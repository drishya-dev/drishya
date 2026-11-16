import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import type {Observation} from '@drishya/contracts';
import {seal} from '@drishya/capture-core';
import {codexAdapter} from '../../adapter-codex/src/index.ts';
import {reduce} from '../src/reduce.ts';
import {relativize} from '../src/paths.ts';

const options={adapters:{codex:codexAdapter.descriptor}};
const io={get:()=>undefined,put:(text:string)=>({sha:createHash('sha256').update(text).digest('hex'),bytes:text.length})};
const prefix=(root:string)=>'worktree-'+createHash('sha256').update(root.replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase()).digest('hex').slice(0,10);
function row(seq:number,kind:Observation['kind'],payload:Record<string,unknown>,workspaceRoot='C:/repo'):Observation {
 return {...seal({raw:{part:0,recordId:`row-${seq}`,agentId:'agent:main',kind,payload,workspaceRoot,operationId:`op-${seq}`},recordingId:'r',sourceId:'s',generation:0,byteOffset:seq,adapter:codexAdapter.descriptor,observedAt:'2026-11-08T00:00:00Z'}),receivedSequence:seq};
}
const meta=(seq:number,cwd:string)=>row(seq,'session.meta',{cwd},cwd);
const read=(seq:number,path:string,cwd='C:/repo',operationCwd?:string)=>row(seq,'tool.call',{tool:'read_file',intent:{kind:'read',path,...(operationCwd?{cwd:operationCwd}:{})}},cwd);
const write=(seq:number,path:string,cwd:string)=>row(seq,'tool.call',{tool:'write_file',intent:{kind:'write',path,content:'// synthetic'}},cwd);
const project=(rows:Observation[])=>reduce('r',rows,io,options);

describe('exact recorded working-directory boundaries (FILES-14)',()=>{
 it('retains relative locations for POSIX and Windows roots with trailing separators',()=>{
  expect(relativize('/repo/src/a.ts','/repo///')).toBe('src/a.ts');
  expect(relativize('C:\\Repo\\src\\a.ts','c:/repo///')).toBe('src/a.ts');
  expect(relativize('/document.md','/')).toBe('document.md');
 });
 it('separates nested and sibling edits with the same filename from primary files',()=>{
  const nested='C:/repo/.local/wt-docs',sibling='C:/sibling';
  const p=project([meta(0,'C:/repo'),write(1,'docs/TASKS.md','C:/repo'),meta(2,nested),write(3,'docs/TASKS.md',nested),meta(4,sibling),write(5,'docs/TASKS.md',sibling)]);
  expect(p.files.map(file=>file.path).sort()).toEqual(['C:/repo',nested,sibling].map(root=>`${prefix(root)}/docs/TASKS.md`).sort());
  expect(p.workspaceRoot).toBeUndefined();
 });
 it('uses an operation cwd before assigning relative paths and normalizes parent segments',()=>{
  const nested='C:/repo/.local/wt-docs';
  const p=project([meta(0,'C:/repo'),read(1,'docs/../same.ts','C:/repo',nested),read(2,'same.ts')]);
  expect(p.operations.map(op=>op.paths[0]?.path)).toEqual([`${prefix(nested)}/same.ts`,`${prefix('C:/repo')}/same.ts`]);
 });
 it('uses the deepest evidenced boundary even for an absolute path observed from the primary cwd',()=>{
  const nested='C:/repo/.local/wt-docs';
  const p=project([meta(0,'C:/repo'),meta(1,nested),read(2,`${nested}/docs/TASKS.md`),read(3,`${nested}/../scratch.ts`)]);
  expect(p.files.map(file=>file.path).sort()).toEqual([`${prefix(nested)}/docs/TASKS.md`,`${prefix('C:/repo')}/.local/scratch.ts`].sort());
 });
 it('preserves ordinary folder names without captured directory evidence and folds Windows root aliases',()=>{
  const p=project([meta(0,'C:/repo'),meta(1,'c:\\REPO\\'),read(2,'.local/wt-docs/same.ts')]);
  expect(p.files.map(file=>file.path)).toEqual(['.local/wt-docs/same.ts']);
  expect(p.workspaceRoot?.replace(/\\/g,'/').toLowerCase().replace(/\/+$/,'')).toBe('c:/repo');
 });
 it('keeps unrelated absolute paths unresolved instead of assigning a nearby directory',()=>{
  const p=project([meta(0,'C:/repo'),meta(1,'C:/repo/nested'),read(2,'C:/unrecorded/same.ts')]);
  expect(p.operations.map(op=>op.paths.map(ref=>ref.path))).toEqual([['C:/unrecorded/same.ts']]);
  expect(p.files).toEqual([]);
 });
});
