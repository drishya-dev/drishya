import type{DesktopAttachment}from'../lib/desktop-prompt.ts';
import{FileIcon}from'./FileIcon.tsx';
/** These are recorded references, not permission to read a present-day path. */
export function DesktopPromptAttachments({files,hasImageBytes}:{files:DesktopAttachment[];hasImageBytes:boolean}){
 return <div className="turn-images"><div className="prompt-attachments" aria-label="Prompt attachments">{files.map((file,i)=><span className="attachment-chip" key={i} title={file.path}><FileIcon path={file.path}/><span>{file.name}<small>{file.path}</small>{file.image&&!hasImageBytes&&<small>Image bytes not recorded</small>}</span></span>)}</div></div>;
}
