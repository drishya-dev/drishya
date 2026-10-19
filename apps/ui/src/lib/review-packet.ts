import type {ReviewInsightsPage} from '../../../../packages/scene/src/review-insights.ts';
import {redactText} from '../../../../packages/privacy/src/index.ts';
import type {ReviewQuestion} from './review-questions.ts';
export interface PacketEvidence {operationId:string;sequence:number;title:string;status:string;note:string;available:boolean}
export interface PacketOptions {samples?:boolean;questions?:boolean;selected?:PacketEvidence[];workspaceRoot?:string}
export const portableReference=(recordingId:string,operationId:string,sequence:number)=>JSON.stringify({recordingId,operationId,sequence});
const line=(value:string)=>value.replace(/[\r\n`]/g,' ').slice(0,600);
const quote=(value:string)=>value.split('\n').map(row=>`> ${row}`).join('\n');
/** A bounded, explicit handoff of facts and reviewer notes, never a model summary. */
export function reviewPacket(data:ReviewInsightsPage,questions:ReviewQuestion[],options:PacketOptions={}):string {
  const facts=data.facts;
  const rows=[`# Review packet — ${line(data.title??'Untitled session')}`,`Captured session: ${line(data.recordingId)}\nThrough observation: ${data.through}\nSample page: ${data.page+1}`,
    'Captured evidence only. Current Git, current disk contents and local drafts are excluded. Recorded checks do not establish test coverage.',
    `## Totals\n${facts.editedFileCount} files with change inputs · ${facts.counts.failures} failed operations · ${facts.counts.tests} recorded checks · ${facts.counts.unfinished} in progress · ${facts.counts.gaps} capture gaps`];
  rows.push('References identify a recording, operation and observation. Open the matching recording or exported evidence bundle to inspect them. This Markdown packet does not contain the complete recording or grant access to current files.');
  if(facts.unplacedCount)rows.push(`${facts.unplacedCount} entries have no captured observation position; timeline positions are explicitly qualified and cannot establish what followed a reading mark.`);
  if(options.selected){rows.push(`## Selected evidence (${options.selected.length})`);for(const item of options.selected.slice(0,20))rows.push(`### ${line(item.title)}\n${item.available?`Captured outcome: ${line(item.status)}`:'Captured action unavailable at export; saved reference only.'}\nReference: ${portableReference(data.recordingId,item.operationId,item.sequence)}${item.note?`\nLocal reviewer note:\n${quote(item.note)}`:''}`);}
  if(options.samples!==false){
  rows.push(`## Files with captured change inputs (${facts.editedFiles.length} of ${facts.editedFileCount})`,...facts.editedFiles.map(path=>`- ${line(path)}`));
  for(const [key,label] of [['failures','Failed operations'],['tests','Recorded checks'],['unfinished','In progress'],['gaps','Capture gaps']] as const){rows.push(`## ${label} (${facts[key].length} of ${facts.counts[key]})`);for(const item of facts[key])rows.push(`- ${line(item.title)}${item.detail?` — ${line(item.detail)}`:''}\n  Reference: ${item.operationId??'capture gap'} · ${item.sequenceBasis==='timeline-position'?'timeline position':'observation'} ${item.sequence}${item.status?` · ${item.status}`:''}`);}
  rows.push(`## Findings (${data.findings.length} of ${data.findingCount})`);
  for(const finding of data.findings)rows.push(`- ${line(finding.title)}\n${quote(finding.detail)}\n  Evidence: ${finding.examples.map(item=>`${item.operationId} @ ${item.sequenceBasis==='timeline-position'?'timeline position':'observation'} ${item.sequence}`).join('; ')||`capture gaps from observation ${finding.sequence}`}`);
  rows.push(`## Prompt windows (${data.prompts.length} of ${data.promptCount})`,'Counts refer to operations started between prompt observations; outcomes are the latest captured values.');
  for(const prompt of data.prompts)rows.push(`### Prompt ${prompt.ordinal}\n${quote(prompt.preview)}\n${prompt.operations} operations · ${prompt.changes} change calls · ${prompt.checks} checks · ${prompt.failures} failed outcomes\nReference: ${prompt.id} · observation ${prompt.sequence}`);
  }
  if(options.questions!==false){
  const open=questions.filter(question=>question.status==='open');rows.push(`## Open reviewer questions (${open.length})`,'Local reviewer notes, separate from captured agent output.');
  for(const question of open)rows.push(`### ${line(question.title)}\n${quote(question.question)}\nOwner: ${line(question.owner||'Unassigned')}\nReference: ${line(question.operationId)} · ${question.sequenceBasis==='captured-observation'?'observation':'saved timeline position'} ${question.sequence}`);
  }
  rows.push('Lists are bounded samples with complete counts. Open Review pages for omitted evidence. No automatic resolution or causal attribution is implied.');
  let result=rows.join('\n\n');
  if(options.workspaceRoot){for(const root of new Set([options.workspaceRoot,options.workspaceRoot.replaceAll('\\','/'),options.workspaceRoot.replaceAll('/','\\')]))result=result.split(root).join('<workspace>');}
  return redactText(result).text;
}
