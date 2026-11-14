import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {workspaceApi} from '../api.ts';
import type {CompareEvidence,CompareFile,CompareGroup,CompareRef,CompareRefs,ComparePull,ComparePulls,GitCompareResult} from '../../../daemon/src/git-compare-types.ts';
import type {GitFile,GitSnapshot} from '../../../daemon/src/git-types.ts';
import {useApp} from '../state.ts';
import {agentName} from '../lib/identity.ts';
import {fileName,fileFolder} from '../lib/file-identity.ts';
import {useWorkspaceMemory,useWorkspaceState} from '../lib/workspace-memory-react.ts';
import {useReadingWorkspace} from './SessionWorkspace.tsx';
import {GitAccess,grantGit} from './GitAccess.tsx';
import {WorkspaceOptions} from './WorkspaceOptions.tsx';
import {FileReadingActions} from './FileReadingActions.tsx';
import {openChanges,type ChangesPreset} from '../lib/open-changes.ts';
import {loadReviewMarks,previousReviewNote,reviewMarkId,saveReviewMarks,updateReviewMark,type ReviewMark} from '../lib/git-review-marks.ts';
import {buildHandoff,type HandoffFile} from '../lib/changes-handoff.ts';
import {GitPatchReader} from './GitPatchReader.tsx';
import {FileIcon} from './FileIcon.tsx';
import {InterfaceGlyph} from './InterfaceGlyph.tsx'; import {plural,pluralWord} from '../lib/plural.ts';
import {useWaitNotice} from '../lib/use-wait-notice.ts';
import './compare-window.css';

// GIT-8, named Changes by GIT-9. It replaces the header's old Changes: two branches (or a pull request against its base) from their merge-base, with
// the files changed on both sides first, and under each file the agents of this session that wrote it. GIT-9 added what Git review had:
// reviewed marks with a note (keyed to the fingerprint of the patch shown) and the redacted handoff packet. Strictly a reader:
// the daemon never fetches, checks out or moves anything. The diff itself is the shared patch reader.

type Preset=ChangesPreset;
const PRESETS:[Preset,string,string][]=[
  ['uncommitted','Uncommitted','What is changed in the working tree right now'],
  ['session','This session','This session’s branch against the branch it started from'],
  ['branch','Branch','Two branches, remote branches or tags from their merge-base'],
  ['pr','Pull request','An open pull request against its base'],
];

interface Row {path:string;group:CompareGroup|'tree';added?:number;removed?:number;binary?:boolean;note?:string;file?:CompareFile;git?:GitFile}

/** Lines the patch adds and removes, counted from hunks only (not the `+++`/`---` headers). */
function patchCounts(patch:string){
  let added=0,removed=0,inHunk=false;
  for(const line of patch.split('\n')){
    if(line.startsWith('diff --git'))inHunk=false;
    else if(line.startsWith('@@'))inHunk=true;
    else if(inHunk&&line[0]==='+')added++;
    else if(inHunk&&line[0]==='-')removed++;
  }
  return {added,removed};
}
const word=(status:string|undefined)=>status==='A'?'new':status==='D'?'deleted':undefined;
const gitWord=(status:string)=>{const code=status.trim();return code==='??'?'untracked':code.includes('U')?'conflict':code.includes('D')?'deleted':code.includes('A')?'new':undefined;};
const ago=(time:string|undefined)=>{
  const then=Date.parse(time??'');if(!Number.isFinite(then))return '';
  const days=Math.floor((Date.now()-then)/86_400_000);
  return days<1?'today':days<2?'yesterday':days<60?`${days} days ago`:days<700?`${Math.round(days/30)} months ago`:`${Math.round(days/365)} years ago`;
};
const isOid=(value:string|undefined)=>!!value&&/^[a-f0-9]{40,64}$/.test(value);
const nameOf=(ref:{name:string}|undefined)=>ref?.name??'';

export { CompareButton } from './CompareButton.tsx';

/** Mounted once in the viewer, beside the Workspace. Remembers its sides and file for the session so closing returns to the same place. */
export function CompareWindow() {
  const checkoutId=useApp(s=>s.checkoutId);
  const open=useApp(s=>s.compareOpen),id=useApp(s=>s.recordingId),source=useApp(s=>s.source),mode=useApp(s=>s.mode),workspaceOpen=useApp(s=>s.developerWorkspace);
  useEffect(()=>{if(open&&workspaceOpen)useApp.setState({compareOpen:false});},[open,workspaceOpen]);
  if(!open||mode!=='history'||!id||id.includes('+'))return null;
  // An offline copy or the bundled demo has no repository on this machine; say so instead of a dead button.
  if(source?.kind!=='daemon')return <section className="developer-workspace compare-window" aria-label="Changes"><header className="compare-header"><strong>Changes</strong><span className="compare-header-end"><button className="btn ghost" onClick={()=>useApp.setState({compareOpen:false})}>Back to agent</button></span></header><p className="compare-note">Changes reads a repository on this machine. This copy of the session has none, so there is nothing to show.</p></section>;
  return <CompareContent key={`${id}:${checkoutId??"main"}`} id={id}/>;
}

