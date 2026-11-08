import { expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { compose } from '../src/index.ts';
const operation = (id: string, startSequence: number, endSequence: number): Operation => ({ id, agentId: 'agent', kind: 'shell', tool: 'exec', title: id, titleProvenance: {kind:'captured', observationIds:[]}, origin:{type:'native',tool:'exec'}, status:'ok', startSequence, endSequence, paths:[], detail:{kind:'shell',command:'echo synthetic'},artifactIds:[],observationIds:[],classification:{kind:'derived',rule:'test',observationIds:[]} });
const p: Projection = {reducerVersion:'test',recordingId:'synthetic',observationCount:6,lastSequence:5,harnesses:[],agents:[],operations:[operation('a',1,3),operation('b',2,4)],prose:[{id:'reply',agentId:'agent',role:'assistant',text:'synthetic reply',truncated:false,exposure:'full',sequence:5,observationIds:[]}],artifacts:[],links:[],files:[],gaps:[],capabilities:{},timeline:[
 {type:'turn',id:'prompt',agentId:'agent',sequence:0,prompt:'synthetic prompt'},
 {type:'op-start',id:'sa',agentId:'agent',sequence:1,operationId:'a'},
 {type:'op-start',id:'sb',agentId:'agent',sequence:2,operationId:'b'},
 {type:'op-end',id:'ea',agentId:'agent',sequence:3,operationId:'a'},
 {type:'op-end',id:'eb',agentId:'agent',sequence:4,operationId:'b'},
 {type:'prose',id:'text',agentId:'agent',sequence:5,proseId:'reply'}],passages:[{id:'passage',agentId:'agent',firstStep:1,lastStep:5,operationIds:['a','b'],proseIds:['reply']} ]};
it('arrives and resolves both calls in one batch even with a later prose record', () => {
 const scene=compose(p,{step:6,since:1});const ops=scene.passages.flatMap(ps=>ps.ops);
 expect(ops.map(op=>op.phase)).toEqual(['arriving','arriving']);expect(ops.map(op=>op.resolving)).toEqual([true,true]);
 expect(scene.passages.flatMap(ps=>ps.prose).map(pr=>pr.arriving)).toEqual([true]);
 expect(compose(p,{step:6,since:1})).toEqual(scene);
});
it('uses an open lower bound in applied-entry coordinates and never exposes later outcomes', () => {
 const scene=compose(p,{step:4,since:3}),ops=scene.passages.flatMap(ps=>ps.ops);
 expect(ops.map(op=>op.phase)).not.toContain('arriving');expect(ops.map(op=>op.resolving)).toEqual([true,false]);expect(ops.map(op=>op.state)).toEqual(['ok','running']);
 expect(compose(p,{step:6,since:6}).passages.flatMap(ps=>ps.ops).some(op=>op.resolving||op.phase==='arriving')).toBe(false);
});
it('preserves every default single-step scene, including step zero', () => {
 for(let step=0;step<=6;step++)expect(compose(p,{step})).toEqual(compose(p,{step,since:step-1}));
 expect(compose(p,{step:6})).toEqual(compose(p,{step:6,since:Number.NaN}));
});
