import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { turnLedgers } from '../src/turns.ts';
import { compose } from '../src/index.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string, store: Store, real: Projection;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-turns-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  real = ingest.projection((await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'))).recordingId);
});
afterAll(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });

const op = (id: string, kind: Operation['kind'], detail: Operation['detail'], status: Operation['status'] = 'ok'): Operation => ({
  id, agentId: 'agent:main', kind, tool: 't', title: id, titleProvenance: { kind: 'derived', rule: 'r', observationIds: [] },
  origin: { type: 'native', tool: 't' }, status, startSequence: 0, paths: [], detail, artifactIds: [], observationIds: [], classification: { kind: 'captured', observationIds: [] },
});
const hunk = (lines: string[]) => ({ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines });

// Two turns: the first reads, edits two files (one twice), runs a command and a failing test; the second only searches.
const built = (): Projection => {
  const operations = [
    op('r1', 'read', { kind: 'read', path: 'a.ts', startLine: 1, lineCount: 3 }),
    op('e1', 'edit', { kind: 'edit', path: 'a.ts', hunks: [hunk([' c', '+x', '+y', '-z'])], created: false, reconstruction: 'complete' }),
    op('e2', 'edit', { kind: 'edit', path: 'a.ts', hunks: [hunk(['+w'])], created: false, reconstruction: 'complete' }),
    op('e3', 'write', { kind: 'edit', path: 'b.ts', hunks: [hunk(['+n', '+m'])], created: true, reconstruction: 'complete' }),
    op('eBad', 'edit', { kind: 'edit', path: 'never.ts', hunks: [hunk(['+q'])], created: false, reconstruction: 'complete' }, 'error'),
    op('s1', 'shell', { kind: 'shell', command: 'ls' }),
    op('t1', 'test', { kind: 'test', command: 'pnpm test', summary: { framework: 'vitest', passed: 41, failed: 1, skipped: 0, failures: [], passing: [], basis: 'derived' } }, 'error'),
    op('q1', 'search', { kind: 'search', query: 'amount', mode: 'text', hits: [] }),
    op('w1', 'shell', { kind: 'shell', command: 'sleep' }, 'running'),
  ];
  const at = (s: number) => `2026-10-19T10:00:${String(s).padStart(2, '0')}Z`;
  const timeline: Projection['timeline'] = [
    { type: 'turn', id: 'u1', sequence: 1, agentId: 'agent:main', prompt: 'first', time: at(0) },
    ...['r1', 'e1', 'e2', 'e3', 'eBad', 's1', 't1'].flatMap((id, i) => [
      { type: 'op-start' as const, id: `s_${id}`, operationId: id, sequence: 2 + i, agentId: 'agent:main', time: at(1 + i) },
      { type: 'op-end' as const, id: `e_${id}`, operationId: id, sequence: 2 + i, agentId: 'agent:main', time: at(2 + i) },
    ]),
    { type: 'turn', id: 'u2', sequence: 30, agentId: 'agent:main', prompt: 'second', time: at(30) },
    { type: 'op-start', id: 's_q1', operationId: 'q1', sequence: 31, agentId: 'agent:main', time: at(31) },
    { type: 'op-start', id: 's_w1', operationId: 'w1', sequence: 32, agentId: 'agent:main' },
  ];
  return { operations, timeline } as unknown as Projection;
};

