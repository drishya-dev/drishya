import {appendFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {recordedFileRoots} from '../src/file-roots.ts';

it('rebuilds live paths when an operation records a descendant cwd and masks all captured roots on export',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'drishya-files14-'));
 const app=new App(join(dir,'data'));
 let fresh:App|undefined;
 try {
  const primary='C:/synthetic-primary',nested=primary+'/.local/wt-docs',sibling='C:/synthetic-sibling';
  const prefix=(root:string)=>'worktree-'+createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0,10);
  const journal=join(dir,'session.jsonl');
  const rows=[
   {type:'session_meta',payload:{id:'files14',cwd:primary}},
   {type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'main',arguments:JSON.stringify({cmd:'cat same.ts'})}},
   {type:'response_item',payload:{type:'function_call_output',call_id:'main',output:'// main'}},
   {type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'nested',arguments:JSON.stringify({cmd:'cat same.ts',workdir:nested})}},
   {type:'response_item',payload:{type:'function_call_output',call_id:'nested',output:'// nested'}},
   {type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'sibling',arguments:JSON.stringify({cmd:'cat same.ts',workdir:sibling})}},
   {type:'response_item',payload:{type:'function_call_output',call_id:'sibling',output:'// sibling'}},
  ].map((row,i)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,10,8,0,0,i)).toISOString()})+'\n');
  writeFileSync(journal,rows.slice(0,3).join(''));
  const id=(await app.ingest.importSource('codex',journal)).recordingId;
  expect((await app.history.page(id,{count:20})).projection.operations.flatMap(op=>op.paths.map(p=>p.path))).toEqual(['same.ts']);
  expect((await recordedFileRoots(app.store,[id])).roots).toHaveLength(1);
  appendFileSync(journal,rows.slice(3).join(''));
  await app.ingest.importSource('codex',journal);
  const live=await app.history.page(id,{count:20});
  const expected=[primary,nested,sibling].map(root=>prefix(root)+'/same.ts').sort();
  expect(live.projection.operations.flatMap(op=>op.paths.map(p=>p.path)).sort()).toEqual(expected);
  expect(app.projection(id).files.map(file=>file.path).sort()).toEqual(expected);
  const metadata=await recordedFileRoots(app.store,[id]);
  expect(metadata.roots.map(root=>root.prefix).sort()).toEqual([primary,nested,sibling].map(prefix).sort());
  expect(metadata.roots.map(root=>root.root).sort()).toEqual([primary,nested,sibling].sort());
  fresh=new App(join(dir,'fresh'));
  const freshId=(await fresh.ingest.importSource('codex',journal)).recordingId;
  const fromScratch=await fresh.history.page(freshId,{count:20});
  expect(fromScratch.projection.operations.flatMap(op=>op.paths.map(p=>p.path)).sort()).toEqual(expected);
  expect(app.store.workspaceRoots(id).sort()).toEqual([primary,nested,sibling].sort());
  const exported=JSON.stringify(await app.exportBundle(id));
  for(const root of [primary,nested,sibling]) expect(exported).not.toContain(root);
  expect(exported).not.toContain('.local/wt-docs');
 } finally {
  await fresh?.close();await app.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe temporary cleanup');
  rmSync(dir,{recursive:true,force:true});
 }
});
