import { redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';
import { gitDiffFlags } from './git-paths.ts';

type Git = (args: string[]) => Promise<string>;
import type { GitRefSummary } from './link-types.ts';
export type { GitRefSummary } from './link-types.ts';

const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const commitShape = /^[0-9a-f]{7,40}$/i;
const branchShape = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$/;
const clean = (text: string, limit: number) => { const value = redactText(text).text; return value.length > limit ? value.slice(0, limit) + '…' : value; };

/** LINK-1: the facts a hover card shows for a commit or local branch named in prose. Read-only, bounded, and never a patch. */
export async function gitRefSummary(git: Git, rev: string): Promise<GitRefSummary> {
  const isCommit = commitShape.test(rev);
  if (!isCommit && (!branchShape.test(rev) || rev.endsWith('.lock') || rev.endsWith('/'))) throw new HttpError(400, 'Invalid Git reference.');
  const candidates = isCommit ? [`${rev}^{commit}`] : [`refs/heads/${rev}^{commit}`, `refs/remotes/origin/${rev}^{commit}`];
  let sha = '';
  for (const candidate of candidates) {
    sha = (await git(['rev-parse', '--verify', '--quiet', '--end-of-options', candidate]).catch(() => '')).trim();
    if (oid.test(sha)) break;
    sha = '';
  }
  if (!sha) return { found: false };
  const [fields] = (await git(['show', '--no-patch', '--no-show-signature', '--no-notes', '--format=%an%x00%aI%x00%s', '--end-of-options', sha, '--'])).split('\n');
  const [author = '', date = '', subject = ''] = (fields ?? '').split('\0');
  const stat = (await git(['diff-tree', ...gitDiffFlags, '--root', '-r', '--numstat', '--no-commit-id', '-m', '--first-parent', '--end-of-options', sha, '--']).catch(() => '')).split('\n').filter(Boolean);
  let additions = 0, deletions = 0;
  for (const row of stat) { const [a, d] = row.split('\t'); if (a !== '-') additions += Number(a) || 0; if (d !== '-') deletions += Number(d) || 0; }
  return { found: true, kind: isCommit ? 'commit' : 'branch', ...(isCommit ? {} : { name: clean(rev, 100) }), hash: sha, subject: clean(subject, 200), author: clean(author, 80), date: date.slice(0, 40), additions, deletions, files: stat.length };
}
