import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { asOfProjection, type Observation } from '@drishya/contracts';
import { pinnedPlans, planThreads } from '../../scene/src/plan-threads.ts';
import { createReducer, reduce } from '../src/reduce.ts';
import { proposedPlan, TaskPlans } from '../src/plans.ts';

const obs = (sequence: number, kind = 'tool.result', payload: unknown = {}, overrides: Partial<Observation> = {}): Observation => ({
 id: `o${sequence}`, recordingId: 'r', agentId: 'agent:main', receivedSequence: sequence,
 source: { adapterId: 'claude-code', adapterVersion: 'test', sourceId: 'source', generation: 0, byteOffset: sequence, part: 0 },
 observedAt: '2026-10-27T00:00:00Z', kind, payload: payload as Observation['payload'], privacyPolicyVersion: 'test', redactions: [], availability: 'complete', ...overrides,
});
function memory() { const blobs = new Map<string, string>(); return { get: (sha: string) => blobs.get(sha), put: (text: string) => {const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) };} }; }
function taskRows() {
 const rows = [obs(0, 'message.user', { text: 'Synthetic plan task' })];
 let n = 1;
 const call = (tool: string, input: unknown, structured: unknown, isError = false) => {
  const operationId = `call${n}`;
  rows.push(obs(n++, 'tool.call', {tool, input, intent: {kind: 'other'}}, {operationId}));
  rows.push(obs(n++, 'tool.result', {structured, isError, text: 'Synthetic result', outcome: {kind: 'other'}}, {operationId}));
 };
 call('TaskCreate', {subject: 'Same label'}, {task: {id: '1', subject: 'Same label'}});
 call('TaskCreate', {subject: 'Same label'}, {task: {id: '2', subject: 'Same label'}});
 call('TaskUpdate', {taskId: '1', status: 'in_progress'}, {success: true, taskId: '1', updatedFields: ['status'], statusChange: {from: 'pending', to: 'in_progress'}});
 call('TaskUpdate', {taskId: '1', subject: 'Renamed', status: 'completed'}, {success: true, taskId: '1', updatedFields: ['subject', 'status'], statusChange: {from: 'in_progress', to: 'completed'}});
 call('TaskUpdate', {taskId: '2', status: 'completed'}, {success: false, taskId: '2'}, true);
 return rows;
}
const options = { adapters: {} };
describe('native task facts', () => {
 it('uses confirmed stable IDs, preserves unknown creation state, renames without adding/removing, and ignores failure', () => {
  const p = reduce('r', taskRows(), memory(), options);
  const ops = p.operations.filter(o => o.detail.kind === 'plan');
  expect(ops).toHaveLength(4);
  expect(ops[0]!.detail).toMatchObject({items: [{id: '1', status: ''}]});
  expect(ops.at(-1)!.detail).toMatchObject({items: [{id: '1', text: 'Renamed', status: 'completed'}, {id: '2', text: 'Same label', status: ''}]});
  const rev = planThreads(p).get(ops.at(-1)!.id)!.thread.revisions.at(-1)!;
  expect(rev.removed).toEqual([]); expect(rev.items[0]!.change).toBe('completed');
  expect(pinnedPlans(p).get(1)?.done).toBe(1);
  expect(p.operations.at(-1)!.kind).toBe('other');
  expect(ops.at(-1)!.classification).toMatchObject({kind: 'derived', observationIds: expect.arrayContaining(['o2','o4','o7','o8'])});
 });
 it('never leaks future result state at any replay boundary and retains immutable append snapshots', () => {
  const rows = taskRows(), io = memory(), reducer = createReducer('r', rows.slice(0, 3), io, options);
  const before = reducer.snapshot(); reducer.append(rows.slice(3)); const p = reducer.snapshot();
  expect(before.operations[0]!.detail).toMatchObject({items: [{status: ''}]});
  for (let step = 0; step <= p.timeline.length; step++) {
   const past = asOfProjection(p, step), visible = new Set(p.timeline.slice(0,step).filter(i => i.type === 'op-end').map(i => i.operationId));
   for (const op of past.operations) if (op.kind === 'plan' && !visible.has(op.id)) expect(op.detail).toMatchObject({items: []});
   const latest = p.operations.filter(op => op.kind === 'plan' && visible.has(op.id)).at(-1);
   expect(pinnedPlans(past).get(1)?.operationId).toBe(latest?.id);
  }
 });
 it('does not mix recordings, agents, explicit list IDs or source generations; repeated creates start a conservative boundary', () => {
  const plans = new TaskPlans();
  const create = (o: Observation, subject = 'A') => plans.apply(o, 'TaskCreate', {}, {task: {id: '1', subject}})!;
  const first = create(obs(1)); const duplicate = create(obs(2), 'B');
  expect(duplicate.detail.scope).not.toBe(first.detail.scope); expect(first.detail.items[0]!.text).toBe('A');
  for (const o of [obs(3, undefined, undefined, {recordingId: 'other'}), obs(4, undefined, undefined, {agentId: 'child'}), obs(5, undefined, undefined, {source: {...obs(1).source, generation: 1}})]) expect(create(o).detail.scope).not.toBe(first.detail.scope);
  expect(plans.apply(obs(6), 'TaskUpdate', {taskId: '1'}, {success: true, taskId: 'missing', statusChange: {to: 'completed'}})).toBeUndefined();
 });
 it('keeps current fact provenance bounded across hundreds of status revisions', () => {
  const plans=new TaskPlans();plans.apply(obs(1),'TaskCreate',{}, {task:{id:'1',subject:'Stable subject'}});
  for(let i=2;i<502;i++)expect(plans.apply(obs(i),'TaskUpdate',{}, {success:true,taskId:'1',statusChange:{to:i%2?'completed':'in_progress'}})!.observations.length).toBeLessThanOrEqual(3);
 });
 it('keeps partial reads, literal states, confirmed deletion and complete empty lists honest', () => {
  const plans = new TaskPlans();
  plans.apply(obs(1), 'TaskCreate', {}, {task: {id: '1', subject: 'A', status: 'waiting-for-review'}});
  expect(plans.apply(obs(2), 'TaskGet', {}, {task: {id: '1', subject: 'B'}})?.detail.items[0]).toMatchObject({text: 'B', status: 'waiting-for-review'});
  expect(plans.apply(obs(3), 'TaskUpdate', {}, {success: true, taskId: '1', statusChange: {to: 'deleted'}})?.detail.items).toEqual([]);
  expect(plans.apply(obs(4), 'TaskList', {}, {tasks: []})?.detail.items).toEqual([]);
  expect(plans.apply(obs(5), 'TaskCreate', {}, 'Task #1 created')).toBeUndefined();
  expect(plans.apply(obs(6), 'TaskUpdate', {status:'completed'}, {taskId:'1'})).toBeUndefined();
 });
 it('replaces lists only on valid unique result identities and shows a bounded projection limit', () => {
  const plans = new TaskPlans(), tasks = Array.from({length:2001}, (_,i)=>({id:String(i), subject:`Task ${i}`,status:'pending'}));
  expect(plans.apply(obs(1), 'TaskList', {}, {tasks})?.detail).toMatchObject({omittedItems:1,items:expect.any(Array)});
  expect(plans.apply(obs(2), 'TaskList', {}, {tasks:[tasks[0],tasks[0]]})).toBeUndefined();
  expect(plans.apply(obs(3), 'TaskGet', {}, {task:tasks[0]})?.detail.items).toHaveLength(2000);
  const p=reduce('r',[obs(0,'message.user',{text:'Bounded list'}),obs(1,'tool.call',{tool:'TaskList',input:{},intent:{kind:'other'}},{operationId:'list'}),obs(2,'tool.result',{structured:{tasks},outcome:{kind:'other'}},{operationId:'list'})],memory(),options);
  expect(pinnedPlans(p).get(1)).toMatchObject({total:2000,omittedItems:1});
  expect([...planThreads(p).values()][0]!.thread.revisions[0]).toMatchObject({omittedItems:1});
 });
});
it('presents only captured successful native plan-file Writes as Markdown material and retains exact source bytes', () => {
 const body='# Native plan\n\n- Read\n- Verify', path='C:/Synthetic/.claude/plans/captured.md';
 const rows=[obs(0,'message.user',{text:'Synthetic plan'}),
 obs(1,'tool.call',{tool:'Write',input:{file_path:path,content:body},intent:{kind:'write',path,content:body}},{operationId:'write'}),
 obs(2,'tool.result',{outcome:{kind:'edit',path,content:body,created:true},text:'Written'},{operationId:'write'})];
 const io=memory(), p=reduce('r',rows,io,options), op=p.operations[0]!;
 expect(op.kind).toBe('plan');expect(op.paths[0]!.role).toBe('write');
 expect(op.detail).toMatchObject({items:[],document:{text:body,source:'file'}});
 expect(pinnedPlans(p).size).toBe(0);expect(planThreads(asOfProjection(p,2)).size).toBe(0);
 const ordinary=rows.map(o=>({...o,payload:JSON.parse(JSON.stringify(o.payload).replaceAll('.claude/plans/captured.md','docs/plan.md'))}));
 expect(reduce('r',ordinary,io,options).operations[0]!.detail.kind).toBe('edit');
});
describe('explicit Codex proposal', () => {
 const codex = obs(1,'message.assistant',{}, {source: {...obs(1).source,adapterId:'codex'}});
 it('renders one captured document without fabricating completion or a duplicate prose item', () => {
  const body = '# Plan\n\n1. Read\n2. Check', io = memory();
  const p = reduce('r',[{...codex,payload:{text:`<proposed_plan>\n${body}\n</proposed_plan>`}}],io,options);
  const raw=p.artifacts[0]!; expect(io.get(raw.blob!)).toBe(`<proposed_plan>\n${body}\n</proposed_plan>`);
  expect(p.agents).toHaveLength(1); expect(p.agents[0]!.id).toBe(p.operations[0]!.agentId);
  expect(p.prose).toEqual([]); expect(p.operations).toHaveLength(1); expect(pinnedPlans(p).size).toBe(0);
  const op=p.operations[0]!; expect(op.detail).toMatchObject({items:[],document:{text:body,truncated:false}});
  const artifact=p.artifacts[0]!; expect(artifact.availability).toBe('complete'); expect(artifact.provenance.kind).toBe('captured');
  expect(asOfProjection(p,1).operations[0]!.detail).toMatchObject({items:[]});
  expect('document' in asOfProjection(p,1).operations[0]!.detail).toBe(false);
 });
 it('leaves headings, quoted/fenced examples, incomplete and repeated wrappers as ordinary prose', () => {
  for (const text of ['# Plan\nRead','```xml\n<proposed_plan>x</proposed_plan>\n```','<proposed_plan>x','<proposed_plan>x</proposed_plan><proposed_plan>y</proposed_plan>']) expect(proposedPlan(codex,text)).toBeUndefined();
  expect(proposedPlan(obs(1,'message.assistant'),'<proposed_plan>x</proposed_plan>')).toBeUndefined();
 });
});
