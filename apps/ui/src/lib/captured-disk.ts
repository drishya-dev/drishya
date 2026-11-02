import type {ArtifactSlice} from '@drishya/contracts';
import type {CurrentFile} from '../api.ts';
const COMMON_LINE = 8;
/** A harness hands back LF for a CRLF file, and a difference of line endings is not a change a reader is looking for. */
const plain = (text:string) => text.replace(/\r\n/g,'\n');

/** The shift most lines agree on, nearest `near` on a tie. A line common in the file says nothing about where a passage sits. */
function shiftOf(lines:{line:string;at:number}[],where:Map<string,number[]>,near:number,within=Infinity) {
  const votes=new Map<number,number>();
  for(const {line,at} of lines){
    const found=where.get(line);
    if(!line.trim()||!found||found.length>COMMON_LINE)continue;
    for(const index of found)if(Math.abs(index-at-near)<=within)votes.set(index-at,(votes.get(index-at)??0)+1);
  }
  let best:number|undefined,score=0;
  for(const [shift,count] of votes)if(count>score||count===score&&Math.abs(shift-near)<Math.abs(best!-near)){best=shift;score=count;}
  return best;
}

/** Where a captured passage sits in today's file. Its two halves are placed apart, so lines added inside it stay inside the comparison. */
export function excerptSpan(excerpt:string[],file:string[],first:number) {
  const where=new Map<string,number[]>();
  file.forEach((line,index)=>(where.get(line)??where.set(line,[]).get(line)!).push(index));
  const lines=excerpt.map((line,at)=>({line,at})),middle=Math.ceil(lines.length/2);
  const whole=shiftOf(lines,where,first);
  if(whole===undefined)return {start:first,end:first+excerpt.length,found:false};
  const head=shiftOf(lines.slice(0,middle),where,whole,excerpt.length)??whole,tail=shiftOf(lines.slice(middle),where,whole,excerpt.length)??whole;
  const start=Math.max(0,head);
  return {start,end:Math.max(start,Math.min(file.length,tail+excerpt.length)),found:true};
}

/** A whole-file snapshot compares with the whole file; an excerpt compares with where its lines sit now. */
export function capturedDiskPair(captured:ArtifactSlice,disk:CurrentFile,startLine?:number) {
  if(!captured.available||captured.start!==0||captured.hasMore||captured.truncated||captured.totalBytes>256*1024)throw new Error('Compare requires complete stored material up to256 KiB. Read its available source pages instead.');
  const artifact=captured.artifact;
  if(!['snapshot','excerpt'].includes(artifact.kind)||artifact.availability!=='complete')throw new Error('This material is not a complete source snapshot or excerpt.');
  if(disk.hasMore||disk.start!==0)throw new Error('Current source is incomplete. Read the file separately.');
  const before=plain(captured.text);
  let after=plain(disk.text),afterLabel='Current disk',label=artifact.provenance.kind==='derived'?'Reconstructed source snapshot':'Whole-file snapshot';
  if(artifact.kind==='excerpt'){
    const first=artifact.range?.start??startLine;
    if(!Number.isSafeInteger(first)||first!<1)throw new Error('Excerpt has no exact file-line position.');
    const file=after.split('\n'),span=excerptSpan(before.replace(/\n$/,'').split('\n'),file,first!-1);
    after=file.slice(span.start,span.end).join('\n');
    label=`Lines ${first}–${first!+captured.returnedLines-1}`;
    afterLabel=span.found?`Current disk · lines ${span.start+1}–${span.end}`:'Current disk · same line numbers, none of these lines were found';
  }
  if(new TextEncoder().encode(after).length>256*1024)throw new Error('Current comparison exceeds256 KiB. Read source separately.');
  return {before,after,label,afterLabel};
}
