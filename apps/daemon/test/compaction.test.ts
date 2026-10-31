import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';
let app: App | undefined, dir: string;
afterEach(async () => { await app?.close(); if (dir) rmSync(dir, { recursive:true, force:true }); });
const at = (i:number) => new Date(Date.UTC(2026,9,30,10,0,i)).toISOString();
function write(rows: unknown[]) {
  dir=mkdtempSync(join(tmpdir(),'drishya-compaction-')); const path=join(dir,'invented.jsonl');
  writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n'); app=new App(join(dir,'data')); return path;
}
const prompt = (i:number) => ({ type:'response_item', timestamp:at(i), payload:{type:'message',role:'user',content:[{type:'input_text',text:`Synthetic prompt ${i}`}]}});
const reading = (i:number,n:number) => ({type:'event_msg',timestamp:at(i),payload:{type:'token_count',info:{model_context_window:100000,last_token_usage:{input_tokens:n}}}});
describe('worker-owned compaction evidence',()=>{
  it('bounds context arrays and summary artifacts to loaded passages plus one as-of reading, including restart',async()=>{
    const rows:unknown[]=[{type:'session_meta',payload:{id:'synthetic-compactions',cwd:'/synthetic'}}];
    for(let i=0;i<60;i++) rows.push(prompt(i*4),reading(i*4+1,80000),{type:'compacted',timestamp:at(i*4+2),payload:{message:`Synthetic summary ${i}`}},reading(i*4+3,9000));
    const path=write(rows), {recordingId}=await app!.ingest.importSource('codex',path), full=app!.projection(recordingId);
    expect(full.compactions).toHaveLength(60);
    const page=await app!.history.page(recordingId,{count:1});
    expect(page.projection.compactions!.length).toBeLessThanOrEqual(1); expect(page.projection.compactionSummaries!.length).toBeLessThanOrEqual(1); expect(page.projection.context!.readings.length).toBeLessThanOrEqual(3);
    const c=full.compactions![10]!, position=full.passages.findIndex(p=>p.compactionIds?.includes(c.id));
    const boundary=await app!.history.page(recordingId,{start:position,count:1,step:c.step+1});
    expect(boundary.projection.compactions![0]!.nextReadingId).toBeUndefined(); expect(boundary.projection.context!.latest!.input.tokens).toBe(80000);
    const boundaryId=boundary.projection.compactions![0]!.summaryId!;
    const descriptor=boundary.projection.compactionSummaries!.find(s=>s.id===boundaryId)!;
    expect((await app!.history.artifact(recordingId,descriptor.artifactId!,0,200)).text).toBe('Synthetic summary 10');
    await app!.close(); app=new App(join(dir,'data')); expect(await app.history.page(recordingId,{count:1})).toEqual(page);
    expect((await app.ingest.rescan(recordingId)).added).toBe(0);
  });
  it('explicit rescan backfills additive detail parts without replacing old IDs or duplicating steps',async()=>{
    const path=write([{type:'system',uuid:'b',timestamp:at(0),subtype:'compact_boundary',compactMetadata:{preTokens:80000,postTokens:6000,durationMs:100,trigger:'manual'}}, {type:'user',uuid:'s',parentUuid:'b',isCompactSummary:true,timestamp:at(1),message:{content:'Synthetic summary'}}]);
    const {recordingId}=await app!.ingest.importSource('claude-code',path);
    const old=app!.store.observations(recordingId).filter(o=>o.source.part===0).map(o=>o.id);
    // Simulate an older import, retaining immutable native marker observations.
    app!.store.db.prepare('DELETE FROM observations WHERE recording_id=? AND id NOT IN (?,?)').run(recordingId,...old);
    await app!.close(); app=new App(join(dir,'data'));
    const before=app.projection(recordingId), result=await app.ingest.rescan(recordingId), after=app.projection(recordingId);
    expect(result.added).toBe(2); expect(after.timeline.map(t=>t.id)).toEqual(before.timeline.map(t=>t.id)); expect(after.compactions).toHaveLength(1); expect(after.compactions![0]).toMatchObject({beforeTokens:80000,afterTokens:6000,durationMs:100});
    expect(old.every(id=>app!.store.observations(recordingId).some(o=>o.id===id))).toBe(true); expect((await app.ingest.rescan(recordingId)).added).toBe(0);
  });
});
