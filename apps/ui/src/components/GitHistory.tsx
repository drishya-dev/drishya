import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {GitHistoryPage,GitCommitDetail} from '../../../daemon/src/git-types.ts';
import {workspaceApi} from '../api.ts';
import {useApp} from '../state.ts';
import {useWorkspaceState} from '../lib/workspace-memory-react.ts';
import {useNarrowWorkspace} from '../lib/responsive-workspace.ts';
import {commitRail} from '../lib/commit-rail.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {ReadingResize} from './ReadingResize.tsx';
import {useSessionWorkspace} from './SessionWorkspace.tsx';
import {GitPatchReader} from './GitPatchReader.tsx';
import {FileIcon} from './FileIcon.tsx';
import {WholeSource} from './WholeSource.tsx';
import './git-history.css';

export const openGitHistory=()=>window.dispatchEvent(new Event('drishya-git-history'));
export function GitHistory() {
  const [open,setOpen]=useState(false),id=useApp(s=>s.recordingId),source=useApp(s=>s.source),mode=useApp(s=>s.mode);
  useEffect(()=>{
    const show=()=>{const state=useApp.getState();if(state.source?.kind!=='daemon'||!state.recordingId||state.recordingId.includes('+')||state.mode!=='history')return;state.set({developerWorkspace:false,currentFile:undefined,filePanel:undefined,selectedOp:undefined,follow:false,held:true});setOpen(true);};
    window.addEventListener('drishya-git-history',show);return()=>window.removeEventListener('drishya-git-history',show);
  },[]);
  useEffect(()=>setOpen(false),[id,source,mode]);
  return open&&id?<GitHistoryReader key={id} id={id} close={()=>setOpen(false)}/>:null;
}

