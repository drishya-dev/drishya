import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it, vi } from 'vitest';
import { asOfProjection } from '@drishya/contracts';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';

it('keeps successive late task outputs and exits at their own replay boundaries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-replay-'));
  const journal = join(dir, 'brain', 'parent', '.system_generated', 'logs', 'transcript.jsonl');
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-4.log');
  mkdirSync(join(journal, '..'), { recursive: true });
  mkdirSync(join(log, '..'), { recursive: true });
  const row = (step_index: number, type: string, content = '', extra: object = {}) => JSON.stringify({ step_index, type, content, source: 'MODEL', status: 'DONE', created_at: '2026-11-14T00:00:00Z', tool_calls: [], ...extra }) + '\n';
  const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, JSON.stringify(v)])) });
  writeFileSync(journal, row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] }) + row(1, 'GENERIC', 'Task ID: 4', { status: 'RUNNING' }) + row(2, 'PLANNER_RESPONSE', '', { tool_calls: [call('manage_task', { TaskId: 'task-4', Action: 'status' })] }) + row(3, 'GENERIC', 'Status: COMPLETED\nExit code: 0'));
  const store = new Store(join(dir, 'store')), ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  const clock = vi.spyOn(Date, 'now');
  try {
    const { recordingId } = await ingest.importSource('antigravity', journal);
    const first = ingest.projection(recordingId);
    const command = first.operations.find(o => o.tool === 'run_command')!;
    const firstEnd = first.timeline.findIndex(t => t.type === 'op-end' && t.operationId === command.id);
    expect(firstEnd).toBeGreaterThanOrEqual(0);
    appendFileSync(journal, row(4, 'PLANNER_RESPONSE', 'Later prose'));
    writeFileSync(log, 'A'.repeat(7000));
    clock.mockReturnValue(Date.now() + 6000);
    await ingest.sync(recordingId);
    writeFileSync(log, 'A'.repeat(7000) + ' second suffix');
    clock.mockReturnValue(Date.now() + 12000);
    await ingest.sync(recordingId);
    writeFileSync(log, 'A'.repeat(300 * 1024));
    clock.mockReturnValue(Date.now() + 18000);
    await ingest.sync(recordingId);
    const p = ingest.projection(recordingId), op = p.operations.find(o => o.id === command.id)!;
    const ends = p.timeline.flatMap((t, i) => t.type === 'op-end' && t.operationId === command.id ? [i] : []);
    expect(ends).toHaveLength(4);
    expect(new Set(p.timeline.map(t => t.id)).size).toBe(p.timeline.length);
    const early = asOfProjection(p, ends[0]! + 1), middle = asOfProjection(p, ends[1]! + 1);
    expect(JSON.stringify(early)).not.toContain('AAAAA');
    expect(JSON.stringify(early)).not.toContain('second suffix');
    expect(early.operations.find(o => o.id === op.id)?.detail).toMatchObject({ exitCode: 0 });
    const beforeCompletion = asOfProjection(p, ends[0]!);
    expect(beforeCompletion.operations.find(o => o.id === op.id)?.detail).not.toHaveProperty('exitCode', 0);
    const middleOp = middle.operations.find(o => o.id === op.id)!;
    expect(JSON.stringify(middleOp)).not.toContain('second suffix');
    const grown = asOfProjection(p, ends[2]! + 1).operations.find(o => o.id === op.id)!;
    expect(JSON.stringify(grown)).toContain('second suffix');
    const oldId = middleOp.detail.kind === 'shell' ? middleOp.detail.outputArtifactId : undefined;
    const newId = op.detail.kind === 'shell' ? op.detail.outputArtifactId : undefined;
    expect(oldId).toBeTruthy(); expect(newId).toBeTruthy(); expect(oldId).not.toBe(newId);
    expect(middle.artifacts.find(a => a.id === oldId)?.availability).toBe('complete');
    expect(middle.artifacts.some(a => a.id === newId)).toBe(false);
    expect(p.artifacts.find(a => a.id === newId)?.availability).toBe('partial');
  } finally { clock.mockRestore(); await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup'); rmSync(dir, { recursive: true, force: true }); }
});


it('keeps a test-classified background command unknown when later snapshots have no exit code', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ag-replay-test-'));
  const journal = join(dir, 'brain', 'parent', '.system_generated', 'logs', 'transcript.jsonl');
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-7.log');
  mkdirSync(join(journal, '..'), { recursive: true });
  mkdirSync(join(log, '..'), { recursive: true });
  const row = (step_index: number, type: string, content = '', extra: object = {}) => JSON.stringify({ step_index, type, content, source: 'MODEL', status: 'DONE', created_at: '2026-11-14T00:00:00Z', tool_calls: [], ...extra }) + '\n';
  const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, JSON.stringify(v)])) });
  writeFileSync(journal, row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'npm test' })] }) + row(1, 'GENERIC', 'Task ID: 7', { status: 'RUNNING' }) + row(2, 'PLANNER_RESPONSE', '', { tool_calls: [call('manage_task', { TaskId: 'task-7', Action: 'status' })] }) + row(3, 'GENERIC', 'Status: COMPLETED'));
  const store = new Store(join(dir, 'store')), ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  const clock = vi.spyOn(Date, 'now');
  try {
    const { recordingId } = await ingest.importSource('antigravity', journal);
    const initial = ingest.projection(recordingId).operations.find(o => o.tool === 'run_command')!;
    expect(initial.detail.kind).toBe('test');
    expect(initial.status).toBe('unknown');
    writeFileSync(log, 'synthetic test output');
    clock.mockReturnValue(Date.now() + 6000);
    await ingest.sync(recordingId);
    const updated = ingest.projection(recordingId).operations.find(o => o.id === initial.id)!;
    expect(updated.detail.kind).toBe('test');
    expect(updated.status).toBe('unknown');
    expect(updated.resultVersions?.at(-1)?.status).toBe('unknown');
  } finally {
    clock.mockRestore(); await ingest.close(); store.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
    rmSync(dir, { recursive: true, force: true });
  }
});
