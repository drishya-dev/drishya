import {GitBranchHeader} from './GitBranchHeader.tsx'; import {plural} from '../lib/plural.ts';
import {withGitPage} from '../lib/git-history-window.ts';
import {gitHistoryStore,type GitHistorySnapshot} from '../lib/git-history-cache.ts';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {GitHistoryPage,GitCommitDetail} from '../../../daemon/src/git-types.ts';
import {gitSessionLinkDescription} from '../../../daemon/src/git-types.ts';
import {HttpError,workspaceApi} from '../api.ts';
import {useApp} from '../state.ts';
import {useWorkspaceState} from '../lib/workspace-memory-react.ts';
import {useNarrowWorkspace} from '../lib/responsive-workspace.ts';
import {GitNetworkGraph} from './GitNetworkGraph.tsx';
import {collectSquashEvidence} from '../lib/git-squash.ts';
import {CommitRows} from './CommitRows.tsx';
import {refsInWindow} from '../lib/git-commit-rows.ts';
import {useReadingWorkspace} from './SessionWorkspace.tsx';
import {GitPatchReader} from './GitPatchReader.tsx';
import {FileIcon} from './FileIcon.tsx';
import {WholeSource} from './WholeSource.tsx';
import {GitAccess,grantGit} from './GitAccess.tsx';

// A reading surface may close while its already-approved Git read is still running.
// Reopening must queue behind that read, not race the daemon's per-recording lock.
const pendingGitReads=new Map<string,Promise<void>>();
function enqueueGitRead<T>(id:string,read:()=>Promise<T>):Promise<T> {
  const next=(pendingGitReads.get(id)??Promise.resolve()).then(read,read);
  const tail=next.then(()=>undefined,()=>undefined);pendingGitReads.set(id,tail);
  void tail.then(()=>{if(pendingGitReads.get(id)===tail)pendingGitReads.delete(id);});
  return next;
}

