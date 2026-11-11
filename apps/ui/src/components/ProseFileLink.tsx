import{useContext,type ReactNode}from'react';
import{ProseFiles}from'./ProseFiles.tsx';
import{FileIcon}from'./FileIcon.tsx';
import{ExternalLink,LinkCard}from'./LinkCard.tsx';
import{commitCandidate,splitUrls}from'../lib/link-kinds.ts';
export function ProseFileLink({value,children,fallback}:{value:string;children:ReactNode;fallback:ReactNode}){
 const navigation=useContext(ProseFiles),reference=navigation?.resolve(value);
 const literal=<ProseFiles.Provider value={undefined}>{children}</ProseFiles.Provider>;
 if(!navigation)return fallback;
 if(!reference)return /^https?:\/\//i.test(value)?<ProseFiles.Provider value={undefined}>{fallback}</ProseFiles.Provider>:literal;
 return <LinkCard target={{kind:'file',value,file:reference}}><button type="button" className="md-path md-link md-file-reference" title={value} aria-label={`${reference.folder?'Show folder':'Open work on'} ${reference.path}${reference.line?` at line ${reference.line}`:''}`} onClick={()=>navigation.open(reference)}><span aria-hidden="true"><FileIcon path={reference.path} folder={reference.folder}/></span><span className="md-file-label">{literal}</span></button></LinkCard>;
}
/** Tokenize only prose, never code fences or command bodies; unresolved text is returned unchanged. Bare web addresses become links (LINK-1). */
export function ProseFileText({text}:{text:string}){
 const parts=splitUrls(text);
 if(parts.every(part=>'text' in part))return <ProseTokens text={text}/>;
 return <>{parts.map((part,n)=>'url' in part?<ExternalLink key={n} url={part.url} bare>{part.url}</ExternalLink>:<ProseTokens key={n} text={part.text}/>)}</>;
}
function ProseTokens({text}:{text:string}){
 const navigation=useContext(ProseFiles);
 const out:ReactNode[]=[];let previous=0;
 for(const match of text.matchAll(/[^\s`*\[\]()<>{}"'?,;!]+/gu)){
  let token=match[0];let reference=navigation?.resolve(token);if(navigation&&!reference){token=token.replace(/[.:]+$/,'');reference=navigation.resolve(token);}
  const start=match.index!;
  if(!reference){
   // A commit id written in prose; the card verifies it against the session's repository and stays plain text when it is not one.
   const id=token.replace(/[.:,]+$/,'');
   if(commitCandidate(id)){out.push(text.slice(previous,start));out.push(<LinkCard key={start} target={{kind:'commit',value:id}} focusable>{id}</LinkCard>);previous=start+id.length;}
   continue;
  }
  if(!token||!/[\p{L}_/\\]/u.test(token)||reference.folder&&!/[\\/]/.test(token))continue;
  out.push(text.slice(previous,start));out.push(<ProseFileLink key={start} value={token} fallback={token}>{token}</ProseFileLink>);previous=start+token.length;
 }
 if(!previous)return <>{text}</>;
 out.push(text.slice(previous));return <>{out}</>;
}
