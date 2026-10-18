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
  const label={ok:'Completed',error:'Failed',running:'Running',unknown:'Outcome not captured'}[op.status];
  return {label,mark:{ok:'✓',error:'✕',running:'◌',unknown:'?'}[op.status],tone:op.status,explanation:command&&exitCode!=null?`Captured process exit code: ${exitCode}`:`Captured tool outcome: ${label.toLowerCase()}`};
}
