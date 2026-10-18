import type {ArtifactSlice} from '@drishya/contracts';
import type {CurrentFile} from '../api.ts';
/** Exact positions only; this does not locate code that has moved since capture. */
export function capturedDiskPair(captured:ArtifactSlice,disk:CurrentFile,startLine?:number) {
  if(!captured.available||captured.start!==0||captured.hasMore||captured.truncated||captured.totalBytes>256*1024)throw new Error('Compare requires complete stored material up to256 KiB. Read its available source pages instead.');
  const artifact=captured.artifact;
  if(!['snapshot','excerpt'].includes(artifact.kind)||artifact.availability!=='complete')throw new Error('This captured material is not a complete source snapshot or excerpt.');
  if(disk.hasMore||disk.start!==0)throw new Error('Current source is incomplete. Read the file separately.');
  let after=disk.text,label=artifact.provenance.kind==='derived'?'Reconstructed source snapshot':'Captured whole-file snapshot';
  if(artifact.kind==='excerpt'){
    const first=artifact.range?.start??startLine;
    if(!Number.isSafeInteger(first)||first!<1)throw new Error('Captured excerpt has no exact file-line position.');
    after=disk.text.split('\n').slice(first!-1,first!-1+captured.returnedLines).join('\n');
    label=`Captured lines ${first}–${first!+captured.returnedLines-1}`;
  }
  if(new TextEncoder().encode(after).length>256*1024)throw new Error('Current comparison exceeds256 KiB. Read source separately.');
  return {before:captured.text,after,label};
}
