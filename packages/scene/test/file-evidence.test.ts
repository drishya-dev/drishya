import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { Operation, Projection, ReplayBundle } from '@drishya/contracts';
import { sinceSnapshot } from '../src/since.ts';
import { fileEvidence, touchedFiles, evidencePath } from '../src/file-evidence.ts';
const base = (JSON.parse(readFileSync(new URL('../../../apps/ui/public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle).projection;
const op = (path: string, kind: Operation['kind']='read', status: Operation['status']='ok', created=false): Operation => ({ ...base.operations[0]!, id: path, kind, status, paths: [{path, role:kind==='read'?'read':'write',basis:'captured'}], detail: kind==='read'?{kind:'read',path,startLine:1,lineCount:1}:{kind:'edit',path,hunks:[],created,reconstruction:'unavailable'} });
const projection = (operations: Operation[]) => ({...base,operations});
describe('file evidence',()=>{
  it('counts captured calls once per path, not references, hits or current Git status',()=>{
    const read=op('src/a.ts');read.paths.push({...read.paths[0]!});
    const p=projection([read,op('src/a.ts','read','error'),op('src/b.ts','edit'),op('src/no.ts','write','error')]);
    expect(fileEvidence(p,['src/a.ts','src/b.ts','src/no.ts','unseen.ts'])).toEqual([
      {path:'src/a.ts',readCalls:2,now:false},
      {path:'src/b.ts',readCalls:0,now:false,change:'E',changeStatus:'ok'},
      {path:'src/no.ts',readCalls:0,now:false},
    ]);
  });
  it('requires recorded creation and preserves it through later edits; empty edits do not mean deleted',()=>{
    const p=projection([op('new.ts','write','ok',true),op('new.ts','edit'),op('empty.ts','edit','unknown'),op('running.ts','write','running',true)]);
    expect(fileEvidence(p,['new.ts','empty.ts','running.ts'])).toEqual([
      {path:'new.ts',readCalls:0,now:false,change:'A',changeStatus:'ok'},
      {path:'empty.ts',readCalls:0,now:false,change:'E',changeStatus:'unknown'},
      {path:'running.ts',readCalls:0,now:true},
    ]);
  });
  it('marks a recorded deletion D; the latest change wins, so a file created again reads A',()=>{
    const del=(path:string)=>{const o=op(path,'edit');return {...o,detail:{...(o.detail as Extract<Operation['detail'],{kind:'edit'}>),deleted:true}} as Operation;};
    const p=projection([op('gone.ts','edit'),del('gone.ts'),del('back.ts'),op('back.ts','write','ok',true),op('brief.ts','write','ok',true),del('brief.ts')]);
    expect(fileEvidence(p,['gone.ts','back.ts','brief.ts']).map(e=>[e.path,e.change])).toEqual([['gone.ts','D'],['back.ts','A'],['brief.ts','D']]);
  });
  it('does not turn failed, pending or empty replacement edits into deletion marks',()=>{
    const del=(path:string,status:Operation['status'])=>{const o=op(path,'edit',status);return {...o,detail:{...(o.detail as Extract<Operation['detail'],{kind:'edit'}>),deleted:true}} as Operation;};
    const p=projection([op('kept.ts','write','ok',true),del('kept.ts','error'),del('failed.ts','error'),del('pending.ts','running'),op('empty.ts','edit')]);
    expect(fileEvidence(p,['kept.ts','failed.ts','pending.ts','empty.ts']).map(e=>[e.path,e.change,e.now])).toEqual([
      ['kept.ts','A',false],['failed.ts',undefined,false],['pending.ts',undefined,true],['empty.ts','E',false],
    ]);
  });

  it('keeps revisions isolated and bounds rows independently of full-session counts',()=>{
    const p=projection(Array.from({length:250},()=>op('old.ts')));
    expect(fileEvidence(p,['old.ts','old.ts'])).toEqual([{path:'old.ts',readCalls:250,now:false}]);
    expect(fileEvidence({...p,operations:[...p.operations,op('old.ts')]},['old.ts'])[0]!.readCalls).toBe(251);
    expect(fileEvidence(p,['other.ts'])).toEqual([]);
  });
  it('uses the same resolved change membership as Review work',()=>{
    const p=projection([op('edited.ts','edit'),op('created.ts','write','ok',true),op('uncertain.ts','edit','unknown'),op('failed.ts','edit','error'),op('pending.ts','edit','running')]);
    const paths=p.operations.flatMap(operation=>operation.paths.map(ref=>ref.path));
    expect(fileEvidence(p,paths).filter(file=>file.change).map(file=>file.path).sort()).toEqual(sinceSnapshot(p,-1).editedFiles.sort());
  });
  it('matches all paged Review files within the repository scope, not only the first fifty',()=>{
    const p=projection([...Array.from({length:120},(_,i)=>op(`src/file-${i}.ts`,'edit')),op('/outside/root.ts','edit')]);
    const pages=Array.from({length:3},(_,page)=>sinceSnapshot(p,-1,page).editedFiles).flat();
    expect(sinceSnapshot(p,-1).editedFileCount).toBe(121);
    expect(fileEvidence(p,pages).filter(e=>e.change).map(e=>e.path).sort()).toEqual(pages.filter(evidencePath).sort());
    expect(fileEvidence(p,pages).filter(e=>e.change)).toHaveLength(120);
  });

  it('aggregates distinct touched files, excludes mentions and unsafe/unresolved locations',()=>{
    const file=(path:string,roles:Projection['files'][number]['roles'])=>({path,roles,firstStep:0,lastStep:1});
    const result=touchedFiles([file('src/a.ts',['read']),file('src/a.ts',['write']),file('src/nested/b.ts',['search-hit']),file('notes.md',['mentioned']),file('/outside.ts',['read']),file('../private',['write'])]);
    expect([...result.paths]).toEqual(['src/a.ts','src/nested/b.ts']);
    expect([...result.folders]).toEqual([['src',2],['src/nested',1]]);
  });
});
