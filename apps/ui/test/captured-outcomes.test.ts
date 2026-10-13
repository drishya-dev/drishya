import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { asOfProjection, type ReplayBundle } from '@drishya/contracts';
import { capturedOutcomes } from '../src/lib/captured-outcomes.ts';

describe('bounded captured outcome presentation', () => {
  const vitest = '\u001b[32mTest Files 46 passed (46)\u001b[0m\nTests 324 passed (324)';
  it('unwraps mixed tool results without counting typecheck exit success', () => {
    const raw = JSON.stringify([{ i: 0, status: 'fulfilled', value: { output: vitest, exit_code: 0 } }, { i: 1, status: 'fulfilled', value: { output: '', exit_code: 0 } }]);
    const { runs } = capturedOutcomes(raw);
    expect(runs).toHaveLength(1); expect(runs[0]!.counts.passed).toBe(324); expect(runs[0]!.suites).toBe('46 passed (46)');
  });
  it('preserves separate runner summaries and captured child output identities', () => {
    const { runs } = capturedOutcomes(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ output: vitest }) }, { type: 'text', text: JSON.stringify({ output: 'Tests: 1 failed, 4 passed, 1 skipped, 6 total' }) }] }));
    expect(runs.map(r => [r.runner, r.output, r.counts.passed])).toEqual([['Vitest', 1, 324], ['Jest', 2, 4]]);
    expect(capturedOutcomes(vitest + '\n' + vitest).runs).toHaveLength(2);
  });
  it('reads explicit pytest, Cargo and Node TAP counters, keeping cancellation and errors separate', () => {
    expect(capturedOutcomes('=== 2 failed, 3 passed, 1 skipped, 1 error in 1.2s ===').runs[0]!.counts).toMatchObject({ passed: 3, failed: 2, skipped: 1, errors: 1 });
    expect(capturedOutcomes('test result: ok. 3 passed; 0 failed; 1 ignored; 0 measured;').runs[0]!.counts.skipped).toBe(1);
    const tap = 'TAP version 13\n    ok 1 - suite child\n# tests 4\n# suites 1\n# pass 2\n# fail 0\n# cancelled 1\n# skipped 1\n# todo 0';
    expect(capturedOutcomes(tap).runs[0]!.counts).toMatchObject({ passed: 2, cancelled: 1, skipped: 1 });
  });
  it('does not infer tests from suites, scripts, warnings or successful exits', () => {
    expect(capturedOutcomes('Test Files 46 passed (46)').runs).toHaveLength(0);
    expect(capturedOutcomes(JSON.stringify({ command: vitest, exit_code: 0 })).runs).toHaveLength(0);
    expect(capturedOutcomes('warning: something\nexit 0').runs).toHaveLength(0);
    expect(capturedOutcomes('Tests 3 passed (').runs).toHaveLength(0);
    expect(capturedOutcomes('{"output":"Tests 3 passed (3)').runs).toHaveLength(0);
  });
  it('rejects contradictory counts and represents explicit unreported totals as unknown', () => {
    expect(capturedOutcomes('Tests 4 passed (3)').notes).toContain('Contradictory summary retained as raw output.');
    expect(capturedOutcomes('Tests 2 passed (3)').runs[0]!.counts.unknown).toBe(1);
    expect(capturedOutcomes('Tests -1 passed (1)').runs).toHaveLength(0);
    expect(capturedOutcomes('Tests 1 passed | 1 passed (2)').runs).toHaveLength(0);
    expect(capturedOutcomes('[warning] wrapped preamble\nTests 2 passed (2)').runs[0]!.counts.passed).toBe(2);
    expect(capturedOutcomes('1 passed, 4 deselected in 1.2s').runs[0]!.counts).toMatchObject({ passed: 1, skipped: 0, deselected: 4 });
  });
  it('does not expose pending or future results across the replay boundary', () => {
    const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
    const original = bundle.projection.operations.filter(op => op.detail.kind === 'test').at(-1)!;
    original.detail = { kind: 'shell', command: 'captured checks', outputPreview: JSON.stringify({ output: vitest }) };
    const step = bundle.projection.timeline.findIndex(item => item.type === 'op-start' && item.operationId === original.id);
    const pending = asOfProjection(bundle.projection, step + 1).operations.find(op => op.id === original.id)!;
    expect(pending.detail.kind).toBe('shell');
    if (pending.detail.kind === 'shell') expect(capturedOutcomes(pending.detail.outputPreview ?? '').runs).toHaveLength(0);
    const complete = asOfProjection(bundle.projection, bundle.projection.timeline.length).operations.find(op => op.id === original.id)!;
    if (complete.detail.kind === 'shell') expect(capturedOutcomes(complete.detail.outputPreview ?? '').runs).toHaveLength(1);
  });
  it('bounds nested inputs and repeated six-figure summaries', () => {
    const raw = JSON.stringify(Array.from({ length: 30 }, () => ({ output: 'Tests 100000 passed (100000)' })));
    expect(capturedOutcomes(raw).runs).toHaveLength(8);
    expect(capturedOutcomes(raw).notes.length).toBeGreaterThan(0);
    expect(capturedOutcomes('x'.repeat(200000)).notes).toContain('Parsing limited to the first 128 KiB of captured preview.');
  });
});
