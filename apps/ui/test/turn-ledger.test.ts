import { describe, expect, it } from 'vitest';
import type { TurnLedger } from '../../../packages/scene/src/turns.ts';
import { ledgerParts, ledgerSummary } from '../src/lib/turn-ledger.ts';

const base = (patch: Partial<TurnLedger> = {}): TurnLedger => ({
  step: 0, operations: 0, reads: 0, searches: 0, edits: { files: 0, added: 0, removed: 0 }, commands: 0,
  tests: { runs: 0, passed: 0, failed: 0 }, web: 0, mcp: 0, delegations: 0, failed: 0, open: 0, ...patch,
});

describe('ledgerParts', () => {
  it('writes the account the way a developer would say it', () => {
    const text = ledgerSummary(base({ operations: 30, reads: 12, edits: { files: 4, added: 86, removed: 23 }, commands: 9, tests: { runs: 2, passed: 41, failed: 1 }, durationMs: 192_000 }));
    expect(text).toBe('read 12 · edited 4 files (+86 −23) · 9 commands · tests 41✓ 1✗ · 3 m 12 s');
  });

  it('names only what happened and singularizes', () => {
    expect(ledgerSummary(base({ reads: 1, commands: 1, edits: { files: 1, added: 2, removed: 0 } }))).toBe('read 1 · edited 1 file (+2 −0) · 1 command');
    expect(ledgerParts(base({ operations: 0 }))).toEqual([]);
  });

  it('marks failures and failing tests so they cannot hide among counts', () => {
    const parts = ledgerParts(base({ failed: 2, tests: { runs: 1, passed: 3, failed: 1 } }));
    expect(parts.find((part) => part.text.startsWith('tests'))!.tone).toBe('bad');
    expect(parts.at(-1)).toEqual({ text: '2 failed', tone: 'bad' });
    expect(ledgerParts(base({ tests: { runs: 1, passed: 5, failed: 0 } }))[0]).toEqual({ text: 'tests 5✓', tone: 'good' });
  });

  it('says test runs without invented counts when no summary was captured', () => {
    expect(ledgerSummary(base({ tests: { runs: 2, passed: 0, failed: 0 } }))).toBe('2 test runs');
  });

  it('adds a duration only when something happened and it is at least a second', () => {
    expect(ledgerSummary(base({ commands: 1, durationMs: 400 }))).toBe('1 command');
    expect(ledgerSummary(base({ durationMs: 60_000 }))).toBe('');
    expect(ledgerSummary(base({ commands: 1, durationMs: 59_000 }))).toBe('1 command · 59 s');
  });
});
