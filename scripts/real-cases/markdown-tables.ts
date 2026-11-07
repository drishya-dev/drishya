import type {RealCase} from './types.ts';
import {tableHeader} from '../../apps/ui/src/lib/markdown-table.ts';
export function hasMarkdownTable(text:string) {const lines=text.split(/\r?\n/);return lines.some((_,i)=>!!tableHeader(lines,i));}
export const markdownTables:RealCase={
 name:'markdown-tables',about:'captured assistant prose with pipe-table headers; no source text printed',harnesses:['claude-code','codex'],prefilter:'|',
 scan(row:any,harness){
  const text=harness==='claude-code'&&row.type==='assistant'&&Array.isArray(row.message?.content)?row.message.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n'):harness==='codex'&&row.type==='response_item'&&row.payload?.role==='assistant'?row.payload.content?.filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('\n'):undefined;
  return typeof text==='string'&&hasMarkdownTable(text)?{hits:1}:undefined;
 },
 verify(projection){const count=projection.prose.filter(p=>hasMarkdownTable(p.text)).length;return[`${count?'PASS':'FAIL'} ${count} captured prose entries contain valid table headers`];},
};
