import type {Operation,Projection} from '@drishya/contracts';
import {sinceSnapshot,type SinceSnapshot} from './since.ts';

export interface ReviewFinding {key:string;kind:'repeated-command'|'unknown-outcome'|'missing-change'|'capture-gap';title:string;detail:string;count:number;sequence:number;examples:{operationId:string;sequence:number}[]}
export interface PromptOverview {id:string;ordinal:number;step:number;sequence:number;time?:string;preview:string;operations:number;failures:number;checks:number;changes:number}
export interface ReviewInsightsPage {recordingId:string;title?:string;through:number;page:number;findingCount:number;promptCount:number;findings:ReviewFinding[];prompts:PromptOverview[];facts:SinceSnapshot}
const example=(op:Operation)=>({operationId:op.id,sequence:op.startSequence});
const examples=(ops:Operation[])=>ops.length?[example(ops[0]!),...(ops.length>1?[example(ops.at(-1)!)]:[])]:[];

/** Explicit evidence conditions only. No risk score, causal story or model-generated summary. */
export function reviewInsights(p:Projection,page=0):ReviewInsightsPage {
  page=Math.max(0,Math.floor(page));
  const operations=[...p.operations].sort((a,b)=>a.startSequence-b.startSequence||a.id.localeCompare(b.id));
  const findings:ReviewFinding[]=[];
  const artifacts=new Map(p.artifacts.map(artifact=>[artifact.id,artifact]));
  const repeated=new Map<string,Operation[]>();
  for(const op of operations)if(op.detail.kind==='shell'||op.detail.kind==='test') {
    const input=op.artifactIds.find(id=>id.endsWith('_input'));
    // A repeated request to poll a running process is normal transport activity.
    if(!input&&/^\s*(?:text\(\s*)?\(?await\s+tools\.(?:write_stdin|wait)\s*\(/.test(op.detail.command)&&! /tools\.(?:exec_command|apply_patch)\s*\(/.test(op.detail.command))continue;
    const artifact=input?artifacts.get(input):undefined;
    // Clipped previews can be identical while their full commands differ.
    const identity=input?artifact?.blob&&artifact.availability==='complete'?`blob:${artifact.blob}`:undefined:`text:${op.detail.command}`;
    if(identity){const group=repeated.get(identity)??[];group.push(op);repeated.set(identity,group);}
  }
  for(const group of repeated.values())if(group.length>=3){const op=group[0]!,detail=op.detail as Extract<Operation['detail'],{kind:'shell'|'test'}>;findings.push({key:`repeat/${op.id}`,kind:'repeated-command',title:`Same captured command · ${group.length} runs`,detail:detail.command.slice(0,512),count:group.length,sequence:op.startSequence,examples:examples(group)});}
  const unknown=operations.filter(op=>op.status==='unknown');
  if(unknown.length)findings.push({key:'unknown',kind:'unknown-outcome',title:`${unknown.length} operations have no captured outcome`,detail:'No success or failure was exposed for these operations.',count:unknown.length,sequence:unknown[0]!.startSequence,examples:examples(unknown)});
  const missing=operations.filter(op=>op.detail.kind==='edit'&&['unavailable','metadata-only'].includes(op.detail.reconstruction));
  if(missing.length)findings.push({key:'missing-change',kind:'missing-change',title:`Change material unavailable · ${missing.length} operations`,detail:'Open the captured action to inspect the available metadata and reconstruction note.',count:missing.length,sequence:missing[0]!.startSequence,examples:examples(missing)});
  if(p.gaps.length)findings.push({key:'gaps',kind:'capture-gap',title:`${p.gaps.length} capture gaps recorded`,detail:p.gaps.slice(0,3).map(gap=>gap.reason.replace(/-/g,' ')).join(' · '),count:p.gaps.length,sequence:p.gaps[0]!.sequence,examples:[]});
  findings.sort((a,b)=>b.sequence-a.sequence||a.key.localeCompare(b.key));
  const turns=p.timeline.flatMap((item,step)=>item.type==='turn'?[{item,step}]:[]).sort((a,b)=>a.item.sequence-b.item.sequence||a.step-b.step);
  let operation=0;
  const prompts=turns.map(({item,step},index):PromptOverview=>{
    const next=turns[index+1]?.item.sequence??Infinity;while(operation<operations.length&&operations[operation]!.startSequence<item.sequence)operation++;
    let count=0,failures=0,checks=0,changes=0;
    while(operation<operations.length&&operations[operation]!.startSequence<next){const op=operations[operation++]!;count++;if(op.status==='error')failures++;if(op.kind==='test')checks++;if(op.kind==='edit'||op.kind==='write')changes++;}
    return {id:item.id,ordinal:index+1,step,sequence:item.sequence,time:item.time,preview:(item.prompt??'Prompt text not captured').slice(0,240),operations:count,failures,checks,changes};
  }).reverse();
  return {recordingId:p.recordingId,title:p.title,through:p.lastSequence,page,findingCount:findings.length,promptCount:prompts.length,findings:findings.slice(page*20,page*20+20),prompts:prompts.slice(page*20,page*20+20),facts:sinceSnapshot(p,-1,page)};
}
