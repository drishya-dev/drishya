import { describe, expect, it } from 'vitest';
import { contextReportCandidates } from '../src/context-report-turns.ts';

const turn = (prompt: string, time = '2026-11-01T10:00:00Z') => ({ type: 'turn', prompt, time });
const report = (n: number) => `<local-command-stdout>## Context Usage\n**Tokens:** ${n}k / 1m (1%)\n| Category | Tokens | Percentage |\n|---|---|---|\n| Messages | ${n}k | 1% |</local-command-stdout>`;
describe('context report candidates (USAGE-1)', () => {
  it('returns the newest captured /context outputs first, as captured', () => {
    const found = contextReportCandidates([turn(report(1)), { type: 'marker' }, turn('an ordinary prompt'), turn(report(2), 'later'), turn(report(3))]);
    expect(found.map(f => f.prompt)).toEqual([report(3), report(2), report(1)]);
    expect(found[1]!.time).toBe('later');
  });
  it('ignores other command output, mentions inside prose, and oversized text; keeps at most three', () => {
    expect(contextReportCandidates([turn('<local-command-stdout>Total cost: $1</local-command-stdout>'), turn(`see ${report(1)}`), turn('x'.repeat(600_000))])).toEqual([]);
    expect(contextReportCandidates(Array.from({ length: 6 }, (_, i) => turn(report(i + 1))))).toHaveLength(3);
  });
});
