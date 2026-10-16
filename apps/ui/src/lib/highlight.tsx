// A small, fast tokenizer for display — GitHub Dark colours. Not a parser; it only has to be
// right often enough to help reading. CodeMirror replaces it in the full reader.

import type { ReactNode } from 'react';

const KEYWORDS = new Set(
  'abstract as async await break case catch class const continue debugger def default del delete do elif else enum except export extends false finally for from function global if implements import in instanceof interface is lambda let new nonlocal None not null of or pass private protected public raise readonly return static super switch this throw true True False try type typeof undefined var void while with yield fn pub mut impl struct use mod match func package go defer chan select'.split(' '),
);

type Tok = { t: 'kw' | 'str' | 'com' | 'num' | 'fn' | 'type' | 'property' | 'plain'; s: string };

const IDENTIFIER = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\d_.]*(?:e[+-]?\d+)?/iy;
const AT_NAME = /@[A-Za-z_][\w./-]*/y;
const COLOR_CHARACTERS = 64 * 1024;
const COLOR_TOKENS = 512;

export function tokenize(line: string, lang?: string): Tok[] {
  // Document prose is not programming syntax: English “for/from/return” must stay prose.
  if (lang === 'md' || lang === 'mdx' || lang === 'markdown') {
    const out: Tok[] = [];
    let end = 0;
    for (const match of line.matchAll(/(^\s{0,3}#{1,6}\s|`[^`]*`|\[[^\]]*\]\([^)]*\)|^\s*(?:[-*+] |\d+\. ))/g)) {
      const start = match.index!;
      if (start > end) out.push({ t: 'plain', s: line.slice(end, start) });
      out.push({ t: match[0].startsWith('`') ? 'str' : 'property', s: match[0] });
      end = start + match[0].length;
    }
    if (end < line.length) out.push({ t: 'plain', s: line.slice(end) });
    return out;
  }
  if (lang === 'txt' || lang === 'text' || lang === 'log') return [{ t: 'plain', s: line }];
  const out: Tok[] = [];
  let cursor = 0, plain = 0;
  const end = Math.min(line.length, COLOR_CHARACTERS);
  const hashComments = lang === 'python' || lang === 'shell' || lang === 'yaml' || lang === 'toml' || lang === 'ruby';
  // Scan forward once, including unterminated quotes. Retrying a global string
  // regex at every quote makes long pasted scripts expensive. Bound DOM spans,
  // not readable content: any remaining characters are still rendered as plain text.
  while (cursor < end && out.length < COLOR_TOKENS - 2) {
    const start = cursor, char = line[cursor]!;
    let kind: Tok['t'] = 'plain';
    if (line.startsWith('//', cursor) || char === '#' && hashComments && !/[!{[]/.test(line[cursor + 1] ?? '')) {
      cursor = end; kind = 'com';
    } else if (line.startsWith('/*', cursor)) {
      const close = line.indexOf('*/', cursor + 2);
      cursor = close < 0 ? end : Math.min(end, close + 2); kind = 'com';
    } else if (char === '"' || char === "'" || char === '`') {
      cursor++;
      while (cursor < end) {
        if (line[cursor] === '\\') { cursor = Math.min(end, cursor + 2); continue; }
        if (line[cursor++] === char) break;
      }
      kind = 'str';
    } else {
      AT_NAME.lastIndex = IDENTIFIER.lastIndex = NUMBER.lastIndex = cursor;
      const at = char === '@' ? AT_NAME.exec(line) : null;
      const number = /\d/.test(char) ? NUMBER.exec(line) : null;
      const name = !at && !number ? IDENTIFIER.exec(line) : null;
      const word = (at ?? number ?? name)?.[0];
      if (word) {
        cursor += word.length;
        let next = cursor; while (next < end && /\s/.test(line[next]!)) next++;
        kind = at ? 'property' : number ? 'num' : KEYWORDS.has(word) ? 'kw' : line[next] === '(' ? 'fn' : lang === 'shell' && /^(node|npm|npx|pnpm|corepack|git|python|pytest|vitest|tsc|Get|Select|Set|Write|Remove|Copy|Move)$/.test(word) ? 'fn' : lang === 'shell' && /[-$]/.test(line[start - 1] ?? '') ? 'property' : /^[A-Z]/.test(word) ? 'type' : line[start - 1] === '.' || line[next] === ':' ? 'property' : 'plain';
      } else cursor++;
    }
    if (kind !== 'plain') {
      if (start > plain) out.push({ t: 'plain', s: line.slice(plain, start) });
      out.push({ t: kind, s: line.slice(start, cursor) });
      plain = cursor;
    }
  }
  if (plain < line.length) out.push({ t: 'plain', s: line.slice(plain) });
  return out;
}

export function Highlighted({ line, lang }: { line: string; lang?: string }): ReactNode {
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
