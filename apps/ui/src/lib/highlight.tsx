// A small, fast tokenizer for display — GitHub Dark colours. Not a parser; it only has to be
// right often enough to help reading. CodeMirror replaces it in the full reader.

import { Fragment, type ReactNode } from 'react';

const KEYWORDS = new Set(
  'abstract as async await break case catch class const continue debugger def default del delete do elif else enum except export extends false finally for from function global if implements import in instanceof interface is lambda let new nonlocal None not null of or pass private protected public raise readonly return static super switch this throw true True False try type typeof undefined var void while with yield fn pub mut impl struct use mod match func package go defer chan select'.split(' '),
);

type Tok = { t: 'kw' | 'str' | 'com' | 'num' | 'fn' | 'type' | 'property' | 'plain'; s: string };

const IDENTIFIER = /[A-Za-z_$][\w$]*/y;
const NUMBER = /\d[\d_.]*(?:e[+-]?\d+)?/iy;
const AT_NAME = /@[A-Za-z_][\w./-]*/y;
const COLOR_CHARACTERS = 64 * 1024;
const COLOR_TOKENS = 512;

const SHELL_WRAPPERS = new Set(
  'sudo env command exec nohup time xargs corepack nice ionice'.split(' '),
);
const SHELL_KEYWORDS = new Set(
  'if then else elif fi for in do done case esac while until select function return export local readonly unset declare typeset exit break continue trap source'.split(' '),
);
const SHELL_CHAIN_KEYWORDS = new Set('then do else elif'.split(' '));
const SHELL_INLINE_KEYWORDS = new Set('then do done fi esac in elif else'.split(' '));
const POWERSHELL_CMDLET = /^(?:Get|Set|New|Remove|Copy|Move|Select|Write|Read|Test|Invoke|Start|Stop|Restart|Export|Import|ConvertFrom|ConvertTo|Format|Out|Where|ForEach)-[A-Z][A-Za-z0-9]*$/;
const DIFF_META_LINE = /^(?:diff\s+--git\s|index\s+[0-9a-f]+\.\.|(?:new|deleted)\s+file\s+mode\s|rename\s+(?:from|to)\s|similarity\s+index\s|(?:---|\+\+\+)\s+\S)/;

function normalizeLang(lang?: string): string | undefined {
  const raw = lang?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'sh' || raw === 'bash' || raw === 'zsh' || raw === 'powershell' || raw === 'ps1' || raw === 'pwsh') return 'shell';
  if (raw === 'ts' || raw === 'tsx' || raw === 'js' || raw === 'jsx' || raw === 'mjs' || raw === 'cjs' || raw === 'mts' || raw === 'cts') return 'typescript';
  if (raw === 'py') return 'python';
  if (raw === 'yml') return 'yaml';
  if (raw === 'rb') return 'ruby';
  if (raw === 'jsonc') return 'json';
  if (raw === 'patch') return 'diff';
  return raw;
}

function tokenizeDiff(line: string): Tok[] {
  if (!line) return [{ t: 'plain', s: line }];
  if (DIFF_META_LINE.test(line)) return [{ t: 'com', s: line }];
  const hunk = /^(@@[^@]*@@)(.*)$/.exec(line);
  if (hunk) {
    const out: Tok[] = [{ t: 'property', s: hunk[1]! }];
    if (hunk[2]) out.push({ t: 'com', s: hunk[2] });
    return out;
  }
  if (line.startsWith('@@')) return [{ t: 'property', s: line }];
  if (line.startsWith('+')) return [{ t: 'str', s: line }];
  if (line.startsWith('-')) return [{ t: 'kw', s: line }];
  return [{ t: 'plain', s: line }];
}

