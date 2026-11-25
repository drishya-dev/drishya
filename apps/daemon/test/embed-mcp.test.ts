import {PassThrough} from 'node:stream';
import {expect,it} from 'vitest';
import {embedMcp} from '../src/embed-mcp.ts';
import type {EmbedSupervisor} from '../src/embed-runtime.ts';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const code='x'.repeat(43);
const launchUrl='http://127.0.0.1:42345/?embed=1&recording=rec_0000000000000000#launch='+code;
const fake=(onClose=()=>{}):EmbedSupervisor=>({pid:1,release:()=>{},open:async()=>({url:launchUrl,port:42345,recordingId:'rec_0000000000000000',mode:'top-level'}),close:async()=>{onClose();}});
async function client(privateLaunch:boolean,factory:()=>EmbedSupervisor,opened:string[]=[]) {
 const input=new PassThrough(),output=new PassThrough();const replies:any[]=[];let pending='';
 output.on('data',b=>{pending+=String(b);for(;;){const at=pending.indexOf('\n');if(at<0)break;replies.push(JSON.parse(pending.slice(0,at)));pending=pending.slice(at+1);}});
 await embedMcp(input,output,factory,url=>{opened.push(url);});
 const send=(v:unknown)=>input.write(JSON.stringify(v)+'\n');
 send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:privateLaunch?{experimental:{'drishya.privateLaunch':{}}}:{}}});
 send({jsonrpc:'2.0',method:'notifications/initialized'});await tick();
 return{send,replies,input,output};
}
it('initialize result follows the MCP schema: experimental capabilities are objects, a boolean declaration is ignored',async()=>{
 const c=await client(false,()=>fake());
 expect(c.replies[0].result.capabilities.experimental['drishya.privateLaunch']).toEqual({});
 c.input.end();
 const input=new PassThrough(),output=new PassThrough();const replies:any[]=[];
 output.on('data',b=>{for(const line of String(b).split('\n').filter(Boolean))replies.push(JSON.parse(line));});
 await embedMcp(input,output,()=>fake());
 input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{experimental:{'drishya.privateLaunch':true}}}})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 input.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{sessionId:'rec_0000000000000000'}}})+'\n');await tick();
 expect(JSON.parse(replies[1].result.content[0].text).code).toBe('HOST_HANDOFF_UNAVAILABLE');input.end();
});
it('lists one tool whose schema has no top-level combinator',async()=>{
 const c=await client(false,()=>fake());
 c.send({jsonrpc:'2.0',id:2,method:'tools/list'});await tick();
 const tool=c.replies[1].result.tools[0];
 expect(tool.name).toBe('drishya.open_view');
 expect(tool.inputSchema.oneOf??tool.inputSchema.anyOf??tool.inputSchema.allOf).toBeUndefined();
 c.input.end();
});
it('a host without private handoff gets no launch credential and starts no worker',async()=>{
 let starts=0;const c=await client(false,()=>{starts++;return fake();});
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{sessionId:'rec_0000000000000000'}}});await tick();
 const result=c.replies[1].result;
 expect(result.isError).toBe(true);
 expect(JSON.parse(result.content[0].text).code).toBe('HOST_HANDOFF_UNAVAILABLE');
 expect(JSON.stringify(result).includes(code)).toBe(false);
 expect(starts).toBe(0);
 c.input.end();
});
it('capable host receives private metadata and closes its owned worker when the client ends',async()=>{
 let closed=false;const c=await client(true,()=>fake(()=>{closed=true;}));
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{sessionId:'rec_0000000000000000'}}});await tick();
 const result=c.replies[1].result;expect(!JSON.stringify(result.content).includes(code)).toBe(true);
 expect(JSON.parse(result.content[0].text).url).toBe('http://127.0.0.1:42345/?embed=1#/r/rec_0000000000000000');
 expect(result._meta['drishya/privateLaunch'].url.endsWith(code)).toBe(true);
 c.input.end();await tick();expect(closed).toBe(true);
});
it('systemBrowser hands the link to the opener and never to the model',async()=>{
 const opened:string[]=[];const c=await client(false,()=>fake(),opened);
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{nativeSessionId:'0123abcd-0000-4000-8000-000000000000',systemBrowser:true}}});await tick();
 expect(opened).toEqual([launchUrl]);
 const text=c.replies[1].result.content[0].text;expect(text.includes(code)).toBe(false);expect(JSON.parse(text).status).toBe('system-browser-requested');
 c.input.end();
});
it('closing the MCP channel cancels its active launch without opening a late browser',async()=>{
 const opened:string[]=[];
 let markStarted!:()=>void, finishLaunch!:(value:Awaited<ReturnType<EmbedSupervisor['open']>>)=>void;
 const started=new Promise<void>(resolve=>{markStarted=resolve;});
 const holding=new Promise<Awaited<ReturnType<EmbedSupervisor['open']>>>(resolve=>{finishLaunch=resolve;});
 let closes=0;
 const supervisor=fake(()=>{closes++;});
 const completed=supervisor.open({sessionId:'rec_0000000000000000'});
 supervisor.open=()=>{markStarted();return holding;};
 const c=await client(false,()=>supervisor,opened);
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{sessionId:'rec_0000000000000000',systemBrowser:true}}});
 await started;
 c.input.end();
 await new Promise(resolve=>setImmediate(resolve));
 const closesBeforeLaunchSettles=closes;
 finishLaunch(await completed);
 await new Promise(resolve=>setImmediate(resolve));
 expect(closesBeforeLaunchSettles).toBe(1);
 expect(opened).toEqual([]);
});
it('unknown tools, uninitialized requests, unsafe args and malformed messages are refused',async()=>{
 const c=await client(false,()=>{throw new Error('must not start');});
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'wrong',arguments:{latest:true}}});
 c.send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'drishya.open_view',arguments:{latest:true,command:'unsafe'}}});
 c.send({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'drishya.open_view',arguments:{nativeSessionId:'../../etc/passwd'}}});
 c.send({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'drishya.open_view',arguments:{sessionId:'rec_0000000000000000',systemBrowser:'yes'}}});
 c.send({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'drishya.open_view',arguments:{latest:true,systemBrowser:true}}});await tick();
 expect(c.replies[1].error.code).toBe(-32602);
 for(const i of [2,3,4,5]) expect(JSON.parse(c.replies[i].result.content[0].text).code).toBe('INVALID_SELECTION');
 c.input.write('not json\n');await tick();expect(c.replies[6].error.code).toBe(-32700);c.input.end();
});
it('tools are not listed before initialize',async()=>{
 const input=new PassThrough(),output=new PassThrough();const replies:any[]=[];
 output.on('data',b=>{for(const line of String(b).split('\n').filter(Boolean))replies.push(JSON.parse(line));});
 await embedMcp(input,output,()=>fake());
 input.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})+'\n');await tick();
 expect(replies[0].error.code).toBe(-32002);input.end();
});
