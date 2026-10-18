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

it('shows neutral evidence explanations for unverified changes and missing results across classes',()=>{
  for(const created of [true,false])expect(operationOutcome({status:'unknown',tool:'exec',detail:{kind:'edit',path:'a.ts',hunks:[],created,reconstruction:'complete'}})).toMatchObject({label:'Change unverified',mark:'—',tone:'unknown'});
  for(const detail of [{kind:'read',path:'a.ts',startLine:1,lineCount:1},{kind:'mcp',server:'s',tool:'t',input:{}},{kind:'other',input:{}}] as const){expect(operationOutcome({status:'unknown',tool:'tool',detail})).toMatchObject({label:'Result not captured',mark:'—'});}
  expect(operationOutcome({status:'error',tool:'Write',detail:{kind:'edit',path:'a.ts',hunks:[],created:true,reconstruction:'complete'}})).toMatchObject({mark:'✕',label:'Failed'});
});
