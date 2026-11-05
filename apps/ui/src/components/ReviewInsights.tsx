import {useEffect,useState} from 'react';
import {reviewInsights,type ReviewInsightsPage,type ReviewFinding} from '../../../../packages/scene/src/review-insights.ts';
import {FindingMembers} from './FindingMembers.tsx';
import {useApp} from '../state.ts';
import {ReviewPacketBuilder} from './ReviewPacketBuilder.tsx';
import {reviewPacket} from '../lib/review-packet.ts';
import {ReadingDialog} from './ProductShell.tsx';
import './review-insights.css';

export type ReviewView='findings'|'prompts'|'packet';
export const openReviewTool=(view:ReviewView)=>window.dispatchEvent(new CustomEvent('drishya-review-tool',{detail:view}));
export function ReviewTools({close}:{close:()=>void}) {
  const open=(view:ReviewView|'commands')=>{close();requestAnimationFrame(()=>view==='commands'?window.dispatchEvent(new Event('drishya-commands')):openReviewTool(view));};
  return <details className="review-tools"><summary className="btn ghost">Review tools</summary><div><button className="btn ghost" onClick={()=>open('commands')}>Commands</button><button className="btn ghost" onClick={()=>open('findings')}>Review findings</button><button className="btn ghost" onClick={()=>open('prompts')}>Prompt overview</button><button className="btn ghost" onClick={()=>open('packet')}>Prepare review packet</button></div></details>;
}
export function ReviewInsights() {
  const [view,setView]=useState<ReviewView>(),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode),source=useApp(s=>s.source);
  useEffect(()=>{const show=(event:Event)=>{const next=(event as CustomEvent).detail;if(['findings','prompts','packet'].includes(next))setView(next);};window.addEventListener('drishya-review-tool',show);return()=>window.removeEventListener('drishya-review-tool',show);},[]);
  useEffect(()=>setView(undefined),[id,mode]);
  return view&&id&&mode==='history'?<InsightsReader key={`${id}/${view}`} view={view} close={()=>setView(undefined)}/>:null;
}
function InsightsReader({view,close}:{view:ReviewView;close:()=>void}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId)!,projection=useApp(s=>s.projection);
  const [page,setPage]=useState(0),[retry,setRetry]=useState(0),[value,setValue]=useState<{key:string;data:ReviewInsightsPage}>(),[error,setError]=useState('');
  const [packet,setPacket]=useState(''),[status,setStatus]=useState('');
  const [finding,setFinding]=useState<ReviewFinding>();
  const [kind,setKind]=useState<ReviewFinding['kind']>();
  const key=`${page}/${retry}/${kind??''}`,data=value?.key===key?value.data:undefined;
  useEffect(()=>{let active=true;setError('');const request=source?.reviewInsights?source.reviewInsights(id,page,kind):source?.kind==='bundle'&&projection?Promise.resolve(reviewInsights(projection,page,kind)):Promise.reject(new Error('Review details are unavailable for this source.'));void request.then(data=>{if(active)setValue({key,data});}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[source,id,key]);
  const count=data?(view==='findings'?data.findingCount:data.promptCount):0,pages=Math.max(1,Math.ceil(count/20));
  const target=(operationId:string)=>{useApp.getState().select(operationId);close();};
  const prompt=async(step:number)=>{const state=useApp.getState();state.set({promptStep:step,playing:false,held:true,follow:false,selectedOp:undefined,expandedOp:undefined,focusObservationId:undefined});try{if(state.historyPage)await state.loadHistoryWindow({promptStep:step,count:32});if(useApp.getState().recordingId===id)close();}catch(error){setError((error as Error).message);}};
  if(finding)return <ReadingDialog title="Review findings" className="review-insights-dialog" close={close}><FindingMembers key={finding.key} finding={finding} open={target} back={()=>{const key=finding.key;setFinding(undefined);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`[data-finding-members="${CSS.escape(key)}"]`)?.focus());}}/></ReadingDialog>;
  return <ReadingDialog title={view==='findings'?'Review findings':view==='prompts'?'Prompt overview':'Review packet'} className="review-insights-dialog" close={close}>
    <div className="insights-intro"><p>{view==='findings'?'What deserves a second look: commands that keep failing, steps with no outcome, and gaps in the record.':view==='prompts'?'What each prompt led to: the work it started, and how that work ended.':'Prepare a local handoff of changes, checks, gaps and open reviewer questions.'}</p><span>{data?'Whole session':'Loading whole-session facts…'}</span><button className="btn ghost" onClick={()=>setRetry(n=>n+1)}>Refresh</button>{view==='findings'&&<label className="finding-category">Condition<select aria-label="Finding category" value={kind??''} onChange={event=>{setKind(event.target.value?event.target.value as ReviewFinding['kind']:undefined);setPage(0);}}><option value="">All conditions</option><option value="unknown-outcome">Missing outcomes</option><option value="missing-change">Unavailable changes</option><option value="capture-gap">Capture gaps</option><option value="repeated-command">Repeated commands</option></select></label>}</div>
    {error?<p role="alert" className="insights-error">{error}</p>:!data?<p className="insights-empty" role="status">Reading the session index…</p>:<>
      <div className="insights-content">
        {view==='findings'&&<>{data.findings.map(finding=><article className="insight-row" key={finding.key}><header><h3>{finding.title}</h3><small>Computed from this session</small></header><p className={finding.kind==='repeated-command'?'insight-command':''}>{finding.detail}</p><footer><button className="btn" data-finding-members={finding.key} onClick={()=>setFinding(finding)}>Inspect all {finding.count} {finding.kind==='capture-gap'?'gaps':'operations'}</button>{finding.examples.map((item,index)=><button className="btn ghost" key={item.operationId} onClick={()=>target(item.operationId)}>{index===0?'First example':'Latest example'} ↗</button>)}{!finding.examples.length&&<span>From {finding.sequenceBasis==='timeline-position'?'timeline position':'observation'} {finding.sequence} · inspect Capture gaps in Review work</span>}</footer></article>)}{!data.findings.length&&<p className="insights-empty">No matching findings on this page. This is not a completeness or safety assessment.</p>}</>}
        {view==='prompts'&&<>{data.prompts.map(item=><article className="insight-row prompt-overview-row" key={item.id}><header><h3>Prompt {item.ordinal}</h3><time title={item.time}>{item.time?new Date(item.time).toLocaleString():'Time unavailable'}</time></header><p>{item.preview}</p><div className="prompt-facts">{item.operations ? <><span>{item.operations} {item.operations === 1 ? 'step' : 'steps'}</span>{!!item.changes && <span>{item.changes} {item.changes === 1 ? 'change' : 'changes'}</span>}{!!item.checks && <span>{item.checks} {item.checks === 1 ? 'check' : 'checks'}</span>}{!!item.failures && <span className="prompt-failed">{item.failures} failed</span>}</> : <span>No work recorded after this prompt</span>}</div><footer><button className="btn ghost" onClick={()=>void prompt(item.step)}>Open prompt ↗</button></footer></article>)}{!data.prompts.length&&<p className="insights-empty">No prompt observations were recorded on this page.</p>}</>}
        {view==='packet'&&<ReviewPacketBuilder data={data}/>}
      </div>
      {view!=='packet'&&<nav className="commands-pages" aria-label="Review detail pages"><button className="btn" disabled={!page} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page+1} of {pages} · {count} {view}</span><button className="btn" disabled={page+1>=pages} onClick={()=>setPage(n=>n+1)}>Next</button></nav>}
    </>}
  </ReadingDialog>;
}
