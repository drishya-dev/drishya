import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Markdown} from '../src/lib/markdown.tsx';
import {loadWorkspaceDocument} from '../src/lib/load-workspace-document.ts';
import type {CurrentFile} from '../src/api.ts';
const page=(text:string,start=0,totalLines=text.split('\n').length,hasMore=false):CurrentFile=>({path:'readme.md',scope:'current-workspace',text,start,totalLines,returnedLines:text.split('\n').length,hasMore,redacted:false,modifiedAt:'one'});
it('renders document structure safely and distinguishes natural-language fences',()=>{
 const html=renderToStaticMarkup(createElement(Markdown,{document:true,text:'# Project\n\n| Name | Result |\n| --- | --- |\n| **Build** | Pass |\n\n> Captured text\n\n```text\nA long natural language instruction\n```\n\n<script>alert(1)</script>'}));
 expect(html).toContain('<h1>Project</h1>');expect(html).toContain('<table>');expect(html).toContain('<strong>Build</strong>');expect(html).toContain('<blockquote>');expect(html).toContain('md-code-text');expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');
});
it('reads one complete redacted document across source pages and rejects changed/oversized versions',async()=>{
 const first=Array(200).fill('line').join('\n');const text=await loadWorkspaceDocument(async start=>start===0?page(first,0,201,true):{...page('[REDACTED]',200,201),redacted:true});
 expect(text.totalLines).toBe(201);expect(text.redacted).toBe(true);expect(text.text.endsWith('[REDACTED]')).toBe(true);
 await expect(loadWorkspaceDocument(async start=>start===0?page(first,0,201,true):{...page('end',200,201),modifiedAt:'two'})).rejects.toThrow('changed');
 await expect(loadWorkspaceDocument(async()=>page('x',0,5001,true))).rejects.toThrow('5,000');
});

it('does not consume underscores inside captured tool identifiers',()=>{
 expect(renderToStaticMarkup(createElement(Markdown,{text:'Captured outcome for mcp__arrival__inspect.'}))).toContain('mcp__arrival__inspect');
});
