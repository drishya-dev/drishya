import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeniedPath, redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';
import type { WorkspaceAccess } from './workspace.ts';

import type { GitFile, GitSnapshot } from './git-types.ts';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const safe = (path: string) => !!path && !path.startsWith('.local/') && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(p => p === '..' || p === '.git') && !isDeniedPath(path);

/** No shell, hooks, filters, textconv, external diff, fsmonitor or lazy network fetch. */
function git(root: string, args: string[]): Promise<string> {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
  // Ambient override variables must not redirect this reader to a different worktree/config.
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|CONFIG.*|EXTERNAL_DIFF|DIFF_OPTS)$/.test(key)) delete (env as Record<string, string | undefined>)[key];
  return new Promise((yes, no) => execFile('git', ['--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd: root, env, timeout: 10_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout) => {
    if (error) no(new HttpError(422, 'Git inspection failed or exceeded its time/content limit. Check Git installation and repository state.'));
    else yes(stdout);
  }));
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
  constructor(workspace: WorkspaceAccess) { this.workspace = workspace; }
  revoke(id: string) { this.grants.delete(id); }
  status(id: string) { return { approved: this.grants.has(id), scope: 'current-git' as const }; }
  async approve(id: string) { await this.workspace.root(id); this.grants.add(id); return this.status(id); }
  async snapshot(id: string): Promise<GitSnapshot> {
    if (!this.grants.has(id)) throw new HttpError(403, 'Approve read-only Git inspection separately.');
    if (this.busy.has(id)) throw new HttpError(409, 'Git inspection is already running.');
    this.busy.add(id);
    try {
      const root = await this.workspace.root(id);
      if (await realpath(resolve((await git(root, ['rev-parse', '--show-toplevel'])).trim())) !== root) throw new HttpError(403, 'The selected workspace must be the repository root.');
      const head = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
      const branch = redactText((await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => 'detached')).trim()).text;
      const raw = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
      const entries = parseStatus(raw); const allowed = entries.filter(f => safe(f.path) && (!f.previousPath || safe(f.previousPath)));
      const files: GitFile[] = []; let budget = 1024 * 1024;
      for (const item of allowed.slice(0, 50)) {
        // Untracked content remains behind the existing approved disk reader. Never execute a filter to read it.
        let patch = item.status === '??' ? 'Untracked file. Open on disk to inspect its content.' : '';
        if (!patch) {
          const paths = item.previousPath ? [item.previousPath, item.path] : [item.path];
          const flags = ['--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', '--ignore-submodules=all'];
          const staged = await git(root, ['diff', ...flags, '--cached', '--', ...paths]);
          const working = await git(root, ['diff', ...flags, '--', ...paths]);
          patch = `${staged ? 'Staged changes\n' + staged : ''}${working ? '\nWorking tree changes\n' + working : ''}` || 'No textual patch available (submodule, binary or metadata-only change).';
        }
        const fingerprint = digest(head + '\0' + item.path + '\0' + item.status + '\0' + patch);
        const clean = redactText(patch).text;
        const bytes = Buffer.byteLength(clean);
        if (bytes > budget) break;
        budget -= bytes;
        files.push({ ...item, path: redactText(item.path).text, previousPath: item.previousPath ? redactText(item.previousPath).text : undefined, fingerprint, patch: clean });
      }
      const end = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
      const endHead = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
      if (end !== raw || head !== endHead) throw new HttpError(409, 'Repository changed during inspection. Refresh before reviewing.');
      return { scope: 'current-git', head, branch, fingerprint: digest(head + raw + files.map(f => f.fingerprint).join()), files, omitted: entries.length - files.length, limit: 50 };
    } finally { this.busy.delete(id); }
  }
}