export function GitHistoryReader({id,close}:{id:string;close:()=>void}) {
  const source=useApp(s=>s.source),checkoutId=useApp(s=>s.checkoutId);
  const targetId=checkoutId??id,cacheScope=source??'default',cacheKey=`${id}:${checkoutId??'main'}`;
  const initialRef=useRef<{hydrated:boolean;snapshot?:GitHistorySnapshot}>(undefined);
  if(!initialRef.current){
    const snapshot=gitHistoryStore.get(cacheScope,cacheKey);
    initialRef.current={hydrated:!!(snapshot?.approved&&snapshot.value&&snapshot.pages.size>0),snapshot};
  }
  const initial=initialRef.current.snapshot,hydrated=initialRef.current.hydrated;
  const {workspace,approve}=useReadingWorkspace(),narrow=useNarrowWorkspace();
  const [approved,setApproved]=useState<boolean|undefined>(()=>initial?.approved?true:undefined),[granting,setGranting]=useState(false);
  const [start,setStart]=useState(()=>initial?.start??0),[reference,setReference]=useState(()=>initial?.reference??'all'),[referenceStart,setReferenceStart]=useState(()=>initial?.referenceStart??0);
  const [query,setQuery]=useState(()=>initial?.query??''),[filter,setFilter]=useState(()=>initial?.filter??''),[retry,setRetry]=useState(()=>initial?.retry??0);
  const [value,setValue]=useState<{key:string;data:GitHistoryPage}|undefined>(()=>initial?.value),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [selected,setSelected]=useState(()=>initial?.selected??''),[parent,setParent]=useState(()=>initial?.parent??0),[fileStart,setFileStart]=useState(()=>initial?.fileStart??0);
  const [detail,setDetail]=useState<GitCommitDetail|undefined>(()=>initial?.detail),[detailError,setDetailError]=useState(''),[detailLoading,setDetailLoading]=useState(false),[path,setPath]=useState(()=>initial?.path??'');
  const [refsOpen,setRefsOpen]=useState(false),[reading,setReading]=useState(()=>initial?.reading??false),[copied,setCopied]=useState(false);
  const [rowsOpen,setRowsOpen]=useWorkspaceState('git/rows',true),[hoverRow,setHoverRow]=useState(''),[hoverRef,setHoverRef]=useState(''),[hoverGraph,setHoverGraph]=useState(''),[reveal,setReveal]=useState<{hash:string;n:number}>(),[allRefs,setAllRefs]=useState(()=>initial?.allRefs??false);
  const generation=useRef<string|undefined>(initial?.value?.data.generation);
  const enqueue=<T,>(read:()=>Promise<T>)=>enqueueGitRead(id,read);
  const key=`${start}/${reference}/${referenceStart}/${filter}/${retry}`,data=value?.data;
  const [pages,setPages]=useState<Map<number,GitHistoryPage>>(()=>initial?new Map(initial.pages):new Map());
  const mainSeeds=useRef(new Set<string>(initial?.mainSeeds??[]));
  const viewRef=useRef<{scale:number;scrollLeft?:number;rowsScrollTop?:number}>({scale:initial?.scale??1,scrollLeft:initial?.scrollLeft,rowsScrollTop:initial?.rowsScrollTop});
  const detailCacheRef=useRef<Map<string,{detail:GitCommitDetail;path:string}>>(new Map(initial?.detailCache));
  const detailKey=selected&&data?`${targetId}:${selected}:${parent}:${fileStart}`:'';
  const loadedDetailKeyRef=useRef<string>(initial?.detail?initial.detailKey:'');
  const onViewChange=useCallback((view:{scale?:number;scrollLeft?:number})=>{
    if(view.scale!==undefined)viewRef.current.scale=view.scale;
    if(view.scrollLeft!==undefined)viewRef.current.scrollLeft=view.scrollLeft;
  },[]);
  const onRowsScrollTop=useCallback((top:number)=>{viewRef.current.rowsScrollTop=top;},[]);
  const snapshotRef=useRef<()=>void>(() => undefined);
  snapshotRef.current=()=>{
    if(!approved){if(approved===false)gitHistoryStore.delete(cacheScope,cacheKey);return;}
    if(!value||!pages.size)return;
    gitHistoryStore.upsert(cacheScope,cacheKey,{
      approved:true,
      start,reference,referenceStart,query,filter,retry,value,
      pages:new Map(pages),
      selected,parent,fileStart,detail,detailKey,
      detailCache:new Map(detailCacheRef.current),
      path,reading,allRefs,
      scale:viewRef.current.scale,
      scrollLeft:viewRef.current.scrollLeft,
      rowsScrollTop:viewRef.current.rowsScrollTop,
      mainSeeds:[...mainSeeds.current],
    });
  };
  useEffect(()=>{snapshotRef.current();});
  useEffect(()=>()=>snapshotRef.current(),[]);
  const history=useMemo(()=>[...pages.entries()].sort((a,b)=>a[0]-b[0]).flatMap(([,page])=>page.commits),[pages]);
  // Squash-merge evidence joins across loaded pages: a squash commit is usually newer than its branch.
  const evidence=useMemo(()=>collectSquashEvidence(pages.values()),[pages]);
  const links=useMemo(()=>new Map([...pages.values()].flatMap(page=>Object.entries(page.sessionLinks??{}))),[pages]);
  const bounds=[...pages.keys()].sort((a,b)=>a-b),newest=bounds[0]??0,oldest=bounds.at(-1)??0;
  const moreOlder=!!pages.get(oldest)?.more,moreNewer=newest>0;
  const extend=(direction:'older'|'newer')=>{if(loading)return;const next=direction==='older'?moreOlder?oldest+50:undefined:moreNewer?Math.max(0,newest-50):undefined;if(next!==undefined)setStart(next);};
  useEffect(()=>{
    if(approved!==undefined)return;
    let active=true;
    void workspaceApi.gitStatus(targetId).then(status=>{if(active)setApproved(status.approved);}).catch(error=>{if(active)setError(error.message);});
    return()=>{active=false;};
  },[targetId,approved]);
  useEffect(()=>{
    if(query===filter)return;
    const timer=setTimeout(()=>{setFilter(query);setReferenceStart(0);},250);
    return()=>clearTimeout(timer);
  },[query,filter]);
  useEffect(()=>{
    if(!approved||!workspace?.approved)return;
    if(value?.key===key&&pages.has(start))return;
    let active=true;setLoading(true);setError('');
    void enqueue(async()=>active?workspaceApi.gitHistory(targetId,{start,reference,referenceStart,q:filter,generation:generation.current}):undefined).then(next=>{
      if(!active||!next)return;generation.current=next.generation;setValue({key,data:next});
      setPages(previous=>withGitPage(previous,next));
      setSelected(current=>current||next.commits[0]?.hash||'');
    }).catch(error=>{if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[targetId,approved,workspace?.approved,key]);
  const revalidatedRef=useRef(false);
  useEffect(()=>{
    if(!hydrated||revalidatedRef.current||!approved||!workspace?.approved)return;
    revalidatedRef.current=true;
    let active=true;
    const savedGeneration=generation.current;
    const savedReference=reference,savedReferenceStart=referenceStart,savedFilter=filter,savedStart=start,savedKey=key;
    const loadedOffsets=[...pages.keys()].sort((a,b)=>a-b);
    void enqueue(async()=>{
      if(!active)return;
      let currentGen:string;
      try{
        currentGen=(await workspaceApi.gitGeneration(targetId)).generation;
      }catch(err){
        if(err instanceof HttpError&&err.status===403&&active){setApproved(false);gitHistoryStore.delete(cacheScope,cacheKey);return;}
        throw err;
      }
      if(!active||currentGen===savedGeneration)return;
      const offsets=loadedOffsets.length?loadedOffsets:[savedStart];
      const nextPages=new Map<number,GitHistoryPage>();
      let firstGen:string|undefined;
      try{
        for(const offset of offsets){
          if(!active)return;
          const next=await workspaceApi.gitHistory(targetId,{start:offset,reference:savedReference,referenceStart:savedReferenceStart,q:savedFilter,...(firstGen?{generation:firstGen}:{})});
          if(!firstGen)firstGen=next.generation;
          if(next.commits.length>0||offset===0)nextPages.set(offset,next);
        }
      }catch(err){
        if(err instanceof HttpError&&err.status===404&&savedReference!=='all'){
          const fallback=await workspaceApi.gitHistory(targetId,{start:0,reference:'all',referenceStart:0,q:savedFilter});
          if(!active)return;
          generation.current=fallback.generation;
          setReference('all');setStart(0);setReferenceStart(0);
          setValue({key:`0/all/0/${savedFilter}/${retry}`,data:fallback});
          setPages(new Map([[0,fallback]]));
          setSelected(current=>current&&fallback.commits.some(c=>c.hash===current)?current:(fallback.commits[0]?.hash??''));
          return;
        }
        throw err;
      }
      if(!active)return;
      if(!nextPages.size){
        const zero=await workspaceApi.gitHistory(targetId,{start:0,reference:savedReference,referenceStart:savedReferenceStart,q:savedFilter});
        if(!active)return;
        nextPages.set(0,zero);
      }
      const primaryPage=nextPages.get(savedStart)??nextPages.get(0)??[...nextPages.values()][0]!;
      generation.current=primaryPage.generation;
      setValue({key:savedKey,data:primaryPage});
      setPages(nextPages);
      const allHashes=new Set([...nextPages.values()].flatMap(p=>p.commits.map(c=>c.hash)));
      setSelected(current=>current&&allHashes.has(current)?current:(primaryPage.commits[0]?.hash??''));
    }).catch(err=>{if(active)setError((err as Error).message);});
    return()=>{active=false;};
  },[approved,workspace?.approved,targetId]);
  useEffect(()=>{
    setDetailError('');setCopied(false);
    if(!detailKey){setDetail(undefined);loadedDetailKeyRef.current='';return;}
    if(loadedDetailKeyRef.current===detailKey&&detail)return;
    const hit=detailCacheRef.current.get(detailKey);
    if(hit){
      loadedDetailKeyRef.current=detailKey;
      setDetail(hit.detail);
      setPath(current=>hit.detail.files.some(file=>file.path===current)?current:hit.path);
      return;
    }
    setDetail(undefined);
    let active=true;setDetailLoading(true);
    const gen=generation.current??data?.generation;
    void enqueue(async()=>active?workspaceApi.gitCommit(targetId,selected,parent,fileStart,gen):undefined).then(next=>{
      if(!active||!next)return;
      const nextPath=next.files.some(file=>file.path===path)?path:next.files[0]?.path??'';
      loadedDetailKeyRef.current=detailKey;
      if(detailCacheRef.current.has(detailKey))detailCacheRef.current.delete(detailKey);
      detailCacheRef.current.set(detailKey,{detail:next,path:nextPath});
      if(detailCacheRef.current.size>24){const oldest=detailCacheRef.current.keys().next().value;if(oldest!==undefined)detailCacheRef.current.delete(oldest);}
      setDetail(next);setPath(current=>next.files.some(file=>file.path===current)?current:next.files[0]?.path??'');
    }).catch(error=>{if(active)setDetailError(error.message);}).finally(()=>{if(active)setDetailLoading(false);});
    return()=>{active=false;};
  },[detailKey]);
  const refresh=()=>{setPages(new Map());mainSeeds.current.clear();setValue(undefined);generation.current=undefined;setDetail(undefined);detailCacheRef.current.clear();loadedDetailKeyRef.current='';viewRef.current={scale:1};gitHistoryStore.delete(cacheScope,cacheKey);setStart(0);setReferenceStart(0);setParent(0);setFileStart(0);setRetry(n=>n+1);};
  const consent=async()=>{setGranting(true);setError('');try{await grantGit(targetId,!!workspace?.approved,approve);setApproved(true);}catch(error){setError((error as Error).message);}finally{setGranting(false);}};
  const choose=(hash:string)=>{setSelected(hash);setParent(0);setFileStart(0);setReading(true);};
  // Stepping along a focused branch only moves the selection; it must not swap the graph for the commit's reading pane.
  const select=(hash:string)=>{setSelected(hash);setParent(0);setFileStart(0);};
  // A row picks the commit and brings it into view on the timeline; picking on the timeline needs no movement.
  const chooseRow=(hash:string)=>{choose(hash);setReveal(previous=>({hash,n:(previous?.n??0)+1}));};
  // Refs named by the commits in view, unless the reader searched or asked for every ref.
  const windowed=!!data&&!allRefs&&!filter,shownRefs=!data?[]:windowed?refsInWindow(data.references,history,{selected:reference}):data.references;
  const chooseRef=(next:string)=>{setPages(new Map());mainSeeds.current.clear();setValue(undefined);setDetail(undefined);loadedDetailKeyRef.current='';viewRef.current={scale:1};setSelected('');setReference(next);setStart(0);setParent(0);setFileStart(0);setReading(false);setRefsOpen(false);};
  const file=detail?.files.find(file=>file.path===path),commit=history.find(commit=>commit.hash===selected);
  const selectedLink=links.get(selected),working=pages.get(0)?.workingTree;
  const navigateFile=(current:boolean)=>{close();useApp.getState().set(current?{currentFile:path,explore:false}:{filePanel:path,filePanelFocus:'change',explore:false});};

  return <>
    {approved&&workspace?.approved&&<div className="atlas-toolbar"><GitBranchHeader data={data} reference={reference} choose={chooseRef} loading={loading}/><span title="Remote-tracking branches show their locally stored state. No fetch is performed.">Local refs{data?.shallow?' · shallow history':''}</span><button className="btn ghost" disabled={loading||granting} onClick={refresh}>Refresh</button></div>}
    {error&&<p className="atlas-error" role="alert">{error}<button className="btn ghost" onClick={refresh}>Retry history</button></p>}
    {approved===undefined&&!error?<section className="atlas-access" aria-busy="true"><p>Checking Git access…</p></section>:!approved||!workspace?.approved?workspace?.root?<GitAccess workspaceApproved={!!workspace.approved} busy={granting} disabled={granting} grant={()=>void consent()}/>:<section className="atlas-access"><p>This session did not record a workspace, so there is no repository to read.</p></section>:<div className={`atlas-layout${reading?' atlas-reading':''}`}>
      <details className="atlas-references" open={!narrow||refsOpen} onToggle={event=>{if(narrow)setRefsOpen(event.currentTarget.open);}}><summary>Branches &amp; tags{data?` · ${data.referenceTotal}`:''}</summary><div className="atlas-ref-content"><label>Find a branch or tag<input aria-label="Find Git branches and tags" maxLength={200} value={query} onChange={event=>setQuery(event.target.value)}/></label><button className="atlas-ref" aria-pressed={reference==='all'} onClick={()=>chooseRef('all')}><span>◎</span><strong>All local history</strong></button><div className="atlas-ref-list" aria-label="Git references">{shownRefs.map(ref=><button className="atlas-ref" key={ref.id} title={`${ref.kind} · ${ref.name}`} aria-pressed={reference===ref.id} onClick={()=>chooseRef(ref.id)} onMouseEnter={()=>setHoverRef(ref.name)} onMouseLeave={()=>setHoverRef('')} onFocus={()=>setHoverRef(ref.name)} onBlur={()=>setHoverRef('')}><span aria-hidden="true">{ref.kind==='tag'?'◇':ref.kind==='remote'?'↗':'⑂'}</span><strong>{ref.name}</strong>{ref.current&&<small>HEAD</small>}</button>)}{data&&!shownRefs.length&&<p>{windowed?'No branch or tag labels in the commits in view.':'No matching references.'}</p>}</div>{data&&!filter&&<div className="atlas-ref-scope" role="group" aria-label="Reference scope"><button aria-pressed={!allRefs} onClick={()=>setAllRefs(false)}>In view</button><button aria-pressed={allRefs} onClick={()=>setAllRefs(true)}>All {data.referenceTotal}</button></div>}{!windowed&&<nav className="atlas-ref-pages" aria-label="Reference pages"><button className="btn ghost" aria-label="Previous references" disabled={!referenceStart||loading} onClick={()=>setReferenceStart(n=>Math.max(0,n-100))}>←</button><span>{data?`${Math.min(referenceStart+1,data.referenceCount)}–${Math.min(referenceStart+100,data.referenceCount)} / ${data.referenceCount}`:'…'}</span><button className="btn ghost" aria-label="Next references" disabled={!data||referenceStart+100>=data.referenceCount||loading} onClick={()=>setReferenceStart(n=>n+100)}>→</button></nav>}</div></details>
      <section className="atlas-history" aria-label="Commit graph">{working&&working.files.length>0&&<details className="atlas-working"><summary>Working tree · this session <small>{working.files.length} matching {working.files.length===1?'file':'files'}</small></summary><p>Changed-line text matches edits. Positions are not verified; this is not proof of who last changed the file.{working.omitted>0?` ${plural(working.omitted,'path')} could not be compared in this bounded sample.`:''}</p><div className="atlas-files">{working.files.map(file=><button key={file.path} title={gitSessionLinkDescription(file.links[0]!)} onClick={()=>{close();useApp.getState().set({filePanel:file.path,filePanelFocus:'change',explore:false});}}><FileIcon path={file.path}/><span>{file.path}</span><small>{file.links[0]?.turn?`turn ${file.links[0].turn}`:'Edit'}</small></button>)}</div></details>}<header><strong>{data?.selectedReference?.name??'All refs'}</strong><span>Parent topology</span>{!!history.length&&<button className="btn ghost atlas-rows-toggle" aria-expanded={rowsOpen} aria-controls="atlas-commit-rows" onClick={()=>setRowsOpen(!rowsOpen)}>Commits · {history.length}</button>}</header>{loading&&!data?<p className="atlas-empty" role="status">Reading local history…</p>:data&&!data.commits.length?<p className="atlas-empty">No commits in this view. New repositories appear here after their first commit.</p>:<GitNetworkGraph mirrorRef={hoverRef} commits={history} selected={selected} choose={choose} select={select} primary={data?.mainline} seeds={mainSeeds.current} resetKey={`${reference}/${retry}`} moreOlder={moreOlder} moreNewer={moreNewer} loading={loading} extend={extend} offset={newest} evidence={evidence} links={links} mirror={hoverRow} onHover={setHoverGraph} reveal={reveal} initialScale={viewRef.current.scale} initialScrollLeft={viewRef.current.scrollLeft} onViewChange={onViewChange}/>}{rowsOpen&&!!history.length&&<section id="atlas-commit-rows" className="atlas-rows" aria-label="Commit list"><CommitRows commits={history} selected={selected} hovered={hoverRow||hoverGraph} links={links} choose={chooseRow} hover={setHoverRow} initialScrollTop={viewRef.current.rowsScrollTop} onScrollTop={onRowsScrollTop}/></section>}</section>
      <section className="atlas-detail" aria-label="Selected commit"><header><button className="btn ghost atlas-back" aria-label="Back to Git graph" onClick={()=>setReading(false)}>← Graph</button><strong>{selected?selected.slice(0,12):'Select a commit'}</strong>{selected&&links.get(selected)?.operationId&&<button className="btn ghost" title={selectedLink?gitSessionLinkDescription(selectedLink):undefined} onClick={()=>{const operationId=links.get(selected)!.operationId!;close();useApp.getState().select(operationId);}}>{selectedLink?.basis==='commit-time-paths'?'Command matches':'Seen in'} turn {selectedLink?.turn??'—'}</button>}{selected&&<button className="btn ghost" aria-label="Copy commit hash" onClick={()=>void navigator.clipboard.writeText(selected).then(()=>setCopied(true),()=>setCopied(false))}>{copied?'Copied':'Copy hash'}</button>}</header>
        {detailError&&<p className="atlas-error" role="alert">{detailError}<button className="btn ghost" onClick={refresh}>Refresh history</button></p>}
        {detailLoading&&!detail&&<p className="atlas-empty" role="status">Reading commit changes…</p>}
        {detail&&<div className="atlas-detail-content"><div className="atlas-message"><CommitMessage key={detail.hash} text={detail.message}/><span>{commit?.author} · {commit?.time?new Date(commit.time).toLocaleString():''}</span></div>
          <div className="atlas-parent"><label>Compare with<select aria-label="Commit comparison parent" value={parent} onChange={event=>{setParent(Number(event.target.value));setFileStart(0);}}>{detail.parents.length?detail.parents.map((hash,index)=><option key={hash} value={index}>Parent {index+1} · {hash.slice(0,10)}</option>):<option value={0}>Empty tree · root commit</option>}</select></label></div>
          <div className="atlas-files" aria-label="Commit changed files">{detail.files.map(file=><button key={file.path} title={file.path} aria-pressed={file.path===path} onClick={()=>setPath(file.path)}><FileIcon path={file.path}/><span>{file.path}</span><small>{file.status}</small></button>)}{!detail.total&&<p>No changed paths against this parent.</p>}{detail.protectedCount>0&&<small>{detail.protectedCount} protected paths excluded.</small>}{detail.omissions.map(item=><p key={item.path}>{item.path} · patch exceeds the inspection limit.</p>)}</div>
          {detail.total>50&&<nav className="atlas-file-pages" aria-label="Commit file pages"><button className="btn ghost" disabled={!fileStart||detailLoading} onClick={()=>setFileStart(n=>Math.max(0,n-50))}>Previous files</button><span>{fileStart+1}–{Math.min(fileStart+50,detail.total)} / {detail.total}</span><button className="btn ghost" disabled={fileStart+50>=detail.total||detailLoading} onClick={()=>setFileStart(n=>n+50)}>Next files</button></nav>}
          {file&&<><div className="atlas-file-actions"><strong>{file.path}</strong><button className="btn ghost" onClick={()=>navigateFile(true)}>Current file</button><button className="btn ghost" onClick={()=>navigateFile(false)}>Agent work</button></div><GitPatchReader key={file.fingerprint} file={file} openRecorded={(recordedPath,key)=>{close();useApp.getState().set({filePanel:recordedPath,filePanelFocus:'change',filePanelEvidence:key,explore:false});}}/></>}
        </div>}
      </section>
    </div>}
  </>;
}

function CommitMessage({text}:{text:string}) {
  const [full,setFull]=useState(false),[copied,setCopied]=useState(false),viewport=useRef<HTMLDivElement>(null);
  return <><pre>{text.slice(0,32768)}</pre>{text.length>32768&&<><button className="btn ghost" onClick={()=>setFull(!full)} aria-expanded={full}>{full?'Close full message':'Read full commit message'}</button>{full&&<div className="atlas-full-message" ref={viewport} tabIndex={0} role="region" aria-label="Full commit message"><WholeSource text={text} path="commit-message.txt" viewport={viewport} wrap/></div>}</>}{text.length>32768&&<button className="btn ghost atlas-copy-message" onClick={()=>void navigator.clipboard.writeText(text).then(()=>setCopied(true),()=>setCopied(false))}>{copied?'Copied message':'Copy message'}</button>}</>;
}
