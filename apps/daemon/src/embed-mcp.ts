// Minimal stdio MCP: no HTTP listener, SDK or native config writes.
// EMBED refined: the agent itself opens the view in its pane, so a host without a private hand-off receives the
// one-use launch link in the tool result. That link signs in once, for one recording, within 60 seconds, and the
// privacy rules strip it from every journal Drishya captures (see `drishya-launch` in @drishya/privacy).
import type {Readable, Writable} from 'node:stream';
import {openBrowser} from './commands.ts';
import {embedFailure, EmbedError, selection, type EmbedLaunch} from './embed-launch.ts';
import {embedSupervisor, jsonLines, type EmbedSupervisor} from './embed-runtime.ts';

export const OPEN_VIEW = 'drishya.open_view';
const tool = {
  name: OPEN_VIEW, title: 'Open this session in Drishya',
  description: 'Open one local agent session in Drishya, a live view of what the agent read, ran and changed, beside the conversation. '
    + 'Give exactly one of nativeSessionId (this harness session\'s own ID), sessionId (a Drishya recording ID) or latest: true; add cwd (the absolute checkout folder) to stay inside one checkout. '
    + 'The result holds a single-use link that expires in 60 seconds: open it at once in your browser or artifact pane, never in a shared place. '
    + 'With systemBrowser: true, Drishya opens it in the system browser itself. Observes only: it does not send prompts, approve anything or grant workspace access.',
  // No top-level oneOf: several clients refuse combinators there. The server enforces exactly one selector.
  inputSchema: {type:'object',additionalProperties:false,properties:{
    nativeSessionId:{type:'string',description:'The harness\'s own session ID for this conversation, when it is known.'},
    sessionId:{type:'string',description:'A Drishya recording ID (rec_…).'},
    latest:{type:'boolean',const:true,description:'The newest session, within cwd when cwd is given.'},
    cwd:{type:'string',description:'Absolute path of the checkout the session works in.'},
    systemBrowser:{type:'boolean',description:'Open the view in the system browser instead of returning the link.'}}},
  annotations: {readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:false},
};
const clean = (launched: EmbedLaunch) => {
  const cleaned = new URL(launched.url); cleaned.searchParams.delete('recording'); cleaned.hash = '/r/' + encodeURIComponent(launched.recordingId);
  return cleaned.href;
};
export async function embedMcp(input: Readable = process.stdin, output: Writable = process.stdout,
  factory: () => EmbedSupervisor = () => embedSupervisor(), open: (url: string) => void = openBrowser): Promise<void> {
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
          // MCP experimental capabilities are objects: a host declares `{}` to say it keeps `_meta` out of model content,
          // persistence and logs. #497 used `true`, which real clients reject as an invalid initialize result.
          const declared = capabilities?.experimental?.['drishya.privateLaunch'];
          privateHandoff = !!declared && typeof declared === 'object' && !Array.isArray(declared);
          // Answer with the client's version when we speak it; the tool surface is the same in each.
          const version = ['2024-11-05','2025-03-26','2025-06-18'].includes(r.params.protocolVersion) ? r.params.protocolVersion : '2025-06-18';
          return reply({protocolVersion:version,capabilities:{tools:{},experimental:{'drishya.privateLaunch':{}}},serverInfo:{name:'drishya',version:'1'}});
        }
        // Some clients list tools before sending `initialized`; listing reveals nothing, launching still waits.
        if (r.method === 'tools/list') return initialized ? reply({tools:[tool]}) : error(-32002,'Initialize this local client first');
        if (!ready) return error(-32002,'Initialize this local client first');
        if (r.method !== 'tools/call') return error(-32601,'Method not found');
        try {
          if (r.params?.name !== tool.name) return error(-32602,'Unknown tool');
          const raw = r.params.arguments;
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new EmbedError('INVALID_SELECTION');
          const {systemBrowser, ...rest} = raw as Record<string, unknown>;
          if (systemBrowser !== undefined && systemBrowser !== null && typeof systemBrowser !== 'boolean') throw new EmbedError('INVALID_SELECTION');
          // Models fill unused options with null, '' or latest: false; those select nothing. Only the server decides validity.
          for (const key of Object.keys(rest)) if (rest[key] === null || rest[key] === '' || (key === 'latest' && rest[key] === false)) delete rest[key];
          const args = selection(rest);
          supervisor ??= factory();
          const launched = await supervisor.open(args);
          const summary = {recordingId:launched.recordingId,port:launched.port,mode:launched.mode};
          if (systemBrowser) {
            open(launched.url);
            return reply({content:[{type:'text',text:JSON.stringify({...summary,opened:'system-browser',url:clean(launched)})}]});
          }
          if (privateHandoff) {
            return reply({content:[{type:'text',text:JSON.stringify({...summary,url:clean(launched)})}],_meta:{'drishya/privateLaunch':launched}});
          }
          return reply({content:[{type:'text',text:JSON.stringify({...summary,url:launched.url,singleUse:true,expiresInSeconds:60,
            next:'Open url now in your browser or artifact pane (or the system browser). It signs in once; call the tool again for a fresh link.'})}]});
        } catch (e) {reply({isError:true,content:[{type:'text',text:JSON.stringify(embedFailure(e))}]});}
      } finally {queued--;}
    }).catch(() => {send({jsonrpc:'2.0',id:r.id,error:{code:-32603,message:'Local launcher unavailable'}});});
  }, () => {send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid or oversized JSON message'}}); void close();});
}
