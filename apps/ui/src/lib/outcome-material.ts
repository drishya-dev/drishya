import {capturedOutcomes,type OutcomeReport} from './captured-outcomes.ts';
interface Slice{text?:string;partial?:string;hasMore?:boolean;start?:number}
/** Never concatenate disjoint output slices or map first-page cases onto tail summaries. */
export function outcomeMaterial(preview:string,head:Slice={},tail:Slice={}):OutcomeReport{
 if(head.text&&!head.partial&&head.text.length<=131072)return capturedOutcomes(head.text);
 const initial=capturedOutcomes(preview);
 if(initial.runs.some(run=>!run.observedOnly))return initial;
 if(head.text&&head.hasMore&&!/^\s*[\[{]/.test(head.text)&&tail.text&&!tail.partial&&tail.text.length<=131072){
  const runner=/^TAP version \d+\s*$/m.test(head.text)?'TAP':/^\s*Running \d+ tests? using \d+ workers?/m.test(head.text)?'Playwright':undefined;
  const report=capturedOutcomes(tail.text,{runner});
  if(report.runs.some(run=>!run.observedOnly)){
   for(const run of report.runs)for(const item of run.cases??[])item.line+=tail.start??0;
   report.notes.push('Summary from the last captured output slice; earlier case rows are not mapped onto these totals.');return report;
  }
 }
 return initial;
}
