import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { asOfProjection, type Observation } from '@drishya/contracts';
import { reduce } from '../src/reduce.ts';

const source = { adapterId: 'antigravity', adapterVersion: 'test', sourceId: 'source', generation: 0, byteOffset: 0, part: 0 };
function obs(n: number, kind: string, payload: object, operationId?: string): Observation {
  return { id: `o${n}`, recordingId: 'r', agentId: 'main', receivedSequence: n, source: { ...source, byteOffset: n }, observedAt: '2026-11-14T00:00:00Z', kind, payload, operationId, privacyPolicyVersion: 'test', redactions: [], availability: 'complete' };
}
function memory() { const blobs = new Map<string, string>(); return { get: (sha: string) => blobs.get(sha), put: (value: string) => { const sha = createHash('sha256').update(value).digest('hex'); blobs.set(sha, value); return { sha, bytes: Buffer.byteLength(value) }; } }; }
const path = '/native/brain/one/task.md';
const items = [{ text: 'Captured task', status: 'pending' }];
const call = () => obs(0, 'tool.call', { tool: 'write_to_file', intent: { kind: 'plan', items }, nativeArtifact: { path, name: 'task.md', text: '- [ ] Captured task', items, truncated: false } }, 'call');
const version = (n: number, filePath: string, text: string, extra = {}) => obs(n, 'artifact.plan', { forOperationId: 'call', path, name: 'task.md', filePath, current: false, text, bytes: text.length, truncated: false, observedAfterNativeStep: n, items, association: 'captured-path-reference', ...extra });

it('keeps invocation, native result and later file evidence at their own replay boundaries', () => {
  const rows = [call(), obs(1, 'tool.result', { text: 'ok', outcome: { kind: 'other' } }, 'call'), obs(2, 'message.assistant', { text: 'Later prose' }),
    version(3, `${path}.resolved.2`, 'Version two', { version: '2' }), version(4, `${path}.resolved.10`, 'Version ten', { version: '10' }),
    version(5, path, 'Current excerpt', { current: true, updatedAt: '2026-11-14T00:00:00Z', truncated: true }),
    version(6, `${path}.resolved`, '', { unavailable: 'removed', text: undefined })];
  const p = reduce('r', rows, memory(), { adapters: {} });
  expect(p.operations).toHaveLength(1); expect(p.files).toEqual([]);
  const op = p.operations[0]!;
  expect(op.tool).toBe('write_to_file'); expect(op.status).toBe('ok');
  expect(op.detail).toMatchObject({ kind: 'plan', artifactVersions: [{ version: '2' }, { version: '10' }, { current: true, truncated: true }, { unavailable: 'removed' }] });
  const start = p.timeline.findIndex(t => t.type === 'op-start');
  const firstEnd = p.timeline.findIndex(t => t.type === 'op-end');
  const early = asOfProjection(p, start + 1).operations[0]!;
  expect(early.status).toBe('running'); expect(early.detail).toMatchObject({ document: { text: '- [ ] Captured task' } });
  expect(JSON.stringify(early)).not.toContain('Version two');
  const result = asOfProjection(p, firstEnd + 1).operations[0]!;
  expect(result.status).toBe('ok'); expect(JSON.stringify(result)).not.toContain('Version two');
  const end2 = p.timeline.findIndex(t => t.id === 'e_r.call_o3');
  const later = asOfProjection(p, end2 + 1).operations[0]!;
  expect(JSON.stringify(later)).toContain('Version two'); expect(JSON.stringify(later)).not.toContain('Version ten');
  expect(later.endTime).toBe(result.endTime); expect(new Set(p.timeline.map(t => t.id)).size).toBe(p.timeline.length);
});

it('retains unmatched snapshot bytes with an explicit gap, without inventing a call', () => {
  const p = reduce('r', [call(), version(1, path, 'Unmatched', { path: '/different/task.md' })], memory(), { adapters: {} });
  expect(p.operations).toHaveLength(1);
  expect(p.operations[0]!.detail).not.toHaveProperty('artifactVersions');
  expect(p.gaps).toMatchObject([{ reason: 'unresolved-artifact-reference' }]);
  expect(p.artifacts.some(a => a.provenance.kind === 'captured' && a.provenance.observationIds.includes('o1'))).toBe(true);
});

it('holds a snapshot seen while a call runs until a later material boundary', () => {
  const p = reduce('r', [call(), version(1, path, 'While running'), obs(2, 'message.assistant', { text: 'Next' }), obs(3, 'tool.result', { text: 'ok', outcome: { kind: 'other' } }, 'call')], memory(), { adapters: {} });
  expect(p.timeline.filter(t => t.type === 'op-end')).toHaveLength(1);
  const first = asOfProjection(p, 1).operations[0]!;
  expect(JSON.stringify(first)).not.toContain('While running');
  const next = asOfProjection(p, 2).operations[0]!;
  expect(next.status).toBe('running'); expect(JSON.stringify(next)).toContain('While running');
});
