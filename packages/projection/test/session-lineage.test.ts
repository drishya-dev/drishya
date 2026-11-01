import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { Observation, SessionLineageView } from '@drishya/contracts';
import { claudeAdapter } from '../../adapter-claude/src/index.ts';
import { seal } from '../../capture-core/src/index.ts';
import { reduce } from '../src/reduce.ts';
const descriptor = claudeAdapter.descriptor;
const adapters = { [descriptor.id]: descriptor };
const lineage = (): SessionLineageView => ({ kind: 'derived', rule: 'claude-native-parent-lineage-v1', currentRecordingId: 'child', recordingIds: ['parent', 'child'], links: [], duplicatePartsOmitted: 0, differingReceiptPartsRetained: 0 });
function observation(recordingId: string, kind: Observation['kind'], payload: Record<string, unknown>, part = 0, operationId?: string): Observation {
  return { ...seal({ raw: { kind, payload, part, recordId: `${recordingId}-${kind}`, operationId, agentId: 'agent:main' }, recordingId, adapter: descriptor, sourceId: `source-${recordingId}`, generation: 0, byteOffset: part, observedAt: '2026-01-01T00:00:00Z' }), receivedSequence: part };
}
function project(observations: Observation[], view?: SessionLineageView) {
  const blobs = new Map<string, string>();
  return reduce(view?.currentRecordingId ?? 'combined', observations, { get: sha => blobs.get(sha), put: text => { const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) }; } }, { adapters, lineage: view, ordered: true });
}
describe('lineage reducer', () => {
  it('retains physical operation and observation identities while correlating exact cross-file results', () => {
    const call = observation('parent', 'tool.call', { tool: 'Read', intent: { kind: 'read', path: '/synthetic/a' } }, 1, 'native-call');
    const reply = observation('child', 'tool.result', { tool: 'Read', text: 'body', outcome: { kind: 'read', content: 'body' } }, 0, 'native-call');
    const p = project([call, reply], lineage());
    expect(p.operations).toHaveLength(1);
    expect(p.operations[0]!.id).toBe('parent.native-call');
    expect(p.operations[0]!.observationIds).toEqual([call.id, reply.id]);
    expect(p.operations[0]!.status).toBe('ok');
    expect(p.agents).toHaveLength(1);
    expect(p.agents[0]!.id).toBe('child.agent:main');
    expect(project([call, reply]).operations).toHaveLength(2);
  });
  it('derives transitions from real timeline material, including prose-only continuation', () => {
    const p = project([observation('parent', 'message.user', { text: 'earlier' }), observation('child', 'message.assistant', { text: 'later' })], lineage());
    expect(p.lineage!.transitions).toEqual([{ recordingId: 'parent', step: 0 }, { recordingId: 'child', step: 1 }]);
    expect(p.timeline).toHaveLength(2);
    expect(p.timeline.every(item => item.type !== ('lineage' as string))).toBe(true);
  });
  it('does not synthesize a transition for a source with no retained material', () => {
    const p = project([observation('parent', 'message.user', { text: 'earlier' }), observation('child', 'usage', { source: 'claude-message-usage', cumulative: false, tokens: { input: 1, output: 1 } })], lineage());
    expect(p.lineage!.transitions).toEqual([{ recordingId: 'parent', step: 0 }]);
    expect(p.usage).toBeUndefined();
  });
});
