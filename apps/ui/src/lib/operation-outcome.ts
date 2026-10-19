import type {Operation} from '@drishya/contracts';

/** Presentation scope only: never turn an outer wrapper receipt into task success. */
export function operationOutcome(op:Pick<Operation,'status'|'detail'|'tool'>) {
  const command=op.detail.kind==='shell'||op.detail.kind==='test';
  const exitCode=op.detail.kind==='shell'||op.detail.kind==='test'?op.detail.exitCode:undefined;
  const wrapper=command&&(op.tool==='exec'||op.tool==='functions.exec');
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
