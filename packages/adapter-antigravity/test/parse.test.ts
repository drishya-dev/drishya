import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createParser, descriptor } from '../src/index.ts';
import { seal, initialCursor, readJsonl } from '@drishya/capture-core';
import { reduce } from '../../projection/src/index.ts';

const blobs = new Map<string, string>();
const io = { get: (sha: string) => blobs.get(sha), put: (text: string) => { const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) }; } };
const options = { adapters: { antigravity: descriptor } };
const ctx = { recordingId: 'r', sourceId: 's', sourcePath: '/root/brain/conversation/.system_generated/logs/transcript_full.jsonl' };
const row = (step_index: number, type: string, extra: Record<string, unknown> = {}) => ({ step_index, type, source: 'MODEL', status: 'DONE', created_at: `2026-11-13T10:00:${String(step_index).padStart(2, '0')}Z`, content: '', thinking: '', tool_calls: [], ...extra });
const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([key, value]) => [key, JSON.stringify(value)])) });

describe('Antigravity transcript', () => {
  it('covers the generated real-shaped corpus without losing complete records before its cut line', async () => {
    const file = new URL('../../../fixtures/synthetic/antigravity/corpus.ndjson', import.meta.url);
    const lines = readFileSync(file, 'utf8').split('\n');
    const parser = createParser(ctx);
    const complete = lines.slice(0, -1).map(line => JSON.parse(line));
    const batch = await readJsonl(fileURLToPath(file), initialCursor(), { acceptUnterminated: false });
    expect(batch.records.filter(record => record.type === 'record')).toHaveLength(complete.length);
    expect(batch.cursor.offset).toBeLessThan(batch.size);
    expect(complete.length).toBeGreaterThan(50);
    const observations = complete.flatMap(record => parser.parse(record)).map((raw, receivedSequence) => seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: receivedSequence, observedAt: '2026-11-13T11:00:00Z' }));
    expect(observations.some(o => o.kind === 'unknown')).toBe(false);
    expect(JSON.stringify(observations)).not.toContain('ghp_1234567890abcdefghijklmnopqrstuv123456');
    expect(observations.some(o => o.kind === 'capture.gap')).toBe(true);
  });
  it('does not promote a successful requested write into an applied snapshot', () => {
    const parser = createParser(ctx);
    const rows = [row(0, 'PLANNER_RESPONSE', { tool_calls: [call('write_file', { TargetFile: 'file.ts', Content: 'export const x = 1;' })] }), row(1, 'GENERIC', { content: 'Created file' })];
    const observations = rows.flatMap(record => parser.parse(record)).map((raw, receivedSequence) => ({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: receivedSequence, observedAt: '2026-11-13T11:00:00Z' }), receivedSequence }));
    const projection = reduce('r', observations, io, options);
    expect(projection.artifacts.some(artifact => artifact.kind === 'snapshot')).toBe(false);
    expect(projection.operations[0]!.detail).toMatchObject({ reconstruction: 'unavailable' });
  });
  it('pairs positional results only inside their planner group and exposes missing calls', () => {
    const parser = createParser(ctx);
    const calls = parser.parse(row(0, 'PLANNER_RESPONSE', { tool_calls: [call('read_file', { Path: 'a.ts' }), call('edit_file', { TargetFile: 'a.ts', Target: 'a', Replacement: 'b' })] }));
    const result = parser.parse(row(1, 'GENERIC', { content: '1: source' })).find(o => o.kind === 'tool.result')!;
    expect(result.operationId).toBe(calls.find(o => o.kind === 'tool.call')!.operationId);
    expect(result.correlation?.basis).toBe('call-order');
    expect(parser.parse(row(2, 'PLANNER_RESPONSE')).filter(o => o.kind === 'capture.gap')).toHaveLength(1);
    const orphan = parser.parse(row(3, 'GENERIC', { content: 'orphan result' })).find(o => o.kind === 'tool.result')!;
    expect(orphan.operationId).toBeUndefined();
    expect(orphan.payload.callAvailability).toBe('not-recorded');
  });
  it('does not consume another call when the same result receipt is repeated or replaced', () => {
    const parser = createParser(ctx);
    parser.parse(row(0, 'PLANNER_RESPONSE', { tool_calls: [call('read_file', { Path: 'a' }), call('read_file', { Path: 'b' })] }));
    const first = parser.parse(row(1, 'GENERIC', { content: 'old' })).find(o => o.kind === 'tool.result')!;
    expect(parser.parse(row(1, 'GENERIC', { content: 'old' }))).toEqual([]);
    expect(parser.parse(row(1, 'GENERIC', { content: 'updated' })).find(o => o.kind === 'tool.result')!.operationId).toBe(first.operationId);
    expect(parser.parse(row(2, 'GENERIC', { content: 'second' })).find(o => o.kind === 'tool.result')!.operationId).not.toBe(first.operationId);
  });
  it('keeps explicit errors, absent exit codes and RUNNING snapshots honest', () => {
    const parser = createParser(ctx);
    parser.parse(row(0, 'PLANNER_RESPONSE', { tool_calls: [call('run_command', { CommandLine: 'node test.mjs' })] }));
    const running = parser.parse(row(1, 'GENERIC', { status: 'RUNNING', content: 'Task: 42' })).find(o => o.kind === 'tool.result')!;
    expect(running.payload).toMatchObject({ status: 'running', resultAvailability: 'not-recorded' });
    expect(running.payload.exitCode).toBeUndefined();
    parser.parse(row(2, 'PLANNER_RESPONSE', { tool_calls: [call('edit_file', { TargetFile: 'a', Target: 'old', Replacement: 'new' })] }));
    expect(parser.parse(row(3, 'GENERIC', { status: 'ERROR', error: 'target not found' })).find(o => o.kind === 'tool.result')!.payload.isError).toBe(true);
  });
  it('marks truncated fields, keeps unknown records visible and ignores named bookkeeping content', () => {
    const parser = createParser(ctx);
    expect(parser.parse(row(0, 'PLANNER_RESPONSE', { content: 'partial', truncated_fields: ['content'] })).find(o => o.kind === 'message.assistant')!.availability).toBe('partial');
    expect(parser.parse(row(1, 'FUTURE_STEP'))[1]!.kind).toBe('unknown');
    expect(JSON.stringify(parser.parse(row(2, 'SYSTEM_MESSAGE', { content: 'ignored bookkeeping' })))).not.toContain('ignored bookkeeping');
  });
  it('seals decoded argument secrets and protected read output before projection', () => {
    const parser = createParser(ctx);
    const raw = [row(0, 'PLANNER_RESPONSE', { tool_calls: [call('read_file', { Path: '.env' })] }), row(1, 'GENERIC', { content: '1: SECRET=must-not-persist' })].flatMap(r => parser.parse(r));
    const sealed = raw.map((raw, receivedSequence) => ({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: receivedSequence, observedAt: '2026-11-13T11:00:00Z' }), receivedSequence }));
    expect(JSON.stringify(sealed)).not.toContain('must-not-persist');
    expect(JSON.stringify(reduce('r', sealed, io, options))).not.toContain('must-not-persist');
  });
  it('keeps an orphan result metadata-only when its path and protection cannot be established', () => {
    const raw = createParser(ctx).parse(row(0, 'GENERIC', { content: 'unidentifiable private file content', error: 'unidentifiable private error' })).find(o => o.kind === 'tool.result')!;
    const sealed = seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: 0, observedAt: '2026-11-13T11:00:00Z' });
    expect(sealed.availability).toBe('metadata-only');
    expect(JSON.stringify(sealed)).not.toContain('unidentifiable private');
  });
  it('orders a backwards source clock by recorded step, without altering the timestamp', () => {
    const parser = createParser(ctx);
    const rows = [row(0, 'USER_INPUT', { source: 'USER_EXPLICIT', content: 'request', created_at: '2026-11-13T10:00:12Z' }), row(1, 'PLANNER_RESPONSE', { content: 'reply', created_at: '2026-11-13T10:00:00Z' })];
    const observations = rows.flatMap(r => parser.parse(r)).map((raw, receivedSequence) => ({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: receivedSequence, observedAt: '2026-11-13T11:00:00Z' }), receivedSequence }));
    const projection = reduce('r', observations, io, options);
    expect(projection.timeline.findIndex(item => item.type === 'turn')).toBeLessThan(projection.timeline.findIndex(item => item.type === 'prose'));
    expect(observations.find(o => o.kind === 'message.assistant')!.sourceTime).toBe('2026-11-13T10:00:00Z');
  });
  it('retains the protected result owner after restart without consuming the next call', () => {
    const parser = createParser(ctx);
    const rows = [row(0, 'PLANNER_RESPONSE', { tool_calls: [call('read_file', { Path: '.env' }), call('read_file', { Path: 'safe.ts' })] }), row(1, 'GENERIC', { status: 'RUNNING', content: 'pending' })];
    const observations = rows.flatMap(r => parser.parse(r)).map((raw, receivedSequence) => ({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: receivedSequence, observedAt: '2026-11-13T11:00:00Z' }), receivedSequence }));
    const first = observations.find(o => o.kind === 'tool.result')!;
    const restarted = createParser(ctx); restarted.prime(observations);
    const updated = restarted.parse(row(1, 'GENERIC', { content: 'must-not-persist' })).find(o => o.kind === 'tool.result')!;
    expect(updated.operationId).toBe(first.operationId);
    const safe = seal({ raw: updated, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: 100, observedAt: '2026-11-13T11:00:00Z' });
    expect(JSON.stringify(safe)).not.toContain('must-not-persist');
    expect(restarted.parse(row(2, 'GENERIC', { content: 'safe' })).find(o => o.kind === 'tool.result')!.operationId).not.toBe(first.operationId);
  });
});


