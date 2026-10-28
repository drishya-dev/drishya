import {describe, expect, it} from 'vitest';
import type {Operation, Projection, Hunk} from '@drishya/contracts';
import {sessionDiff} from '../src/session-diff.ts';

const patch = (id: string, lines: string[], at = 1): Operation => ({id, agentId:'a',tool:'Edit',origin:{type:'native',tool:'Edit'},titleProvenance:{kind:'captured',observationIds:[]},classification:{kind:'captured',observationIds:[]},kind:'edit',status:'ok',title:id,paths:[],artifactIds:[],observationIds:[],startSequence:0,detail:{kind:'edit',path:'a.ts',created:false,reconstruction:'complete',hunks:[{oldStart:at,oldLines:lines.filter(l=>l[0]===' '||l[0]==='-').length,newStart:lines.some(l=>l[0]!=='-')?at:at-1,newLines:lines.filter(l=>l[0]===' '||l[0]==='+').length,lines}]}});
const build = (operations: Operation[]): Projection => ({reducerVersion:'fixture',recordingId:'fixture',observationCount:100,harnesses:['claude-code'],agents:[],prose:[],artifacts:[],links:[],passages:[],files:[],capabilities:{},operations,timeline:[{type:'turn',id:'turn',agentId:'a',sequence:1},...operations.flatMap((op,i)=>[{type:'op-start' as const,id:`s${i}`,agentId:op.agentId,operationId:op.id,sequence:i*3+2},{type:'op-end' as const,id:`e${i}`,agentId:op.agentId,operationId:op.id,sequence:i*3+3}])],gaps:[],lastSequence:100});
const net = (ops: Operation[])=>sessionDiff(build(ops),'a.ts');
describe('READ-5 continuous patch composition',()=>{
 it('attributes final additions to their latest writer and original removals to their removing edit',()=>{
  const n=net([patch('one',['-alpha','+beta']),patch('two',['-beta','+gamma'])]);
  expect(n.status).toBe('complete');expect(n.lines.map(l=>[l.kind,l.text,l.attribution.operationId,l.attribution.turn])).toEqual([['remove','alpha','one',1],['add','gamma','two',1]]);
 });
 it('cancels a complete textual reversion',()=>expect(net([patch('one',['-alpha','+beta']),patch('two',['-beta','+alpha'])]).lines).toEqual([]));
 it('attributes a removal after a reversion to the actual latest remover',()=>expect(net([patch('one',['-alpha','+beta']),patch('two',['-beta','+alpha']),patch('three',['-alpha','+gamma'])]).lines.map(l=>l.attribution.operationId)).toEqual(['three','three']));
 it('keeps the newest writer when a transient line is deleted and reintroduced',()=>{
  const create=patch('one',['+fresh']);create.detail={...(create.detail as Extract<Operation['detail'],{kind:'edit'}>),hunks:[{oldStart:0,oldLines:0,newStart:1,newLines:1,lines:['+fresh']}],created:true};
  const add=patch('three',['+fresh']);(add.detail as {hunks:Hunk[]}).hunks[0]!.oldStart=0;
  expect(net([create,patch('two',['-fresh']),add]).lines).toMatchObject([{kind:'add',text:'fresh',attribution:{operationId:'three'}}]);
 });
 it('preserves sparse unchanged positions and offset changes',()=>{
  const one=patch('one',['-a','+b','+c'],20),two=patch('two',['-x','+y'],35);
  expect(net([one,two]).lines.map(l=>[l.text,l.oldLine,l.newLine])).toEqual([['a',20,undefined],['b',undefined,20],['c',undefined,21],['x',34,undefined],['y',undefined,35]]);
 });
 it('verifies matching context and rejects discontinuities rather than guessing',()=>{
  expect(net([patch('one',[' a','-b','+c']),patch('two',[' a','-wrong','+d'])])).toMatchObject({status:'unavailable',lines:[]});
 });
 it('rejects unpositioned, incomplete and over-budget hunks explicitly',()=>{
  expect(net([patch('unknown',['-a','+b'],0)]).note).toMatch(/no exact/);
  const bad=patch('bad',['-a','+b']);(bad.detail as {hunks:Hunk[]}).hunks[0]!.oldLines=5;expect(net([bad]).note).toMatch(/incomplete/);
  expect(net([patch('huge',['-a','+b'],200_000)]).note).toMatch(/bounded/);
 });
 it('uses captured positions, never array order or timeline offsets',()=>{
  const p=build([patch('one',['-a','+b']),patch('two',['-b','+c'])]);p.operations.reverse();expect(sessionDiff(p,'a.ts').lines.at(-1)!.text).toBe('c');
  p.timeline=p.timeline.filter(t=>!('operationId'in t&&t.operationId==='one'));expect(sessionDiff(p,'a.ts').status).toBe('unavailable');
 });
 it('blocks across capture gaps',()=>{
  const p=build([patch('one',['-a','+b']),patch('two',['-b','+c'])]);p.timeline.push({type:'gap',id:'g',agentId:'a',sequence:4,reason:'malformed-record'});expect(sessionDiff(p,'a.ts').note).toMatch(/gap/);
 });
 it('supports a reading boundary without claiming the full session baseline',()=>{
  const p=build([patch('one',['-a','+b']),patch('two',['-b','+c'])]);expect(sessionDiff(p,'a.ts',3).lines.map(l=>l.text)).toEqual(['b','c']);
 });
 it('links the first subsequent shell/lint run, without calling arbitrary commands tests',()=>{
  const check={...patch('lint',[]),kind:'shell',detail:{kind:'shell',command:'npm run lint',exitCode:1},status:'error'} as Operation;
  const n=net([patch('one',['-a','+b']),check]);expect(n.lines[0]!.attribution.nextCheck).toEqual({operationId:'lint',kind:'shell',outcome:'failed'});
 });
 it('does not call a completed tool wrapper without an exit code a passed command',()=>{
  const check={...patch('shell',[]),kind:'shell',detail:{kind:'shell',command:'wrapped command',exitCode:null}} as Operation;
  expect(net([patch('one',['-a','+b']),check]).lines[0]!.attribution.nextCheck?.outcome).toBe('unknown');
 });
 it('accepts newline markers without inventing final-newline certainty',()=>{
  const p=patch('newline',['-a','+b','\\ No newline at end of file']);(p.detail as {hunks:Hunk[]}).hunks[0]!.oldLines=1;(p.detail as {hunks:Hunk[]}).hunks[0]!.newLines=1;
  expect(net([p])).toMatchObject({status:'complete',note:expect.stringMatching(/newline/)});
 });
 it('rejects overlapping operation intervals and inconsistent new-side positions',()=>{
  const p=build([patch('one',['-a','+b']),patch('two',['-b','+c'])]);p.timeline.find(t=>t.id==='e0')!.sequence=6;expect(sessionDiff(p,'a.ts').note).toMatch(/Overlapping/);
  const edit=patch('wrong',['-a','+b']);(edit.detail as {hunks:Hunk[]}).hunks[0]!.newStart=2;expect(net([edit]).note).toMatch(/positions disagree/);
 });
 it('does not cross prompt/agent boundaries or treat declined checks as executed',()=>{
  const check={...patch('cmd',[]),kind:'shell',detail:{kind:'shell',command:'lint'},agentId:'b'} as Operation;
  const p=build([patch('one',['-a','+b']),check]);expect(sessionDiff(p,'a.ts').lines[0]!.attribution.nextCheck).toBeUndefined();
  check.agentId='a';p.timeline.push({type:'turn',id:'next',agentId:'a',sequence:4});expect(sessionDiff(p,'a.ts').lines[0]!.attribution.nextCheck).toBeUndefined();
 });
 it('ignores failed and declined patch attempts, and keeps missing successful material explicit',()=>{
  const failed=patch('fail',['-wrong','+x']);failed.status='error';expect(net([patch('one',['-a','+b']),failed]).lines.at(-1)!.text).toBe('b');
  const missing=patch('missing',[]);(missing.detail as {hunks:Hunk[]}).hunks=[];expect(net([patch('one',['-a','+b']),missing]).status).toBe('unavailable');
 });
});
