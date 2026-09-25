// Minimal, safe Markdown for agent prose: paragraphs, lists, fenced code, `code`, **bold**, links
// shown as text. Everything is React text — no HTML from a transcript is ever interpreted.

import type { ReactNode } from 'react';
import { Highlighted } from './highlight.tsx';

export function Markdown({ text, onPath }: { text: string; onPath?: (p: string) => void }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^\s*```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={key++} className="md-code">
          {code.map((l, j) => (
            <div key={j}>
              <Highlighted line={l} lang={fence[1] || undefined} />
              {'\n'}
            </div>
          ))}
        </pre>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\./.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, onPath)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(<p key={key++} className="md-h">{inline(h[2]!, onPath)}</p>);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^\s*(```|([-*]|\d+\.)\s+|#{1,4}\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(<p key={key++}>{inline(para.join(' '), onPath)}</p>);
  }
  return <>{blocks}</>;
}

function inline(s: string, onPath?: (p: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(s.slice(last, i));
    if (m[1]) {
      const code = m[1].slice(1, -1);
      const looksPath = /^[\w./-]+\.\w{1,5}(:\d+)?$/.test(code);
      out.push(
        looksPath && onPath ? (
          <code key={k++} className="md-path" onClick={() => onPath(code.replace(/:\d+$/, ''))}>
            {code}
          </code>
        ) : (
          <code key={k++}>{code}</code>
        ),
      );
    } else if (m[2]) out.push(<strong key={k++}>{m[2].slice(2, -2)}</strong>);
    else if (m[3]) out.push(<span key={k++} className="md-link" title={m[5]}>{m[4]}</span>);
    last = i + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
