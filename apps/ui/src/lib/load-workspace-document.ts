import type { CurrentFile } from '../api.ts';
/** Complete redacted Markdown for reading only. No HTML execution, writes or draft eligibility. */
export async function loadWorkspaceDocument(read:(start:number)=>Promise<CurrentFile>) {
  const parts:string[]=[];let offset=0,version:string|undefined,total:number|undefined,redacted=false;
  while(true) {
    const part=await read(offset);
    if(!Number.isInteger(part.totalLines)||part.totalLines<1||part.totalLines>5000)throw new Error('Rendered documents support up to 5,000 lines and 256 KiB. Use Source for this file.');
    if(version!==undefined&&(part.modifiedAt!==version||part.totalLines!==total))throw new Error('File changed while reading. Refresh to read one version.');
    version??=part.modifiedAt;total??=part.totalLines;
    if(part.start!==offset||part.returnedLines<1||part.returnedLines>200||part.text.split('\n').length!==part.returnedLines||offset+part.returnedLines>total)throw new Error('Incomplete document page. Refresh to retry.');
    parts.push(part.text);redacted||=part.redacted;offset+=part.returnedLines;
    const text=parts.join('\n');if(new TextEncoder().encode(text).length>256*1024)throw new Error('Rendered document limit is 256 KiB. Use Source for this file.');
    if(!part.hasMore) {if(offset!==total)throw new Error('Incomplete document. Refresh to retry.');return {text,modifiedAt:version,totalLines:total,redacted};}
    if(offset>=total)throw new Error('Invalid document continuation. Refresh to retry.');
  }
}
