import {useId,useMemo,useState,type ReactNode} from 'react';
import {capturedOutcomes,type CapturedOutcome,type OutcomeState} from '../lib/captured-outcomes.ts';
import {testTiles} from '../lib/test-tiles.ts';
import './captured-outcomes.css';
import {useArtifact} from './common.tsx';
import {ReadingDialog} from './ProductShell.tsx';
import {outcomeMaterial} from '../lib/outcome-material.ts';

export function CapturedOutcomes({output,fallback,onFailure,artifactId}:{output?:string;artifactId?:string;fallback?:ReactNode;onFailure?:()=>void}){
 const initial=useMemo(()=>capturedOutcomes(output??''),[output]);
 const candidate=artifactId&&(initial.runs.length>0||/\b(?:tests?|vitest|pytest|passed|failed|TAP|Playwright)\b/i.test(output??''))?artifactId:undefined;
 const head=useArtifact(candidate,{scope:'preview',count:200});
 const tailStart=head.hasMore&&head.totalLines&&!/^\s*[\[{]/.test(head.text??'')&&!initial.runs.some(run=>!run.observedOnly)?Math.max(0,head.totalLines-200):0;
 const tail=useArtifact(tailStart?candidate:undefined,{scope:'preview',count:200,start:tailStart});
 const report=useMemo(()=>outcomeMaterial(output??'',head,tail),[output,head.text,head.partial,head.hasMore,tail.text,tail.partial,tail.start]);
 if(!report.runs.length&&!report.notes.length)return fallback??null;
 return <div className="captured-outcomes" aria-label="Derived captured test outcomes">
  {report.runs.map((run,index)=><RunOutcomes key={`${index}/${run.output}/${run.runner}`} run={run} onFailure={onFailure}/>)}
  {report.notes.map(note=><p key={note} className="verification-basis">{note}</p>)}
 </div>;
}
function RunOutcomes({run,onFailure}:{run:CapturedOutcome;onFailure?:()=>void}){
 const [selected,setSelected]=useState(''),[peek,setPeek]=useState(''),detail=useId();
 const entries=Object.entries(run.counts).filter(([,count])=>count>0) as [OutcomeState,number][];
 const total=entries.reduce((sum,[,count])=>sum+count,0),cases=run.cases??[];
 const key=(item:typeof cases[number])=>`${item.line}/${item.name}`;
 const current=cases.find(item=>key(item)===selected),preview=cases.find(item=>key(item)===(peek||selected));
 const tap=run.tap&&!run.counts.cancelled&&!run.counts.errors&&!run.counts.unknown?testTiles({framework:'tap',...run.counts,failures:[],passing:[],basis:'derived'},run.tap):undefined;
 const displayed=cases.length||entries.reduce((sum,[,count])=>sum+Math.min(32,count),0);
 return <section className="outcome-run">
  <div className="material-context">{run.runner} · captured output {run.output} · {run.observedOnly?'captured case rows':run.unit}</div>
  {cases.length?<>
   <div className="verification-track case-bars" role="group" aria-label="Captured test result bars" onMouseLeave={()=>setPeek('')} onKeyDown={event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')],index=buttons.indexOf(event.target as HTMLButtonElement);event.preventDefault();
    buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowLeft'?-1:1)))]?.focus();
   }}>
    {cases.map((item,index)=><button key={key(item)} type="button" className={`case-bar ${item.state}`} tabIndex={selected?key(item)===selected?0:-1:index===0?0:-1} aria-label={`${item.index?`Test ${item.index}`:'Captured case'}: ${item.state} · ${item.name}`} title={`${item.state} · ${item.name} · output line ${item.line}`} aria-pressed={key(item)===selected} aria-controls={detail} onPointerEnter={()=>setPeek(key(item))} onFocus={()=>setPeek(key(item))} onClick={event=>{event.stopPropagation();setSelected(value=>value===key(item)?'':key(item));}}><span className={`verification-tile ${item.state}`} aria-hidden="true"/></button>)}
   </div>
   <div className="case-peek" title={preview?.name}>{preview?`${preview.index?`#${preview.index} · `:''}${preview.state} · ${preview.name}`:`${cases.length} captured result rows · select to inspect`}</div>
  </>:<div className="verification-track" aria-hidden="true">{entries.flatMap(([state,count])=>Array.from({length:Math.min(32,count)},(_,index)=><span key={`${state}-${index}`} title={`${count} ${state} · grouped summary; individual identity unavailable`} className={`verification-tile ${state}`}/>))}</div>}
  <div className="verification-caption">{entries.map(([state,count])=>state==='failed'&&onFailure?<button key={state} className="bad" onClick={event=>{event.stopPropagation();onFailure();}}>{count.toLocaleString()} failed · inspect assertions</button>:<span key={state} className={state==='passed'?'good':state==='failed'||state==='errors'?'bad':'muted'}>{count.toLocaleString()} {state}</span>)}{!total&&<span className="muted">0 reported tests</span>}</div>
  {run.warnings!==undefined&&<div className="verification-basis">{run.warnings.toLocaleString()} runner warning{run.warnings===1?'':'s'}</div>}
  {run.suites&&<div className="verification-basis">Suite summary: {run.suites}</div>}
  <div className="verification-basis">Derived · {run.observedOnly?'captured result rows only · runner totals unavailable':tap?.ordered?'captured flat TAP indices':cases.length?'captured result rows · runner summary totals':'grouped counts, not execution order'}{total>displayed?` · ${total-displayed} additional outcomes in counts`:''}</div>
  {current&&<div onClick={event=>event.stopPropagation()}><ReadingDialog title="Captured test result" className="test-result-dialog" close={()=>{setSelected('');setPeek('');}}><div id={detail} className="case-evidence" role="region" aria-label="Selected captured test result" onClick={event=>event.stopPropagation()}>
   <div><strong>{current.name}</strong></div>
   <small>Captured output {run.output} · excerpt near line {current.line} · {current.state}</small><pre>{current.context}</pre>
   {onFailure&&<button type="button" className="material-more" onClick={()=>{setSelected('');onFailure();}}>Open full captured output</button>}
  </div></ReadingDialog></div>}
 </section>;
}
