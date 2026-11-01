import {describe,expect,it} from 'vitest';
import {currentReadingTarget,currentReadingFailure,OUTSIDE_FILE_REASON,recordedFileIdentity,capturedFileEvidence} from '../src/lib/file-reading.ts';
import type {Operation} from '@drishya/contracts';

describe('captured file navigation boundary',()=>{
  const roots=[{root:'C:/repo',prefix:'worktree-1111111111'},{root:'C:/worker',prefix:'worktree-2222222222'}];
  it('maps only exact main roots and keeps an inside absolute path relative',()=>{
    expect(currentReadingTarget('worktree-1111111111/src/a.ts',roots,'c:\\repo').path).toBe('src/a.ts');
    expect(currentReadingTarget('C:/REPO/src/a.ts',roots,'c:/repo').path).toBe('src/a.ts');
    expect(currentReadingTarget('src/a.ts',roots,'C:/repo').path).toBe('src/a.ts');
  });
  it('does not grant another root, a similarly named root or unresolved metadata',()=>{
    for(const path of ['C:/repo-other/a.ts','C:/scratchpad/a.ts','../a.ts','/outside/a.ts','//remote/share/a.ts','worktree-2222222222/a.ts'])expect(currentReadingTarget(path,roots,'C:/repo').reason).toBe(OUTSIDE_FILE_REASON);
    expect(currentReadingTarget('worktree-3333333333/a.ts',roots,'C:/repo').path).toBeUndefined();
    expect(currentReadingTarget('src/a.ts',roots,undefined).path).toBeUndefined();
  });
  it('explains permanent refusals without hiding transient retry opportunities',()=>{
    expect(currentReadingTarget('.env',roots,'C:/repo').path).toBeUndefined();
    expect(currentReadingFailure('the file is no longer there')).toContain('no longer on disk');
    expect(currentReadingFailure('not a readable workspace path')).toBe(OUTSIDE_FILE_REASON);
    expect(currentReadingFailure('linked files are not readable')).toContain('access checks');
    expect(currentReadingFailure('Network unavailable')).toBeUndefined();
  });
  it('resolves captured aliases only from existing exact main-root evidence',()=>{
    const files=['worktree-1111111111/src/a.ts','worktree-2222222222/src/b.ts'];
    expect(recordedFileIdentity('src/a.ts',files,roots,'C:/repo')).toBe(files[0]);
    expect(recordedFileIdentity('src/b.ts',files,roots,'C:/repo')).toBe('src/b.ts');
    expect(recordedFileIdentity('absent.ts',files,roots,'C:/repo')).toBe('absent.ts');
  });
  it('prefers the actual after-state when one was captured without inventing one from a patch',()=>{
    const op={id:'op',detail:{kind:'edit',path:'src/a.ts',hunks:[{}]},artifactIds:['art_op_after']} as unknown as Operation;
    expect(capturedFileEvidence(op,'src/a.ts')).toBe('op/after');
    expect(capturedFileEvidence({...op,artifactIds:[]},'src/a.ts')).toBe('op/patch');
    expect(capturedFileEvidence(op,'different.ts')).toBeUndefined();
  });
});
