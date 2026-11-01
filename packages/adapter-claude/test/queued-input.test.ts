import {describe,it,expect} from 'vitest';
import {createParser} from '../src/index.ts';
import {recordedQueueOperation} from '../src/queued-input.ts';
describe('recorded native queue operations',()=>{
 it('retains a queued input exactly without promoting it to a delivered prompt',()=>{
  const content='first\n  second\r\n@literal';
  expect(recordedQueueOperation({type:'queue-operation',operation:'enqueue',timestamp:'2026-10-31T00:00:00Z',sessionId:'synthetic',content})).toEqual({operation:'enqueue',content});
 });
 it('does not invent an item identity from the row UUID or timestamp',()=>{
  expect(recordedQueueOperation({type:'queue-operation',operation:'dequeue',uuid:'row-identity',timestamp:'2026-10-31T00:00:00Z'})).toEqual({operation:'dequeue'});
  expect(recordedQueueOperation({type:'queue-operation',operation:'remove'})).toEqual({operation:'remove'});
 });
 it('uses an explicitly named native queue identity, and retains removals with content',()=>{
  expect(recordedQueueOperation({type:'queue-operation',operation:'remove',queue_id:'native-item',content:'recorded input'})).toEqual({operation:'remove',nativeQueueId:'native-item',content:'recorded input'});
 });
 it('retains block and unknown payload shapes for the eventual redaction boundary rather than coercing them',()=>{
  const content=[{type:'text',text:'look'},{type:'image',source:{type:'base64',data:'synthetic image bytes'}}];
  expect(recordedQueueOperation({type:'queue-operation',operation:'enqueue',content})?.content).toBe(content);
  expect(recordedQueueOperation({type:'queue-operation',operation:'enqueue',content:null})).toEqual({operation:'enqueue',content:null});
 });
 it('ignores malformed and unrelated rows instead of guessing a queue action',()=>{
  for(const value of [null,[],{},'text',{type:'queue-operation',operation:'delivered'},{type:'user',operation:'enqueue'},{type:'queue-operation',operation:{toString:()=> 'enqueue'}}])expect(recordedQueueOperation(value)).toBeUndefined();
 });
});

// Delivered messages and enqueue receipts intentionally have different observation kinds.
it('parses queue text literally and never counts enqueue/dequeue as a delivered user prompt',()=>{
 const parser=createParser({recordingId:'r',sourceId:'s',sourcePath:'synthetic.jsonl'});
 const text='line one\n  line two';
 const receipt=parser.parse({type:'queue-operation',operation:'enqueue',content:text});
 expect(receipt).toMatchObject([{kind:'queue.operation',payload:{operation:'enqueue',text},contentKeys:['text','images']}]);
 expect(parser.parse({type:'queue-operation',operation:'remove'})).toMatchObject([{kind:'queue.operation',payload:{operation:'remove'}}]);
 expect(parser.parse({type:'attachment',attachment:{type:'queued_command',prompt:text}})).toMatchObject([{kind:'message.user',payload:{text}}]);
});
it('sends queue image bytes through the existing image-candidate privacy boundary',()=>{
 const parser=createParser({recordingId:'r',sourceId:'s',sourcePath:'synthetic.jsonl'});
 const rows=parser.parse({type:'queue-operation',operation:'enqueue',content:[{type:'text',text:'look'},{type:'image',source:{type:'base64',data:'synthetic bytes'}}]});
 expect(rows).toHaveLength(1);expect(rows[0]?.payload).toMatchObject({text:'look',images:[{kind:'captured-image'}]});
});

