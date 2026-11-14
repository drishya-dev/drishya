import {readFileSync} from 'node:fs';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {liveParser} from '../src/live.ts';
import { describe, expect, it } from 'vitest';
import { createParser, descriptor } from '../src/index.ts';
import { intentFor } from '../src/tools.ts';
import { seal } from '@drishya/capture-core';
import { reduce } from '../../projection/src/reduce.ts';
const ctx = { recordingId: 'r', sourceId: 's', sourcePath: '/root/brain/synthetic/.system_generated/logs/transcript_full.jsonl' };
const row = (step_index: number, type: string, extra: object = {}) => ({ step_index, type, source: 'MODEL', status: 'DONE', content: '', tool_calls: [], ...extra });
const call = (args: object) => ({ name: 'call_mcp_tool', args: Object.fromEntries(Object.entries(args).map(([k,v]) => [k,JSON.stringify(v)])) });
describe('genuinely observed Antigravity native tool shapes', () => {
  it('uses explicit MCP server/tool identities without guessing from prose or arguments', () => {
    expect(intentFor('call_mcp_tool', { ServerName: 'synthetic-mcp', ToolName: 'echo', Arguments: { message: 'synthetic' } })).toEqual({ kind: 'mcp', server: 'synthetic-mcp', tool: 'echo' });
    expect(intentFor('call_mcp_tool', { ServerName: 'synthetic-mcp', Arguments: { ToolName: 'echo' } })).toEqual({ kind: 'other' });
    const parser = createParser(ctx);
    expect(parser.parse(row(0, 'PLANNER_RESPONSE', { tool_calls: [call({ ToolName: 'echo' })] })).some(o => o.kind === 'unknown')).toBe(true);
  });
  it('preserves parallel native MCP calls and recorded results with positional correlation', () => {
    const parser = createParser(ctx), tools = ['echo', 'get-sum', 'get-tiny-image'];
    const rows = [row(0, 'PLANNER_RESPONSE', { tool_calls: tools.map(ToolName => call({ ServerName: 'synthetic-mcp', ToolName, Arguments: { message: 'synthetic' } })) }), ...tools.map((tool,i) => row(i+1, 'GENERIC', { content: `Synthetic ${tool} result` }))];
    const raws = rows.flatMap(r => parser.parse(r));
    expect(raws.filter(r => r.kind === 'unknown')).toEqual([]);
    const observations = raws.map((raw,n) => ({ ...seal({ raw, recordingId:'r', adapter:descriptor, sourceId:'s', generation:0, byteOffset:n, observedAt:'2026-11-14T00:00:00Z' }), receivedSequence:n }));
    const projection = reduce('r', observations, { get: () => undefined, put: () => ({sha:'synthetic',bytes:0}) }, { adapters: { antigravity:descriptor } });
    expect(projection.operations.map(o => o.detail.kind === 'mcp' ? [o.detail.server,o.detail.tool,o.detail.resultPreview] : null)).toEqual(tools.map(t => ['synthetic-mcp',t,`Synthetic ${t} result`]));
    expect(projection.links.filter(l => l.relation === 'tool-result').every(l => l.basis === 'deterministic-rule' && l.ruleVersion === 'antigravity-call-order-v1')).toBe(true);
  });
});

it('retains a complete native browser script as captured input, not a fake MCP or inferred actions', () => {
 const parser=createParser(ctx),script='/* synthetic input */'+ 'x'.repeat(2000);
 const rows=[row(0,'PLANNER_RESPONSE',{tool_calls:[{name:'webview_browser',args:{script:JSON.stringify(script),urls:JSON.stringify(['http://127.0.0.1:4317/'])}}]}),row(1,'GENERIC',{content:'Synthetic browser result'})];
 const raws=rows.flatMap(r=>parser.parse(r));
 expect(raws.some(o=>o.kind==='unknown')).toBe(false);
 const observations=raws.map((raw,n)=>({...seal({raw,recordingId:'r',adapter:descriptor,sourceId:'s',generation:0,byteOffset:n,observedAt:'2026-01-01T00:00:00Z'}),receivedSequence:n}));
 const blobs=new Map<string,string>();
 const projection=reduce('r',observations,{get:sha=>blobs.get(sha),put:content=>{const sha='synthetic-'+blobs.size;blobs.set(sha,content);return{sha,bytes:content.length}}},{adapters:{antigravity:descriptor}});
 const operation=projection.operations[0]!;
 expect(operation.detail.kind).toBe('other');
 const captured=projection.artifacts.find(a=>operation.artifactIds.includes(a.id)&&a.id.endsWith('_native_browser_input'))!;
 expect(captured.provenance.kind).toBe('captured');expect(blobs.get(captured.blob!)).toContain(script);
});

it('does not confuse a denied-looking stdout marker with a native permission refusal', () => {
 const parser=createParser(ctx);
 const rows=[row(0,'PLANNER_RESPONSE',{tool_calls:[{name:'run_command',args:{CommandLine:JSON.stringify('node -e "console.log(\'ag5-denied\')"')}}]}),row(1,'GENERIC',{content:'ag5-denied'})];
 const observations=rows.flatMap(r=>parser.parse(r)).map((raw,n)=>({...seal({raw,recordingId:'r',adapter:descriptor,sourceId:'s',generation:0,byteOffset:n,observedAt:'2026-01-01T00:00:00Z'}),receivedSequence:n}));
 const p=reduce('r',observations,{get:()=>undefined,put:()=>({sha:'synthetic',bytes:0})},{adapters:{antigravity:descriptor}});
 expect(p.operations[0]?.declined).toBeUndefined();expect(p.operations[0]?.status).toBe('unknown');
});

