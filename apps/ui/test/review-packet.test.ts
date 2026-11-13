import {it,expect} from 'vitest';
import {reviewPacket} from '../src/lib/review-packet.ts';
import {reviewInsights} from '../../../packages/scene/src/review-insights.ts';
import type {Projection} from '@drishya/contracts';
const p:Projection={reducerVersion:'test',recordingId:'synthetic',title:'Captured session',observationCount:0,lastSequence:42,harnesses:[],agents:[],operations:[],prose:[],artifacts:[],links:[],timeline:[{type:'gap',id:'gap',sequence:4,agentId:'agent',reason:'missing-content'}],passages:[],files:[],gaps:[{sequence:0,reason:'missing-content',detail:'Result was unavailable'}],capabilities:{}};
it('preserves gap references and separates reviewer notes and current work from captured evidence',()=>{
  const packet=reviewPacket(reviewInsights(p),[{id:'question',operationId:'captured-op',sequence:2,title:'Check source',question:'How does zero work?',owner:'Reviewer',status:'open',createdAt:'',updatedAt:''}]);
  expect(packet).toContain('Through observation: 42');expect(packet).toContain('capture gap · observation 4');expect(packet).toContain('Current Git, current disk contents and local drafts are excluded');expect(packet).toContain('How does zero work?');expect(packet).toContain('captured-op');
});
it('exports only deliberately selected references when samples/notes are excluded and removes workspace roots',()=>{
  const packet=reviewPacket(reviewInsights({...p,title:'/private/project session'}),[],{samples:false,questions:false,workspaceRoot:'/private/project',selected:[{operationId:'exact',sequence:11,title:'Chosen action',status:'Tool returned',note:'User note',available:true},{operationId:'missing',sequence:12,title:'Saved reference',status:'Unavailable',note:'',available:false}]});
  expect(packet).toContain('"recordingId":"synthetic","operationId":"exact","sequence":11');expect(packet).toContain('saved reference only');expect(packet).toContain('User note');expect(packet).not.toContain('/private/project');expect(packet).not.toContain('## Prompt windows');expect(packet).not.toContain('## Open reviewer questions');expect(packet).not.toContain('Result was unavailable');
});
it('redacts notes again at the export boundary and excludes resolved questions',()=>{
  const questions=[{id:'one',operationId:'op',sequence:1,title:'Note',question:'sk-proj-abcdefghijklmnopqrstuvw0123456789',owner:'',status:'open' as const,createdAt:'',updatedAt:''},{id:'two',operationId:'op',sequence:1,title:'Resolved',question:'DO_NOT_EXPORT_RESOLVED',owner:'',status:'resolved' as const,createdAt:'',updatedAt:''}];
  const packet=reviewPacket(reviewInsights(p),questions);expect(packet).not.toContain('abcdefghijklmnop');expect(packet).not.toContain('DO_NOT_EXPORT_RESOLVED');expect(packet).toContain('Open reviewer questions (1)');
});
it('uses singular nouns when packet facts have count 1',()=>{
  const single={...p,operations:[{id:'edit-1',agentId:'agent',kind:'edit' as const,tool:'edit',title:'Edit a.ts',titleProvenance:{kind:'captured' as const,observationIds:[]},origin:{type:'native' as const,tool:'edit'},status:'ok' as const,startSequence:1,paths:[{path:'a.ts',role:'write' as const}],detail:{kind:'edit' as const,path:'a.ts',hunks:[],created:false,reconstruction:'full' as const},artifactIds:[],observationIds:[],classification:{kind:'derived' as const,rule:'test',observationIds:[]}},{id:'test-1',agentId:'agent',kind:'test' as const,tool:'test',title:'Run tests',titleProvenance:{kind:'captured' as const,observationIds:[]},origin:{type:'native' as const,tool:'test'},status:'ok' as const,startSequence:2,paths:[],detail:{kind:'test' as const,command:'pnpm test'},artifactIds:[],observationIds:[],classification:{kind:'derived' as const,rule:'test',observationIds:[]}}],timeline:[{type:'op-start' as const,id:'s1',operationId:'edit-1',sequence:1,agentId:'agent'},{type:'op-start' as const,id:'s2',operationId:'test-1',sequence:2,agentId:'agent'}]};
  const packet=reviewPacket(reviewInsights(single),[]);
  expect(packet).toContain('1 file changed · 0 failed · 1 test run');
  expect(packet).toContain('1 capture gap');
  expect(packet).not.toContain('1 files changed');
  expect(packet).not.toContain('1 test runs');
  expect(packet).not.toContain('1 gaps captured');
});
