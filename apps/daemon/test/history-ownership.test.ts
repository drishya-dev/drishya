import { afterEach, expect, test } from 'vitest';
import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { App } from '../src/app.ts';

let dir: string | undefined;
const apps: App[] = [];
afterEach(async()=>{
  for(const app of apps) await app.close();apps.length=0;
  if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe fixture path');rmSync(dir,{recursive:true,force:true});dir=undefined;}
});
const cache=(app:App)=>(app.ingest as unknown as {projectionCache:Map<string,unknown>}).projectionCache;
function setup(){
  dir=mkdtempSync(join(tmpdir(),'drishya-history-ownership-'));
  const a=join(dir,'invented-a.jsonl'),b=join(dir,'invented-b.jsonl');
  for(const file of [a,b])copyFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'),file);
  const app=new App(join(dir,'data'));apps.push(app);return {app,a,b};
}

test('worker reads evict capture projections while explicit full reads remain byte-identical',async()=>{
  const {app,a}=setup();const id=(await app.ingest.importSource('codex',a)).recordingId;
  const before=app.projection(id);expect(cache(app).size).toBe(1);
  await app.history.page(id,{count:2});expect(cache(app).size).toBe(0);
  expect(JSON.stringify(app.projection(id))).toBe(JSON.stringify(before));expect(cache(app).size).toBe(0);
  expect((await app.ingest.rescan(id)).added).toBe(0);expect(cache(app).size).toBe(0);
});

test('worker ownership includes combined cache keys with workspace suffixes',async()=>{
  const {app,a,b}=setup();const one=(await app.ingest.importSource('codex',a)).recordingId,two=(await app.ingest.importSource('codex',b)).recordingId;
  const id=one+'+'+two,before=app.projection(id);
  expect([...cache(app).keys()].some(k=>k.includes('\u0000'))).toBe(true);
  await app.history.summary(two);expect(cache(app).size).toBe(0);
  expect(JSON.stringify(app.projection(id))).toBe(JSON.stringify(before));expect(cache(app).size).toBe(0);
});

test('a warm index visit preserves incremental state for returning live turns',async()=>{
  const {app:original,a,b}=setup();const one=(await original.ingest.importSource('codex',a)).recordingId,two=(await original.ingest.importSource('codex',b)).recordingId;
  const warm=await original.history.page(two,{count:2});await original.close();apps.splice(apps.indexOf(original),1);
  const app=new App(join(dir!,'data'));apps.push(app);
  await app.history.page(one,{count:2});expect(await app.history.diagnosticSqlite()).toMatchObject({reducerResident:true});
  expect(JSON.stringify(await app.history.page(two,{count:2}))).toBe(JSON.stringify(warm));
  expect(await app.history.diagnosticSqlite()).toMatchObject({fullProjectionResident:true,reducerResident:true});
  appendFileSync(a,JSON.stringify({timestamp:'2026-12-01T00:00:00Z',type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Invented ownership append'}]}})+'\n');
  expect((await app.ingest.sync(one)).gaps).toBe(0);const updated=await app.history.page(one,{count:2});
  const fresh=new App(join(dir!,'fresh'));apps.push(fresh);await fresh.ingest.importSource('codex',a);const expected=await fresh.history.page(one,{count:2});
  expect(updated.projection).toEqual(expected.projection);expect(updated.scene).toEqual(expected.scene);
  expect(app.store.observations(one).map(o=>o.id)).toEqual(fresh.store.observations(one).map(o=>o.id));
  expect((await app.ingest.rescan(one)).added).toBe(0);
});
