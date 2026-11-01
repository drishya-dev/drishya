import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
import type {Observation} from '@drishya/contracts';
import {asOfProjection} from '@drishya/contracts';
import {descriptor, createParser} from '../../adapter-claude/src/index.ts';
import {seal} from '@drishya/capture-core';
import {reduce} from '../src/reduce.ts';
import {queuePage} from '../../scene/src/queued-inputs.ts';
import {midTurnInput} from '../../../scripts/real-cases/mid-turn-input.ts';

function capture(rows: unknown[]) {
  const parser = createParser({recordingId: 'r', sourceId: 's', sourcePath: 'synthetic.jsonl'});
  let sequence = 0;
  const observations: Observation[] = rows.flatMap((row, index) => parser.parse(row).map(raw => ({...seal({raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: index,
    observedAt: '2026-11-01T00:00:00Z'}), receivedSequence: sequence++})));
  const blobs = new Map<string,string>();
  const projection = reduce('r', observations, {get: sha => blobs.get(sha), put: text => {const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return {sha, bytes: Buffer.byteLength(text)};}}, {adapters: {[descriptor.id]: descriptor}});
  return {projection, observations, blobs};
}
describe('provisional queue projection', () => {
  it('retains whole literal input once without creating a prompt or passage', () => {
    const text = 'queued\n\t@literal\r\n' + 'α'.repeat(40000);
    const {projection: p, observations, blobs} = capture([{type:'queue-operation', operation:'enqueue', content:text}]);
    expect(p.timeline.map(item => item.type)).toEqual(['queue']); expect(p.passages).toHaveLength(0);
    const item = p.timeline[0]!; expect(item).toMatchObject({type:'queue', sourceObservationId: observations[0]!.id, ownerRecordingId:'r'});
    if (item.type !== 'queue') throw Error('Missing queue item');
    const artifact = p.artifacts.find(artifact => artifact.id === item.inputArtifactId)!;
    expect(artifact.provenance).toEqual({kind:'captured', observationIds:[observations[0]!.id]});
    expect(blobs.get(artifact.blob!)).toBe(text);
    expect(asOfProjection(p, 0).artifacts).toHaveLength(0);
    expect(asOfProjection(p, 1).artifacts).toContainEqual(artifact);
  });
  it('does not infer delivery from a native delivery id, UUID or identical text', () => {
    const {projection:p} = capture([{type:'queue-operation', operation:'enqueue', content:'same'},
      {type:'attachment', uuid:'delivery-row', attachment:{type:'queued_command', prompt:'same', delivery_id:'delivery-row', source_uuid:'source-row'}}]);
    expect(p.timeline.filter(item => item.type === 'turn')).toHaveLength(1);
    expect(queuePage(p.timeline,'r').items[0]?.state).toBe('recorded');
  });
  it('links a delivered reference only when the native attachment records the exact queue id', () => {
    const {projection:p} = capture([{type:'queue-operation', operation:'enqueue', queueId:'native-item', content:'input'},
      {type:'attachment', attachment:{type:'queued_command', queueId:'native-item', prompt:'input'}}]);
    const first = p.timeline.find(item => item.type === 'queue')!;
    expect(queuePage(p.timeline,'r',{through:first.type === 'queue' ? first.sourceObservationId : ''}).items[0]?.state).toBe('recorded');
    expect(queuePage(p.timeline,'r').items[0]?.state).toBe('delivered');
    expect(p.timeline.filter(item => item.type === 'turn')).toHaveLength(1);
  });
  it('bounds replay by the exact timeline prefix rather than a higher physical ingest sequence', () => {
    const p = capture([{type:'queue-operation', operation:'enqueue', timestamp:'2026-11-01T00:00:02Z', content:'future'},
      {type:'queue-operation', operation:'enqueue', timestamp:'2026-11-01T00:00:01Z', content:'visible'}]).projection;
    const first = p.timeline[0]!; if(first.type !== 'queue') throw Error('Missing queue item');
    expect(first.sequence).toBe(1);
    expect(queuePage(p.timeline,'r',{through:first.sourceObservationId}).items.map(item => item.preview)).toEqual(['visible']);
  });
  it('scans queue receipts separately from delivered prompts and resets native candidate state per source', () => {
    expect(midTurnInput.scan({type:'queue-operation',operation:'enqueue'},'claude-code')).toEqual({hits:1});
    expect(midTurnInput.scan({type:'attachment',attachment:{type:'queued_command'}},'claude-code')).toBeUndefined();
    midTurnInput.scan({type:'session_meta'},'codex');
    midTurnInput.scan({type:'response_item',payload:{type:'custom_tool_call_output',output:'Process running with session ID 1'}},'codex');
    expect(midTurnInput.scan({type:'response_item',payload:{type:'message',role:'user'}},'codex')).toEqual({hits:1});
    midTurnInput.scan({type:'session_meta'},'codex');
    expect(midTurnInput.scan({type:'response_item',payload:{type:'message',role:'user'}},'codex')).toBeUndefined();
  });
});
