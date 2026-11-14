import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor, SourceWatch } from '../src/index.ts';
import { firstReach, groupByPaint, percentile, stepKind, summarizeSteps } from '../../../scripts/lib/live-latency.ts';

// LIVE-7 guard: the daemon's share of a live step's delay (the journal growing to the commit a viewer
// is told about) stays small, and capture never waits on whether anything is watching.
let dir: string;
let store: Store;
let ingest: Ingestor;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-live7-'));
  store = new Store(join(dir, 'data'));
  ingest = new Ingestor(store);
});
afterEach(async () => {
  await ingest.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const record = (payload: unknown) => JSON.stringify({ timestamp: new Date().toISOString(), type: 'response_item', payload }) + '\n';

describe('the followed journal reaches a commit quickly', () => {
  it('commits each appended step within the budget, with nobody listening', async () => {
    const journal = join(dir, 'rollout-live.jsonl');
    writeFileSync(journal, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: 'live7', cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n');
    const { recordingId } = await ingest.importSource('codex', journal);
    const commits: { count: number; at: number }[] = [];
    ingest.on('change', (e: { observationCount: number }) => commits.push({ count: e.observationCount, at: performance.now() }));
    ingest.startLive(recordingId);
    await sleep(150);
    // Steps are appended at uneven offsets against the poll, like an agent's.
    const appended: number[] = [];
    for (let i = 0; i < 30; i++) {
      const id = `live7-${i}`;
      appendFileSync(journal, record({ type: 'function_call', name: 'exec_command', call_id: id, arguments: JSON.stringify({ cmd: `echo ${i}` }) }));
      appended.push(performance.now());
      await sleep(7 + (i % 5) * 13);
    }
    await sleep(500);
    const base = store.countObservations(recordingId) - 30;
    expect(base).toBeGreaterThan(0);
    const reached = firstReach(commits, base + 30);
    const delays = appended.map((at, i) => reached[base + i]! - at);
    expect(delays.every((d) => Number.isFinite(d))).toBe(true);
    // Reads ride a 100 ms poll: the budget is the interval plus the work of one small commit. The
    // proposed target for the whole path (append to paint) is p95 < 500 ms; this guards the daemon's part.
    expect(percentile(delays, 95)!).toBeLessThan(250);
    expect(percentile(delays, 50)!).toBeLessThan(150);
  });

  it('following reads what was written since the last import at once', async () => {
    const journal = join(dir, 'rollout-first.jsonl');
    writeFileSync(journal, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: 'live7b', cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n');
    const { recordingId } = await ingest.importSource('codex', journal);
    const before = store.countObservations(recordingId);
    appendFileSync(journal, record({ type: 'function_call', name: 'exec_command', call_id: 'c1', arguments: JSON.stringify({ cmd: 'echo a' }) }));
    ingest.startLive(recordingId, 60_000); // no tick will fire for a minute: only the immediate first look can read it
    await ingest.liveTurn(recordingId);
    expect(store.countObservations(recordingId)).toBeGreaterThan(before);
  });
});

describe('SourceWatch', () => {
  it('announces a new journal and ignores the growth of a settled one', async () => {
    const root = join(dir, 'sessions');
    mkdirSync(join(root, '2026', '11', '14'), { recursive: true });
    const old = join(root, '2026', '11', '14', 'rollout-old.jsonl');
    writeFileSync(old, 'x'.repeat(100 * 1024));
    let notices = 0;
    const watch = new SourceWatch([{ dir: root, depth: 3, match: (n) => n.startsWith('rollout-') && n.endsWith('.jsonl') }], () => notices++);
    expect(await watch.poll(true)).toBe(false); // the first look is the baseline
    appendFileSync(old, 'more\n');
    expect(await watch.poll()).toBe(false);
    expect(notices).toBe(0);
    const fresh = join(root, '2026', '11', '14', 'rollout-new.jsonl');
    writeFileSync(fresh, '{"a":1}\n');
    expect(await watch.poll()).toBe(true);
    expect(notices).toBe(1);
    // While small, its growth (the first prompt arriving) is announced too, so the row can gain its title.
    appendFileSync(fresh, '{"b":2}\n');
    expect(await watch.poll()).toBe(true);
    expect(await watch.poll()).toBe(false);
    expect(notices).toBe(2);
  });

  it('tolerates a missing folder', async () => {
    const watch = new SourceWatch([{ dir: join(dir, 'nope'), depth: 1, match: () => true }], () => undefined);
    expect(await watch.poll(true)).toBe(false);
  });
});

describe('latency helpers', () => {
  it('classifies steps and summarises per kind', () => {
    expect(stepKind({ rank: 1, kind: 'tool.call', tool: 'ExitPlanMode' })).toBe('plan-or-question');
    expect(stepKind({ rank: 2, kind: 'tool.call', tool: 'Task' })).toBe('subagent-start');
    expect(stepKind({ rank: 3, kind: 'tool.call', tool: 'Read' })).toBe('tool-start');
    expect(stepKind({ rank: 4, kind: 'turn.start' })).toBe('prompt');
    const steps = [10, 20, 30, 40].map((ms, i) => ({ rank: i + 1, kind: 'prose' as const, appendAt: 0, paintAt: ms }));
    const summary = summarizeSteps(steps);
    expect(summary.prose!['append→paint']!.p50).toBe(20);
    expect(summary.all!['append→paint']!.p95).toBe(40);
    expect(groupByPaint([{ rank: 1, kind: 'prose', appendAt: 0, paintAt: 100 }, { rank: 2, kind: 'prose', appendAt: 0, paintAt: 101 }, { rank: 3, kind: 'prose', appendAt: 0, paintAt: 300 }])).toEqual([[1, 2], [3]]);
  });
});
