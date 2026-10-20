import {describe,it,expect} from 'vitest';
import {outputPaths} from '../src/lib/output-paths.ts';

describe('captured diagnostic file locations',()=>{
 it.each([
  ['  at run (C:\\repo\\src\\main.ts:12:3)', 'src/main.ts',12],
  ['src/main.ts(4,9): error TS1', 'src/main.ts',4],
  ['  1 tests/browser/main.spec.ts:19:1 › opens', 'tests/browser/main.spec.ts',19],
  ['FAIL src/main.test.ts', 'src/main.test.ts',undefined],
  [' ✓ src/main.test.ts (3 tests)', 'src/main.test.ts',undefined],
  ['tests/test_main.py::test_open FAILED', 'tests/test_main.py',undefined],
  ['  File "C:/repo/src/has space.py", line 7, in run', 'src/has space.py',7],
 ])('resolves %s without changing its text', (text,path,line)=>{
  const hits=outputPaths(text,'C:/repo');expect(hits).toHaveLength(1);expect(hits[0]!.path).toBe(path);expect(hits[0]!.line).toBe(line);
  const hit=hits[0]!;expect(text.slice(hit.start,hit.end)).toContain(path.split('/').at(-1)!.split('.')[0]!);
 });
 it.each(['https://example.com/src/main.ts:2:3','../src/main.ts:2','C:/repo-other/src/main.ts:2','echo "src/main.ts:2"','const value = "src/main.ts:2";','version v3.2.7','at node:internal/main.js:3:1'])('leaves untrusted/unresolved text inert: %s',text=>expect(outputPaths(text,'C:/repo')).toEqual([]));
 it('keeps POSIX boundaries and bounds work',()=>{
  expect(outputPaths('at /repo/src/main.py:3','/repo')[0]).toMatchObject({path:'src/main.py',line:3});
  expect(outputPaths('at /repo-other/src/main.py:3','/repo')).toEqual([]);
  expect(outputPaths('x'.repeat(4097),'C:/repo')).toEqual([]);
  expect(outputPaths('src/a.ts:1 src/b.ts:2','C:/repo',1)).toHaveLength(1);
 });
});
