import type {Artifact,Operation,Projection} from '@drishya/contracts';
import {sinceSnapshot,type SinceSnapshot} from './since.ts';

export interface ReviewFinding {key:string;kind:'repeated-command'|'unknown-outcome'|'missing-change'|'capture-gap';title:string;detail:string;count:number;sequence:number;examples:{operationId:string;sequence:number}[]}
export interface PromptOverview {id:string;ordinal:number;step:number;sequence:number;time?:string;preview:string;operations:number;failures:number;checks:number;changes:number}
export interface ReviewInsightsPage {recordingId:string;title?:string;through:number;page:number;findingCount:number;promptCount:number;findings:ReviewFinding[];prompts:PromptOverview[];facts:SinceSnapshot}
const example=(op:Operation)=>({operationId:op.id,sequence:op.startSequence});
const examples=(ops:Operation[])=>ops.length?[example(ops[0]!),...(ops.length>1?[example(ops.at(-1)!)]:[])]:[];
function commandIdentity(op:Operation,artifacts:Map<string,Artifact>):string|undefined {
  if(op.detail.kind!=='shell'&&op.detail.kind!=='test')return;
  const input=op.artifactIds.find(id=>id.endsWith('_input'));
  if(!input&&/^\s*(?:text\(\s*)?\(?await\s+tools\.(?:write_stdin|wait)\s*\(/.test(op.detail.command)&&! /tools\.(?:exec_command|apply_patch)\s*\(/.test(op.detail.command))return;
  const artifact=input?artifacts.get(input):undefined;
  return input?artifact?.blob&&artifact.availability==='complete'?`blob:${artifact.blob}`:undefined:`text:${op.detail.command}`;
}

export interface FindingMember {id:string;operationId?:string;sequence:number;title:string;detail:string;time?:string;tool?:string;status?:Operation['status'];kind?:Operation['kind']}
export interface FindingMembers {key:string;through:number;page:number;total:number;matching:number;items:FindingMember[];available:boolean}
/** Query exact membership in the same worker projection; never ship whole operations/output. */
export function findingMembers(p:Projection,key:string,page=0,q=''):FindingMembers {
  const operations=[...p.operations].sort((a,b)=>a.startSequence-b.startSequence||a.id.localeCompare(b.id));
  let selected:Operation[]=[],items:FindingMember[]=[],available=true;
  if(key==='unknown')selected=operations.filter(op=>op.status==='unknown');
  else if(key==='missing-change')selected=operations.filter(op=>op.detail.kind==='edit'&&['unavailable','metadata-only'].includes(op.detail.reconstruction));
  else if(key==='gaps'){
    let next=0;
    items=[...p.gaps].sort((a,b)=>a.sequence-b.sequence).map((gap,index)=>{
      while(next<operations.length&&operations[next]!.startSequence<gap.sequence)next++;
      return {id:`gap/${gap.sequence}/${index}`,sequence:gap.sequence,operationId:operations[next]?.id,title:gap.reason.replace(/-/g,' '),detail:(gap.detail??'No source material was captured for this interval.').slice(0,1024)};
    });
  }else if(key.startsWith('repeat/')){
    const artifacts=new Map(p.artifacts.map(item=>[item.id,item])),anchor=operations.find(op=>op.id===key.slice(7));
    const identity=anchor&&commandIdentity(anchor,artifacts);
    if(identity)selected=operations.filter(op=>commandIdentity(op,artifacts)===identity);
    available=selected.length>=3;if(!available)selected=[];
  }else available=false;
  if(key!=='gaps')items=selected.map(op=>({id:op.id,operationId:op.id,sequence:op.startSequence,title:op.title.slice(0,240),detail:((op.detail.kind==='shell'||op.detail.kind==='test')?op.detail.command:op.paths.map(path=>path.path).join(' · ')).slice(0,1024),time:op.startTime,tool:op.tool,status:op.status,kind:op.kind}));
  const total=items.length,needle=q.trim().toLowerCase();
  if(needle)items=items.filter(item=>`${item.title} ${item.detail} ${item.tool??''}`.toLowerCase().includes(needle));
  return {key,through:p.lastSequence,page,total,matching:items.length,items:items.slice(page*25,page*25+25),available};
}

/** Explicit evidence conditions only. No risk score, causal story or model-generated summary. */
export function reviewInsights(p:Projection,page=0,kind?:ReviewFinding['kind']):ReviewInsightsPage {
  page=Math.max(0,Math.floor(page));
  const operations=[...p.operations].sort((a,b)=>a.startSequence-b.startSequence||a.id.localeCompare(b.id));
  const findings:ReviewFinding[]=[];
  const artifacts=new Map(p.artifacts.map(artifact=>[artifact.id,artifact]));
  const repeated=new Map<string,Operation[]>();
  for(const op of operations)if(op.detail.kind==='shell'||op.detail.kind==='test') {
    const identity=commandIdentity(op,artifacts);
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
  const filtered=kind?findings.filter(finding=>finding.kind===kind):findings;
  return {recordingId:p.recordingId,title:p.title,through:p.lastSequence,page,findingCount:filtered.length,promptCount:prompts.length,findings:filtered.slice(page*20,page*20+20),prompts:prompts.slice(page*20,page*20+20),facts:sinceSnapshot(p,-1,page)};
}