function GitHistoryReader({id,close}:{id:string;close:()=>void}) {
  const {workspace,approve}=useSessionWorkspace(),narrow=useNarrowWorkspace();
  const [width,setWidth]=useWorkspaceState('git/historyWidth',1180);
  const [approved,setApproved]=useState(false),[granting,setGranting]=useState(false);
  const [start,setStart]=useState(0),[reference,setReference]=useState('all'),[referenceStart,setReferenceStart]=useState(0);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState(''),[retry,setRetry]=useState(0);
  const [value,setValue]=useState<{key:string;data:GitHistoryPage}>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(''),[parent,setParent]=useState(0),[fileStart,setFileStart]=useState(0);
  const [detail,setDetail]=useState<GitCommitDetail>(),[detailError,setDetailError]=useState(''),[detailLoading,setDetailLoading]=useState(false),[path,setPath]=useState('');
  const [refsOpen,setRefsOpen]=useState(false),[reading,setReading]=useState(false),[copied,setCopied]=useState(false);
  const queue=useRef<Promise<unknown>>(Promise.resolve()),generation=useRef<string|undefined>(undefined);
  const enqueue=<T,>(read:()=>Promise<T>)=>{const next=queue.current.then(read,read);queue.current=next.catch(()=>undefined);return next;};
  const key=`${start}/${reference}/${referenceStart}/${filter}/${retry}`,data=value?.key===key?value.data:undefined;
  useEffect(()=>{let active=true;void workspaceApi.gitStatus(id).then(status=>{if(active)setApproved(status.approved);}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[id]);
  useEffect(()=>{const timer=setTimeout(()=>{setFilter(query);setReferenceStart(0);},250);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    if(!approved||!workspace?.approved)return;let active=true;setLoading(true);setError('');
    void enqueue(async()=>active?workspaceApi.gitHistory(id,{start,reference,referenceStart,q:filter,generation:generation.current}):undefined).then(next=>{
      if(!active||!next)return;generation.current=next.generation;setValue({key,data:next});setSelected(current=>next.commits.some(commit=>commit.hash===current)?current:next.commits[0]?.hash??'');
    }).catch(error=>{if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id,approved,workspace?.approved,key]);
  useEffect(()=>{
    setDetail(undefined);setDetailError('');setCopied(false);
    if(!selected||!data)return;let active=true;setDetailLoading(true);
    void enqueue(async()=>active?workspaceApi.gitCommit(id,selected,parent,fileStart,data.generation):undefined).then(next=>{
      if(active&&next){setDetail(next);setPath(current=>next.files.some(file=>file.path===current)?current:next.files[0]?.path??'');}
    }).catch(error=>{if(active)setDetailError(error.message);}).finally(()=>{if(active)setDetailLoading(false);});
    return()=>{active=false;};
  },[id,selected,parent,fileStart,data]);
  const refresh=()=>{generation.current=undefined;setStart(0);setReferenceStart(0);setParent(0);setFileStart(0);setRetry(n=>n+1);};
  const consent=async()=>{setGranting(true);setError('');try{if(!workspace?.approved)await approve();await workspaceApi.approveGit(id);setApproved(true);}catch(error){setError((error as Error).message);}finally{setGranting(false);}};
  const choose=(hash:string)=>{setSelected(hash);setParent(0);setFileStart(0);setReading(true);};
  const chooseRef=(next:string)=>{setReference(next);setStart(0);setParent(0);setFileStart(0);setReading(false);setRefsOpen(false);};
  const rail=useMemo(()=>commitRail(data?.commits??[]),[data]);
  const file=detail?.files.find(file=>file.path===path),commit=data?.commits.find(commit=>commit.hash===selected);
  const navigateFile=(current:boolean)=>{close();useApp.getState().set(current?{currentFile:path,explore:false}:{filePanel:path,filePanelFocus:'change',explore:false});};
  return <ReadingDialog title="Git history" windowId="Git history" resetWindow={()=>setWidth(1180)} close={close} className="git-atlas" style={{width:`min(${width}px,calc(100vw - 28px))`}} resizeControl={<ReadingResize value={width} minimum={700} maximum={1800} change={setWidth} reset={()=>setWidth(1180)} label="Resize Git history reading space" fromRight/>}>
    <div className="atlas-toolbar"><div><span className="atlas-eyebrow">Branch atlas</span><strong>{data?.branch??workspace?.root?.replace(/\\/g,'/').split('/').at(-1)??'Local repository'}</strong></div><span title="Remote-tracking branches show their locally stored state. No fetch is performed.">Local refs{data?.shallow?' · shallow history':''}</span><button className="btn ghost" disabled={loading||granting} onClick={refresh}>Refresh</button></div>
    {error&&<p className="atlas-error" role="alert">{error}<button className="btn ghost" onClick={refresh}>Retry history</button></p>}
    {!approved||!workspace?.approved?<section className="atlas-access"><h3>Explore your repository’s history</h3><p>Read local branches, tags, commits and their changes in this workspace.</p><button className="btn" disabled={granting||!workspace?.root} onClick={()=>void consent()}>{granting?'Approving…':'Approve read-only Git history'}</button>{!workspace?.root&&<p>No workspace root was captured for this session.</p>}</section>:<div className={`atlas-layout${narrow&&reading?' atlas-reading':''}`}>
      <details className="atlas-references" open={!narrow||refsOpen} onToggle={event=>{if(narrow)setRefsOpen(event.currentTarget.open);}}><summary>Branches &amp; tags{data?` · ${data.referenceTotal}`:''}</summary><div className="atlas-ref-content"><label>Find a branch or tag<input aria-label="Find Git branches and tags" maxLength={200} value={query} onChange={event=>setQuery(event.target.value)}/></label><button className="atlas-ref" aria-pressed={reference==='all'} onClick={()=>chooseRef('all')}><span>◎</span><strong>All local history</strong></button><div className="atlas-ref-list" aria-label="Git references">{data?.references.map(ref=><button className="atlas-ref" key={ref.id} title={`${ref.kind} · ${ref.name}`} aria-pressed={reference===ref.id} onClick={()=>chooseRef(ref.id)}><span aria-hidden="true">{ref.kind==='tag'?'◇':ref.kind==='remote'?'↗':'⑂'}</span><strong>{ref.name}</strong>{ref.current&&<small>HEAD</small>}</button>)}{data&&!data.references.length&&<p>No matching references.</p>}</div><nav className="atlas-ref-pages" aria-label="Reference pages"><button className="btn ghost" aria-label="Previous references" disabled={!referenceStart||loading} onClick={()=>setReferenceStart(n=>Math.max(0,n-100))}>←</button><span>{data?`${Math.min(referenceStart+1,data.referenceCount)}–${Math.min(referenceStart+100,data.referenceCount)} / ${data.referenceCount}`:'…'}</span><button className="btn ghost" aria-label="Next references" disabled={!data||referenceStart+100>=data.referenceCount||loading} onClick={()=>setReferenceStart(n=>n+100)}>→</button></nav></div></details>
      <section className="atlas-history" aria-label="Commit graph"><header><strong>{data?.selectedReference?.name??'All refs'}</strong><span>Parent topology</span></header><div className="atlas-commit-list" tabIndex={0} aria-label="Commits" onKeyDown={event=>{
        if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
        const rows=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('.atlas-commit')];if(!rows.length)return;const index=rows.indexOf(event.target as HTMLButtonElement);event.preventDefault();rows[event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();
      }}>
        {loading&&!data&&<p className="atlas-empty" role="status">Reading local history…</p>}
        {data&&!data.commits.length&&<p className="atlas-empty">No commits in this view. New repositories appear here after their first commit.</p>}
        {data?.commits.map((item,index)=>{const row=rail.rows[index]!,railWidth=16+rail.lanes*12;return <button key={item.hash} className="atlas-commit" data-commit-hash={item.hash} aria-pressed={selected===item.hash} aria-label={`${item.subject||'Untitled commit'} · ${item.hash.slice(0,8)}`} style={{'--rail-width':`${railWidth}px`} as CSSProperties} onClick={()=>choose(item.hash)}>
          <svg className="atlas-rail" width={railWidth} height="100%" viewBox={`0 0 ${railWidth} 92`} preserveAspectRatio="none" aria-hidden="true">{row.segments.map((edge,n)=><path key={n} className={`rail-lane-${edge.from%6}`} d={`M${10+edge.from*12},${edge.start*92} C${10+edge.from*12},${(edge.start+edge.end)*46} ${10+edge.to*12},${(edge.start+edge.end)*46} ${10+edge.to*12},${edge.end*92}`}/>)}<circle cx={10+row.lane*12} cy="46" r={item.parents.length>1?4:3} className={`rail-lane-${row.lane%6}`}/></svg>
          <span className="atlas-commit-copy"><strong>{item.subject||'Untitled commit'}</strong><span><code>{item.hash.slice(0,8)}</code><span>{item.author}</span><time title={item.time}>{new Date(item.time).toLocaleDateString()}</time></span>{!!item.labels.length&&<span className="atlas-labels">{item.labels.map((label,n)=><em key={n}>{label}</em>)}{item.omittedLabels>0&&<em>+{item.omittedLabels}</em>}</span>}{row.hidden>0&&<small>{row.hidden} parent links outside the rail</small>}</span>
        </button>;})}
      </div><footer><nav aria-label="Commit pages"><button className="btn ghost" disabled={!start||loading} onClick={()=>{setStart(n=>Math.max(0,n-50));setParent(0);setFileStart(0);}}>Newer</button><span>{data?.commits.length?`${start+1}–${start+data.commits.length}`:'0'} commits</span><button className="btn ghost" disabled={!data?.more||loading} onClick={()=>{setStart(n=>n+50);setParent(0);setFileStart(0);}}>Older</button></nav>{rail.continuations>0&&<small>Parent lines continue beyond this page.</small>}</footer></section>
      <section className="atlas-detail" aria-label="Selected commit"><header><button className="btn ghost atlas-back" onClick={()=>setReading(false)}>← Commits</button><strong>{selected?selected.slice(0,12):'Select a commit'}</strong>{selected&&<button className="btn ghost" aria-label="Copy commit hash" onClick={()=>void navigator.clipboard.writeText(selected).then(()=>setCopied(true),()=>setCopied(false))}>{copied?'Copied':'Copy hash'}</button>}</header>
        {detailError&&<p className="atlas-error" role="alert">{detailError}<button className="btn ghost" onClick={refresh}>Refresh history</button></p>}
        {detailLoading&&!detail&&<p className="atlas-empty" role="status">Reading commit changes…</p>}
        {detail&&<div className="atlas-detail-content"><div className="atlas-message"><CommitMessage key={detail.hash} text={detail.message}/><span>{commit?.author} · {commit?.time?new Date(commit.time).toLocaleString():''}</span></div>
          <div className="atlas-parent"><label>Compare with<select aria-label="Commit comparison parent" value={parent} onChange={event=>{setParent(Number(event.target.value));setFileStart(0);}}>{detail.parents.length?detail.parents.map((hash,index)=><option key={hash} value={index}>Parent {index+1} · {hash.slice(0,10)}</option>):<option value={0}>Empty tree · root commit</option>}</select></label></div>
          <div className="atlas-files" aria-label="Commit changed files">{detail.files.map(file=><button key={file.path} title={file.path} aria-pressed={file.path===path} onClick={()=>setPath(file.path)}><FileIcon path={file.path}/><span>{file.path}</span><small>{file.status}</small></button>)}{!detail.total&&<p>No changed paths against this parent.</p>}{detail.protectedCount>0&&<small>{detail.protectedCount} protected paths excluded.</small>}{detail.omissions.map(item=><p key={item.path}>{item.path} · patch exceeds the inspection limit.</p>)}</div>
          {detail.total>50&&<nav className="atlas-file-pages" aria-label="Commit file pages"><button className="btn ghost" disabled={!fileStart||detailLoading} onClick={()=>setFileStart(n=>Math.max(0,n-50))}>Previous files</button><span>{fileStart+1}–{Math.min(fileStart+50,detail.total)} / {detail.total}</span><button className="btn ghost" disabled={fileStart+50>=detail.total||detailLoading} onClick={()=>setFileStart(n=>n+50)}>Next files</button></nav>}
          {file&&<><div className="atlas-file-actions"><strong>{file.path}</strong><button className="btn ghost" onClick={()=>navigateFile(true)}>Current file</button><button className="btn ghost" onClick={()=>navigateFile(false)}>Recorded work</button></div><GitPatchReader key={file.fingerprint} file={file}/></>}
        </div>}
      </section>
    </div>}
  </ReadingDialog>;
}

function CommitMessage({text}:{text:string}) {
  const [full,setFull]=useState(false),[copied,setCopied]=useState(false),viewport=useRef<HTMLDivElement>(null);
  return <><pre>{text.slice(0,32768)}</pre>{text.length>32768&&<><button className="btn ghost" onClick={()=>setFull(!full)} aria-expanded={full}>{full?'Close full message':'Read full commit message'}</button>{full&&<div className="atlas-full-message" ref={viewport} tabIndex={0} role="region" aria-label="Full commit message"><WholeSource text={text} path="commit-message.txt" viewport={viewport} wrap/></div>}</>}{text.length>32768&&<button className="btn ghost atlas-copy-message" onClick={()=>void navigator.clipboard.writeText(text).then(()=>setCopied(true),()=>setCopied(false))}>{copied?'Copied message':'Copy message'}</button>}</>;
}
