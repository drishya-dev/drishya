import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { redactText } from '@drishya/privacy';
import {safeGitPath as safe,gitDiffFlags as diffFlags} from './git-paths.ts';
import {gitHistory,gitCommit,type GitHistoryQuery} from './git-history.ts';
import { HttpError } from './app.ts';
import type { WorkspaceAccess } from './workspace.ts';

import type { GitFile, GitSnapshot, GitOmission } from './git-types.ts';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Fixed argv without a shell; snapshot also overrides configured content filters. */
export function readGit(root: string, args: string[], signal?: AbortSignal): Promise<string> {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
  // Ambient override variables must not redirect this reader to a different worktree/config.
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|SHALLOW_FILE|REPLACE_REF_BASE|GRAFT_FILE|INDEX_FILE|CONFIG.*|EXTERNAL_DIFF|DIFF_OPTS)$/.test(key)) delete (env as Record<string, string | undefined>)[key];
  return new Promise((yes, no) => execFile('git', ['--no-pager','--no-replace-objects','--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd: root, env, signal, timeout: 10_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout) => {
    if (error && String(error.code) === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') no(new HttpError(413, 'Git output exceeds the inspection content limit.'));
    else if (error) no(new HttpError(422, 'Git inspection failed or exceeded its time/content limit. Check Git installation and repository state.'));
    else yes(stdout);
  }));
}

type GitReader = typeof readGit;
const changed = () => new HttpError(409, 'Repository changed during inspection. Refresh before reviewing.');

