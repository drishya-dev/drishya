import{useContext,type ReactNode}from'react';
import{ProseFiles}from'./ProseFiles.tsx';
import{FileIcon}from'./FileIcon.tsx';
export function ProseFileLink({value,children,fallback}:{value:string;children:ReactNode;fallback:ReactNode}){
 const navigation=useContext(ProseFiles),reference=navigation?.resolve(value);
 const literal=<ProseFiles.Provider value={undefined}>{children}</ProseFiles.Provider>;
 if(!navigation)return fallback;
 if(!reference)return /^https?:\/\//i.test(value)?<ProseFiles.Provider value={undefined}>{fallback}</ProseFiles.Provider>:literal;
 return <button type="button" className="md-path md-link" title={value} aria-label={`${reference.folder?'Show folder':'Open work on'} ${reference.path}${reference.line?` at line ${reference.line}`:''}`} onClick={()=>navigation.open(reference)}><span aria-hidden="true" style={{userSelect:'none'}}><FileIcon path={reference.path} folder={reference.folder}/></span>{literal}</button>;
}
/** Tokenize only prose, never code fences or command bodies; unresolved text is returned unchanged. */
export function ProseFileText({text}:{text:string}){
 const navigation=useContext(ProseFiles);if(!navigation)return text;
 const out:ReactNode[]=[];let previous=0;
 for(const match of text.matchAll(/[^\s`*\[\]()<>{}"'?,;!]+/gu)){
  let token=match[0];let reference=navigation.resolve(token);if(!reference){token=token.replace(/[.:]+$/,'');reference=navigation.resolve(token);}if(!token||!/[\p{L}_/\\]/u.test(token))continue;
 if(!reference||reference.folder&&!/[\\/]/.test(token))continue;
  const start=match.index!;out.push(text.slice(previous,start));out.push(<ProseFileLink key={start} value={token} fallback={token}>{token}</ProseFileLink>);previous=start+token.length;
 }
 out.push(text.slice(previous));return <>{out}</>;
}
