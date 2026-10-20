import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Operation, Projection, ReplayBundle } from '@drishya/contracts';
import { readingTarget } from '../src/reading-target.ts';
const base=(JSON.parse(readFileSync(new URL('../../../apps/ui/public/demo/bundle.json',import.meta.url),'utf8')) as ReplayBundle).projection;
const op=(id:string,step:number,kind:Operation['kind']='read',status:Operation['status']='ok'):Operation=>({...base.operations[0]!,id,startSequence:step,kind,status});
const p:Projection={...base,operations:[op('read',1),op('edit',3,'edit'),op('bad',5,'shell','error'),op('write',8,'write'),op('last',11)],timeline:[{type:'turn',id:'turn-1',agentId:'main',sequence:10,prompt:'First'},{type:'op-start',id:'start',agentId:'main',sequence:11,operationId:'read'},{type:'turn',id:'turn-1',agentId:'main',sequence:100,prompt:'Second'}]};
describe('whole-history reading cursors',()=>{
  it('moves in captured timeline positions, not observation sequence, and never wraps',()=>{
    expect(readingTarget(p,{kind:'operation',direction:1,from:'read'})).toEqual({type:'operation',id:'edit',step:3});
    expect(readingTarget(p,{kind:'operation',direction:-1,from:'edit'})).toEqual({type:'operation',id:'read',step:1});
    expect(readingTarget(p,{kind:'operation',direction:-1,from:'read'})).toBeNull();
    expect(readingTarget(p,{kind:'operation',direction:1,from:'last'})).toBeNull();
    expect(readingTarget(p,{kind:'turn',direction:1,at:0})).toEqual({type:'turn',step:2});
    expect(readingTarget(p,{kind:'turn',direction:-1,at:2})).toEqual({type:'turn',step:0});
  });
  it('supports edit/write, failures and absolute edges across unloaded operations',()=>{
    expect(readingTarget(p,{kind:'edit',direction:1,from:'edit'})?.id).toBe('write');
    expect(readingTarget(p,{kind:'edit',direction:-1,from:'write'})?.id).toBe('edit');
    expect(readingTarget(p,{kind:'failure',direction:1,from:'read'})?.id).toBe('bad');
    expect(readingTarget(p,{kind:'operation',direction:1,edge:'first'})?.id).toBe('read');
    expect(readingTarget(p,{kind:'operation',direction:1,edge:'last'})?.id).toBe('last');
  });
  it('respects source filters and reports no target without guessing',()=>{
    expect(readingTarget(p,{kind:'operation',direction:1,operationKind:'write'})?.id).toBe('write');
    expect(readingTarget(p,{kind:'operation',direction:1,agent:'missing'})).toBeNull();
    expect(readingTarget(p,{kind:'operation',direction:1,server:'missing'})).toBeNull();
    expect(readingTarget({...p,operations:[],timeline:[]},{kind:'turn',direction:1})).toBeNull();
  });
  it('does not reuse an old cursor index after a capture revision',()=>{
    expect(readingTarget(p,{kind:'operation',direction:1,from:'last'})).toBeNull();
    expect(readingTarget({...p,operations:[...p.operations,op('new',12)]},{kind:'operation',direction:1,from:'last'})?.id).toBe('new');
  });
});
