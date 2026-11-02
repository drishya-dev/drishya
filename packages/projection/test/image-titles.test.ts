import {createHash} from 'node:crypto';
import {expect, it} from 'vitest';
import type {Observation} from '@drishya/contracts';
import {descriptor} from '../../adapter-codex/src/index.ts';
import {reduce} from '../src/reduce.ts';

it('names image cards by the file while retaining the exact captured reference', () => {
  const paths = ['file:///C:/work/screens/Read%20me.png', 'C:\\work\\images\\研究.png', '/home/me/result.jpg', 'file:///C:/work/a%23b.png'];
  for (const [index, path] of paths.entries()) {
    const observation: Observation = {id: `o${index}`, recordingId: 'r', source: {adapterId: 'codex', adapterVersion: '0.1.0', sourceId: 's', generation: 0, byteOffset: index, part: 0},
      receivedSequence: index, observedAt: '2026-11-02T00:00:00Z', agentId: 'agent:main', kind: 'item.completed',
      payload: {item: index % 2 ? 'image-generation' : 'image-view', itemId: `image${index}`, image: index % 2 ? {savedPath: path} : {path}}, privacyPolicyVersion: 'p3', redactions: [], availability: 'metadata-only'};
    const blobs = new Map<string,string>();
    const projection = reduce('r', [observation], {get: sha => blobs.get(sha), put: text => {const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return {sha, bytes: Buffer.byteLength(text)};}}, {adapters: {codex: descriptor}});
    const op = projection.operations[0]!;
    expect(op.title).toBe(`${index % 2 ? 'Generated image' : 'View image'} · ${['Read me.png','研究.png','result.jpg','a#b.png'][index]}`);
    expect(JSON.stringify(op.detail)).toContain(JSON.stringify(path).slice(1,-1));
    expect(op.status).toBe('unknown');
    expect(op.images).toBeUndefined();
  }
});
