import {outcomeMaterial} from '../src/lib/outcome-material.ts';
import {expect,it} from 'vitest';
import {capturedTestCases} from '../src/lib/captured-test-cases.ts';
import {capturedOutcomes} from '../src/lib/captured-outcomes.ts';
it('keeps explicit case names, states and source lines without inventing indices',()=>{
 const text='   ✓ reads a file 12ms\n   × fails with context 3ms\nAssertionError: expected 1 to be 2\nTests 1 failed | 1 passed (2)';
 const run=capturedOutcomes(text).runs[0]!;
 expect(run.cases?.map(item=>[item.name,item.state,item.line,item.index])).toEqual([['reads a file','passed',1,undefined],['fails with context','failed',2,undefined]]);
 expect(run.cases?.[1]?.context).toContain('AssertionError: expected 1 to be 2');expect(run.observedOnly).toBeUndefined();
});
it('does not confuse suite rows, missing timing, scripts or ambiguous unheaded TAP with case results',()=>{
 for(const text of [' ✓ src/file.test.ts (5 tests) 12ms','   ✓ documentation example','ok 1 - ambiguous output','{"command":"test a ... ok"}'])expect(capturedTestCases(text)).toEqual([]);
});
it('uses explicit Playwright indices and final totals, not successful shell exits',()=>{
 const text='Running 3 tests using 1 worker\n  ok 1 [chromium] › tests/a.spec.ts:1:1 › first (3ms)\n  x 2 [chromium] › tests/a.spec.ts:2:1 › broken (4ms)\n  - 3 [chromium] › tests/a.spec.ts:3:1 › later\n  1 failed\n  1 skipped\n  1 passed (1.2s)';
 const run=capturedOutcomes(text).runs[0]!;expect(run.runner).toBe('Playwright');expect(run.cases?.map(item=>item.index)).toEqual([1,2,3]);expect(run.counts).toMatchObject({passed:1,failed:1,skipped:1});expect(run.observedOnly).toBeUndefined();
});
it('handles pytest, Cargo and flat TAP while refusing nested TAP indices',()=>{
 const pytest=capturedOutcomes('tests/test_a.py::test_ok PASSED [ 50%]\ntests/test_a.py::test_error ERROR [100%]\n=== 1 passed, 1 error in 1.2s ===').runs[0]!;
 expect(pytest.cases?.map(item=>item.state)).toEqual(['passed','errors']);
 const cargo=capturedOutcomes('test some::case ... ok\ntest some::skip ... ignored\ntest result: ok. 1 passed; 0 failed; 1 ignored; 0 measured;').runs[0]!;expect(cargo.cases).toHaveLength(2);
 const tap='TAP version 13\nok 1 - first\nnot ok 2 - broken\n# tests 2\n# pass 1\n# fail 1';expect(capturedOutcomes(tap).runs[0]?.cases?.[1]?.index).toBe(2);
 expect(capturedTestCases(tap.replace('ok 1 - first','    ok 1 - nested'))).toEqual([]);
});
it('labels partial case-only output as rows rather than complete run totals',()=>{
 const run=capturedOutcomes('tests/a.py::test_one PASSED [ 12%]').runs[0]!;expect(run.observedOnly).toBe(true);expect(run.counts.passed).toBe(1);expect(run.cases).toHaveLength(1);
});
it('does not attach ambiguous or contradictory case rows to a summary',()=>{
 const rows='   ✓ one 2ms\n   ✓ two 4ms';expect(capturedOutcomes(rows+'\nTests 1 passed (1)').runs[0]?.cases).toBeUndefined();
 const repeated=capturedOutcomes(rows+'\nTests 2 passed (2)\nTests 2 passed (2)');expect(repeated.runs).toHaveLength(2);expect(repeated.runs.every(run=>!run.cases)).toBe(true);
});
it('keeps native and MCP mixed outputs separate and bounds case material',()=>{
 const text='   ✓ alpha 2ms\nTests 1 passed (1)';const report=capturedOutcomes(JSON.stringify({content:[{type:'text',text:JSON.stringify({output:text})},{type:'text',text:'test beta ... FAILED\ntest result: FAILED. 0 passed; 1 failed; 0 ignored;'}]}));
 expect(report.runs.map(run=>[run.output,run.runner,run.cases?.length])).toEqual([[1,'Vitest',1],[2,'Cargo',1]]);
 const cases=capturedTestCases(Array.from({length:1000},(_,i)=>`test long::case${i} ... ok`).join('\n'));expect(cases).toHaveLength(240);expect(cases.every(item=>item.context.length<=6000)).toBe(true);
});

it('recovers complete wrapped artifact material without joining disjoint slices',()=>{
 const wrapped=JSON.stringify({output:'   ✓ long output recovered 2ms\nTests 1 passed (1)',exit_code:0});
 expect(outcomeMaterial(wrapped.slice(-40),{text:wrapped}).runs[0]?.cases?.[0]?.name).toBe('long output recovered');
 const result=outcomeMaterial('log preview',{text:'TAP version 13\nok 1 - old case',hasMore:true,partial:'partial'},{text:'# tests 2\n# pass 1\n# fail 1',start:300});
 expect(result.runs[0]?.counts).toMatchObject({passed:1,failed:1});expect(result.runs[0]?.cases).toBeUndefined();expect(result.notes.join(' ')).toContain('earlier case rows are not mapped');
 expect(outcomeMaterial('Tests 3 passed (3)',{text:'partial first slice',hasMore:true,partial:'partial'},{text:'Tests 2 passed (2)'}).runs[0]?.counts.passed).toBe(3);
 expect(outcomeMaterial('preview',{text:'{"output":"partial',hasMore:true,partial:'partial'},{text:'Tests 2 passed (2)'}).runs).toHaveLength(0);
});

it('keeps pytest warnings outside test counts in real-style stdout and stderr envelopes',()=>{
 const text='142 passed, 4 warnings in 12.49s',run=capturedOutcomes(JSON.stringify({stdout:text,stderr:'a warning'})).runs[0]!;
 expect(run.runner).toBe('pytest');expect(run.counts.passed).toBe(142);expect(run.warnings).toBe(4);expect(Object.values(run.counts).reduce((a,b)=>a+b,0)).toBe(142);
 expect(capturedOutcomes('1 failed, 141 passed, 4 warnings in 9.77s').runs[0]?.counts.failed).toBe(1);
 expect(capturedOutcomes('2 passed, 1 warning, 2 warnings in 1.1s').runs).toHaveLength(0);
});
