import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';
import { projectionDigest, reduce } from '@drishya/projection';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';
import { delegationThread } from '../../../apps/daemon/src/delegation-thread.ts';
import { DatabaseSync } from 'node:sqlite';

let dir: string, journal: string, store: Store, ingest: Ingestor;
const row = (step_index: number, type: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index, type, content, source: 'MODEL', status: 'DONE', created_at: '2026-11-14T00:00:00Z', tool_calls: [], ...extra });
const line = (value: unknown) => JSON.stringify(value) + '\n';
const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, JSON.stringify(v)])) });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ag-live-test-'));
  journal = join(dir, 'brain', 'parent', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(journal, '..'), { recursive: true });
  store = new Store(join(dir, 'store')); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
});
afterEach(async () => {
  await ingest.close(); store.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
  rmSync(dir, { recursive: true, force: true });
});

it('captures growing logs without another journal line, seals before persistence and preserves the original RUNNING receipt', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: task-1', { status: 'RUNNING' })));
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-1.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'first line');
  const result = await ingest.importSource('antigravity', journal), cursor = store.getSources(result.recordingId)[0]!.cursor.offset;
  const canary = 'ghp_' + '1'.repeat(36); appendFileSync(log, '\nsecond line\n' + canary);
  expect((await ingest.sync(result.recordingId)).added).toBeGreaterThan(0);
  expect(store.getSources(result.recordingId)[0]!.cursor.offset).toBe(cursor);
  const observations = store.observationsOfKinds(result.recordingId, ['tool.result']);
  expect(observations.some(o => o.source.recordId === 'parent:1' && (o.payload as any).status === 'running')).toBe(true);
  expect(JSON.stringify(observations)).not.toContain(canary);
  const op = ingest.projection(result.recordingId).operations[0]!;
  expect(op.run?.backgroundTaskId).toBe('task-1');
  expect(op.detail.kind === 'shell' && op.detail.outputPreview).toContain('second line');
  expect(op.status).toBe('unknown');
  expect(store.search(result.recordingId, 'second')).toHaveLength(1);
  expect((await ingest.sync(result.recordingId)).added).toBe(0);
  expect(readFileSync(log, 'utf8')).toContain(canary); // The native file is never rewritten.
});

it('uses exact manage_task completion, clears its gap and restores correlation after restart', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: 2', { status: 'RUNNING' })));
  const result = await ingest.importSource('antigravity', journal);
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-2.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'initial captured output');
  await ingest.sync(result.recordingId);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  appendFileSync(journal, line(row(2, 'PLANNER_RESPONSE', '', { tool_calls: [call('manage_task', { TaskId: 'task-2', Action: 'status' })] })) + line(row(3, 'GENERIC', 'Status: COMPLETED\nExit code: 0\nfinal output')));
  await ingest.sync(result.recordingId);
  const p = ingest.projection(result.recordingId), shell = p.operations.find(o => o.tool === 'run_command')!;
  expect(shell.status).toBe('ok');
  expect(shell.detail.kind === 'shell' && shell.detail.outputPreview).toContain('final output');
  expect(p.links.some(l => l.relation === 'tool-result' && l.explanation?.includes('background task id'))).toBe(true);
  expect(store.observationsOfKinds(result.recordingId, ['capture.gap']).filter(o => o.operationId?.includes(':0:call:'))).toHaveLength(0);
});

it('does not duplicate an unchanged file snapshot after unrelated steps or a restart', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: 3', { status: 'RUNNING' })));
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-3.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'same captured bytes');
  const result = await ingest.importSource('antigravity', journal);
  const count = () => store.observationsOfKinds(result.recordingId, ['tool.result']).filter(o => (o.payload as any).resultUpdate).length;
  expect(count()).toBe(1);
  appendFileSync(journal, line(row(2, 'PLANNER_RESPONSE', 'An unrelated answer'))); await ingest.sync(result.recordingId);
  expect(count()).toBe(1);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  expect((await ingest.sync(result.recordingId)).added).toBe(0); expect(count()).toBe(1);
  appendFileSync(log, '\nnew captured bytes'); await ingest.sync(result.recordingId);
  expect(count()).toBe(2);
  expect(ingest.projection(result.recordingId).operations[0]!.detail.kind).toBe('shell');
});

