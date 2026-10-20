import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { Operation, Projection, ReplayBundle } from '@drishya/contracts';
import { fileEvidence, touchedFiles } from '../src/file-evidence.ts';
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
  it('keeps revisions isolated and bounds rows independently of full-session counts',()=>{
    const p=projection(Array.from({length:250},()=>op('old.ts')));
    expect(fileEvidence(p,['old.ts','old.ts'])).toEqual([{path:'old.ts',readCalls:250,now:false}]);
    expect(fileEvidence({...p,operations:[...p.operations,op('old.ts')]},['old.ts'])[0]!.readCalls).toBe(251);
    expect(fileEvidence(p,['other.ts'])).toEqual([]);
  });
  it('aggregates distinct touched files, excludes mentions and unsafe/unresolved locations',()=>{
    const file=(path:string,roles:Projection['files'][number]['roles'])=>({path,roles,firstStep:0,lastStep:1});
    const result=touchedFiles([file('src/a.ts',['read']),file('src/a.ts',['write']),file('src/nested/b.ts',['search-hit']),file('notes.md',['mentioned']),file('/outside.ts',['read']),file('../private',['write'])]);
    expect([...result.paths]).toEqual(['src/a.ts','src/nested/b.ts']);
    expect([...result.folders]).toEqual([['src',2],['src/nested',1]]);
  });
});
