// Minimal stdio MCP: no HTTP listener, SDK, native config writes or model-visible credentials.
import type {Readable, Writable} from 'node:stream';
import {embedFailure, EmbedError, selection} from './embed-launch.ts';
import {embedSupervisor, jsonLines, type EmbedSupervisor} from './embed-runtime.ts';

const tool = {
  name: 'drishya.open_view', title: 'Open local Drishya view',
  description: 'Open one local recorded session in a capable desktop host. Does not send a prompt or grant workspace access.',
  inputSchema: {type:'object',additionalProperties:false,properties:{sessionId:{type:'string'},latest:{const:true},cwd:{type:'string'}},
    oneOf:[{required:['sessionId'],not:{required:['latest']}},{required:['latest'],not:{required:['sessionId']}}]},
  annotations: {readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:false},
};
export async function embedMcp(input: Readable = process.stdin, output: Writable = process.stdout,
  factory: () => EmbedSupervisor = () => embedSupervisor()): Promise<void> {
  let initialized = false, ready = false, privateHandoff = false, closed = false, queued = 0;
  let supervisor: EmbedSupervisor | undefined, work = Promise.resolve();
  const send = (value: unknown) => {if (!closed) output.write(JSON.stringify(value) + '\n');};
  const close = async () => {closed = true; await work.catch(() => undefined); await supervisor?.close();};
  input.on('end', () => {void close();}); input.on('error', () => {void close();}); output.on('error', () => {void close();});
  jsonLines(input, 8192, value => {
    if (closed || queued >= 32) {void close(); return;}
    const r = value as {jsonrpc?: unknown;id?: unknown;method?: unknown;params?: Record<string, unknown>};
    if (!r || r.jsonrpc !== '2.0' || typeof r.method !== 'string' || (r.id !== undefined && typeof r.id !== 'string' && typeof r.id !== 'number')) {
      send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}}); return;
    }
    queued++;
    work = work.then(async () => {
      try {
        if (closed) return;
        if (r.id === undefined) {if (r.method === 'notifications/initialized' && initialized) ready = true; return;}
        const reply = (result: unknown) => send({jsonrpc:'2.0',id:r.id,result});
        const error = (code: number, message: string) => send({jsonrpc:'2.0',id:r.id,error:{code,message}});
        if (r.method === 'ping') return reply({});
        if (r.method === 'initialize') {
          if (initialized || !r.params || typeof r.params.protocolVersion !== 'string') return error(-32602,'Invalid initialization');
          initialized = true;
          const capabilities = r.params.capabilities as {experimental?:Record<string,unknown>} | undefined;
          privateHandoff = capabilities?.experimental?.['drishya.privateLaunch'] === true;
          return reply({protocolVersion:'2025-06-18',capabilities:{tools:{},experimental:{'drishya.privateLaunch':true}},serverInfo:{name:'drishya',version:'1'}});
        }
        if (!ready) return error(-32002,'Initialize this local client first');
        if (r.method === 'tools/list') return reply({tools:[tool]});
        if (r.method !== 'tools/call') return error(-32601,'Method not found');
        try {
          if (r.params?.name !== tool.name) return error(-32602,'Unknown tool');
          const args = selection(r.params.arguments);
          if (!privateHandoff) throw new EmbedError('HOST_HANDOFF_UNAVAILABLE');
          supervisor ??= factory();
          const launched = await supervisor.open(args);
          const cleaned = new URL(launched.url); cleaned.searchParams.delete('recording'); cleaned.hash = '/r/' + encodeURIComponent(launched.recordingId);
          reply({content:[{type:'text',text:JSON.stringify({url:cleaned.href,recordingId:launched.recordingId,mode:launched.mode})}],
            _meta:{'drishya/privateLaunch':launched}});
        } catch (e) {reply({isError:true,content:[{type:'text',text:JSON.stringify(embedFailure(e))}]});}
      } finally {queued--;}
    }).catch(() => {send({jsonrpc:'2.0',id:r.id,error:{code:-32603,message:'Local launcher unavailable'}});});
  }, () => {send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid or oversized JSON message'}}); void close();});
}
