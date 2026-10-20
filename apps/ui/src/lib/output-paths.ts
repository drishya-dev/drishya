import {prosePath,type ProsePath} from './prose-path.ts';

export interface OutputPath extends ProsePath {start:number;end:number}
/** Diagnostic locations, not commands or arbitrary source expressions. Never probes disk. */
export function outputPaths(text:string,root?:string,limit=8):OutputPath[]{
 if(text.length>4096)return [];
 const hits:OutputPath[]=[];
 const add=(raw:string,start:number,line?:number)=>{
  const ref=prosePath(raw,root);if(!ref||hits.length>=Math.min(64,limit))return;
  const end=start+raw.length;if(hits.some(hit=>start<hit.end&&end>hit.start))return;
  hits.push({...ref,...(line?{line}:{}),start,end});
 };
 // Python traceback keeps paths with spaces inside quotes.
 const python=/\bFile "([^"\r\n]+)", line ([1-9]\d{0,8})/g;
 for(const match of text.matchAll(python))add(match[1]!,match.index!+6,Number(match[2]));
 const token=/(?:[A-Za-z]:[\\/]|\/)?(?:[\p{L}\p{N}_.@+-]+[\\/])*[\p{L}\p{N}_.@+-]+\.[\p{L}\p{N}_-]{1,16}(?::[1-9]\d{0,8}(?::[1-9]\d{0,8})?|\([1-9]\d{0,8},[1-9]\d{0,8}\))?/gu;
 for(const match of text.matchAll(token)){
  const raw=match[0],start=match.index!,before=text.slice(0,start),after=text.slice(start+raw.length);
  // Reject URL fragments, quoted command/source literals and partial tokens.
  if(start&&/[\p{L}\p{N}_./\\:'"`=-]/u.test(text[start-1]!))continue;
  const location=/:\d/.test(raw)||/\(\d+,\d+\)$/.test(raw);
  const runner=/^\s*(?:[✓✔√×✕✘]|PASS|FAIL|FAILED|ERROR)\s/.test(before)||/^::/.test(after);
  if(!location&&!runner)continue;
  const ts=/\(([1-9]\d*),[1-9]\d*\)$/.exec(raw);
  if(ts){const ref=prosePath(raw.slice(0,ts.index),root);if(ref&&hits.length<Math.min(64,limit))hits.push({...ref,line:Number(ts[1]),start,end:start+raw.length});}
  else add(raw,start);
 }
 return hits.sort((a,b)=>a.start-b.start);
}