it('imports the native-case regression corpus without guessing permission outcomes', () => {
 const rows=readFileSync(new URL('../../../fixtures/synthetic/antigravity/native-cases.ndjson',import.meta.url),'utf8').trim().split('\n').map(line=>JSON.parse(line));
 const parser=createParser(ctx),raws=rows.flatMap(row=>parser.parse(row));
 expect(raws.filter(r=>r.kind==='unknown')).toHaveLength(0);
 const permission=raws.find(r=>r.kind==='tool.call'&&r.payload.tool==='ask_permission')!;
 expect(raws.some(r=>r.kind==='capture.gap'&&r.operationId===permission.operationId&&String(r.payload.detail).includes('approval or denial cannot be identified'))).toBe(true);
 expect(raws.filter(r=>r.kind==='tool.call'&&r.payload.tool==='call_mcp_tool')).toHaveLength(3);
 expect(raws.filter(r=>r.kind==='tool.call'&&r.payload.tool==='ask_question')).toHaveLength(2);
 expect(raws.some(r=>r.kind==='capture.gap'&&String(r.payload.detail).includes('A native approval or rejection is not established'))).toBe(true);
 expect((raws.find(r=>r.kind==='tool.call'&&r.payload.tool==='write_file')?.payload.intent as {kind:string}).kind).toBe('plan');
});
it('shows the recorded PDF reference without reading or pretending to capture PDF bytes', async () => {
 const root=await mkdtemp(join(tmpdir(),'ag-native-pdf-'));const logs=join(root,'brain','synthetic','.system_generated','logs');await mkdir(logs,{recursive:true});
 try {
  const context={...ctx,sourcePath:join(logs,'transcript.jsonl')};
  const parser=liveParser(createParser(context),context,root,'synthetic',()=>undefined);
  const input=row(0,'USER_INPUT',{source:'USER_EXPLICIT',content:'Synthetic attachment',media:[{uri:'.user_uploaded/not-read.pdf',mime_type:'application/pdf'}]});
  await parser.prepare?.(input);const raws=parser.parse(input);
  const gap=raws.find(r=>r.kind==='capture.gap'&&String(r.payload.detail).includes('application/pdf: .user_uploaded/not-read.pdf'));
  expect(gap).toBeDefined();expect(raws.find(r=>r.kind==='message.user')?.payload.images).toEqual([]);
 } finally {await rm(root,{recursive:true,force:true});}
});

it('maps only native swarm add to delegation, never title/status/kill control as a new child', () => {
 expect(intentFor('swarm',{action:'add',name:'synthetic-child',brief:'Review a synthetic file',model:'requested-only'})).toEqual({kind:'spawn',agentType:'synthetic-child',description:'Review a synthetic file',prompt:'Review a synthetic file'});
 for(const action of ['models','title','status','kill','unrecognised'])expect(intentFor('swarm',{action,name:'synthetic-child'})).toEqual({kind:'other'});
});

it('uses exact native swarm result-step receipts for parallel child references, never model/name guesses', async () => {
 const root=await mkdtemp(join(tmpdir(),'ag-native-swarm-')),folder=join(root,'brain','synthetic'),logs=join(folder,'.system_generated','logs'),children=join(folder,'.system_generated','subagents');await mkdir(logs,{recursive:true});await mkdir(children,{recursive:true});
 try {
  for(const id of ['first','second'])await writeFile(join(children,id+'.json'),JSON.stringify({conversationId:id,spawnStepIndex:34,subagentDescriptor:{typeName:'unrelated-type',role:'synthetic'}}));
  const context={...ctx,sourcePath:join(logs,'transcript.jsonl')},parser=liveParser(createParser(context),context,root,'synthetic',()=>undefined);
  const input=row(32,'PLANNER_RESPONSE',{tool_calls:['one','two'].map(name=>({name:'swarm',args:{action:JSON.stringify('add'),name:JSON.stringify(name),model:JSON.stringify('requested-only'),brief:JSON.stringify('Synthetic review')}}))});
  const raws=[];for(const value of [input,row(33,'GENERIC',{content:'Synthetic first receipt'}),row(34,'GENERIC',{content:'Synthetic second receipt'})]){await parser.prepare?.(value);raws.push(...parser.parse(value));}
  const spawned=raws.filter(r=>r.kind==='agent.spawn');expect(spawned).toHaveLength(2);expect(new Set(spawned.map(r=>r.payload.nativeConversationId))).toEqual(new Set(['first','second']));expect(spawned.every(r=>r.payload.spawnStepIndex===34&&r.operationId==='synthetic:32:call:1')).toBe(true);
  expect(spawned.every(r=>r.payload.model===undefined)).toBe(true);
 } finally {await rm(root,{recursive:true,force:true});}
});

it('keeps a completed permission tool receipt distinct from an identified approval or denial', () => {
 const parser=createParser(ctx),rows=[row(0,'PLANNER_RESPONSE',{tool_calls:[{name:'ask_permission',args:{Action:JSON.stringify('synthetic')}}]}),row(1,'GENERIC',{content:'Synthetic DONE receipt'})];
 const observations=rows.flatMap(r=>parser.parse(r)).map((raw,n)=>({...seal({raw,recordingId:'r',adapter:descriptor,sourceId:'s',generation:0,byteOffset:n,observedAt:'2026-01-01T00:00:00Z'}),receivedSequence:n}));
 const p=reduce('r',observations,{get:()=>undefined,put:()=>({sha:'synthetic',bytes:0})},{adapters:{antigravity:descriptor}});
 expect(p.operations[0]?.status).toBe('unknown');expect(p.operations[0]?.declined).toBeUndefined();expect(p.gaps.some(g=>g.detail?.includes('approval or denial cannot be identified'))).toBe(true);
});
