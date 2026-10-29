import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { reduce } from '../src/reduce.ts';

// CONTENT-1: a prompt's images arrive as parts of its record. A record with images and no text is still a prompt turn.
const obs = (sequence: number, kind: string, payload: unknown, recordId: string, agentId = 'agent:main'): Observation => ({
 id: `o${sequence}`, recordingId: 'r', agentId, receivedSequence: sequence,
 source: { adapterId: 'claude-code', adapterVersion: 'test', sourceId: 'source', generation: 0, byteOffset: sequence, part: sequence, recordId },
 observedAt: '2026-10-28T00:00:00Z', sourceTime: `2026-10-28T00:00:${String(sequence).padStart(2, '0')}Z`, kind, payload: payload as Observation['payload'], privacyPolicyVersion: 'test', redactions: [], availability: 'complete',
});
function memory() { const blobs = new Map<string, string>(); return { get: (sha: string) => blobs.get(sha), put: (text: string) => { const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: text.length }; } } as never; }
const image = { omitted: 'remote', mime: 'image/png' };
const turns = (rows: Observation[]) => reduce('r', rows, memory(), { adapters: {} }).timeline.filter((item) => item.type === 'turn') as Extract<ReturnType<typeof reduce>['timeline'][number], { type: 'turn' }>[];
const reply = (n: number, recordId: string) => obs(n, 'message.assistant', { text: 'Done' }, recordId);

describe('prompt images', () => {
 it('keeps an image-first and a text-first record as one turn each', () => {
  const imageFirst = turns([obs(0, 'message.user', { images: [image] }, 'a'), obs(1, 'message.user', { text: 'Look at this' }, 'a'), reply(2, 'x')]);
  expect(imageFirst).toHaveLength(1);
  expect(imageFirst[0]).toMatchObject({ prompt: 'Look at this', id: 'turn_o1' });
  expect(imageFirst[0]!.images).toHaveLength(1);
  const textFirst = turns([obs(0, 'message.user', { text: 'Look at this' }, 'a'), obs(1, 'message.user', { images: [image] }, 'a'), reply(2, 'x')]);
  expect(textFirst).toHaveLength(1);
  expect(textFirst[0]!.images).toHaveLength(1);
 });
 it('shows a record with images and no text as its own turn, without invented words or a title', () => {
  const p = reduce('r', [obs(0, 'message.user', { images: [image, image] }, 'a'), reply(1, 'x')], memory(), { adapters: {} });
  const found = p.timeline.filter((item) => item.type === 'turn');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ prompt: '', id: 'turn_o0', sequence: 0 });
  expect((found[0] as { images: unknown[] }).images).toHaveLength(2);
  expect(p.title).toBeUndefined();
  expect(p.timeline.map((item) => item.type)).toEqual(['turn', 'prose']);
 });
 it('keeps the image-only prompt between its neighbours and counts text prompts separately', () => {
  const rows = [obs(0, 'message.user', { text: 'First' }, 'a'), reply(1, 'x'), obs(2, 'message.user', { images: [image] }, 'b'), reply(3, 'y'), obs(4, 'message.user', { text: 'Third' }, 'c')];
  expect(turns(rows).map((turn) => [turn.prompt, turn.images?.length ?? 0])).toEqual([['First', 0], ['', 1], ['Third', 0]]);
 });
 it('presents a trailing image-only prompt before its record is followed by anything', () => {
  const found = turns([obs(0, 'message.user', { text: 'First' }, 'a'), obs(1, 'message.user', { images: [image] }, 'b')]);
  expect(found.map((turn) => turn.prompt)).toEqual(['First', '']);
 });
 it('never turns a sub-agent image into a turn', () => {
  expect(turns([obs(0, 'message.user', { images: [image] }, 'a', 'agent:sub'), reply(1, 'x')])).toHaveLength(0);
 });
});