it('keeps checking a terminal task when its log arrives late, including after restart', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: 4', { status: 'RUNNING' })) + line(row(2, 'PLANNER_RESPONSE', '', { tool_calls: [call('manage_task', { TaskId: 'task-4', Action: 'status' })] })) + line(row(3, 'GENERIC', 'Status: COMPLETED\nExit code: 0')));
  const result = await ingest.importSource('antigravity', journal);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-4.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'late final captured output');
  await ingest.sync(result.recordingId);
  const op = ingest.projection(result.recordingId).operations.find(o => o.tool === 'run_command')!;
  expect(op.detail.kind === 'shell' && op.detail.outputPreview).toContain('late final captured output'); expect(op.status).toBe('ok');
});

it('marks a bounded background-output artifact partial rather than complete', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: 5', { status: 'RUNNING' })));
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-5.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'x'.repeat(300 * 1024));
  const result = await ingest.importSource('antigravity', journal), p = ingest.projection(result.recordingId), op = p.operations[0]!;
  const artifactId = op.detail.kind === 'shell' ? op.detail.outputArtifactId : undefined;
  const artifact = p.artifacts.find(a => a.id === artifactId);
  expect(artifact?.availability).toBe('partial');
});

it('opens an imported child only through the recorded result-step metadata and exact parent identity', async () => {
  const metadata = join(dir, 'brain', 'parent', '.system_generated', 'subagents'); mkdirSync(metadata, { recursive: true });
  writeFileSync(join(metadata, 'child.json'), JSON.stringify({ conversationId: 'child', spawnStepIndex: 1, subagentDescriptor: { typeName: 'reviewer' } }));
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('invoke_subagent', { Prompt: 'Review synthetic file', TypeName: 'reviewer' })] })) + line(row(1, 'GENERIC', 'Spawn recorded')));
  const child = join(dir, 'brain', 'child', '.system_generated', 'logs', 'transcript.jsonl'); mkdirSync(join(child, '..'), { recursive: true }); writeFileSync(child, line(row(0, 'USER_INPUT', 'Synthetic child', { source: 'USER_EXPLICIT' })));
  const db = new DatabaseSync(join(dir, 'conversation_summaries.db')); db.exec('CREATE TABLE conversation_summaries(conversation_id TEXT,title TEXT,workspace_uris TEXT,parent_conversation_id TEXT,agent_name TEXT)'); db.prepare('INSERT INTO conversation_summaries VALUES (?,?,?,?,?)').run('child', 'Synthetic child', '[]', 'parent', 'reviewer'); db.close();
  const childImport = await ingest.importSource('antigravity', child), parentImport = await ingest.importSource('antigravity', journal), p = ingest.projection(parentImport.recordingId), spawn = p.operations[0]!;
  expect(spawn.detail.kind === 'spawn' && spawn.detail.childAgentId).toContain('child');
  expect(delegationThread(store, p, spawn.id)?.child?.recordingId).toBe(childImport.recordingId);
  expect(p.agents.some(a => a.id.endsWith('.agent:child'))).toBe(true);
  writeFileSync(join(metadata, 'child.json'), JSON.stringify({ conversationId: 'child', spawnStepIndex: 1, state: 'COMPLETED', subagentDescriptor: { typeName: 'reviewer' } }));
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);
  try {
    await ingest.sync(parentImport.recordingId);
    expect(store.observationsOfKinds(parentImport.recordingId, ['agent.spawn'])).toHaveLength(1);
    expect((store.observationsOfKinds(parentImport.recordingId, ['agent.spawn'])[0]!.payload as any).nativeState).toBe('COMPLETED');
  } finally { clock.mockRestore(); }
});

it('waits for a complete last line and consumes only the appended suffix on restart', async () => {
  writeFileSync(journal, line(row(0, 'USER_INPUT', 'First', { source: 'USER_EXPLICIT' })));
  const result = await ingest.importSource('antigravity', journal);
  const before = store.getSources(result.recordingId)[0]!.cursor.offset, pending = line(row(1, 'PLANNER_RESPONSE', 'Whole reply'));
  appendFileSync(journal, pending.slice(0, -3));
  expect((await ingest.sync(result.recordingId, { acceptUnterminated: false })).added).toBe(0);
  expect(store.getSources(result.recordingId)[0]!.cursor.offset).toBe(before);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  appendFileSync(journal, pending.slice(-3)); await ingest.sync(result.recordingId, { acceptUnterminated: false });
  expect(ingest.projection(result.recordingId).prose.map(p => p.text)).toContain('Whole reply');
  expect((await ingest.sync(result.recordingId)).added).toBe(0);
});

