import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { redactText } from '@drishya/privacy';
import {safeGitPath as safe,gitDiffFlags as diffFlags} from './git-paths.ts';
import {GitHistoryCache,gitHistory,gitCommit,gitRefGeneration,verifyGitHistoryGeneration,type GitHistoryQuery} from './git-history.ts';
import { HttpError } from './app.ts';
import { executable } from './native-executable.ts';
import { verifyOwnGitDir, type WorkspaceAccess } from './workspace.ts';

import type { GitFile, GitSnapshot, GitOmission } from './git-types.ts';
import type {HistoryService} from './history.ts';
import {gitSessionContext} from './git-session-context.ts';
import {gitRefSummary} from './git-ref.ts';
import {githubRepo} from './git-compare.ts';
import type {GithubLinks} from './github-links.ts';
import type {GitGithubSquashMatch} from './git-types.ts';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Commands that read only Git's object store and refs. They never look at working-tree files, so no content filter can run. */
const OBJECT_ONLY = new Set(['log', 'show', 'cat-file', 'rev-parse', 'for-each-ref', 'merge-base', 'symbolic-ref', 'rev-list', 'show-ref', 'ls-tree', 'config']);

function subcommandOf(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c') { i++; continue; }
    if (!args[i]!.startsWith('-')) return args[i]!;
  }
  return '';
}

/**
 * `-c` overrides that switch off every content filter a repository's own configuration defines. A clean or
 * process filter is a program, and `git status` or `git diff` runs it on working-tree files to compare them
 * with the index. The configured names are read on every call, because a repository can change underneath us.
 */
async function filterOverrides(root: string, signal?: AbortSignal): Promise<string[]> {
  const keys = await runGit(root, ['config', '--list', '--name-only'], signal);
  const drivers = [...new Set(keys.split(/\r?\n/).filter(key => /^filter\..+\.(clean|smudge|process|required)$/i.test(key)).map(key => key.replace(/\.[^.]+$/, '')))];
  if (drivers.length > 64) throw new HttpError(422, 'Too many configured Git filters for bounded read-only inspection.');
  return drivers.flatMap(driver => ['-c', `${driver}.clean=`, '-c', `${driver}.smudge=`, '-c', `${driver}.process=`, '-c', `${driver}.required=false`]);
}

/** Fixed argv without a shell. Any command that can touch working-tree files runs with the repository's content filters switched off (SEC-3). */
export async function readGit(root: string, args: string[], signal?: AbortSignal): Promise<string> {
  const overrides = OBJECT_ONLY.has(subcommandOf(args)) ? [] : await filterOverrides(root, signal);
  return runGit(root, [...overrides, ...args], signal);
}

