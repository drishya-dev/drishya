import { describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { readBeforeWriteFor } from '../src/index.ts';

// READ-6: facts about recorded reads before an edit; never a judgement.
const base = { agentId: 'a', title: '', titleProvenance: 'derived', origin: { type: 'native', tool: 'x' }, status: 'ok', paths: [], artifactIds: [], observationIds: [], classification: 'derived' };
const read = (id: string, seq: number, startLine: number, lineCount: number, path = 'src/a.ts', extra: object = {}): Operation => ({ ...base, id, kind: 'read', tool: 'Read', startSequence: seq, detail: { kind: 'read', path, startLine, lineCount, ...extra }, ...extra }) as unknown as Operation;
const edit = (id: string, seq: number, hunks: [number, number][], created = false, path = 'src/a.ts'): Operation => ({ ...base, id, kind: 'edit', tool: 'Edit', startSequence: seq, detail: { kind: 'edit', path, created, reconstruction: 'complete', hunks: hunks.map(([oldStart, oldLines]) => ({ oldStart, oldLines, newStart: oldStart, newLines: oldLines, lines: [] })) } }) as unknown as Operation;
const projection = (operations: Operation[], harness = 'claude-code') => ({ operations, agents: [{ id: 'a', harness }] }) as unknown as Projection;

describe('readBeforeWriteFor', () => {
  it('says none was recorded when the file was never read', () => {
    const r = readBeforeWriteFor(projection([edit('e', 5, [[40, 3]])]), 'e')!;
    expect(r.coverage).toBe('none');
    expect(r.totalReads).toBe(0);
  });

  it('compares the lines an edit replaces with the lines that were read', () => {
    const inside = readBeforeWriteFor(projection([read('r', 1, 1, 100), edit('e', 5, [[40, 19]])]), 'e')!;
    expect(inside.coverage).toBe('inside');
    expect(inside.edited).toEqual([{ start: 40, end: 58 }]);
    expect(readBeforeWriteFor(projection([read('r', 1, 1, 30), edit('e', 5, [[40, 19]])]), 'e')!.coverage).toBe('outside');
    expect(readBeforeWriteFor(projection([read('r', 1, 1, 50), edit('e', 5, [[40, 19]])]), 'e')!.coverage).toBe('partly');
  });

  it('does not compare line numbers across an earlier edit to the same file', () => {
    const r = readBeforeWriteFor(projection([read('r', 1, 1, 100), edit('e1', 3, [[10, 1]]), edit('e2', 5, [[40, 3]])]), 'e2')!;
    expect(r.reads[0]!.changedSince).toBe(true);
    expect(r.coverage).toBe('unknown');
  });

  it('ignores failed reads, other files and other agents; a whole-file read covers every line', () => {
    const other = { ...read('x', 2, 1, 100), agentId: 'b' } as Operation;
    const failed = { ...read('f', 2, 1, 100), status: 'error' } as Operation;
    const elsewhere = read('o', 2, 1, 100, 'src/b.ts');
    expect(readBeforeWriteFor(projection([other, failed, elsewhere, edit('e', 5, [[40, 3]])]), 'e')!.totalReads).toBe(0);
    expect(readBeforeWriteFor(projection([read('w', 1, 1, 0), edit('e', 5, [[900, 3]])]), 'e')!.coverage).toBe('inside');
  });

  it('has nothing for a new file with no read, a non-edit, or a harness whose reads are not captured', () => {
    expect(readBeforeWriteFor(projection([edit('e', 5, [], true)]), 'e')!.created).toBe(true);
    expect(readBeforeWriteFor(projection([read('r', 1, 1, 10)]), 'r')).toBeUndefined();
    expect(readBeforeWriteFor(projection([edit('e', 5, [[1, 1]])], 'codex'), 'e')).toBeUndefined();
  });
});
