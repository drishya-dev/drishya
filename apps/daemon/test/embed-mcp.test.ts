import {PassThrough} from 'node:stream';
import {expect,it} from 'vitest';
import {embedMcp} from '../src/embed-mcp.ts';
import type {EmbedSupervisor} from '../src/embed-runtime.ts';
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function client(privateLaunch:boolean,factory:()=>EmbedSupervisor) {
 const input=new PassThrough(),output=new PassThrough();const replies:any[]=[];let pending='';
 output.on('data',b=>{pending+=String(b);for(;;){const at=pending.indexOf('\n');if(at<0)break;replies.push(JSON.parse(pending.slice(0,at)));pending=pending.slice(at+1);}});
 await embedMcp(input,output,factory);
 const send=(v:unknown)=>input.write(JSON.stringify(v)+'\n');
 send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{experimental:{'drishya.privateLaunch':privateLaunch}}}});
 send({jsonrpc:'2.0',method:'notifications/initialized'});await tick();
 return{send,replies,input,output};
}
it('plain clients get an honest fallback, never a secret or worker',async()=>{
 let called=false;const c=await client(false,()=>{called=true;throw new Error('unreachable');});
 c.send({jsonrpc:'2.0',id:2,method:'tools/list'});c.send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'drishya.open_view',arguments:{latest:true}}});
 await tick();expect(c.replies[1].result.tools[0].name).toBe('drishya.open_view');
 expect(c.replies[2].result.isError).toBe(true);expect(JSON.stringify(c.replies).includes('HOST_HANDOFF_UNAVAILABLE')).toBe(true);expect(called).toBe(false);c.input.end();
});
it('capable host receives private metadata, model content contains only cleaned route',async()=>{
 const code='x'.repeat(43);let closed=false;
 const c=await client(true,()=>({pid:1,open:async()=>({url:'http://127.0.0.1:42345/?embed=1&recording=rec_0000000000000000#launch='+code,port:42345,recordingId:'rec_0000000000000000',mode:'top-level'}),close:async()=>{closed=true;}}));
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'drishya.open_view',arguments:{latest:true}}});await tick();
 const result=c.replies[1].result;expect(!JSON.stringify(result.content).includes(code)).toBe(true);
 expect(JSON.parse(result.content[0].text).url).toBe('http://127.0.0.1:42345/?embed=1#/r/rec_0000000000000000');
 expect(result._meta['drishya/privateLaunch'].url.endsWith(code)).toBe(true);
 c.input.end();await tick();expect(closed).toBe(true);
});
it('unknown tools, uninitialized requests, unsafe args and malformed messages are refused',async()=>{
 const c=await client(true,()=>{throw new Error('must not start');});
 c.send({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'wrong',arguments:{latest:true}}});
 c.send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'drishya.open_view',arguments:{latest:true,command:'unsafe'}}});await tick();
 expect(c.replies[1].error.code).toBe(-32602);expect(c.replies[2].result.isError).toBe(true);c.input.write('not json\n');await tick();expect(c.replies[3].error.code).toBe(-32700);c.input.end();
});
