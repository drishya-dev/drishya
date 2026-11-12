import {operationOutcome} from '../lib/operation-outcome.ts';
import {useEffect,useState} from 'react';
import {commandPage,type CommandPage,type CommandQuery} from '../../../../packages/scene/src/commands.ts';
import {useApp} from '../state.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {CommandText} from './CommandText.tsx';
import {ArtifactReader} from './ArtifactReader.tsx';
import {ExecPatchMaterial} from './ExecPatchMaterial.tsx';
import './captured-commands.css';

/** An occasional investigation destination, not another resident panel or command runner. */
export function CapturedCommands() {
  const [open,setOpen]=useState(false),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode);
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener('drishya-commands',show);return()=>window.removeEventListener('drishya-commands',show);},[]);
  useEffect(()=>setOpen(false),[id,mode]);
  return open&&id&&mode==='history'?<CommandsReader key={id} close={()=>setOpen(false)}/>:null;
}
function CommandsReader({close}:{close:()=>void}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId)!,projection=useApp(s=>s.projection);
  const [input,setInput]=useState(''),[query,setQuery]=useState<CommandQuery>({}),[retry,setRetry]=useState(0);
  const [value,setValue]=useState<{key:string;page:CommandPage}>(),[error,setError]=useState('');
  const key=JSON.stringify([query,retry]),page=value?.key===key?value.page:undefined;
  useEffect(()=>{const timer=setTimeout(()=>setQuery(old=>(old.q??'')===input?old:{q:input,status:old.status}),200);return()=>clearTimeout(timer);},[input]);
  useEffect(()=>{
    let active=true;setError('');
    const request=source?.commands?source.commands(id,query):source?.kind==='bundle'&&projection?Promise.resolve(commandPage(projection.operations,query)):Promise.reject(new Error('Command review is unavailable for this source.'));
    void request.then(page=>{if(active)setValue({key,page});}).catch(error=>{if(active)setError(error.message);});
    return()=>{active=false;};
  },[source,id,key]);
  return <ReadingDialog title="Commands" className="captured-commands" close={close}>
    <div className="commands-toolbar"><label><span>Find command</span><input type="search" aria-label="Filter command previews" placeholder="Command or tool…" maxLength={200} value={input} onChange={e=>setInput(e.target.value)}/></label><label><span>Tool outcome</span><select aria-label="Command outcome" value={query.status??''} onChange={e=>setQuery({q:input,status:e.target.value?e.target.value as CommandQuery['status']:undefined})}><option value="">All tool outcomes</option><option value="error">Failed</option><option value="ok">Returned / completed</option><option value="running">Running</option><option value="unknown">Unknown</option></select></label><button className="btn" onClick={()=>{setQuery({q:input,status:query.status});setRetry(n=>n+1);}}>Refresh</button></div>
    <div className="commands-caption"><span>{page?`${page.total.toLocaleString()} matching commands`:'Loading commands…'}</span><small>Newest first · Search covers previews · Tool return does not prove nested commands passed.</small></div>
    {error?<p className="commands-error" role="alert">{error}<button className="btn" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>:!page?<p className="commands-empty" role="status">Reading the session command index…</p>:<>
      <div className="commands-list" aria-label="Command results">{page.items.map(item=>{const outcome=operationOutcome({status:item.status,tool:item.tool,detail:{kind:'shell',command:item.command,exitCode:item.exitCode}});return <article className="captured-command" data-command-id={item.id} key={item.id}>
        <header><span className={`command-outcome outcome-${outcome.tone}`} title={outcome.explanation}>{outcome.label}</span><span>{item.tool}{item.exitCode!=null?` · exit ${item.exitCode}`:''}</span><time title={item.time} dateTime={item.time}>{item.time?new Date(item.time).toLocaleString():'Time unavailable'}</time></header>
        <ExecPatchMaterial
          id={`commands/${item.id}`}
          command={item.command}
          truncated={item.truncated}
          full
          inputArtifactId={item.inputArtifactId}
          rawFallback={item.truncated?<><pre className="command-preview">{item.command}</pre><small className="commands-limit">Preview · open the input for complete content.</small>{item.inputArtifactId&&<details className="command-full-input"><summary>Full input</summary><ArtifactReader id={item.inputArtifactId} kind="code" navigationSlot={`commands/${item.id}`}/></details>}</>:<CommandText text={item.command}/>}
        />
        <footer><button className="btn ghost" onClick={()=>{useApp.getState().select(item.id);close();}}>Open activity <span aria-hidden="true">↗</span></button></footer>
      </article>;})}{!page.items.length&&<p className="commands-empty">No commands match. Try another command or outcome.</p>}</div>
      <nav className="commands-pages" aria-label="Command pages"><button className="btn" disabled={!page.newer&&!query.cursor} onClick={()=>setQuery({q:query.q,status:query.status})}>Newest</button><button className="btn" disabled={!page.newer} onClick={()=>setQuery({...query,cursor:page.newer,direction:'newer'})}>Newer</button><span>Up to 25 per page</span><button className="btn" disabled={!page.older} onClick={()=>setQuery({...query,cursor:page.older,direction:'older'})}>Older</button></nav>
    </>}
  </ReadingDialog>;
}
