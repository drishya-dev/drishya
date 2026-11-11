import { execFile } from 'node:child_process';
import { redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';
import type { App } from './app.ts';
import type { GithubReply } from './link-types.ts';

// LINK-1: GitHub PR and issue hover cards. Drishya holds no token and calls no GitHub endpoint itself. When the person opts in
// (Settings), a card for a github.com pull request or issue URL is answered by the person's own installed, signed-in `gh` CLI,
// with fixed argv and no shell. Only URLs of the exact shape https://github.com/<owner>/<repo>/(pull|issues)/<n> are accepted,
// so this never fetches an arbitrary URL. Replies are cached for the daemon's lifetime.

export type GhRun = (args: string[], signal: AbortSignal) => Promise<string>;

export type { GithubItem, GithubReply } from './link-types.ts';

const META_KEY = 'github-links-optin-v1';
const URL_SHAPE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\/(pull|issues)\/([1-9]\d{0,8})(?:[/?#].*)?$/;

export function parseGithubUrl(value: string): { owner: string; repo: string; kind: 'pull' | 'issue'; number: number } | undefined {
  const m = URL_SHAPE.exec(value.trim());
  if (!m || m[2] === '.' || m[2] === '..') return undefined;
  return { owner: m[1]!, repo: m[2]!, kind: m[3] === 'pull' ? 'pull' : 'issue', number: Number(m[4]) };
}

const defaultRun: GhRun = (args, signal) => new Promise((yes, no) => {
  execFile('gh', args, { signal, timeout: 15_000, maxBuffer: 256 * 1024, windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' } }, (error, stdout, stderr) => {
    if (error) { const e = error as NodeJS.ErrnoException & { stderr?: string }; e.stderr = String(stderr).slice(0, 400); no(e); } else yes(stdout);
  });
});

const text = (value: unknown, max: number) => typeof value === 'string' ? redactText(value.replace(/[\x00-\x1f\x7f]/g, ' ')).text.slice(0, max) : undefined;
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

export class GithubLinks {
  private cache = new Map<string, GithubReply>();
  private available: boolean | undefined;
  private app: App;
  private run: GhRun;
  constructor(app: App, run: GhRun = defaultRun) { this.app = app; this.run = run; }

  get enabled(): boolean {
    const row = this.app.store.db.prepare('SELECT value FROM meta WHERE key=?').get(META_KEY) as { value: string } | undefined;
    return row?.value === '1';
  }
  set(enabled: boolean) {
    this.app.store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(META_KEY, enabled ? '1' : '0');
    if (!enabled) this.cache.clear();
    return this.status();
  }
  /** `gh` is not run at all until the person opts in; its `--version` is local and never touches the network. */
  async status(): Promise<{ enabled: boolean; available?: boolean }> {
    if (!this.enabled) return { enabled: false };
    if (this.available === undefined) this.available = await this.run(['--version'], AbortSignal.timeout(5_000)).then(() => true, () => false);
    return { enabled: true, available: this.available };
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
