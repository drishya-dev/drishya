// A small, fast tokenizer for display — GitHub Dark colours. Not a parser; it only has to be
// right often enough to help reading. CodeMirror replaces it in the full reader.

import type { ReactNode } from 'react';

const KEYWORDS = new Set(
  'abstract as async await break case catch class const continue debugger def default del delete do elif else enum except export extends false finally for from function global if implements import in instanceof interface is lambda let new nonlocal None not null of or pass private protected public raise readonly return static super switch this throw true True False try type typeof undefined var void while with yield fn pub mut impl struct use mod match func package go defer chan select'.split(' '),
);

type Tok = { t: 'kw' | 'str' | 'com' | 'num' | 'fn' | 'type' | 'property' | 'plain'; s: string };

const RE = /(\/\/.*$|#(?![!{[]).*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\d_.]*(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/gm;

export function tokenize(line: string, lang?: string): Tok[] {
  const out: Tok[] = [];
  let last = 0;
  const hashComments = lang === 'python' || lang === 'shell' || lang === 'yaml' || lang === 'toml' || lang === 'ruby';
  for (const m of line.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: 'plain', s: line.slice(last, i) });
    if (m[1]) {
      if (m[1].startsWith('#') && !hashComments) out.push({ t: 'plain', s: m[1] });
      else out.push({ t: 'com', s: m[1] });
    } else if (m[2]) out.push({ t: 'str', s: m[2] });
    else if (m[3]) out.push({ t: 'num', s: m[3] });
    else if (m[4]) out.push({ t: KEYWORDS.has(m[4]) ? 'kw' : 'fn', s: m[4] });
    else if (m[5]) out.push({ t: KEYWORDS.has(m[5]) ? 'kw' : /^[A-Z]/.test(m[5]) ? 'type' : line[i - 1] === '.' || /^\s*:/.test(line.slice(i + m[5].length)) ? 'property' : 'plain', s: m[5] });
    last = i + m[0].length;
  }
  if (last < line.length) out.push({ t: 'plain', s: line.slice(last) });
  return out;
}

export function Highlighted({ line, lang }: { line: string; lang?: string }): ReactNode {
  if (line.length > 2000) return line;
  return tokenize(line, lang).map((t, i) => (t.t === 'plain' ? t.s : <span key={i} className={`tk-${t.t}`}>{t.s}</span>));
}

export function langOf(path: string | undefined): string | undefined {
  const ext = path?.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'].includes(ext)) return 'typescript';
  if (ext === 'py') return 'python';
  if (['sh', 'bash', 'zsh', 'ps1'].includes(ext)) return 'shell';
  if (['yml', 'yaml'].includes(ext)) return 'yaml';
  if (ext === 'toml') return 'toml';
  if (ext === 'rb') return 'ruby';
  return ext;
}
