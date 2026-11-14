import { execFile } from 'node:child_process';
import { redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';
import type { App } from './app.ts';
import type { GithubReply } from './link-types.ts';

// LINK-1: GitHub PR and issue hover cards. Drishya holds no token and calls no GitHub endpoint itself. When the person opts in
// (Settings), a card for a github.com pull request or issue URL is answered by the person's own installed, signed-in `gh` CLI,
// with fixed argv and no shell. Only URLs of the exact shape https://github.com/<owner>/<repo>/(pull|issues)/<n> are accepted,
// so this never fetches an arbitrary URL. Replies are cached for the daemon's lifetime.

export type GhRun = (args: string[], signal: AbortSignal, maxBuffer?: number) => Promise<string>;

export type { GithubItem, GithubReply } from './link-types.ts';

const META_KEY = 'github-links-optin-v1';
const URL_SHAPE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\/(pull|issues)\/([1-9]\d{0,8})(?:[/?#].*)?$/;

export function parseGithubUrl(value: string): { owner: string; repo: string; kind: 'pull' | 'issue'; number: number } | undefined {
  const m = URL_SHAPE.exec(value.trim());
  if (!m || m[2] === '.' || m[2] === '..') return undefined;
  return { owner: m[1]!, repo: m[2]!, kind: m[3] === 'pull' ? 'pull' : 'issue', number: Number(m[4]) };
}

export const defaultGhRun: GhRun = (args, signal, maxBuffer = 256 * 1024) => new Promise((yes, no) => {
  execFile('gh', args, { signal, timeout: 15_000, maxBuffer, windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' } }, (error, stdout, stderr) => {
    if (error) { const e = error as NodeJS.ErrnoException & { stderr?: string }; e.stderr = String(stderr).slice(0, 400); no(e); } else yes(stdout);
  });
});

const text = (value: unknown, max: number) => typeof value === 'string' ? redactText(value.replace(/[\x00-\x1f\x7f]/g, ' ')).text.slice(0, max) : undefined;
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

export class GithubLinks {
  private cache = new Map<string, GithubReply>();
  private mergedCache = new Map<string, { at: number; pulls: { number: number; headRef: string; headOid: string; mergeCommit: string }[] }>();
  private pullCache = new Map<string, { status: 'ready' | 'not-found'; pull?: { number: number; headRef: string; headOid: string; mergeCommit?: string; merged: boolean } }>();
  private available: boolean | undefined;
  private app: App;
  private run: GhRun;
  constructor(app: App, run: GhRun = defaultGhRun) { this.app = app; this.run = run; }

  get enabled(): boolean {
    const row = this.app.store.db.prepare('SELECT value FROM meta WHERE key=?').get(META_KEY) as { value: string } | undefined;
    return row?.value === '1';
  }
  set(enabled: boolean) {
    this.app.store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(META_KEY, enabled ? '1' : '0');
    if (!enabled) { this.cache.clear(); this.mergedCache.clear(); this.pullCache.clear(); }
    return this.status();
  }
  /** `gh` is not run at all until the person opts in; its `--version` is local and never touches the network. */
  async status(): Promise<{ enabled: boolean; available?: boolean }> {
    if (!this.enabled) return { enabled: false };
    if (this.available === undefined) this.available = await this.run(['--version'], AbortSignal.timeout(5_000)).then(() => true, () => false);
    return { enabled: true, available: this.available };
  }
  /** GIT-8: why `gh` could not answer, in the words Compare shows. Never a guess about the network. */
  private failure(error: unknown): 'gh-missing' | 'gh-unauthenticated' | 'failed' {
    const stderr = String((error as { stderr?: string }).stderr ?? '');
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'gh-missing' : /not logged in|authentication|auth login|GH_TOKEN|HTTP 401/i.test(stderr) ? 'gh-unauthenticated' : 'failed';
  }
  /** GIT-11: recently merged PRs of a repository, through the same opt-in, read-only `gh api` as open PRs. */
  async mergedPulls(repo: string): Promise<{ status: 'ready' | 'disabled' | 'gh-missing' | 'gh-unauthenticated' | 'failed'; pulls: { number: number; headRef: string; headOid: string; mergeCommit: string }[] }> {
    if (!this.enabled) return { status: 'disabled', pulls: [] };
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) return { status: 'failed', pulls: [] };
    const cached = this.mergedCache.get(repo.toLowerCase());
    if (cached && Date.now() - cached.at < 60_000) return { status: 'ready', pulls: cached.pulls };
    if (!(await this.status()).available) return { status: 'gh-missing', pulls: [] };
    try {
      const out = await this.run(['api', `repos/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`], AbortSignal.timeout(15_000), 4 * 1024 * 1024);
      const rows = JSON.parse(out) as Record<string, unknown>[];
      const pulls = rows.flatMap(row => {
        if (typeof row.merged_at !== 'string' || !row.merged_at) return [];
        const head = row.head as { sha?: unknown; ref?: unknown } | undefined;
        const number = count(row.number);
        const headOid = typeof head?.sha === 'string' && /^[a-f0-9]{40,64}$/.test(head.sha) ? head.sha : undefined;
        const mergeCommit = typeof row.merge_commit_sha === 'string' && /^[a-f0-9]{40,64}$/.test(row.merge_commit_sha) ? row.merge_commit_sha : undefined;
        const headRef = text(head?.ref, 200);
        if (!number || !headOid || !mergeCommit || !headRef) return [];
        return [{ number, headRef, headOid, mergeCommit }];
      });
      if (this.mergedCache.size > 32) this.mergedCache.clear();
      this.mergedCache.set(repo.toLowerCase(), { at: Date.now(), pulls });
      return { status: 'ready', pulls };
    } catch (error) { return { status: this.failure(error), pulls: [] }; }
  }
  /** GIT-11: single PR lookup for `(#N)` squash commit subjects when not already present in recent merged PRs. */
  async pull(repo: string, number: number): Promise<{ status: 'ready' | 'disabled' | 'gh-missing' | 'gh-unauthenticated' | 'not-found' | 'failed'; pull?: { number: number; headRef: string; headOid: string; mergeCommit?: string; merged: boolean } }> {
    if (!this.enabled) return { status: 'disabled' };
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(repo) || !Number.isSafeInteger(number) || number < 1 || number > 999_999_999) return { status: 'failed' };
    const key = `${repo.toLowerCase()}#${number}`;
    const cached = this.pullCache.get(key);
    if (cached) return cached;
    if (!(await this.status()).available) return { status: 'gh-missing' };
    try {
      const out = await this.run(['api', `repos/${repo}/pulls/${number}`], AbortSignal.timeout(15_000), 1024 * 1024);
      const row = JSON.parse(out) as Record<string, unknown>;
      const head = row.head as { sha?: unknown; ref?: unknown } | undefined;
      const headOid = typeof head?.sha === 'string' && /^[a-f0-9]{40,64}$/.test(head.sha) ? head.sha : undefined;
      const mergeCommit = typeof row.merge_commit_sha === 'string' && /^[a-f0-9]{40,64}$/.test(row.merge_commit_sha) ? row.merge_commit_sha : undefined;
      const headRef = text(head?.ref, 200);
      const merged = typeof row.merged_at === 'string' && !!row.merged_at;
      if (!headOid || !headRef) return { status: 'failed' };
      const reply = { status: 'ready' as const, pull: { number, headRef, headOid, ...(mergeCommit ? { mergeCommit } : {}), merged } };
      if (merged) {
        if (this.pullCache.size > 500) this.pullCache.clear();
        this.pullCache.set(key, reply);
      }
      return reply;
    } catch (error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '');
      if (/Could not resolve|HTTP 404|Not Found/i.test(stderr)) {
        const nf = { status: 'not-found' as const };
        if (this.pullCache.size > 500) this.pullCache.clear();
        this.pullCache.set(key, nf);
        return nf;
      }
      return { status: this.failure(error) };
    }
  }
  /** Open pull requests of one repository, through the same opt-in, read-only `gh` as the hover cards. */
  async pulls(repo: string): Promise<{ status: 'ready' | 'disabled' | 'gh-missing' | 'gh-unauthenticated' | 'failed'; pulls: { number: number; title: string; author?: string; draft?: boolean; url: string; baseName: string; headName: string; headOid: string }[] }> {
    if (!this.enabled) return { status: 'disabled', pulls: [] };
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(repo)) return { status: 'failed', pulls: [] };
    if (!(await this.status()).available) return { status: 'gh-missing', pulls: [] };
    try {
      // REST (`gh api`), not `gh pr list`: it is read-only too, and it draws on GitHub's core budget rather than the smaller GraphQL one.
      const out = await this.run(['api', `repos/${repo}/pulls?state=open&per_page=40&sort=updated&direction=desc`], AbortSignal.timeout(15_000), 4 * 1024 * 1024);
      const rows = JSON.parse(out) as Record<string, unknown>[];
      const pulls = rows.flatMap(row => {
        const head = row.head as { sha?: unknown; ref?: unknown } | undefined, base = row.base as { ref?: unknown } | undefined;
        const number = count(row.number), headOid = typeof head?.sha === 'string' && /^[a-f0-9]{40,64}$/.test(head.sha) ? head.sha : undefined;
        const baseName = text(base?.ref, 200), headName = text(head?.ref, 200);
        if (!number || !headOid || !baseName || !headName) return [];
        const author = row.user && typeof row.user === 'object' ? text((row.user as { login?: unknown }).login, 80) : undefined;
        return [{ number, title: text(row.title, 300) ?? '', ...(author ? { author } : {}), ...(row.draft === true ? { draft: true } : {}), url: `https://github.com/${repo}/pull/${number}`, baseName, headName, headOid }];
      });
      return { status: 'ready', pulls };
    } catch (error) { return { status: this.failure(error), pulls: [] }; }
  }
  /** GitHub's compare of a base branch and a head commit that is not on this machine. Read-only (`gh api` GET). */
  async compare(repo: string, baseName: string, headOid: string): Promise<{ status: 'ready'; value: unknown } | { status: 'disabled' | 'gh-missing' | 'gh-unauthenticated' | 'failed' }> {
    if (!this.enabled) return { status: 'disabled' };
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(repo) || !/^[a-f0-9]{40,64}$/.test(headOid) || !baseName || baseName.length > 200) return { status: 'failed' };
    if (!(await this.status()).available) return { status: 'gh-missing' };
    try {
      const out = await this.run(['api', `repos/${repo}/compare/${encodeURIComponent(baseName)}...${headOid}`], AbortSignal.timeout(15_000), 8 * 1024 * 1024);
      return { status: 'ready', value: JSON.parse(out) };
    } catch (error) { return { status: this.failure(error) }; }
  }
  async item(url: string): Promise<GithubReply> {
    if (!this.enabled) return { status: 'disabled' };
    const target = parseGithubUrl(url);
    if (!target) throw new HttpError(400, 'Only github.com pull request and issue addresses can be looked up.');
    const key = `${target.owner}/${target.repo}/${target.kind}/${target.number}`.toLowerCase();
    const cached = this.cache.get(key); if (cached) return cached;
    if (!(await this.status()).available) return { status: 'gh-missing' };
    const view = target.kind === 'pull' ? 'pr' : 'issue';
    const fields = target.kind === 'pull' ? 'state,title,author,additions,deletions,changedFiles,url,isDraft,mergedAt' : 'state,title,author,url';
    let reply: GithubReply;
    try {
      const out = await this.run([view, 'view', String(target.number), '--repo', `${target.owner}/${target.repo}`, '--json', fields], AbortSignal.timeout(15_000));
      const raw = JSON.parse(out) as Record<string, unknown>;
      const author = raw.author && typeof raw.author === 'object' ? text((raw.author as { login?: unknown }).login, 80) : undefined;
      reply = { status: 'ready', item: {
        kind: target.kind, owner: target.owner, repo: target.repo, number: target.number,
        state: text(raw.state, 20)?.toLowerCase() ?? 'unknown', title: text(raw.title, 300) ?? '', ...(author ? { author } : {}),
        url: `https://github.com/${target.owner}/${target.repo}/${target.kind === 'pull' ? 'pull' : 'issues'}/${target.number}`,
        ...(raw.isDraft === true ? { draft: true } : {}), ...(typeof raw.mergedAt === 'string' ? { merged: true } : {}),
        ...(target.kind === 'pull' ? { additions: count(raw.additions), deletions: count(raw.deletions), changedFiles: count(raw.changedFiles) } : {}),
      } };
    } catch (error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '');
      reply = { status: /not logged in|authentication|auth login|GH_TOKEN|HTTP 401/i.test(stderr) ? 'gh-unauthenticated' : /Could not resolve|HTTP 404|not found/i.test(stderr) ? 'not-found' : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'gh-missing' : 'failed' };
      // Transient failures are not remembered; a signed-in retry or a later network must be able to succeed.
      if (reply.status !== 'not-found') return reply;
    }
    if (this.cache.size > 500) this.cache.clear();
    this.cache.set(key, reply);
    return reply;
  }
}