it('retains valid journal records when asynchronous side-file preparation or refresh fails', async () => {
  await ingest.close(); const adapter = createAntigravityAdapter([dir]), create = adapter.createParser.bind(adapter);
  adapter.createParser = ctx => ({ ...create(ctx), prepare: async () => { throw new Error('Synthetic supplemental read failure'); }, refresh: async () => { throw new Error('Synthetic supplemental refresh failure'); } });
  ingest = new Ingestor(store, [adapter]);
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', 'The valid recorded answer')));
  const result = await ingest.importSource('antigravity', journal);
  expect(ingest.projection(result.recordingId).prose.map(p => p.text)).toContain('The valid recorded answer');
  expect(store.observationsOfKinds(result.recordingId, ['capture.gap']).length).toBeGreaterThan(0);
  expect(ingest.health(result.recordingId).state).not.toBe('failed');
});

it('preserves multiple exact children without selecting just one as the spawn owner', async () => {
  const metadata = join(dir, 'brain', 'parent', '.system_generated', 'subagents'); mkdirSync(metadata, { recursive: true });
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('invoke_subagent', { Prompt: 'Two independent synthetic reviews' })] })) + line(row(1, 'GENERIC', 'Spawns recorded')));
  const db = new DatabaseSync(join(dir, 'conversation_summaries.db')); db.exec('CREATE TABLE conversation_summaries(conversation_id TEXT,title TEXT,workspace_uris TEXT,parent_conversation_id TEXT,agent_name TEXT)');
  const imported: string[] = [];
  for (const id of ['first', 'second']) {
    writeFileSync(join(metadata, `${id}.json`), JSON.stringify({ conversationId: id, spawnStepIndex: 1, subagentDescriptor: { typeName: id } }));
    db.prepare('INSERT INTO conversation_summaries VALUES (?,?,?,?,?)').run(id, 'Synthetic child', '[]', 'parent', id);
  }
  db.close();
  for (const id of ['first', 'second']) {
    const path = join(dir, 'brain', id, '.system_generated', 'logs', 'transcript.jsonl'); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, line(row(0, 'USER_INPUT', 'Synthetic child', { source: 'USER_EXPLICIT' })));
    imported.push((await ingest.importSource('antigravity', path)).recordingId);
  }
  const result = await ingest.importSource('antigravity', journal), p = ingest.projection(result.recordingId), spawn = p.operations[0]!;
  expect(spawn.detail.kind === 'spawn' && spawn.detail.childAgentId).toBeUndefined();
  expect(p.links.filter(l => l.relation === 'spawned')).toHaveLength(2);
  const thread = delegationThread(store, p, spawn.id)!;
  expect(thread.child).toBeUndefined(); expect(thread.identity).toBe('captured');
  expect(thread.children?.map(c => c.recordingId).sort()).toEqual(imported.sort());
});

it('a followed (live) recording serves the same projection as a full rebuild when a step is journalled again in place', async () => {
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call('run_command', { CommandLine: 'echo synthetic' })] })) + line(row(1, 'GENERIC', 'Task ID: task-1', { status: 'RUNNING' })));
  const log = join(dir, 'brain', 'parent', '.system_generated', 'tasks', 'task-1.log'); mkdirSync(join(log, '..'), { recursive: true }); writeFileSync(log, 'first line');
  const result = await ingest.importSource('antigravity', journal);
  store.updateRecordingMeta(result.recordingId, { live: true });
  ingest.projection(result.recordingId);
  const rebuild = () => projectionDigest(reduce(result.recordingId, [...store.orderedObservations(result.recordingId)], store.blobs, { adapters: ingest.descriptors, live: true, ordered: true }));
  const steps: (() => void)[] = [
    () => appendFileSync(journal, line(row(1, 'GENERIC', 'Task ID: task-1', { status: 'DONE' }))),
    () => appendFileSync(log, '\nsecond line\n'),
    () => appendFileSync(journal, line(row(2, 'PLANNER_RESPONSE', 'later prose'))),
  ];
  for (const step of steps) {
    step();
    await ingest.sync(result.recordingId);
    expect(projectionDigest(ingest.projection(result.recordingId))).toBe(rebuild());
  }
});
