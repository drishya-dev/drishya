import {expect,it} from 'vitest';
import {operationOutcome} from '../src/lib/operation-outcome.ts';

it('does not present a successful wrapper as successful nested execution',()=>{
  for(const exitCode of [undefined,null,0]){
    const outcome=operationOutcome({status:'ok',tool:'exec',detail:{kind:'shell',command:'text(await tools.exec_command(...))',exitCode}});
    expect(outcome.tone).toBe('returned');expect(outcome.mark).not.toBe('✓');expect(outcome.explanation).toContain('nested commands');
  }
});
it('keeps reported native process exits and errors distinct from unreported exits',()=>{
  expect(operationOutcome({status:'ok',tool:'Bash',detail:{kind:'shell',command:'npm test',exitCode:0}})).toMatchObject({tone:'ok',mark:'✓'});
  expect(operationOutcome({status:'error',tool:'Bash',detail:{kind:'shell',command:'npm test',exitCode:1}})).toMatchObject({tone:'error',label:'Failed'});
  expect(operationOutcome({status:'ok',tool:'Bash',detail:{kind:'shell',command:'npm test'}})).toMatchObject({tone:'returned'});
});