describe('turnLedgers', () => {
  it('counts one turn from captured operations only', () => {
    const [first] = turnLedgers(built());
    expect(first).toMatchObject({ step: 0, operations: 7, reads: 1, commands: 1, failed: 2, open: 0 });
    expect(first!.edits).toEqual({ files: 2, added: 5, removed: 1 });
    expect(first!.tests).toEqual({ runs: 1, passed: 41, failed: 1 });
  });

  it('does not count a failed edit as an edited file', () => {
    expect(turnLedgers(built())[0]!.edits.files).toBe(2);
  });

  it('gives each turn its own range and open calls', () => {
    const [, second] = turnLedgers(built());
    expect(second).toMatchObject({ operations: 2, searches: 1, commands: 1, open: 1, reads: 0 });
    expect(second!.edits).toEqual({ files: 0, added: 0, removed: 0 });
  });

  it('derives duration from the last captured time inside the turn and never invents one', () => {
    const [first, second] = turnLedgers(built());
    expect(first!.durationMs).toBe(8_000);
    expect(first!.endTime).toBe('2026-10-19T10:00:08.000Z');
    expect(second!.durationMs).toBe(1_000);
    const untimed = built();
    untimed.timeline = untimed.timeline.map((item) => ({ ...item, time: undefined }) as typeof item);
    const none = turnLedgers(untimed)[0]!;
    expect(none.durationMs).toBeUndefined(); expect(none.endTime).toBeUndefined();
  });

  it('adds what the harness recorded about a turn and keeps the derived duration beside it', () => {
    const projection = built();
    projection.turns = [
      { id: 'a', agentId: 'agent:main', basis: 'captured', startSequence: 0, endSequence: 20, durationMs: 12_000, timeToFirstTokenMs: 900, outcome: 'completed', settings: { model: 'm1', effort: 'high', approvalPolicy: 'never' } },
      { id: 'b', agentId: 'agent:main', basis: 'captured', startSequence: 29, endSequence: 40, durationMs: 3_000, outcome: 'aborted', reason: 'interrupted', settings: { model: 'm1', effort: 'low', approvalPolicy: 'never' } },
    ];
    const [first, second] = turnLedgers(projection);
    expect(first!.durationMs).toBe(8_000);
    expect(first!.recorded).toEqual({ durationMs: 12_000, timeToFirstTokenMs: 900, outcome: 'completed', settingsChange: { model: 'm1', effort: 'high', approvalPolicy: 'never' } });
    expect(second!.recorded).toEqual({ durationMs: 3_000, outcome: 'aborted', reason: 'interrupted', settingsChange: { effort: 'low' } });
  });

  it('puts the duration on a single-prompt turn only, and the outcome on the last prompt of a shared turn', () => {
    const projection = built();
    projection.turns = [{ id: 'a', agentId: 'agent:main', basis: 'captured', startSequence: 0, endSequence: 40, durationMs: 30_000, outcome: 'aborted', reason: 'interrupted', settings: { model: 'm1' } }];
    const [first, second] = turnLedgers(projection);
    expect(first!.recorded).toEqual({ settingsChange: { model: 'm1' } });
    expect(second!.recorded).toEqual({ outcome: 'aborted', reason: 'interrupted' });
  });

  it('records nothing for a turn the harness did not record, or one that ended before the prompt', () => {
    const none = built();
    expect(turnLedgers(none).every((l) => l.recorded === undefined)).toBe(true);
    none.turns = [{ id: 'a', agentId: 'agent:main', basis: 'captured', startSequence: 0, endSequence: 5, durationMs: 1 }];
    const [first, second] = turnLedgers(none);
    expect(first!.recorded).toEqual({ durationMs: 1 });
    expect(second!.recorded).toBeUndefined();
  });

  it('works on a real recording: one ledger per prompt, positions match the timeline', () => {
    const ledgers = turnLedgers(real);
    const turns = real.timeline.flatMap((item, index) => item.type === 'turn' ? [index] : []);
    expect(ledgers.map((l) => l.step)).toEqual(turns);
    expect(ledgers.reduce((n, l) => n + l.operations, 0)).toBeLessThanOrEqual(real.operations.length);
    expect(ledgers.some((l) => l.edits.files > 0)).toBe(true);
  });

  it('marks every passage after a prompt with that turn, so a folded turn knows its members', () => {
    const scene = compose(real, { step: real.timeline.length });
    let turn: number | undefined;
    for (const ps of scene.passages) {
      if (ps.turnStep !== undefined) turn = ps.turnStep;
      expect(ps.inTurn).toBe(turn);
    }
    expect(scene.passages.some((ps) => ps.inTurn !== undefined && ps.turnStep === undefined)).toBe(true);
  });

  it('is empty without prompts and deterministic', () => {
    expect(turnLedgers({ operations: [], timeline: [] } as unknown as Projection)).toEqual([]);
    expect(turnLedgers(real)).toEqual(turnLedgers(real));
  });
});
