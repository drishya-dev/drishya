import {expect,it} from 'vitest';
import {operationOutcome,outputReportsFailure} from '../src/lib/operation-outcome.ts';

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
  for(const detail of [{kind:'read',path:'a.ts',startLine:1,lineCount:1},{kind:'mcp',server:'s',tool:'t',input:{}},{kind:'other',input:{}}] as const){expect(operationOutcome({status:'unknown',tool:'tool',detail})).toMatchObject({label:'Result not recorded',mark:'—'});}
  expect(operationOutcome({status:'error',tool:'Write',detail:{kind:'edit',path:'a.ts',hunks:[],created:true,reconstruction:'complete'}})).toMatchObject({mark:'✕',label:'Failed'});
});

it('reads a failed suite from a run that exited clean, and nothing else',()=>{
  expect(outputReportsFailure('Tests:       3 failed, 40 passed, 43 total\n')).toBe(true);
  expect(outputReportsFailure('Test Suites: 1 failed, 5 passed, 6 total\nTests:       40 passed, 40 total\n')).toBe(true);
  expect(outputReportsFailure(' Test Files  1 failed (1)\n      Tests  no tests\n')).toBe(true);
  expect(outputReportsFailure('  ...\n1..2\n# tests 2\n# suites 0\n# pass 1\n# fail 1\n# cancelled 0\n')).toBe(true);
  expect(outputReportsFailure('tests\\a.spec.ts:1:1 › a\n\n  1 failed\n    tests\\a.spec.ts:1:1 › a\n  3 passed (12.4s)\n')).toBe(true);
  expect(outputReportsFailure('# tests 2\n# pass 2\n# fail 0\n')).toBe(false);
  expect(outputReportsFailure('Tests:       40 passed, 40 total\n')).toBe(false);
  expect(outputReportsFailure('Tests:       0 failed, 40 passed, 40 total\n')).toBe(false);
  expect(outputReportsFailure('grep found: 2 failed logins in auth.log\n')).toBe(false);
  expect(outputReportsFailure(undefined)).toBe(false);
  expect(operationOutcome({status:'ok',tool:'Bash',detail:{kind:'test',command:'npx playwright test',exitCode:0,outputPreview:'Running 2 tests using 1 worker\n  1 failed\n  1 passed (12s)\n'}})).toMatchObject({tone:'reported',mark:'!'});
  expect(operationOutcome({status:'error',tool:'Bash',detail:{kind:'test',command:'npm test',exitCode:1,outputPreview:'Tests:       3 failed, 40 passed, 43 total\n'}})).toMatchObject({tone:'error'});
});
