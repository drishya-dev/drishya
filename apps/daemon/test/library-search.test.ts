import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {startServer,type RunningServer} from '../src/server.ts';
import type {LibrarySearchPage} from '../../../packages/store/src/search-types.ts';
let dir:string,app:App,server:RunningServer,a:string,b:string;
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-library-search-'));app=new App(join(dir,'store'));
  for(const name of ['first','second']){
    const path=join(dir,`${name}.jsonl`),timestamp=name==='first'?'2026-10-14T10:00:00Z':'2026-10-17T10:00:00Z';
    const rows=[{type:'session_meta',timestamp,payload:{id:name,cwd:join(dir,name)}},...Array.from({length:30},(_,i)=>({type:'response_item',timestamp,payload:{type:'message',role:'assistant',content:[{type:'output_text',text:`sharedneedle ${name} observation ${i}`} ]}}))];
    writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('codex',path)).recordingId;if(name==='first')a=id;else b=id;
  }
  const claude=join(dir,'claude.jsonl');writeFileSync(claude,JSON.stringify({type:'assistant',sessionId:'claude-search',cwd:join(dir,'claude'),timestamp:'2026-10-17T10:00:00Z',message:{role:'assistant',content:[{type:'text',text:'claudeneedle captured source'}]}})+'\n');await app.ingest.importSource('claude-code',claude);
  server=await startServer({app,port:0,token:'synthetic-library-search'});
});
afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

it('searches all imported sessions with stable bounded paging and exact observation identities',async()=>{
  const first=await app.history.searchLibrary({q:'sharedneedle',count:17});expect(first.items).toHaveLength(17);expect(first.nextBefore).toBeDefined();
  const rows=[...first.items];let cursor=first.nextBefore;
  while(cursor){const page=await app.history.searchLibrary({q:'sharedneedle',count:17,before:cursor});rows.push(...page.items);cursor=page.nextBefore;}
  expect(rows).toHaveLength(60);expect(new Set(rows.map(row=>row.observationId)).size).toBe(60);expect(new Set(rows.map(row=>row.recordingId))).toEqual(new Set([a,b]));
  expect(rows.every(row=>row.snippet.includes('sharedneedle')&&row.sourceTime)).toBe(true);
  expect((await app.history.searchLibrary({q:'sharedneedle',root:join(dir,'first')})).items).toHaveLength(30);
  expect((await app.history.searchLibrary({q:'sharedneedle',from:'2026-10-16T00:00:00.000Z'})).items.every(row=>row.recordingId===b)).toBe(true);
  expect((await app.history.searchLibrary({q:'sharedneedle',harness:'claude-code'})).items).toEqual([]);
  expect((await app.history.searchLibrary({q:'claudeneedle',harness:'claude-code'})).items).toHaveLength(1);
  expect((await app.history.searchLibrary({q:'claudeneedle',harness:'codex'})).items).toEqual([]);
  expect((await app.history.searchLibrary({q:'" OR * : ('})).items).toEqual([]);
});

it('requires authentication and validates API bounds/filter dates before the worker query',async()=>{
  const url=`${server.url}/v1/search-library?q=sharedneedle`,headers={authorization:`Bearer ${server.token}`};
  expect((await fetch(url)).status).toBe(401);
  const valid=await fetch(url,{headers});expect(valid.status).toBe(200);expect(((await valid.json()) as LibrarySearchPage).items).toHaveLength(50);
  for(const suffix of ['&count=51','&before=0','&before=1.5','&harness=unknown','&from=yesterday','&from=2026-10-18T00%3A00%3A00.000Z&to=2026-10-17T00%3A00%3A00.000Z'])expect((await fetch(url+suffix,{headers})).status,suffix).toBe(400);
});
