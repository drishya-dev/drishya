import { mkdtempSync,rmSync,copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest';
import { App } from '../src/app.ts';
import { readWorkingLocations,saveWorkingLocations } from '../src/working-locations.ts';
import { startServer,type RunningServer } from '../src/server.ts';
import { workingLocations } from '../../../packages/contracts/src/working-locations.ts';

let dir:string,app:App,id:string,otherId:string,server:RunningServer;
beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-locations-'));app=new App(join(dir,'store'));const journal=join(dir,'session.jsonl');copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'),journal);id=(await app.ingest.importSource('claude-code',journal)).recordingId;const other=join(dir,'other.jsonl');copyFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'),other);otherId=(await app.ingest.importSource('codex',other)).recordingId;server=await startServer({app,port:0});});
afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('unsafe temporary directory');rmSync(dir,{recursive:true,force:true});});
beforeEach(()=>{app.store.db.prepare("DELETE FROM meta WHERE key='ui-working-locations-v1'").run();});
const snapshot=():{version:1;last:string;sessions:{id:string;entries:[string,unknown][]}[]}=>({version:1,last:id,sessions:[{id,entries:[['desk/files',['src/cart/total.ts']],['location',{developerWorkspace:true,currentFile:'src/cart/total.ts',follow:false}]]}]});

it('persists source-free locations in the own store across a second App and port',async()=>{saveWorkingLocations(app,snapshot());const second=new App(join(dir,'store'));const next=await startServer({app:second,port:0});try{expect(next.url).not.toBe(server.url);const response=await fetch(`${next.url}/v1/working-locations`,{headers:{authorization:`Bearer ${next.token}`}});const saved=workingLocations(await response.json());expect(saved.last).toBe(id);expect(saved.sessions[0]!.entries).toContainEqual(['desk/files',['src/cart/total.ts']]);}finally{await next.close();await second.close();}});
it('drops body, prompt, credentials and approval/playback state, and scrubs metadata before SQLite',()=>{const input=snapshot();input.sessions[0]!.entries.push(['source',{text:'DO_NOT_PERSIST'}],['draft','DO_NOT_PERSIST'],['map/query','sk-proj-abcdefghijklmnopqrstuvw0123456789'],['folders/query','password="long-random-private-secret"']);(input.sessions[0]!.entries[1]![1] as Record<string,unknown>).playing=true;saveWorkingLocations(app,input);const stored=app.store.db.prepare("SELECT value FROM meta WHERE key='ui-working-locations-v1'").get() as {value:string};expect(stored.value).not.toContain('DO_NOT_PERSIST');expect(stored.value).not.toContain('playing');expect(stored.value).not.toContain('sk-proj-');expect(stored.value).not.toContain('long-random-private-secret');expect(readWorkingLocations(app).sessions).toHaveLength(1);});
it('ignores corrupted versions and malformed state before any reader can consume it',()=>{expect(workingLocations({version:99,sessions:[]})).toEqual({version:1,sessions:[]});const safe=workingLocations({version:1,sessions:[{id:'r',entries:[['desk/files','not an array'],['map/camera',{x:'bad',y:0,k:1}],['evidence/trail',{cursor:0,visits:[{location:{inspectorTab:'bad'},memory:[['disk/start','bad'],['disk/wrap',true],['captured/text','private']]}]}]]}]});expect(safe.sessions[0]!.entries).toHaveLength(1);expect(JSON.stringify(safe)).not.toContain('private');expect(JSON.stringify(safe)).not.toContain('bad');});
it('does not accept unauthenticated or cross-origin recovery writes',async()=>{expect((await fetch(`${server.url}/v1/working-locations`)).status).toBe(401);expect((await fetch(`${server.url}/v1/working-locations`,{method:'PUT',headers:{authorization:`Bearer ${server.token}`,origin:'https://example.invalid','content-type':'application/json'},body:JSON.stringify(snapshot())})).status).toBe(403);});
it('bounds request bytes and retains the previous valid checkpoint on rejection',async()=>{saveWorkingLocations(app,snapshot());const before=readWorkingLocations(app);expect((await fetch(`${server.url}/v1/working-locations`,{method:'PUT',headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'},body:JSON.stringify({padding:'x'.repeat(270000)})})).status).toBe(413);expect(readWorkingLocations(app)).toEqual(before);});
it('drops references to unavailable recordings rather than restoring an invented session',()=>{saveWorkingLocations(app,{version:1,last:'gone',sessions:[{id:'gone',entries:[['desk/files',['file.ts']]]}]});expect(readWorkingLocations(app).sessions).toHaveLength(0);expect(readWorkingLocations(app).last).toBeUndefined();});
it('merges different sessions, and with two tabs on one session the later write wins quietly',()=>{saveWorkingLocations(app,snapshot());saveWorkingLocations(app,{version:1,last:otherId,sessions:[{id:otherId,entries:[['location',{explore:true}]]}]});expect(readWorkingLocations(app).sessions).toHaveLength(2);
  const later=snapshot();later.sessions[0]!.entries=[['desk/files',['src/later.ts']]];
  const first=saveWorkingLocations(app,later).revisions[id]!;
  // The other tab still holds an older revision. Its write succeeds and is the one kept.
  const stale=snapshot();(stale.sessions[0] as {revision?:number}).revision=0;stale.sessions[0]!.entries=[['desk/files',['src/stale-tab.ts']]];
  expect(saveWorkingLocations(app,stale).revisions[id]).toBe(first+1);
  expect(readWorkingLocations(app).sessions.find(s=>s.id===id)!.entries).toContainEqual(['desk/files',['src/stale-tab.ts']]);
  expect(readWorkingLocations(app).sessions.find(s=>s.id===otherId)!.entries).toContainEqual(['location',{explore:true}]);});

it('forgetting through the shared App also removes saved locations and last-session references',async()=>{
  const journal=join(dir,'forgotten.jsonl');copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'),journal);
  const forgotten=(await app.ingest.importSource('claude-code',journal)).recordingId;
  saveWorkingLocations(app,{version:1,last:forgotten,sessions:[{id:forgotten,entries:[['desk/files',['src/cart/total.ts']]]},{id:`${id}+${forgotten}`,entries:[['history/top',150]]}]});
  await app.forget(forgotten);
  expect(readWorkingLocations(app)).toEqual({version:1,sessions:[]});
});
