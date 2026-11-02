// Minimal, safe Markdown for agent prose: paragraphs, lists, fenced code, `code`, **bold**, links
// shown as text, with explicit local file navigation when supplied. Everything is
// React text — no HTML from a transcript is ever interpreted.

import { createElement, type ReactNode } from 'react';
import { FencedCode } from '../components/FencedCode.tsx';
import { prosePath } from './prose-path.ts';

type PathAction = (path: string, line?: number) => void;
export function Markdown({ text, onPath, document = false, workspaceRoot }: { text: string; onPath?: PathAction; document?: boolean; workspaceRoot?:string }) {
  return renderMarkdown(text, onPath, document, 0, workspaceRoot);
}

const listMarker = (line: string) => /^( *)([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/.exec(line);
const orderedMarker = (marker: string) => /^\d/.test(marker);

function renderMarkdown(text: string, onPath: PathAction | undefined, document: boolean, depth: number, workspaceRoot?:string): ReactNode {
  // Malformed/extremely nested captured content must remain readable without
  // making transcript rendering recursively unbounded.
  if (depth >= 32) return <FencedCode text={text} language="text" />;
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
      blocks.push(<div className="md-table-scroll" key={key++}><table><thead><tr>{headers.map((cell,n)=><th key={n}>{inline(cell,onPath,workspaceRoot)}</th>)}</tr></thead><tbody>{rows.map((row,n)=><tr key={n}>{row.map((cell,j)=><td key={j}>{inline(cell,onPath,workspaceRoot)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    if (document && /^\s*>/.test(line)) {
      const quote:string[]=[];while(i<lines.length && /^\s*>/.test(lines[i]!))quote.push(lines[i++]!.replace(/^\s*> ?/,''));
      blocks.push(<blockquote key={key++}>{renderMarkdown(quote.join('\n'), onPath, document, depth + 1, workspaceRoot)}</blockquote>);continue;
    }
    if (document && /^\s*(---+|\*\*\*+)\s*$/.test(line)) {blocks.push(<hr key={key++}/>);i++;continue;}
    // HTML is never interpreted, and as a paragraph it reads like broken prose; show it as the source it is.
    if (document && /^\s*<(?:!--|\/?[a-z][\w-]*[\s/>])/i.test(line)) {
      const markup:string[]=[];while(i<lines.length && lines[i]!.trim())markup.push(lines[i++]!);
      blocks.push(<pre className="md-html" key={key++}>{markup.join('\n')}</pre>);continue;
    }
    const fence = /^\s*```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      blocks.push(<FencedCode key={key++} text={code.join('\n')} language={fence[1] ?? ''}/>);
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      const indent = marker[1]!.length, ordered = orderedMarker(marker[2]!);
      const start = ordered ? Number.parseInt(marker[2]!, 10) : undefined;
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const item = listMarker(lines[i]!);
        if (!item || item[1]!.length !== indent || orderedMarker(item[2]!) !== ordered) break;
        const contentIndent = indent + item[2]!.length + item[3]!.length;
        const body = [item[4]!]; i++;
        let blank = false, fenced = /^```/.test(item[4]!);
        while (i < lines.length) {
          const next = lines[i]!, nextMarker = listMarker(next);
          if (nextMarker && nextMarker[1]!.length <= indent) break;
          const spaces = /^ */.exec(next)![0].length;
          if (next.trim() && spaces <= indent) {
            // Lazy paragraph continuation is valid, but a new block or a
            // paragraph after a blank line belongs outside this list item.
            if (blank || /^(#{1,6}\s|>|```)/.test(next)) break;
          }
          const content = next.slice(Math.min(spaces, contentIndent));
          if (/^```/.test(content)) fenced = !fenced;
          body.push(content); i++; blank = !next.trim() && !fenced;
        }
        const ordinal = ordered ? Number.parseInt(item[2]!, 10) : undefined;
        items.push(<li key={items.length} value={ordered && ordinal !== start! + items.length ? ordinal : undefined}>{renderMarkdown(body.join('\n'), onPath, document, depth + 1, workspaceRoot)}</li>);
      }
      blocks.push(ordered ? <ol className="md-list" key={key++} start={start === 1 ? undefined : start}>{items}</ol> : <ul className="md-list" key={key++}>{items}</ul>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(document ? createElement(`h${h[1]!.length}`, {key:key++}, inline(h[2]!,onPath,workspaceRoot)) : <p key={key++} className="md-h">{inline(h[2]!, onPath, workspaceRoot)}</p>);
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !listMarker(lines[i]!) && !/^\s*(```|#{1,6}\s)/.test(lines[i]!)) {
      if(document && para.length && i+1<lines.length && lines[i]!.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i+1]!))break;
      if(document && para.length && /^\s*>/.test(lines[i]!))break;
      para.push(lines[i++]!);
    }
    blocks.push(<p key={key++}>{inline(para.join(' '), onPath, workspaceRoot)}</p>);
  }
  return <>{blocks}</>;
}

function inline(s: string, onPath?: PathAction, workspaceRoot?:string): ReactNode[] {
  const out: ReactNode[] = [];
  // A link target may hold one level of parentheses, e.g. /docs/report (copy).md.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\))|(\*[^*\n]+\*|(?<![\w_])_[^_\n]+_(?![\w_]))/g;
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(s.slice(last, i));
    if (m[1]) {
      const code = m[1].slice(1, -1);
      const reference = prosePath(code,workspaceRoot);
      out.push(
        reference && onPath ? (
          <button type="button" key={k++} className="md-path" aria-label={`Open work on ${reference.path}${reference.line ? ` at line ${reference.line}` : ''}`} onClick={() => onPath(reference.path, reference.line)}><code>{code}</code></button>
        ) : (
          <code key={k++}>{code}</code>
        ),
      );
    } else if (m[2]) out.push(<strong key={k++}>{inline(m[2].slice(2, -2), onPath, workspaceRoot)}</strong>);
    else if (m[6]) out.push(<em key={k++}>{inline(m[6].slice(1,-1), onPath, workspaceRoot)}</em>);
    else if (m[3]) {
      const reference=prosePath(m[5]!,workspaceRoot);
      out.push(reference&&onPath?<button type="button" key={k++} className="md-path md-link" title={m[5]} aria-label={`Open work on ${reference.path}${reference.line?` at line ${reference.line}`:''}`} onClick={()=>onPath(reference.path,reference.line)}>{inline(m[4]!)}</button>:<span key={k++} className="md-link" title={m[5]}>{m[4]}</span>);
    }
    last = i + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
