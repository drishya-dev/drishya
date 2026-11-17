import { describe, expect, it } from 'vitest';
import { decodeArgs, intentFor, outcomeFor, recordedExitCode, touchesProtectedFile, isPlanArtifact } from '../src/tools.ts';

describe('Antigravity tool mapping', () => {
  it('decodes each argument once and tolerates malformed values', () => {
    expect(decodeArgs({ Path: '"a.ts"', StartLine: '12', broken: '{', nested: '"\\\"inner\\\""' })).toEqual({ Path: 'a.ts', StartLine: 12, broken: '{', nested: '"inner"' });
  });
  it('maps reads and preserves recorded line numbers', () => {
    const a = { Path: 'a.ts', StartLine: 2, EndLine: 3 };
    expect(intentFor('read_file', a)).toEqual({ kind: 'read', path: 'a.ts', offset: 2, limit: 2 });
    expect(outcomeFor('read_file', a, 'Showing lines 2-3 of 8\n2: hello\n3: world')).toMatchObject({ kind: 'read', startLine: 2, numLines: 2, totalLines: 8, harnessLineNumbers: true });
  });
  it('never fabricates exits or file creation', () => {
    expect(recordedExitCode('Command output\nhello')).toBeUndefined();
    expect(recordedExitCode('Exit code: 2')).toBe(2);
    expect(outcomeFor('run_command', {}, 'one stream')).toEqual({ kind: 'shell', stdout: 'one stream' });
    expect(outcomeFor('write_file', { Path: 'x' }, 'Updated file')).toEqual({ kind: 'edit', path: 'x' });
    expect(outcomeFor('write_file', { Path: 'x' }, 'Created file')).toMatchObject({ created: true });
  });
  it('reads the first complete exit status and preserves wrapped whitespace', () => {
    expect(recordedExitCode('Message: Exit code: 3\r\nExit status: unavailable\r\n\tExit status \r\n: \t-2\r\nExit code: 0')).toBe(-2);
    expect(recordedExitCode('Exit code: 2 bytes written\n  Exit code: 0  \n')).toBe(0);
  });
  it('maps requested edits, searches, web and spawn without claiming applied edits', () => {
    expect(intentFor('edit_file', { TargetFile: 'a', Target: 'old', Replacement: 'new', AllowMultiple: true })).toEqual({ kind: 'edit', path: 'a', edits: [{ oldString: 'old', newString: 'new', replaceAll: true }] });
    expect(outcomeFor('edit_file', { TargetFile: 'a' }, 'failed')).toEqual({ kind: 'edit', path: 'a' });
    expect(intentFor('grep_search', { Query: 'x' })).toMatchObject({ kind: 'search', mode: 'text', query: 'x' });
    expect(intentFor('find_by_name', { Pattern: '*.ts' })).toMatchObject({ kind: 'search', mode: 'file' });
    expect(intentFor('search_web', { Query: 'x' })).toMatchObject({ kind: 'web', query: 'x' });
    expect(intentFor('invoke_subagent', { Prompt: 'help' })).toMatchObject({ kind: 'spawn', prompt: 'help' });
    expect(intentFor('list_dir', {})).toEqual({ kind: 'other' });
  });
  it('exposes protected and plan artifact checks', () => {
    expect(touchesProtectedFile(intentFor('read_file', { Path: '.env' }))).toBe(true);
    expect(isPlanArtifact({ Path: '/brain/implementation_plan.md', ArtifactMetadata: {} })).toBe(true);
    expect(isPlanArtifact({ Path: '/repo/task.md' })).toBe(false);
  });
});