function runGit(root: string, args: string[], signal?: AbortSignal): Promise<string> {
  const bin = executable('git');
  if (!bin) return Promise.reject(new HttpError(422, 'Git is unavailable on the configured PATH.'));
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
  // Ambient override variables must not redirect this reader to a different worktree/config.
  for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|SHALLOW_FILE|REPLACE_REF_BASE|GRAFT_FILE|INDEX_FILE|CONFIG.*|EXTERNAL_DIFF|DIFF_OPTS)$/.test(key)) delete (env as Record<string, string | undefined>)[key];
  return new Promise((yes, no) => {
    let result:{error:Error|null;stdout:string}|undefined;
    const child=execFile(bin, ['--no-pager','--no-replace-objects','--no-optional-locks', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd: root, env, signal, timeout: 10_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (error, stdout) => {result={error,stdout};});
    // Abort emits an error before the native process has necessarily exited.
    // Joining the callback alone lets Windows checkout cleanup race that child.
    child.once('close',()=>{
      const error=result?.error;
      if(error && String((error as NodeJS.ErrnoException).code)==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER')no(new HttpError(413,'Git output exceeds the inspection content limit.'));
      else if(error || !result)no(new HttpError(422,'Git inspection failed or exceeded its time/content limit. Check Git installation and repository state.'));
      else yes(result.stdout);
    });
  });
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

const GIT_TURN_LIMIT = 8;

/** Consent is per daemon lifetime. Snapshots are returned redacted, never stored as history. */
export class GitReview {
  private grants = new Set<string>();
  private turns = new Map<string, { tail: Promise<unknown>; waiting: number }>();
  private historyCache = new GitHistoryCache(64);
  private workspace: WorkspaceAccess;
  private read: GitReader;
  private historyService?:HistoryService;
  private github?:GithubLinks;
  private shutdown=new AbortController();
  private closing:Promise<void>|undefined;
  private removeCloseOwner:()=>void;
  constructor(workspace: WorkspaceAccess, read: GitReader = readGit, historyService?:HistoryService, github?:GithubLinks) { this.workspace = workspace; this.read = read; this.historyService=historyService; this.github=github; this.removeCloseOwner=workspace.onClose(()=>this.close()); }
  async close():Promise<void>{
    this.closing??=(async()=>{
      this.shutdown.abort();
      await Promise.allSettled([...this.turns.values()].map(turn=>turn.tail));
      this.removeCloseOwner();
    })();
    return this.closing;
  }
  revoke(id: string) { this.grants.delete(id); }
  status(id: string) { return { approved: this.grants.has(id), scope: 'current-git' as const }; }
  async approve(id: string) { await this.workspace.root(id); this.grants.add(id); return this.status(id); }
  /** One Git read per recording at a time. Moving between the Git surfaces waits its turn instead of failing. */
  private async inTurn<T>(id:string,read:()=>Promise<T>):Promise<T> {
    if(this.shutdown.signal.aborted)throw new HttpError(503,'Git inspection is closing.');
    const turn=this.turns.get(id)??{tail:Promise.resolve(),waiting:0};
    if(turn.waiting>=GIT_TURN_LIMIT)throw new HttpError(409,'Git inspection is already running.');
    turn.waiting++;this.turns.set(id,turn);
    const run=turn.tail.then(()=>{if(this.shutdown.signal.aborted)throw new HttpError(503,'Git inspection is closing.');return read();});
    turn.tail=run.catch(()=>undefined);
    try{return await run;}
    finally{if(--turn.waiting===0)this.turns.delete(id);}
  }
  private async readHistory<T>(id:string,inspect:(git:(args:string[])=>Promise<string>,root:string)=>Promise<T>):Promise<T> {
    if(!this.grants.has(id))throw new HttpError(403,'Approve read-only Git inspection separately.');
    return this.inTurn(id,async()=>{
      const signal=AbortSignal.any([AbortSignal.timeout(30_000),this.shutdown.signal]);
      const root=await this.workspace.root(id),git=(args:string[])=>this.read(root,args,signal);
      if(await realpath(resolve((await git(['rev-parse','--show-toplevel'])).trim()))!==root)throw new HttpError(403,'The selected workspace must be the repository root.');
      await verifyOwnGitDir(root); // SEC-4: for the History/Compare/Graph surfaces — the toplevel check above does not see where Git keeps history, only the work tree.
      const result=await inspect(git,root);
      if(signal.aborted)throw new HttpError(409,'Git inspection expired or its consent was revoked.');
      if(!this.grants.has(id)||await this.workspace.root(id)!==root)throw new HttpError(403,'Git reading access changed. Approve this workspace again.');
      return result;
    });
  }
  /** GIT-8: Compare reads through the same consent, turn and repository-root checks as History. */
  inspect<T>(id:string,read:(git:(args:string[])=>Promise<string>)=>Promise<T>):Promise<T> {return this.readHistory(id,git=>read(git));}
  generation(id:string) {return this.readHistory(id,async (git,root)=>{const generation=await gitRefGeneration(git);this.historyCache.syncGeneration(root,generation);return {generation};});}
  history(id:string,query:GitHistoryQuery={}) {return this.readHistory(id,async (git,root)=>{
    const page=await gitHistory(git,query,{root,cache:this.historyCache});
    const [sessionData,githubPulls]=await Promise.all([
      (async()=>{
        if(!this.historyService||id.includes('+'))return undefined;
        const context=await gitSessionContext(git,page.commits.map(commit=>commit.hash),page.start===0,path=>this.workspace.read(id,path,0,5001),root);
        const evidenceQuery={commits:context.query.commits.map(commit=>({...commit,paths:commit.paths.map(path=>this.workspace.evidencePath(id,path))})),working:context.query.working.map(file=>({...file,path:this.workspace.evidencePath(id,file.path)}))};
        const evidence=await this.historyService.gitSessionEvidence(this.workspace.evidenceId(id),evidenceQuery);
        return {evidence,omitted:context.omitted};
      })(),
      this.resolveGithubPulls(git,page),
    ]);
    // Check refs again after reading patches and captured evidence.
    await verifyGitHistoryGeneration(git,page.generation);
    return {
      ...page,
      ...(githubPulls.length?{githubPulls}:{}),
      ...(sessionData?{sessionLinks:sessionData.evidence.links,...(page.start===0?{workingTree:{files:sessionData.evidence.working.map(file=>({...file,path:this.workspace.currentPath(id,file.path)})),omitted:sessionData.omitted}}:{})}:{}),
    };
  });}
  private async resolveGithubPulls(git:(args:string[])=>Promise<string>,page:Awaited<ReturnType<typeof gitHistory>>):Promise<GitGithubSquashMatch[]> {
    if(!this.github?.enabled)return [];
    const repo=await githubRepo(git);
    if(!repo)return [];
    const mergedReply=await this.github.mergedPulls(repo);
    const rawMatches:GitGithubSquashMatch[]=mergedReply.status==='ready'?mergedReply.pulls.map(p=>({pr:p.number,headRef:p.headRef,headOid:p.headOid,mergeCommit:p.mergeCommit,basis:'github-pr' as const})):[];
    const seenPr=new Set(rawMatches.map(m=>m.pr));
    const subjectNums:number[]=[];
    for(const commit of page.commits){
      const m=/\(#([1-9]\d{0,8})\)\s*$/.exec(commit.subject);
      const n=m?Number(m[1]):0;
      if(n&&!seenPr.has(n)){seenPr.add(n);subjectNums.push(n);}
    }
    for(const n of subjectNums.slice(0,15)){
      const reply=await this.github.pull(repo,n);
      if(reply.status==='ready'&&reply.pull?.merged&&reply.pull.mergeCommit){
        rawMatches.push({pr:reply.pull.number,headRef:reply.pull.headRef,headOid:reply.pull.headOid,mergeCommit:reply.pull.mergeCommit,basis:'github-subject-pr'});
      }
    }
    if(!rawMatches.length)return [];
    const rawRefs=await git(['for-each-ref','--format=%(objectname)%00%(refname)','refs/heads','refs/remotes']).catch(()=>'');
    const tipsByBranch=new Map<string,Set<string>>();
    for(const line of rawRefs.split(/\r?\n/)){
      const [hash,refname]=line.split('\0');
      if(!hash||!refname||/^refs\/remotes\/[^/]+\/HEAD$/.test(refname))continue;
      const short=refname.startsWith('refs/heads/')?refname.slice('refs/heads/'.length):refname.replace(/^refs\/remotes\/[^/]+\//,'');
      let set=tipsByBranch.get(short);if(!set){set=new Set();tipsByBranch.set(short,set);}
      set.add(hash);
    }
    const ancCache=new Map<string,boolean>();
    const isAnc=async(a:string,b:string)=>{const k=`${a}:${b}`;const hit=ancCache.get(k);if(hit!==undefined)return hit;const v=await git(['merge-base','--is-ancestor',a,b]).then(()=>true,()=>false);ancCache.set(k,v);return v;};
    const existsCache=new Map<string,boolean>();
    const hasCommit=async(h:string)=>{const hit=existsCache.get(h);if(hit!==undefined)return hit;const v=(await git(['cat-file','-t',h]).catch(()=>'')).trim()==='commit';existsCache.set(h,v);return v;};
    const out:GitGithubSquashMatch[]=[];
    for(const match of rawMatches){
      const eligible=new Set<string>([match.headOid]);
      const tips=tipsByBranch.get(match.headRef);
      if(tips){
        for(const t of tips){
          if(t===match.headOid)continue;
          if(await isAnc(match.mergeCommit,t))continue;
          if(await hasCommit(match.headOid)&&!(await isAnc(t,match.headOid)))continue;
          eligible.add(t);
        }
      }
      out.push({...match,eligibleTips:[...eligible]});
    }
    return out;
  }
  ref(id:string,rev:string) {return this.readHistory(id,git=>gitRefSummary(git,rev));}
  commit(id:string,hash:string,parent=0,start=0,generation?:string) {return this.readHistory(id,git=>gitCommit(git,hash,parent,start,generation));}
  async snapshot(id: string, start = 0): Promise<GitSnapshot> {
    if (!Number.isSafeInteger(start) || start < 0) throw new HttpError(400, 'Invalid Git page.');
    if (!this.grants.has(id)) throw new HttpError(403, 'Approve read-only Git inspection separately.');
    return this.inTurn(id, () => this.readSnapshot(id, start));
  }
  private async readSnapshot(id: string, start: number): Promise<GitSnapshot> {
    const signal = AbortSignal.any([AbortSignal.timeout(30_000),this.shutdown.signal]);
    const root = await this.workspace.root(id);
    let overrides: string[] = [];
    const git: GitReader = (root, args) => this.read(root, [...overrides, ...args], signal);
    if (await realpath(resolve((await git(root, ['rev-parse', '--show-toplevel'])).trim())) !== root) throw new HttpError(403, 'The selected workspace must be the repository root.');
    await verifyOwnGitDir(root); // SEC-4: for the Snapshot surface — the toplevel check above does not see where Git keeps history, only the work tree.
    // Status/diff may invoke clean/process filters. Disable each configured driver
    // for this invocation only; do not change the repository's configuration.
    const configKeys = await git(root, ['config', '--list', '--name-only']);
    const drivers = [...new Set(configKeys.split('\n').filter(key => /^filter\..+\.(clean|smudge|process|required)$/i.test(key)).map(key => key.replace(/\.[^.]+$/, '')))];
    if (drivers.length > 64) throw new HttpError(422, 'Too many configured Git filters for bounded read-only inspection.');
    overrides = drivers.flatMap(driver => ['-c', `${driver}.clean=`, '-c', `${driver}.smudge=`, '-c', `${driver}.process=`, '-c', `${driver}.required=false`]);
    const head = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
    const branchRef = (await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => 'detached')).trim();
    const branch = redactText(branchRef).text;
    const raw = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=dirty']);
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
    const end = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=dirty']);
    const endHead = await git(root, ['rev-parse', '--verify', 'HEAD']).then(s => s.trim()).catch(() => 'unborn');
    const endBranch = (await git(root, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => 'detached')).trim();
    if (end !== raw || head !== endHead || branchRef !== endBranch || startIndex !== await indexMarker() || startMarkers !== await fileMarkers(root, paths)) throw changed();
    if (configKeys !== await this.read(root, ['config', '--list', '--name-only'], signal)) throw changed();
    await this.workspace.root(id);
    if (!this.grants.has(id) || signal.aborted) throw new HttpError(409, 'Git inspection expired or its consent was revoked.');
    return { scope: 'current-git', head, branch, sampledAt: new Date().toISOString(), fingerprint: digest(head + '\0' + branchRef + '\0' + raw + files.map(f => f.fingerprint).join()), files, omitted: entries.length - files.length, limit: 50, pageStart, totalAllowed: allowed.length, protectedCount: entries.length - allowed.length, omissions };
  }
}
