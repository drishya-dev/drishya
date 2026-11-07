// Minimal, safe Markdown for agent prose: paragraphs, lists, fenced code, `code`, **bold**, links
// shown as text, with explicit local file navigation when supplied. Everything is
// React text — no HTML from a transcript is ever interpreted.

import { createElement, useContext, useState, type ReactNode } from 'react';
import { FencedCode } from '../components/FencedCode.tsx';
import { prosePath } from './prose-path.ts';
import {fileName} from './file-identity.ts';
import {ProseFiles} from '../components/ProseFiles.tsx';
import {ProseFileLink,ProseFileText} from '../components/ProseFileLink.tsx';
import {OriginalToggle,OriginalOwned} from '../components/OriginalToggle.tsx';
import {tableCells, tableHeader} from './markdown-table.ts';
import './markdown-table.css';

type PathAction = (path: string, line?: number) => void;
export function Markdown({ text, onPath, document = false, workspaceRoot }: { text: string; onPath?: PathAction; document?: boolean; workspaceRoot?:string }) {
  const rendered=renderMarkdown(text, onPath, document, 0, workspaceRoot);
  return document?<ProseFiles.Provider value={undefined}>{rendered}</ProseFiles.Provider>:rendered;
}

const listMarker = (line: string) => /^( *)([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/.exec(line);
const orderedMarker = (marker: string) => /^\d/.test(marker);

function renderMarkdown(text: string, onPath: PathAction | undefined, document: boolean, depth: number, workspaceRoot?:string): ReactNode {
  // Malformed/extremely nested captured content must remain readable without
  // making transcript rendering recursively unbounded.
  if (depth >= 32) return <FencedCode text={text} language="text" />;
  const blocks: ReactNode[] = [];
  const originalLines = text.split('\n');
  const lines = originalLines.map(line=>line.replace(/\r/g,''));
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const table = tableHeader(lines, i);
    if (table) {
      const start=i,rows:string[][]=[];i+=2;
      while(i<lines.length && lines[i]!.trim()) {
        const cells=tableCells(lines[i]!);if(!cells)break;
        rows.push(table.cells.map((_,column)=>cells[column]??''));i++;
      }
      blocks.push(<MarkdownTable key={key++} headers={table.cells} rows={rows} align={table.align} raw={originalLines.slice(start,i).join('\n')} onPath={onPath} workspaceRoot={workspaceRoot} document={document}/>);continue;
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
      if(para.length && tableHeader(lines,i))break;
      if(document && para.length && /^\s*>/.test(lines[i]!))break;
      para.push(lines[i++]!);
    }
    blocks.push(<p key={key++}>{inline(para.join(' '), onPath, workspaceRoot)}</p>);
  }
  return <>{blocks}</>;
}

function MarkdownTable({headers,rows,align,raw,onPath,workspaceRoot,document}:{headers:string[];rows:string[][];align:('left'|'center'|'right'|undefined)[];raw:string;onPath?:PathAction;workspaceRoot?:string;document:boolean}) {
  const [original,setOriginal]=useState(false),owned=useContext(OriginalOwned);
  return <div className={document?'md-document-table':'md-prose-table'}>
    {original?<FencedCode text={raw} language="markdown"/>:<div className="md-table-scroll" role="region" aria-label="Markdown table" tabIndex={0}><table><thead><tr>{headers.map((cell,n)=><th scope="col" style={{textAlign:align[n]}} key={n}>{inline(cell,onPath,workspaceRoot,true)}</th>)}</tr></thead><tbody>{rows.map((row,n)=><tr key={n}>{row.map((cell,j)=><td style={{textAlign:align[j]}} key={j}>{inline(cell,onPath,workspaceRoot,true)}</td>)}</tr>)}</tbody></table></div>}
    {!document&&!owned&&<OriginalToggle original={original} onToggle={()=>setOriginal(!original)}/>}
  </div>;
}

function inline(s: string, onPath?: PathAction, workspaceRoot?:string, tableLinks=false): ReactNode[] {
  const out: ReactNode[] = [];
  // A link target may hold one level of parentheses, e.g. /docs/report (copy).md.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\))|(\*[^*\n]+\*|(?<![\w_])_[^_\n]+_(?![\w_]))|(:codex-file-citation\{(?:[^}"\\]|\\.|"(?:\\.|[^"\\])*")*\})/g;
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(<ProseFileText key={`text-${i}`} text={s.slice(last,i)}/>);
    if (m[7]) {
      const attributes = new Map<string,string>();
      for (const attribute of m[7].matchAll(/([\w_]+)\s*=\s*("(?:\\.|[^"\\])*"|[^\s}]+)/g)) {
        const value = attribute[2]!;
        if (value.startsWith('"')) {
          // Native Windows paths are sometimes quoted without JSON escaping.
          // Both forms remain text, never HTML or an executable URL.
          try {attributes.set(attribute[1]!, JSON.parse(value) as string);}
          catch {attributes.set(attribute[1]!, value.slice(1,-1));}
        } else attributes.set(attribute[1]!, value);
      }
      const path = attributes.get('path');
      if (!path || path.length > 2000 || /[\x00-\x1f]/.test(path)) out.push(m[7]);
      else {
        const start = attributes.get('line_range_start'), end = attributes.get('line_range_end');
        const line = start && /^[1-9]\d{0,8}$/.test(start) ? Number(start) : undefined;
        const lastLine = end && /^[1-9]\d{0,8}$/.test(end) ? Number(end) : undefined;
        const label = `${fileName(path)}${line ? `:${line}${lastLine && lastLine > line ? `–${lastLine}` : ''}` : ''}`;
        const reference = prosePath(path, workspaceRoot, true);
        const fallback=reference && onPath
          ? <button type="button" key={k++} className="md-path md-link" title={path} aria-label={`Open work on ${reference.path}${line ? ` at line ${line}` : ''}`} onClick={() => onPath(reference.path, line)}><code>{label}</code></button>
          : <span key={k++} className="md-link" title={path}><code>{label}</code></span>;
        out.push(<ProseFileLink key={k++} value={line?`${path}:${line}`:path} fallback={fallback}><span className="md-link" title={path}><code>{label}</code></span></ProseFileLink>);
      }
    } else if (m[1]) {
      const code = m[1].slice(1, -1);
      const reference = prosePath(code,workspaceRoot);
      const fallback=(
        reference && onPath ? (
          <button type="button" key={k++} className="md-path" aria-label={`Open work on ${reference.path}${reference.line ? ` at line ${reference.line}` : ''}`} onClick={() => onPath(reference.path, reference.line)}><code>{code}</code></button>
        ) : (
          <code key={k++}>{code}</code>
        )
      );
      out.push(<ProseFileLink key={k++} value={code} fallback={fallback}><code>{code}</code></ProseFileLink>);
    } else if (m[2]) out.push(<strong key={k++}>{inline(m[2].slice(2, -2), onPath, workspaceRoot,tableLinks)}</strong>);
    else if (m[6]) out.push(<em key={k++}>{inline(m[6].slice(1,-1), onPath, workspaceRoot,tableLinks)}</em>);
    else if (m[3]) {
      const reference=prosePath(m[5]!,workspaceRoot);
      const fallback=reference&&onPath?<button type="button" key={k++} className="md-path md-link" title={m[5]} aria-label={`Open work on ${reference.path}${reference.line?` at line ${reference.line}`:''}`} onClick={()=>onPath(reference.path,reference.line)}>{inline(m[4]!)}</button>:tableLinks&&/^https?:\/\/[^\s\x00-\x1f]+$/i.test(m[5]!)?<a key={k++} className="md-link" href={m[5]} target="_blank" rel="noopener noreferrer">{inline(m[4]!)}</a>:<span key={k++} className="md-link" title={m[5]}>{m[4]}</span>;
      out.push(<ProseFileLink key={k++} value={m[5]!} fallback={fallback}><span className="md-link" title={m[5]}>{inline(m[4]!)}</span></ProseFileLink>);
    }
    last = i + m[0].length;
  }
  if (last < s.length) out.push(<ProseFileText key="tail" text={s.slice(last)}/>);
  return out;
}
