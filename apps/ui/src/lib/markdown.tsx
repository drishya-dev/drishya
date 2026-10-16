// Minimal, safe Markdown for agent prose: paragraphs, lists, fenced code, `code`, **bold**, links
// shown as text. Everything is React text — no HTML from a transcript is ever interpreted.

import { createElement, type ReactNode } from 'react';
import { FencedCode } from '../components/FencedCode.tsx';

export function Markdown({ text, onPath, document = false }: { text: string; onPath?: (p: string) => void; document?: boolean }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (document && i+1<lines.length && line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1]!)) {
      const cells = (row:string) => row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
      const headers=cells(line),rows:string[][]=[];i+=2;
      while(i<lines.length && lines[i]!.includes('|') && lines[i]!.trim())rows.push(cells(lines[i++]!));
      blocks.push(<div className="md-table-scroll" key={key++}><table><thead><tr>{headers.map((cell,n)=><th key={n}>{inline(cell,onPath)}</th>)}</tr></thead><tbody>{rows.map((row,n)=><tr key={n}>{row.map((cell,j)=><td key={j}>{inline(cell,onPath)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    if (document && /^\s*>/.test(line)) {
      const quote:string[]=[];while(i<lines.length && /^\s*>/.test(lines[i]!))quote.push(lines[i++]!.replace(/^\s*> ?/,''));
      blocks.push(<blockquote key={key++}><Markdown text={quote.join('\n')} /></blockquote>);continue;
    }
    if (document && /^\s*(---+|\*\*\*+)\s*$/.test(line)) {blocks.push(<hr key={key++}/>);i++;continue;}
    const fence = /^\s*```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      blocks.push(<FencedCode key={key++} text={code.join('\n')} language={fence[1] ?? ''}/>);
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
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(document ? createElement(`h${h[1]!.length}`, {key:key++}, inline(h[2]!,onPath)) : <p key={key++} className="md-h">{inline(h[2]!, onPath)}</p>);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^\s*(```|([-*]|\d+\.)\s+|#{1,6}\s)/.test(lines[i]!)) {
      if(document && para.length && i+1<lines.length && lines[i]!.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i+1]!))break;
      if(document && para.length && /^\s*>/.test(lines[i]!))break;
      para.push(lines[i++]!);
    }
    blocks.push(<p key={key++}>{inline(para.join(' '), onPath)}</p>);
  }
  return <>{blocks}</>;
}

function inline(s: string, onPath?: (p: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(([^)]+)\))|(\*[^*\n]+\*|(?<![\w_])_[^_\n]+_(?![\w_]))/g;
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
    else if (m[6]) out.push(<em key={k++}>{m[6].slice(1,-1)}</em>);
    else if (m[3]) out.push(<span key={k++} className="md-link" title={m[5]}>{m[4]}</span>);
    last = i + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