function tokenizeShell(line: string): Tok[] {
  const out: Tok[] = [];
  const end = Math.min(line.length, COLOR_CHARACTERS);
  let cursor = 0, plain = 0, expectCmd = true;
  const emit = (start: number, stop: number, t: Tok['t']) => {
    if (t !== 'plain') {
      if (start > plain) out.push({ t: 'plain', s: line.slice(plain, start) });
      out.push({ t, s: line.slice(start, stop) });
      plain = stop;
    }
    cursor = stop;
  };
  const prompt = /^\s*(?:PS(?: [^>\r\n]*)?>|[$%](?=\s))/.exec(line.slice(0, end));
  if (prompt) {
    const trimmed = prompt[0]!.trimStart();
    const lead = prompt[0]!.length - trimmed.length;
    if (trimmed) emit(lead, prompt[0]!.length, 'com');
  }
  while (cursor < end && out.length < COLOR_TOKENS - 2) {
    const start = cursor, char = line[cursor]!;
    const afterAssign = cursor > 0 && line[cursor - 1] === '=';
    if (char === '#' && (cursor === 0 || /\s/.test(line[cursor - 1]!)) && !/[!{[]/.test(line[cursor + 1] ?? '')) {
      emit(start, end, 'com');
    } else if (line.startsWith("@'", cursor) || line.startsWith('@"', cursor) || line.startsWith("'@", cursor) || line.startsWith('"@', cursor)) {
      emit(start, Math.min(end, cursor + 2), 'str');
    } else if (char === '"' || char === "'" || char === '`') {
      cursor++;
      while (cursor < end) {
        if (line[cursor] === '\\') { cursor = Math.min(end, cursor + 2); continue; }
        if (line[cursor++] === char) break;
      }
      if (!afterAssign) expectCmd = false;
      emit(start, cursor, 'str');
    } else if (char === '$') {
      if (line[cursor + 1] === '(') {
        cursor += 2;
        expectCmd = true;
      } else if (line[cursor + 1] === '{') {
        const close = line.indexOf('}', cursor + 2);
        const stop = close < 0 ? end : Math.min(end, close + 1);
        if (!afterAssign) expectCmd = false;
        emit(start, stop, 'property');
      } else {
        const variable = /^\$(?:[A-Za-z_][\w:.-]*|\d+|[?@$#*!])/.exec(line.slice(cursor, end));
        if (variable) {
          if (!afterAssign) expectCmd = false;
          emit(start, cursor + variable[0].length, 'property');
        } else {
          cursor++;
        }
      }
    } else if (char === '@') {
      AT_NAME.lastIndex = cursor;
      const at = AT_NAME.exec(line);
      if (at && cursor + at[0].length <= end) {
        if (!afterAssign) expectCmd = false;
        emit(start, cursor + at[0].length, 'property');
      } else {
        cursor++;
      }
    } else if (line.startsWith('&&', cursor) || line.startsWith('||', cursor)) {
      cursor += 2;
      expectCmd = true;
    } else if (char === '|' || char === ';' || char === '(' || char === '\n') {
      cursor++;
      expectCmd = true;
    } else if (char === '-' && (cursor === 0 || /[\s=,(]/.test(line[cursor - 1]!))) {
      const flag = /^--?[A-Za-z0-9][\w.:-]*/.exec(line.slice(cursor, end));
      if (flag) {
        expectCmd = false;
        emit(start, cursor + flag[0].length, 'property');
      } else {
        cursor++;
      }
    } else if (/\d/.test(char) && (cursor === 0 || /[\s=:,([/]/.test(line[cursor - 1]!))) {
      NUMBER.lastIndex = cursor;
      const number = NUMBER.exec(line);
      if (number && cursor + number[0].length <= end) {
        if (!afterAssign) expectCmd = false;
        emit(start, cursor + number[0].length, 'num');
      } else {
        cursor++;
      }
    } else if (/[A-Za-z_.]/.test(char) && (cursor === 0 || !/[\w.+/\-]/.test(line[cursor - 1]!))) {
      const match = /^(?:\.{1,2}[\\/])?[A-Za-z_][\w.+/\\:-]*/.exec(line.slice(cursor, end));
      if (match) {
        const word = match[0];
        const stop = Math.min(end, cursor + word.length);
        if (afterAssign) {
          cursor = stop;
        } else if (line[stop] === '=' && /^[A-Za-z_]\w*$/.test(word)) {
          emit(start, stop, 'property');
        } else if (expectCmd) {
          if (SHELL_KEYWORDS.has(word)) {
            emit(start, stop, 'kw');
            expectCmd = SHELL_CHAIN_KEYWORDS.has(word);
          } else {
            emit(start, stop, 'fn');
            expectCmd = SHELL_WRAPPERS.has(word);
          }
        } else if (SHELL_INLINE_KEYWORDS.has(word)) {
          emit(start, stop, 'kw');
          expectCmd = SHELL_CHAIN_KEYWORDS.has(word);
        } else if (POWERSHELL_CMDLET.test(word)) {
          emit(start, stop, 'fn');
        } else {
          cursor = stop;
        }
      } else {
        cursor++;
      }
    } else {
      cursor++;
    }
  }
  if (plain < line.length) out.push({ t: 'plain', s: line.slice(plain) });
  return out;
}

export function tokenize(line: string, lang?: string): Tok[] {
  const norm = normalizeLang(lang);
  // Document prose is not programming syntax: English “for/from/return” must stay prose.
  if (norm === 'md' || norm === 'mdx' || norm === 'markdown') {
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
  if (norm === 'txt' || norm === 'text' || norm === 'plaintext' || norm === 'log') return [{ t: 'plain', s: line }];
  if (norm === 'diff') return tokenizeDiff(line);
  if (norm === 'shell') return tokenizeShell(line);
  const out: Tok[] = [];
  let cursor = 0, plain = 0;
  const end = Math.min(line.length, COLOR_CHARACTERS);
  const hashComments = norm === 'python' || norm === 'yaml' || norm === 'toml' || norm === 'ruby';
  const jsonMode = norm === 'json';
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
      if (jsonMode && char === '"') {
        let next = cursor; while (next < end && /\s/.test(line[next]!)) next++;
        kind = line[next] === ':' ? 'property' : 'str';
      } else {
        kind = 'str';
      }
    } else {
      AT_NAME.lastIndex = IDENTIFIER.lastIndex = NUMBER.lastIndex = cursor;
      const at = char === '@' ? AT_NAME.exec(line) : null;
      const number = /\d/.test(char) ? NUMBER.exec(line) : null;
      const name = !at && !number ? IDENTIFIER.exec(line) : null;
      const word = (at ?? number ?? name)?.[0];
      if (word) {
        cursor += word.length;
        let next = cursor; while (next < end && /\s/.test(line[next]!)) next++;
        if (jsonMode) {
          kind = number ? 'num' : word === 'true' || word === 'false' || word === 'null' ? 'kw' : 'plain';
        } else {
          kind = at ? 'property' : number ? 'num' : KEYWORDS.has(word) ? 'kw' : line[next] === '(' ? 'fn' : /^[A-Z]/.test(word) ? 'type' : line[start - 1] === '.' || line[next] === ':' ? 'property' : 'plain';
        }
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

/** A place to break a long path: after each separator, even where the browser's own rules refuse one (before a dot). The text is unchanged, so copy yields the original. */
function softBreaks(text: string): ReactNode {
  const parts = text.split(/(?<=[/\\])(?=[^\s/\\])/);
  return parts.length < 2 ? text : parts.flatMap((part, i) => i ? [<wbr key={i}/>, part] : [part]);
}

export function Highlighted({ line, lang, breaks = false }: { line: string; lang?: string; breaks?: boolean }): ReactNode {
  return tokenize(line, lang).map((t, i) => {
    const text = breaks ? softBreaks(t.s) : t.s;
    return t.t === 'plain' ? <Fragment key={i}>{text}</Fragment> : <span key={i} className={`tk-${t.t}`}>{text}</span>;
  });
}

export function langOf(path: string | undefined): string | undefined {
  const ext = path?.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'].includes(ext)) return 'typescript';
  if (ext === 'py') return 'python';
  if (['sh', 'bash', 'zsh', 'ps1', 'pwsh'].includes(ext)) return 'shell';
  if (['yml', 'yaml'].includes(ext)) return 'yaml';
  if (ext === 'toml') return 'toml';
  if (ext === 'rb') return 'ruby';
  if (ext === 'patch') return 'diff';
  return ext;
}
