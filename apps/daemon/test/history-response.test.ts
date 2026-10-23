import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, type RunningServer } from '../src/server.ts';
let app: App | undefined, server: RunningServer | undefined, dir: string | undefined;
afterEach(async () => { await server?.close(); await app?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); server=undefined; app=undefined; dir=undefined; });
it('transfers the exact history JSON bytes and streams complete Unicode across socket chunks', async () => {
  dir=mkdtempSync(join(tmpdir(),'drishya-history-bytes-')); app=new App(join(dir,'data'));
  const journal=join(dir,'invented.jsonl'), timestamp='2026-10-23T00:00:00Z';
  const rows: unknown[]=[{timestamp,type:'session_meta',payload:{id:'invented-encoding',cwd:'/synthetic'}}];
  for(let i=0;i<270;i++)rows.push({timestamp,type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:`Invented ${i}: `+'परीक्षण 🚀 \"quoted\" \\ line\n'.repeat(90)}]}});
  writeFileSync(journal,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const {recordingId}=await app.ingest.importSource('codex',journal);
  const query={count:200}, expected=Buffer.from(JSON.stringify(await app.history.page(recordingId,query)));
  expect(expected.byteLength).toBeGreaterThan(64*1024);
  expect(Buffer.from(await app.history.pageBytes(recordingId,query)).equals(expected)).toBe(true);
  for(const query of [{count:1,start:0},{count:2,step:2},{count:1,filter:{kind:'read'}}]) {
    expect(Buffer.from(await app.history.pageBytes(recordingId,query)).toString('utf8')).toBe(JSON.stringify(await app.history.page(recordingId,query)));
  }
  server=await startServer({app,port:0}); const headers={authorization:`Bearer ${server.token}`,'content-type':'application/json'};
  const url=`${server.url}/v1/recordings/${recordingId}/history`;
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(query)});
  expect(response.status).toBe(200); expect(response.headers.get('content-length')).toBe(String(expected.length));
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(Buffer.from(await response.arrayBuffer()).equals(expected)).toBe(true);
  expect((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status).toBe(401);
  expect((await fetch(url,{method:'POST',headers,body:'{"count":-1}'})).status).toBe(400);
  // Abort a partially consumed body. The stream must settle without a second response,
  // an unhandled rejection, or leaving the history worker unusable.
  await new Promise<void>((resolve,reject)=>{
    const req=request(url,{method:'POST',headers},res=>{res.once('data',()=>{res.destroy();resolve();});res.on('error',()=>{});});
    req.on('error',reject);req.end(JSON.stringify(query));
  });
  expect((await fetch(`${server.url}/v1/recordings`,{headers})).status).toBe(200);
  expect(Buffer.from(await app.history.pageBytes(recordingId,query)).equals(expected)).toBe(true);
  expect((await app.ingest.rescan(recordingId)).added).toBe(0);
},30000);
