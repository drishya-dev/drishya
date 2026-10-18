import type {ReviewInsightsPage} from '../../../../packages/scene/src/review-insights.ts';
import {redactText} from '../../../../packages/privacy/src/index.ts';
import type {ReviewQuestion} from './review-questions.ts';
const line=(value:string)=>value.replace(/[\r\n`]/g,' ').slice(0,600);
const quote=(value:string)=>value.split('\n').map(row=>`> ${row}`).join('\n');
/** A bounded, explicit handoff of facts and reviewer notes, never a model summary. */
export function reviewPacket(data:ReviewInsightsPage,questions:ReviewQuestion[]):string {
  const facts=data.facts;
  const rows=[`# Review packet — ${line(data.title??'Untitled session')}`,`Captured session: ${line(data.recordingId)}\nThrough observation: ${data.through}\nSample page: ${data.page+1}`,
    'Captured evidence only. Current Git, current disk contents and local drafts are excluded. Recorded checks do not establish test coverage.',
    `## Totals\n${facts.editedFileCount} files with change inputs · ${facts.counts.failures} failed operations · ${facts.counts.tests} recorded checks · ${facts.counts.unfinished} in progress · ${facts.counts.gaps} capture gaps`,
    `## Files with captured change inputs (${facts.editedFiles.length} of ${facts.editedFileCount})`,...facts.editedFiles.map(path=>`- ${line(path)}`)];
  for(const [key,label] of [['failures','Failed operations'],['tests','Recorded checks'],['unfinished','In progress'],['gaps','Capture gaps']] as const){rows.push(`## ${label} (${facts[key].length} of ${facts.counts[key]})`);for(const item of facts[key])rows.push(`- ${line(item.title)}${item.detail?` — ${line(item.detail)}`:''}\n  Reference: ${item.operationId??'capture gap'} · observation ${item.sequence}${item.status?` · ${item.status}`:''}`);}
  rows.push(`## Findings (${data.findings.length} of ${data.findingCount})`);
  for(const finding of data.findings)rows.push(`- ${line(finding.title)}\n${quote(finding.detail)}\n  Evidence: ${finding.examples.map(item=>`${item.operationId} @ ${item.sequence}`).join('; ')||`capture gaps from observation ${finding.sequence}`}`);
  rows.push(`## Prompt windows (${data.prompts.length} of ${data.promptCount})`,'Counts refer to operations started between prompt observations; outcomes are the latest captured values.');
  for(const prompt of data.prompts)rows.push(`### Prompt ${prompt.ordinal}\n${quote(prompt.preview)}\n${prompt.operations} operations · ${prompt.changes} change calls · ${prompt.checks} checks · ${prompt.failures} failed outcomes\nReference: ${prompt.id} · observation ${prompt.sequence}`);
  const open=questions.filter(question=>question.status==='open');rows.push(`## Open reviewer questions (${open.length})`,'Local reviewer notes, separate from captured agent output.');
  for(const question of open)rows.push(`### ${line(question.title)}\n${quote(question.question)}\nOwner: ${line(question.owner||'Unassigned')}\nReference: ${line(question.operationId)} · observation ${question.sequence}`);
  rows.push('Lists are bounded samples with complete counts. Open Review pages for omitted evidence. No automatic resolution or causal attribution is implied.');
  return redactText(rows.join('\n\n')).text;
}
