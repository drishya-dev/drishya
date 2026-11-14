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
