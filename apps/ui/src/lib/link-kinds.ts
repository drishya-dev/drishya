// LINK-1: what a link in agent prose or a web tool card is, decided from its text alone. Nothing here reads a file, a repository or
// the network; the hover card asks the daemon only when the person points at a link.

export type LinkKind = 'url' | 'github' | 'commit' | 'branch';

/** A plain http(s) address without credentials. Anything else is never made clickable. */
export function webUrl(value: string): string | undefined {
  if (!/^https?:\/\/[^\s\x00-\x1f]+$/i.test(value)) return;
  try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? value : undefined; } catch { return; }
}

export interface GithubTarget { owner: string; repo: string; kind: 'pull' | 'issue'; number: number }
/** The same exact shape the daemon accepts: https://github.com/<owner>/<repo>/(pull|issues)/<n>. */
export function githubTarget(value: string): GithubTarget | undefined {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/(pull|issues)\/([1-9]\d{0,8})(?:[/?#].*)?$/.exec(value);
  return m && m[2] !== '.' && m[2] !== '..' ? { owner: m[1]!, repo: m[2]!, kind: m[3] === 'pull' ? 'pull' : 'issue', number: Number(m[4]) } : undefined;
}

export const linkKind = (url: string): LinkKind => githubTarget(url) ? 'github' : 'url';

/** A hex word that could be an abbreviated or full commit id. It is only a candidate: the daemon verifies it against the repository. */
export function commitCandidate(token: string): boolean {
  if (!/^[0-9a-f]{7,40}$/i.test(token)) return false;
  // Plain words and plain numbers are not commits: require both digits and letters, or a long id.
  return /\d/.test(token) && /[a-f]/i.test(token) || token.length >= 12 && /[a-f]/i.test(token);
}

const BRANCH_PREFIX = /^(?:feature|feat|fix|bugfix|hotfix|release|chore|refactor|codex|claude|users|dependabot|yash|harsh)\/[A-Za-z0-9._/-]{1,90}$/;
/** An inline-code token that is the session's recorded branch, or has a conventional branch prefix. Verified by the daemon on hover. */
export function branchCandidate(token: string, recorded?: string): boolean {
  if (recorded && token === recorded) return true;
  return BRANCH_PREFIX.test(token) && !/\.\.|\/$|\.lock$/.test(token) && !/\.[a-z0-9]{1,5}$/i.test(token.split('/').at(-1)!);
}

export type TextPart = { text: string } | { url: string };
/** Split prose into text and bare http(s) addresses. Trailing sentence punctuation and an unmatched closing bracket stay text. */
export function splitUrls(text: string): TextPart[] {
  const parts: TextPart[] = []; let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`\[\]{}\\^|]+/gi)) {
    let url = match[0]; const start = match.index!;
    while (/[.,;:!?'")\]}*_]$/.test(url)) {
      if (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
      url = url.slice(0, -1);
    }
    if (!webUrl(url)) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ url }); last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export const hostOf = (url: string) => { try { return new URL(url).host; } catch { return ''; } };