function CompareContent({id}:{id:string}) {
  const checkoutId=useApp(s=>s.checkoutId);
  // FILES-16: every Git read, the access grant and the review marks belong to the checkout chosen in Files, else the session's own.
  const cid=checkoutId??id;
  const {workspace,approve}=useReadingWorkspace();
  const projection=useApp(s=>s.projection);
  const section=useRef<HTMLElement>(null);
  const alive=useRef(true);
  // Reading a file from here closes Changes; the file reader then offers a way back ("← Changes").
  const memory=useWorkspaceMemory();
  useEffect(()=>{memory.set('compare/return',false);},[memory]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [consent,setConsent]=useState<boolean>(),[granting,setGranting]=useState(false);
  const [refs,setRefs]=useState<CompareRefs>(),[pulls,setPulls]=useState<ComparePulls>();
  const [preset,setPreset]=useWorkspaceState<Preset>('compare/preset','session');
  const [baseRef,setBaseRef]=useWorkspaceState<string|undefined>('compare/base',undefined);
  const [headRef,setHeadRef]=useWorkspaceState<string|undefined>('compare/head',undefined);
  const [prNumber,setPrNumber]=useWorkspaceState<number|undefined>('compare/pr',undefined);
  const [selected,setSelected]=useWorkspaceState('compare/file','');
  // Uncommitted lists 50 eligible paths a page, as Git review did.
  const [pageStart,setPageStart]=useWorkspaceState('compare/page',0);
  const [sessionOnly,setSessionOnly]=useWorkspaceState('compare/session-only',true);
  const [sideChoice,setSideChoice]=useState<'head'|'base'>();
  const [result,setResult]=useState<GitCompareResult>(),[snapshot,setSnapshot]=useState<GitSnapshot>();
  const loaded=useRef('');
  const [loading,setLoading]=useState(false),[error,setError]=useState<string>(),[refresh,setRefresh]=useState(0);
  const accessWait = useWaitNotice({
    waiting: consent === undefined && !error,
    quietMessage: 'Checking Git access…',
    longMessage: 'Checking Git access for this workspace…',
  });
  const [evidence,setEvidence]=useState<CompareEvidence>(),[evidenceFor,setEvidenceFor]=useState('');
  const [patch,setPatch]=useState<{key:string;file:GitFile}>(),[patchError,setPatchError]=useState<{key:string;message:string}>();
  const [marks,setMarks]=useState(()=>loadReviewMarks(cid)),[saveError,setSaveError]=useState<string>();
  const [noteOpen,setNoteOpen]=useState(false),[packet,setPacket]=useState<string>(),[checking,setChecking]=useState(false);
  const requested=useApp(s=>s.comparePreset);
  useEffect(()=>{if(!requested)return;setPreset(requested);setSelected('');setSideChoice(undefined);useApp.setState({comparePreset:undefined});},[requested]);

  useEffect(()=>{let active=true;void workspaceApi.gitStatus(checkoutId??id).then(s=>{if(active)setConsent(s.approved);}).catch(e=>{if(active){setConsent(false);setError(e.message);}});return()=>{active=false;};},[id]);
  const ready=!!workspace?.approved&&!!consent;
  useEffect(()=>{
    if(!ready)return;
    let active=true;
    void workspaceApi.compareRefs(checkoutId??id).then(value=>{if(active)setRefs(value);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[id,checkoutId,ready,refresh]);
  useEffect(()=>{
    if(!ready||preset!=='pr')return;
    let active=true;setPulls(undefined);
    void workspaceApi.comparePulls(checkoutId??id).then(value=>{if(active)setPulls(value);}).catch(e=>{if(active)setPulls({status:'failed',pulls:[]});});
    return()=>{active=false;};
  },[id,checkoutId,ready,preset,refresh]);

  const pull=preset==='pr'?pulls?.pulls.find(item=>item.number===prNumber):undefined;
  // The two sides this preset reads. `remote` means GitHub's compare: the pull request's head is not on this machine.
  const recorded=projection?.recordedBranch?.name;
  // The session's own branch is the one its journal recorded, when it still exists here; else the branch checked out now; else a detached HEAD.
  const ownHead=refs?(recorded?refs.refs.find(ref=>ref.ref===`refs/heads/${recorded}`)?.ref:undefined)??refs.current?.ref??refs.head:undefined;
  const sides=useMemo(()=>{
    if(!refs)return undefined;
    if(preset==='session'||preset==='branch'){
      const base=preset==='branch'&&baseRef?baseRef:refs.defaultBase?.ref,head=preset==='branch'?headRef??ownHead:ownHead;
      return base&&head?{base,head}:undefined;
    }
    if(preset==='pr'&&pull)return pull.local&&pull.baseRef?{base:pull.baseRef.ref,head:pull.headOid}:{base:'',head:'',remote:pull.number};
    return undefined;
  },[refs,preset,baseRef,headRef,pull,ownHead]);
  const sidesKey=sides?JSON.stringify(sides):'';
  const readComparison=(value:NonNullable<typeof sides>)=>'remote' in value&&value.remote?workspaceApi.compareRemote(cid,value.remote as number):workspaceApi.compare(cid,value.base,value.head);

  // Load the comparison (or the working tree) for the chosen sides. A newer choice discards an older answer.
  useEffect(()=>{
    if(!ready)return;
    let active=true;
    setError(undefined);setSideChoice(undefined);
    // A refresh keeps what is shown while it reads; a different preset or side never shows the previous answer.
    const key=`${preset}|${sidesKey}|${preset==='uncommitted'?pageStart:''}`;
    if(loaded.current!==key){setResult(undefined);setSnapshot(undefined);}
    if(preset==='uncommitted'){
      setLoading(true);
      void workspaceApi.gitSnapshot(cid,pageStart).then(value=>{if(active){loaded.current=key;setSnapshot(value);setResult(undefined);if(value.pageStart!==undefined&&value.pageStart!==pageStart)setPageStart(value.pageStart);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    }else if(sides){
      setLoading(true);
      void readComparison(sides).then(value=>{if(active){loaded.current=key;setResult(value);setSnapshot(undefined);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    }else{setResult(undefined);setSnapshot(undefined);}
    return()=>{active=false;};
  },[id,checkoutId,ready,preset,sidesKey,pageStart,refresh]);

  const rows=useMemo<Row[]>(()=>{
    if(preset==='uncommitted')return (snapshot?.files??[]).map(file=>({path:file.path,group:'tree',git:file,note:gitWord(file.status),...(file.status.trim()==='??'?{}:patchCounts(file.patch))}));
    return (result?.files??[]).map(file=>({path:file.path,group:file.group,file,added:file.added,removed:file.removed,binary:file.binary,note:word(file.group==='base'?file.baseStatus:file.headStatus)}));
  },[preset,snapshot,result]);
  const isUncommitted = preset === 'uncommitted';
  const compareWait = useWaitNotice({
    waiting: loading && !rows.length,
    quietMessage: isUncommitted ? 'Reading uncommitted changes…' : 'Calculating branch differences…',
    longMessage: isUncommitted
      ? 'Reading working tree changes from Git. This can take a moment for repositories with many files.'
      : 'Comparing branch changes and merge base. This can take a moment for divergent branches.',
  });
  const rowKey=rows.map(row=>row.path).join('\0');

  // What this session's agents wrote, for every file in the list (the daemon answers 200 paths at a time).
  useEffect(()=>{
    setEvidence(undefined);setEvidenceFor('');
    if(!rows.length){setEvidenceFor(rowKey);return;}
    let active=true;
    const paths=rows.map(row=>row.path),chunks:string[][]=[];
    for(let n=0;n<paths.length;n+=200)chunks.push(paths.slice(n,n+200));
    void Promise.all(chunks.map(chunk=>workspaceApi.compareEvidence(checkoutId??id,chunk))).then(all=>{if(active){setEvidence(Object.assign({},...all));setEvidenceFor(rowKey);}}).catch(()=>{if(active){setEvidence({});setEvidenceFor(rowKey);}});
    return()=>{active=false;};
  },[id,checkoutId,rowKey]);
  const evidenceReady=evidenceFor===rowKey&&!!evidence||!rows.length;
  const agentByName=useCallback((agentId:string)=>agentName(projection?.agents.find(agent=>agent.id===agentId)),[projection]);

  const filtering=preset==='session'&&sessionOnly&&rows.length>0;
  const visible=filtering?(evidenceReady?rows.filter(row=>evidence?.[row.path]):[]):rows;
  const row=visible.find(item=>item.path===selected)??visible[0];
  useEffect(()=>{if(row&&row.path!==selected)setSelected(row.path);},[row?.path]);

  // The patch of the selected file, on the side being read.
  const side:'head'|'base'=sideChoice??(row?.group==='base'?'base':'head');
  const patchKey=row?`${result?.generation??snapshot?.fingerprint??''}/${row.path}/${side}/${preset}`:'';
  useEffect(()=>{
    setPatchError(undefined);
    if(!row||!patchKey)return;
    if(row.git){setPatch({key:patchKey,file:row.git});return;}
    if(row.file?.patch!==undefined){setPatch({key:patchKey,file:{path:row.path,status:'M',fingerprint:row.file.fingerprint,patch:row.file.patch}});return;}
    if(!result||result.source==='github'){setPatch(undefined);return;}
    let active=true;
    void workspaceApi.compareFile(checkoutId??id,result.base.ref,result.head.ref,row.path,side).then(value=>{if(active)setPatch({key:patchKey,file:{path:value.path,status:'M',fingerprint:value.fingerprint,patch:value.patch}});}).catch(e=>{if(active){setPatch(undefined);setPatchError({key:patchKey,message:e.message});}});
    return()=>{active=false;};
  },[patchKey]);

  // Reviewed marks. A mark belongs to one exact patch: it counts only while its fingerprint equals the fingerprint of the patch shown.
  const viewSide:'head'|'base'=row?.git?'head':side;
  const scopeFor=(which:'head'|'base')=>preset==='uncommitted'?'':preset==='pr'?`pr${prNumber}:${which}`:`${result?.base.ref}..${result?.head.ref}:${which}`;
  const sidesOf=(item:Row):('head'|'base')[]=>item.group==='both'?['head','base']:item.group==='base'?['base']:['head'];
  const printOf=(item:Row,which:'head'|'base')=>item.git?item.git.fingerprint:which==='base'&&item.group==='both'?item.file?.baseFingerprint:item.file?.fingerprint;
  const markOf=(item:Row,which:'head'|'base')=>marks[reviewMarkId(scopeFor(which),item.path)];
  const markable=(item:Row)=>item.git?.status.trim()!=='??';
  const reviewedPatches=rows.flatMap(item=>!markable(item)?[]:sidesOf(item).flatMap(which=>{const entry=markOf(item,which),print=printOf(item,which);return entry?.reviewed&&print&&entry.fingerprint===print?[{item,which,mark:entry}]:[];}));
  const markStateOf=(item:Row):'reviewed'|'changed'|undefined=>{
    if(!markable(item))return undefined;
    const each=sidesOf(item).map(which=>({mark:markOf(item,which),print:printOf(item,which)}));
    if(each.every(entry=>entry.mark?.reviewed&&entry.print&&entry.mark.fingerprint===entry.print))return 'reviewed';
    return each.some(entry=>entry.mark&&entry.print&&entry.mark.fingerprint!==entry.print)?'changed':undefined;
  };
  const shown=patch?.key===patchKey?patch.file:undefined;
  const markId=row?reviewMarkId(scopeFor(viewSide),row.path):'';
  const mark=marks[markId],exact=!!shown&&mark?.fingerprint===shown.fingerprint,previous=shown?previousReviewNote(mark,shown.fingerprint):undefined;
  const canMark=!!row&&!!shown&&markable(row)&&!checking;
  const update=(change:Partial<Pick<ReviewMark,'note'|'reviewed'>>)=>{
    if(!canMark||!shown)return;
    setPacket(undefined);
    const next=Object.fromEntries(Object.entries({...marks,[markId]:updateReviewMark(mark,shown.fingerprint,change)}).slice(-100));
    setMarks(next);setSaveError(saveReviewMarks(cid,next)?undefined:'Review progress could not be saved in this browser.');
  };
  // A file that already has a note (for this patch, or for an earlier one) opens with it showing; otherwise the note stays folded away.
  useEffect(()=>{setNoteOpen(!!(mark?.note||mark?.previous?.note));},[patchKey,shown?.fingerprint]);
  useEffect(()=>{setPacket(undefined);},[preset,sidesKey,refresh,row?.path,side]);

  // The handoff packet: the reviewed patches and their notes, after the repository has been read again. Saving reads it again too.
  const handoff=async(saving=false)=>{
    if(loading||checking)return;
    setChecking(true);setError(undefined);if(!saving)setPacket(undefined);
    try{
      const changedMessage='Repository changed. Inspect the refreshed changes before making a new handoff.';
      let lines:string[],sampledAt:string,omitted:number,patchOf:(item:Row,which:'head'|'base')=>Promise<string>;
      if(preset==='uncommitted'){
        const next=await workspaceApi.gitSnapshot(cid,pageStart);
        if(!alive.current)return;
        setSnapshot(next);
        if(next.fingerprint!==snapshot?.fingerprint){setPacket(undefined);setError(changedMessage);return;}
        lines=[`Branch: ${next.branch}\nHEAD: ${next.head}`];sampledAt=next.sampledAt;omitted=next.omitted;
        patchOf=async item=>next.files.find(file=>file.path===item.path)?.patch??'';
      }else{
        if(!sides)return;
        const next=await readComparison(sides);
        if(!alive.current)return;
        setResult(next);
        if(next.generation!==result?.generation){setPacket(undefined);setError(changedMessage);return;}
        lines=[`Comparing: ${baseName} ← ${headName}\nBase: ${next.base.tip}\nCompared: ${next.head.tip}${next.mergeBase?`\nMerge-base: ${next.mergeBase}`:''}`];sampledAt=next.sampledAt;omitted=next.omitted+next.protectedCount;
        patchOf=async(item,which)=>{
          if(item.file?.patch!==undefined)return item.file.patch;
          const value=await workspaceApi.compareFile(cid,next.base.ref,next.head.ref,item.path,which);
          if(value.fingerprint!==printOf(item,which))throw new Error('a reviewed patch changed while it was read');
          return value.patch;
        };
      }
      if(saving){
        if(!packet)return;
        const url=URL.createObjectURL(new Blob([packet],{type:'text/markdown'}));
        const link=document.createElement('a');link.href=url;link.download='drishya-review.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        return;
      }
      const files:HandoffFile[]=[];let budget=1024*1024,unsent=0;
      for(const entry of reviewedPatches){
        const text=await patchOf(entry.item,entry.which);
        if(!alive.current)return;
        if(text.length>budget){unsent++;continue;}
        budget-=text.length;
        files.push({path:entry.item.path,fingerprint:entry.mark.fingerprint,note:entry.mark.note,patch:text,...(entry.item.group==='both'?{side:entry.which==='head'?headName:baseName}:{})});
      }
      setPacket(buildHandoff({sampledAt,lines,omitted,files,unsent}));
    }catch(e){if(alive.current){setPacket(undefined);setError(`Handoff check failed: ${(e as Error).message}`);}}
    finally{if(alive.current)setChecking(false);}
  };

  const jump=(operationId:string)=>{useApp.getState().select(operationId);useApp.setState({compareOpen:false});};
  const requestClose=()=>{
    const element=section.current,state=useApp.getState();
    const animate=element&&document.documentElement.dataset.uiVersion==='modern'&&document.documentElement.hasAttribute('data-ui-press')&&state.motion&&!state.lowResource&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done=()=>{useApp.setState({compareOpen:false});requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-compare-open]')?.focus({preventScroll:true}));};
    if(!animate){done();return;}
    // MOTION-1: a window beside the work leaves faster (120 ms) than it arrives (200 ms).
    const easing=getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()||'cubic-bezier(.16,1,.3,1)';
    const exit=element.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(4px)'}],{duration:120,easing,fill:'forwards'});
    void exit.finished.then(done,()=>{});
  };
  // The header's Compare toggles the window through the same leaving motion as Back to agent.
  const closer=useRef(requestClose);closer.current=requestClose;
  useEffect(()=>{const close=()=>closer.current();window.addEventListener('drishya-compare-close',close);return()=>window.removeEventListener('drishya-compare-close',close);},[]);
  const identity=workspace?.root?.replace(/\\/g,'/').split('/').at(-1)??'Repository';
  const ahead=result?.ahead,behind=result?.behind;

  // A pull request's head is a commit id to Git; the person knows it by its branch name.
  const headName=pull?.headName??(result&&isOid(result.head.ref)?'Detached HEAD':nameOf(result?.head)),baseName=pull?.baseName??nameOf(result?.base);
  const groups:{key:CompareGroup|'tree';title?:string;hint?:string}[]=preset==='uncommitted'?[{key:'tree'}]:[
    {key:'both',title:'Changed on both',hint:`Edited on ${headName} and on ${baseName} since they diverged. A merge can conflict here.`},
    {key:'head',title:`Only on ${headName}`},
    {key:'base',title:`Only on ${baseName}`},
  ];

  return <section ref={section} className="developer-workspace compare-window" aria-label="Changes" onKeyDown={e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();useApp.setState({compareOpen:false});requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-compare-open]')?.focus({preventScroll:true}));}}}>
    <header className="compare-header">
      <strong>Changes</strong>
      <nav className="compare-presets" aria-label="What to compare">{PRESETS.map(([key,label,hint])=><button key={key} title={hint} aria-pressed={preset===key} onClick={()=>{setPreset(key);setSelected('');}}>{label}</button>)}</nav>
      <span className="compare-header-end">
        {ready&&<WorkspaceOptions label="Changes actions">
          <button className="btn ghost" disabled={!reviewedPatches.length||loading||checking} onClick={()=>void handoff()}>Preview handoff{reviewedPatches.length>0&&<small aria-hidden="true"> · {reviewedPatches.length} reviewed</small>}</button>
          <p className="compare-menu-note">Reviewed marks apply to this exact patch and stay on this machine. Preview and save read the repository again.</p>
        </WorkspaceOptions>}
        {ready&&<button className="btn ghost compare-refresh" aria-label="Refresh changes" title="Read the repository again" disabled={loading||checking} aria-busy={loading} onClick={()=>setRefresh(n=>n+1)}><InterfaceGlyph name="refresh"/></button>}
        <button className="btn ghost" title="Return to the agent’s work, exactly where you left it" onClick={requestClose}>Back to agent</button>
      </span>
    </header>
    {consent===undefined&&!error?<p className="compare-note" role="status">{accessWait.isImmediate?'':accessWait.message}</p>
      :!workspace?.root?<p className="compare-note">This session recorded no repository on this machine, so there is nothing to compare.</p>
      :!ready?<><GitAccess workspaceApproved={!!workspace?.approved} busy={granting} disabled={granting||!workspace?.root} grant={()=>{setGranting(true);setError(undefined);void grantGit(checkoutId??id,!!workspace?.approved,approve).then(()=>setConsent(true)).catch(e=>setError(e.message)).finally(()=>setGranting(false));}}/>{error&&<p className="compare-note" role="alert">{error} <button className="btn ghost small" onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>}</>
      :<>
      <div className="compare-sides" aria-label="Sides compared">
        {preset==='uncommitted'?<span className="compare-line"><b>{snapshot?.branch??'Working tree'}</b>{snapshot&&<span>{snapshot.head.slice(0,10)}</span>}<span>{identity} · uncommitted changes</span></span>
        :preset==='pr'?<PullPicker pulls={pulls} value={prNumber} pick={number=>{setPrNumber(number);setSelected('');}} enable={()=>{void workspaceApi.githubOptIn(true).then(()=>setRefresh(n=>n+1));}}/>
        :<span className="compare-line">
          {preset==='branch'&&refs?<SidePicker label="Base" value={baseRef??refs.defaultBase?.ref} refs={refs.refs} pick={ref=>{setBaseRef(ref);setSelected('');}}/>:<b title={result?.base.ref}>{(result&&baseName)||nameOf(refs?.defaultBase)}</b>}
          <span className="compare-arrow" aria-hidden="true">←</span>
          {preset==='branch'&&refs?<SidePicker label="Compare" value={headRef??ownHead} refs={refs.refs} pick={ref=>{setHeadRef(ref);setSelected('');}}/>:<b title={result?.head.ref}>{(result&&headName)||(ownHead&&isOid(ownHead)?'Detached HEAD':nameOf(refs?.current))}</b>}
        </span>}
        {result&&<span className="compare-counts" role="status">{result.state==='unrelated'?'No shared history':result.state==='shallow'?'History is shallow here':ahead===undefined?'':<><b>{ahead}</b> ahead · <b>{behind}</b> behind</>}{result.source==='github'&&<span className="compare-source" title="Read from GitHub through your signed-in gh; only this branch’s changes are known">from GitHub</span>}</span>}
        {result&&result.commitTotal>0&&<Commits result={result} jump={jump}/>}
      </div>
      {(error||saveError)&&<p className="compare-note" role="alert">{error??saveError} <button className="btn ghost small" onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>}
      {checking&&<p className="compare-note" role="status">Checking reviewed content…</p>}
      <div className={`compare-body${!loading&&!error&&!rows.length&&!row&&!(preset==='uncommitted'&&snapshot?.omissions?.length)?' compare-body-empty':''}`}>
        <aside className="compare-files" aria-label="Changed files" aria-busy={loading||filtering&&!evidenceReady}>
          {preset==='pr'&&!pull?<p className="compare-note">{pulls?.status==='ready'&&!pulls.pulls.length?'No open pull requests.':'Choose a pull request.'}</p>
          :loading&&!rows.length?<p className="compare-note" role="status">{compareWait.isImmediate?'':compareWait.message}</p>
          :<>
            {preset==='uncommitted'&&snapshot?.totalAllowed!==undefined&&snapshot.totalAllowed>snapshot.limit&&<nav className="compare-pages" aria-label="Changed file pages">
              <button className="btn ghost" disabled={loading||checking||!snapshot.pageStart} onClick={()=>{setPageStart(Math.max(0,(snapshot.pageStart??0)-snapshot.limit));setSelected('');}}>Previous files</button>
              <span>{(snapshot.pageStart??0)+1}–{Math.min((snapshot.pageStart??0)+snapshot.limit,snapshot.totalAllowed)} of {snapshot.totalAllowed} eligible {pluralWord(snapshot.totalAllowed,'path')}</span>
              <button className="btn ghost" disabled={loading||checking||(snapshot.pageStart??0)+snapshot.limit>=snapshot.totalAllowed} onClick={()=>{setPageStart((snapshot.pageStart??0)+snapshot.limit);setSelected('');}}>Next files</button>
            </nav>}
            {filtering&&evidenceReady&&visible.length<rows.length&&<p className="compare-scope">{visible.length?`The ${visible.length} ${visible.length===1?'file':'files'} this session edited`:'This session recorded no edit to these files'} · <button className="compare-link" onClick={()=>setSessionOnly(false)}>Show all {rows.length}</button></p>}
            {preset==='session'&&!sessionOnly&&rows.length>0&&<p className="compare-scope">{rows.length===1?'1 file on this branch':`All ${rows.length} files on this branch`} · <button className="compare-link" onClick={()=>setSessionOnly(true)}>Only this session’s</button></p>}
            {groups.map(group=>{
              const list=visible.filter(item=>item.group===group.key);
              if(!list.length)return null;
              return <div className="compare-group" key={group.key} role="group" aria-label={group.title}>
                {group.title&&<h3 title={group.hint}>{group.title}<span>{list.length}</span></h3>}
                {list.map(item=><FileRow key={item.path} row={item} active={item.path===row?.path} entry={evidence?.[item.path]} name={agentByName} jump={jump} choose={()=>{setSelected(item.path);setSideChoice(undefined);}} mark={markStateOf(item)}/>)}
              </div>;
            })}
            {!loading&&!error&&!rows.length&&(preset==='pr'&&pull||preset!=='pr')&&<div className="compare-note compare-no-changes"><p>{preset==='uncommitted'?'No uncommitted changes.':preset==='session'&&result&&result.head.tip===result.base.tip?`${headName==='Detached HEAD'?'This session’s checkout':`This session’s branch ${headName}`} is at the same commit as ${baseName}. Its work in progress is under Uncommitted.`:result?'These two sides have no differing files.':''}</p>{preset==='session'&&result&&result.head.tip===result.base.tip&&<button className="btn small compare-uncommitted-jump" onClick={()=>{setPreset('uncommitted');setSelected('');}}>Show uncommitted</button>}</div>}
            {preset==='uncommitted'&&snapshot?.omissions?.map(item=><div className="compare-omission" key={item.path}><strong>{item.path}</strong><span>{item.reason==='content-limit'?'Patch exceeds the remaining 1 MiB response budget':'Patch exceeds the Git process output limit'}</span><button className="btn ghost" onClick={()=>{useApp.setState({compareOpen:false});useApp.getState().set({currentFile:item.path});}}>Open current file instead</button></div>)}
            {preset==='uncommitted'&&snapshot&&snapshot.totalAllowed===undefined&&snapshot.omitted>0&&<p className="compare-note">{plural(snapshot.omitted,'path')} omitted: protected or content / 50-file limit.</p>}
            {preset==='uncommitted'&&!!snapshot?.protectedCount&&<p className="compare-note">{plural(snapshot.protectedCount,'protected path')} excluded.</p>}
            {result&&result.omitted>0&&<p className="compare-note">{result.omitted} more {pluralWord(result.omitted,'file')} {result.omitted===1?'is':'are'} not listed.</p>}
            {result&&result.protectedCount>0&&<p className="compare-note">{result.protectedCount} protected {result.protectedCount===1?'path is':'paths are'} left out.</p>}
          </>}
        </aside>
        {(row||loading||error||rows.length>0||(preset==='uncommitted'&&!!snapshot?.omissions?.length))&&<div className="compare-reader">
          {row?<>
            <header className="compare-file-header">
              <span className="compare-file-title"><strong title={row.path}>{fileName(row.path)}</strong>{fileFolder(row.path)&&<small title={row.path}>{fileFolder(row.path)}</small>}</span>
              {row.group==='both'&&result&&<span className="compare-side-switch" role="group" aria-label="Which side’s change to read">
                <button aria-pressed={side==='head'} onClick={()=>setSideChoice('head')} title={`${headName}’s change since the merge-base`}>{headName}</button>
                <button aria-pressed={side==='base'} onClick={()=>setSideChoice('base')} title={`${baseName}’s change since the merge-base`}>{baseName}</button>
              </span>}
              <FileReadingActions path={row.path} compact onNavigate={()=>{memory.set('compare/return',true);useApp.setState({compareOpen:false});}}/>
              {markable(row)&&<>
                <label className="compare-reviewed" title="You have read this exact patch. Kept on this machine, not part of the session."><input type="checkbox" disabled={!canMark} checked={exact&&!!mark?.reviewed} onChange={event=>update({reviewed:event.target.checked})}/>Reviewed</label>
                <button className="btn ghost compare-note-toggle" aria-expanded={noteOpen} disabled={!canMark} title="A note for this patch, kept on this machine" onClick={()=>setNoteOpen(open=>!open)}>{exact&&mark?.note?'Note ·':'Note'}</button>
              </>}
              <button className="btn ghost" title="Read the file as it is on disk" onClick={()=>{memory.set('compare/return',true);useApp.setState({compareOpen:false});useApp.getState().set({currentFile:row.path});}}>Open on disk</button>
            </header>
            <Evidence entry={evidence?.[row.path]} name={agentByName} jump={jump} detailed/>
            {noteOpen&&markable(row)&&<div className="compare-note-box">
              <textarea aria-label="Local review note" disabled={!canMark} placeholder="Review note (local, not part of the session)" maxLength={2000} value={exact?mark?.note??'':''} onChange={event=>update({note:event.target.value})}/>
              {previous?.note&&<details className="compare-previous" key={`${row.path}:${previous.fingerprint}`}>
                <summary>Previous note · changed patch</summary>
                <p>This note belongs to an earlier patch. Reusing it does not mark this change reviewed.</p>
                <textarea aria-label="Previous patch review note" value={previous.note} readOnly/>
                <button className="btn ghost" disabled={!canMark} onClick={()=>update({note:previous.note,reviewed:false})}>Use previous note as draft</button>
              </details>}
            </div>}
            {packet?<section className="compare-handoff" aria-label="Handoff preview">
              <header><strong>Review this text before sharing</strong><button className="btn ghost" onClick={()=>setPacket(undefined)}>Close preview</button></header>
              <p>Only the patches you marked reviewed, with your notes, are included. Saving reads the repository again. Pattern redaction is best effort.</p>
              <textarea aria-label="Handoff preview" value={packet} readOnly/>
              <footer><button className="btn" disabled={checking} onClick={()=>void handoff(true)}>Save handoff</button></footer>
            </section>
            :<div className="compare-patch">
              {patch?.key===patchKey?<GitPatchReader key={`${patch.file.path}:${patch.file.fingerprint}`} file={patch.file} hideScope={preset!=='uncommitted'} openRecorded={(path,key)=>{useApp.setState({compareOpen:false});useApp.getState().set({filePanel:path,filePanelFocus:'change',filePanelEvidence:key});}}/>
                :patchError?.key===patchKey?<p className="compare-note" role="alert">{patchError.message}</p>
                :row.file?.binary&&result?.source==='github'?<p className="compare-note">GitHub did not send a text patch for this file.</p>
                :row.git?.status.trim()==='??'?<p className="compare-note">Git does not track this file yet, so there is no patch. Open it on disk to read it.</p>
                :<p className="compare-note" role="status">Reading the change…</p>}
            </div>}
          </>:null}
        </div>}
      </div>
    </>}
  </section>;
}

function FileRow({row,active,entry,name,jump,choose,mark}:{row:Row;active:boolean;mark?:'reviewed'|'changed';entry?:CompareEvidence[string];name:(id:string)=>string;jump:(operationId:string)=>void;choose:()=>void}) {
  return <div className="compare-file" data-active={active||undefined}>
    <button className="compare-file-main" aria-current={active||undefined} title={row.path} onClick={choose}>
      <FileIcon path={row.path}/>
      <span className="compare-file-name"><strong>{fileName(row.path)}</strong>{fileFolder(row.path)&&<small>{fileFolder(row.path)}</small>}</span>
      <span className="compare-file-stat">{mark&&<i className="compare-mark" data-state={mark} title={mark==='reviewed'?'You marked this patch reviewed':'This patch changed since you reviewed it'}>{mark==='reviewed'?'reviewed':'re-review'}</i>}{row.note&&<i>{row.note}</i>}{row.binary?<i>binary</i>:row.added!==undefined&&<><b className="add">+{row.added}</b>{!!row.removed&&<b className="del">−{row.removed}</b>}</>}</span>
    </button>
    <Evidence entry={entry} name={name} jump={jump}/>
  </div>;
}

/** One quiet line: the agents of this session that wrote the file, each a jump to that agent’s latest edit in History. */
function Evidence({entry,name,jump,detailed=false}:{entry?:CompareEvidence[string];name:(id:string)=>string;jump:(operationId:string)=>void;detailed?:boolean}) {
  if(!entry?.agents.length)return detailed?<p className="compare-evidence none">No edit to this file is recorded in this session.</p>:null;
  return <p className="compare-evidence">
    {entry.agents.slice(0,3).map((agent,index)=><span key={agent.agentId}>{index>0&&<i aria-hidden="true">, </i>}
      <button className="compare-link" title={`Open ${name(agent.agentId)}’s latest edit of this file in History`} onClick={event=>{event.stopPropagation();jump(agent.lastOperationId);}}>{name(agent.agentId)}</button>
      <small>{agent.edits} {agent.edits===1?'edit':'edits'}{agent.elsewhere?' · other checkout':''}</small></span>)}
    {entry.agents.length>3&&<small> +{entry.agents.length-3} more</small>}
  </p>;
}

function Commits({result,jump}:{result:GitCompareResult;jump:(operationId:string)=>void}) {
  const linked=result.commits.filter(commit=>commit.session).length;
  return <details className="compare-commits"><summary>{result.commitTotal} {result.commitTotal===1?'commit':'commits'}{linked>0&&<> · {linked} in this session</>}</summary>
    <ol>{result.commits.map(commit=><li key={commit.hash}>
      <code>{commit.hash.slice(0,7)}</code><span title={commit.subject}>{commit.subject}</span>
      {commit.session&&<button className="compare-link" title="This session printed this commit; it does not prove the session made it" onClick={()=>commit.session!.operationId?jump(commit.session!.operationId):undefined} disabled={!commit.session.operationId}>this session</button>}
    </li>)}{result.commitTotal>result.commits.length&&<li className="muted">{result.commitTotal-result.commits.length} older</li>}</ol></details>;
}

/** A small combobox: search by name, newest first. Its Escape closes the list, not the window. */
function SidePicker({label,value,refs,pick}:{label:string;value?:string;refs:CompareRef[];pick:(ref:string)=>void}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const box=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  const current=refs.find(ref=>ref.ref===value);
  const list=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return [...refs].filter(ref=>!q||ref.name.toLowerCase().includes(q)).sort((a,b)=>(Date.parse(b.lastCommit??'')||0)-(Date.parse(a.lastCommit??'')||0)||a.name.localeCompare(b.name)).slice(0,80);
  },[refs,query]);
  return <span className="compare-picker" ref={box}>
    <button className="compare-side" aria-label={`${label} side: ${current?.name??(isOid(value)?'Detached HEAD':'choose')}`} aria-haspopup="listbox" aria-expanded={open} title={current?.ref} onClick={()=>{setOpen(!open);setQuery('');}}>{current?.name??(isOid(value)?'Detached HEAD':'Choose')}<svg viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg></button>
    {open&&<div className="compare-menu" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}}}>
      <input autoFocus aria-label={`Find a ${label.toLowerCase()} branch or tag`} placeholder="Find a branch or tag" value={query} onChange={event=>setQuery(event.target.value)}/>
      <ul role="listbox" aria-label={`${label} side`}>{list.map(ref=><li key={ref.ref} role="option" aria-selected={ref.ref===value}>
        <button onClick={()=>{pick(ref.ref);setOpen(false);}}><span>{ref.name}</span><small>{ref.kind==='branch'?'':ref.kind==='remote'?'remote':'tag'}{ref.lastCommit?` ${ref.kind==='branch'?'':'· '}${ago(ref.lastCommit)}`:''}</small></button></li>)}
        {!list.length&&<li className="compare-note">Nothing matches.</li>}</ul>
    </div>}
  </span>;
}

function PullPicker({pulls,value,pick,enable}:{pulls?:ComparePulls;value?:number;pick:(number:number)=>void;enable:()=>void}) {
  const [open,setOpen]=useState(false);
  const box=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  if(!pulls)return <span className="compare-line"><span>Reading pull requests…</span></span>;
  if(pulls.status!=='ready'){
    const message={disabled:'Pull requests are read through your own GitHub CLI (gh), which is off. Nothing is sent to GitHub until you allow it.','gh-missing':'Reading pull requests needs the GitHub CLI (gh), which is not installed.','gh-unauthenticated':'Sign in with the GitHub CLI (gh auth login) to read pull requests.','no-remote':'This repository has no GitHub remote.',failed:'GitHub could not be reached.'}[pulls.status];
    return <span className="compare-line compare-gh"><span>{message}</span>{pulls.status==='disabled'&&<button className="btn ghost" onClick={enable}>Allow GitHub lookups</button>}</span>;
  }
  const current=pulls.pulls.find(item=>item.number===value);
  return <span className="compare-line">
    <span className="compare-picker" ref={box}>
      <button className="compare-side" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(!open)}>{current?`#${current.number} ${current.title}`:'Choose a pull request'}<svg viewBox="0 0 10 6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg></button>
      {open&&<div className="compare-menu" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}}}>
        <ul role="listbox" aria-label="Open pull requests">{pulls.pulls.map((item:ComparePull)=><li key={item.number} role="option" aria-selected={item.number===value}>
          <button onClick={()=>{pick(item.number);setOpen(false);}}><span>#{item.number} {item.title}</span><small>{item.headName} → {item.baseName}{item.draft?' · draft':''}{item.local?'':' · not on this machine'}</small></button></li>)}
          {!pulls.pulls.length&&<li className="compare-note">No open pull requests.</li>}</ul>
      </div>}
    </span>
    {current&&<><span className="compare-arrow" aria-hidden="true">→</span><b>{current.baseName}</b><span className="compare-pr-meta">{current.local?current.headName:`${current.headName} · not on this machine`}</span></>}
  </span>;
}
