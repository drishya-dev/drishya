import type {Operation} from '@drishya/contracts';
import {capturedOutcomes} from './captured-outcomes.ts';

/** A clean exit does not make a run clean: a pipe can hide the runner's own exit code. The preview is the tail, so a runner's header may be gone and only its footer says what ran. */
export function outputReportsFailure(output?:string):boolean {
  if(!output||!/\d+ failed|\bfail \d+/i.test(output))return false;
  if(/^\s*(?:(?:Test Files|Test Suites:)\s+[1-9]\d* failed|[1-9]\d* failed\s*$|# fail [1-9]\d*\s*$)/m.test(output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g,'').replace(/\r/g,'')))return true;
  return capturedOutcomes(output).runs.some(run=>run.counts.failed>0);
}

/** Presentation scope only: never turn an outer wrapper receipt into task success. */
export function operationOutcome(op:Pick<Operation,'status'|'detail'|'tool'>) {
  const command=op.detail.kind==='shell'||op.detail.kind==='test';
  const exitCode=op.detail.kind==='shell'||op.detail.kind==='test'?op.detail.exitCode:undefined;
  const wrapper=command&&(op.tool==='exec'||op.tool==='functions.exec');
  if(op.status==='ok'&&command&&outputReportsFailure((op.detail as {outputPreview?:string}).outputPreview))return {
    label:'Output reports failures',mark:'!',tone:'reported',
    explanation:'The command finished without an error, but its output reports failures. Read the captured results.',
  };
  if(op.status==='ok'&&command&&(wrapper||exitCode==null))return {
    label:'Tool returned',mark:'↳',tone:'returned',
    explanation:wrapper?'The outer tool returned. Its status does not establish that nested commands or assertions succeeded. Read their captured output.':'The tool returned without a captured process exit code. Read the output for command and test results.',
  };
  if(op.status==='unknown') {
    const kind=op.detail.kind;
    const proposed=kind==='edit'&&(op.tool==='exec'||op.tool==='functions.exec');
    return {label:proposed?'Change unverified':'Result not captured',mark:'—',tone:'unknown',explanation:proposed?'The captured script contains this proposed change. The outer wrapper does not expose whether this nested file operation succeeded.':'The harness did not expose a final result for this operation. Available content is preserved; completion is not assumed.'};
  }
  const label={ok:'Completed',error:'Failed',running:'Running',unknown:'Outcome not captured'}[op.status];
  return {label,mark:{ok:'✓',error:'✕',running:'◌',unknown:'?'}[op.status],tone:op.status,explanation:command&&exitCode!=null?`Captured process exit code: ${exitCode}`:`Captured tool outcome: ${label.toLowerCase()}`};
}
