// Classifying shell commands into read / search / test. A deterministic rule over the captured
// command text — always labelled derived, never presented as the harness's own statement.

import { isTestCommand } from './tests.ts';

export type ShellClass =
  | { kind: 'test' }
  | { kind: 'read'; path: string; start?: number; end?: number }
  | { kind: 'search'; query: string; path?: string }
  | { kind: 'shell' };

export const SHELL_RULE = 'shell-classify-v1';

/** Split on whitespace, honouring simple quotes. Enough for classification, not a shell parser. */
function words(cmd: string): string[] {
  const out: string[] = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
}

/** The single command we can classify; pipelines and chains are only classified by their head. */
function head(cmd: string): string {
  let c = cmd.trim();
  // `cd dir && cmd` is common in agent shells; the interesting part follows.
  const cd = /^cd\s+("[^"]+"|'[^']+'|\S+)\s*(&&|;)\s*/.exec(c);
  if (cd) c = c.slice(cd[0].length);
  return c.split(/\s*(?:\|\||&&|;|\|)\s*/)[0] ?? c;
}

export function classifyShell(command: string): ShellClass {
  if (isTestCommand(command)) return { kind: 'test' };
  const h = head(command);
  const w = words(h);
  const bin = (w[0] ?? '').split(/[\\/]/).pop()!.toLowerCase().replace(/\.exe$/, '');
  const args = w.slice(1);
  const positional = args.filter((a) => !a.startsWith('-'));
  const isPipeline = h !== command.trim() && /\|/.test(command);

  if (!isPipeline && (bin === 'cat' || bin === 'type' || bin === 'get-content' || bin === 'gc' || bin === 'nl' || bin === 'bat') && positional.length === 1) {
    return { kind: 'read', path: positional[0]! };
  }
  if (bin === 'sed' && args[0] === '-n') {
    const range = /^'?(\d+),(\d+)p'?$/.exec(args[1] ?? '');
    const file = args[2];
    if (range && file && args.length === 3) return { kind: 'read', path: file, start: Number(range[1]), end: Number(range[2]) };
  }
  if ((bin === 'head' || bin === 'tail') && positional.length >= 1) {
    const file = positional.at(-1)!;
    if (!/^\d+$/.test(file)) {
      const n = Number(/-n\s*(\d+)|-(\d+)/.exec(h)?.slice(1).find(Boolean) ?? 10);
      return bin === 'head' ? { kind: 'read', path: file, start: 1, end: n } : { kind: 'read', path: file };
    }
  }
  if (bin === 'rg' || bin === 'grep' || bin === 'ag' || bin === 'ack' || bin === 'findstr' || bin === 'select-string' || (bin === 'git' && args[0] === 'grep')) {
    const a = bin === 'git' ? positional.slice(1) : positional;
    // `rg --files` lists files; there is no query.
    if (args.includes('--files')) return { kind: 'search', query: '--files', path: a[0] };
    const patFlag = args.findIndex((x) => x === '-e' || x === '--regexp' || x === '-Pattern');
    const query = patFlag >= 0 ? args[patFlag + 1] : a[0];
    if (query) return { kind: 'search', query, path: patFlag >= 0 ? a[0] : a[1] };
  }
  if ((bin === 'fd' || bin === 'find') && positional.length) return { kind: 'search', query: positional.join(' ') };
  return { kind: 'shell' };
}

/** Parse "path:line:text" or "path:text" hit lines from search output. */
/**
 * A text-parsed search hit is registered as a file only if it could be one (BUG-8). Everything before `:NN:` used to
 * count as a path, so a grep over test output (`ok 146 tests/a.spec.ts:12:1 › title`, `[270/408] tests/a.spec.ts:…`,
 * `1) tests/a.spec.ts:…`) invented files and folders. A relative path has no whitespace; an absolute path may.
 */
export function plausibleHitPath(path: string): boolean {
  const p = path.trim();
  if (!p || p !== path) return false;
  if (/^(?:[a-zA-Z]:[\\/]|[\\/]|~[\\/])/.test(p)) return !/[\r\n\t]/.test(p);
  return !/\s/.test(p);
}

export function parseHitLines(output: string, max = 200): { path: string; line?: number; text?: string }[] {
  const hits: { path: string; line?: number; text?: string }[] = [];
  for (const raw of output.split('\n')) {
    if (hits.length >= max) break;
    const l = raw.replace(/\r$/, '');
    if (!l.trim()) continue;
    // Windows drive letters contain a colon; match it as part of the path.
    const m = /^((?:[a-zA-Z]:)?[^:\n]+?):(\d+):(?:\d+:)?(.*)$/.exec(l);
    if (m) hits.push({ path: m[1]!, line: Number(m[2]), text: m[3]!.slice(0, 400) });
    else if (/^[\w./\\-]+\.\w+$/.test(l.trim())) hits.push({ path: l.trim() });
  }
  return hits;
}