async function fileMarkers(root: string, paths: string[]): Promise<string> {
  const markers = [];
  for (const path of paths) {
    try {
      // Metadata only: do not read untracked/protected content or follow a final symlink.
      const stat = await lstat(resolve(root, path), { bigint: true });
      markers.push(`${path}\0${stat.dev}:${stat.ino}:${stat.mode}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw changed();
      markers.push(`${path}\0missing`);
    }
  }
  return digest(markers.join('\0'));
}

async function patchFor(read: GitReader, root: string, item: { path: string; previousPath?: string; status: string }): Promise<string> {
  if (item.status === '??') return 'Untracked file. Open on disk to inspect its content.';
  const paths = item.previousPath ? [item.previousPath, item.path] : [item.path];
  const staged = await read(root, ['diff', ...diffFlags, '--cached', '--', ...paths]);
  const working = await read(root, ['diff', ...diffFlags, '--', ...paths]);
  return `${staged ? 'Staged changes\n' + staged : ''}${working ? '\nWorking tree changes\n' + working : ''}` || 'No textual patch available (submodule, binary or metadata-only change).';
}

export function parseStatus(text: string): { path: string; previousPath?: string; status: string }[] {
  const fields = text.split('\0'); const files = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!; if (!field) continue;
    const status = field.slice(0, 2), path = field.slice(3);
    const previousPath = /[RC]/.test(status) ? fields[++i] : undefined;
    files.push({ path, previousPath, status });
  }
  return files;
}

/** Consent is per daemon lifetime. Snapshots are returned redacted, never stored as history. */
export class GitReview {
  private grants = new Set<string>();
  private busy = new Set<string>();
  private workspace: WorkspaceAccess;
  private read: GitReader;
  constructor(workspace: WorkspaceAccess, read: GitReader = readGit) { this.workspace = workspace; this.read = read; }
  revoke(id: string) { this.grants.delete(id); }
  status(id: string) { return { approved: this.grants.has(id), scope: 'current-git' as const }; }
  async approve(id: string) { await this.workspace.root(id); this.grants.add(id); return this.status(id); }
  private async readHistory<T>(id:string,inspect:(git:(args:string[])=>Promise<string>)=>Promise<T>):Promise<T> {
    if(!this.grants.has(id))throw new HttpError(403,'Approve read-only Git inspection separately.');
    if(this.busy.has(id))throw new HttpError(409,'Git inspection is already running.');
    this.busy.add(id);
    const signal=AbortSignal.timeout(30_000);
    try{
      const root=await this.workspace.root(id),git=(args:string[])=>this.read(root,args,signal);
      if(await realpath(resolve((await git(['rev-parse','--show-toplevel'])).trim()))!==root)throw new HttpError(403,'The selected workspace must be the repository root.');
      const result=await inspect(git);
      if(!this.grants.has(id)||await this.workspace.root(id)!==root)throw new HttpError(403,'Git reading access changed. Approve this workspace again.');
      return result;
    }finally{this.busy.delete(id);}
  }
  history(id:string,query:GitHistoryQuery={}) {return this.readHistory(id,git=>gitHistory(git,query));}
  commit(id:string,hash:string,parent=0,start=0,generation?:string) {return this.readHistory(id,git=>gitCommit(git,hash,parent,start,generation));}
  async snapshot(id: string, start = 0): Promise<GitSnapshot> {
    if (!Number.isSafeInteger(start) || start < 0) throw new HttpError(400, 'Invalid Git page.');
    if (!this.grants.has(id)) throw new HttpError(403, 'Approve read-only Git inspection separately.');
    if (this.busy.has(id)) throw new HttpError(409, 'Git inspection is already running.');
    this.busy.add(id);
    const signal = AbortSignal.timeout(30_000);
    try {
      const root = await this.workspace.root(id);
      let overrides: string[] = [];
      const git: GitReader = (root, args) => this.read(root, [...overrides, ...args], signal);
      if (await realpath(resolve((await git(root, ['rev-parse', '--show-toplevel'])).trim())) !== root) throw new HttpError(403, 'The selected workspace must be the repository root.');
      // Status/diff may invoke clean/process filters. Disable each configured driver
      // for this invocation only; do not change the repository's configuration.
      const configKeys = await git(root, ['config', '--list', '--name-only']);
      const drivers = [...new Set(configKeys.split('\n').filter(key => /^filter\..+\.(clean|smudge|process|required)$/i.test(key)).map(key => key.replace(/\.[^.]+$/, '')))];
      if (drivers.length > 64) throw new HttpError(422, 'Too many configured Git filters for bounded read-only inspection.');
      overrides = drivers.flatMap(driver => ['-c', `${driver}.clean=`, '-c', `${driver}.smudge=`, '-c', `${driver}.process=`, '-c', `${driver}.required=false`]);
      const head = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
      const branchRef = (await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => 'detached')).trim();
      const branch = redactText(branchRef).text;
      const raw = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
      const entries = parseStatus(raw); const allowed = entries.filter(f => safe(f.path) && (!f.previousPath || safe(f.previousPath)));
      const pageStart = allowed.length ? Math.min(start, Math.floor((allowed.length - 1) / 50) * 50) : 0;
      const candidates = allowed.slice(pageStart, pageStart + 50);
      const omissions: GitOmission[] = [];
      const paths = [...new Set(candidates.flatMap(item => item.previousPath ? [item.previousPath, item.path] : [item.path]))];
      const indexMarker = async () => paths.length ? digest(await git(root, ['ls-files', '--stage', '-z', '--', ...paths])) : '';
      const startIndex = await indexMarker();
      const startMarkers = await fileMarkers(root, paths);
      const checks: { item: typeof candidates[number]; fingerprint: string }[] = [];
      const files: GitFile[] = []; let budget = 1024 * 1024;
      for (let i = 0; i < candidates.length; i += 4) {
        const batch = candidates.slice(i, i + 4);
        const results = await Promise.allSettled(batch.map(item => patchFor(git, root, item)));
        // Consume in status order, independently of subprocess completion order.
        for (const [offset, result] of results.entries()) {
          const item = batch[offset]!;
          if (result.status === 'rejected') {
            if (result.reason instanceof HttpError && result.reason.status === 413) { omissions.push({ path: redactText(item.path).text, reason: 'process-limit' }); continue; }
            throw result.reason;
          }
          const patch = result.value;
          const fingerprint = digest(head + '\0' + item.path + '\0' + item.status + '\0' + patch);
          const clean = redactText(patch).text;
          const bytes = Buffer.byteLength(clean);
          if (bytes > budget) { omissions.push({ path: redactText(item.path).text, reason: 'content-limit' }); continue; }
          budget -= bytes;
          checks.push({ item, fingerprint: digest(patch) });
          files.push({ ...item, path: redactText(item.path).text, previousPath: item.previousPath ? redactText(item.previousPath).text : undefined, fingerprint, patch: clean });
        }
      }
      // Compare raw patches before redaction: two different secrets must not become
      // the same apparent content. Keep only digests between passes, not raw copies.
      // Four readers bound subprocess/buffer pressure while avoiding another fully
      // serial pass across fifty files. Every started reader finishes before exit.
      for (let i = 0; i < checks.length; i += 4) {
        const results = await Promise.allSettled(checks.slice(i, i + 4).map(async check => {
          if (digest(await patchFor(git, root, check.item)) !== check.fingerprint) throw changed();
        }));
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      }
      const end = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
      const endHead = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
      const endBranch = (await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => 'detached')).trim();
      if (end !== raw || head !== endHead || branchRef !== endBranch || startIndex !== await indexMarker() || startMarkers !== await fileMarkers(root, paths)) throw changed();
      if (configKeys !== await this.read(root, ['config', '--list', '--name-only'], signal)) throw changed();
      await this.workspace.root(id);
      if (!this.grants.has(id) || signal.aborted) throw new HttpError(409, 'Git inspection expired or its consent was revoked.');
      return { scope: 'current-git', head, branch, sampledAt: new Date().toISOString(), fingerprint: digest(head + '\0' + branchRef + '\0' + raw + files.map(f => f.fingerprint).join()), files, omitted: entries.length - files.length, limit: 50, pageStart, totalAllowed: allowed.length, protectedCount: entries.length - allowed.length, omissions };
    } finally { this.busy.delete(id); }
  }
}
