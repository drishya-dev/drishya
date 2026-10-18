import {describe,it,expect} from 'vitest';
import type {Operation} from '@drishya/contracts';
import {commandPage,commandCursor} from '../src/commands.ts';
const op=(n:number):Operation=>({agentId:'agent',title:'Command',titleProvenance:{kind:'captured',observationIds:[]},classification:{kind:'derived',rule:'test',observationIds:[]},origin:{type:'native',tool:'exec_command'},paths:[],observationIds:[],id:`cmd-${n}`,kind:'shell',tool:'exec_command',status:n%2?'error':'ok',startSequence:n,detail:{kind:'shell',command:`echo command ${n}`,exitCode:n%2?1:0},artifactIds:[]});
describe('captured command pages',()=>{
  it('reaches every command, pages back symmetrically and keeps an older cursor stable after append',()=>{
    const rows=Array.from({length:71},(_,i)=>op(i));
    const first=commandPage(rows),second=commandPage(rows,{cursor:first.older});
    expect(first.items).toHaveLength(25);expect(first.items[0]!.sequence).toBe(70);
    expect(commandPage(rows,{cursor:second.newer,direction:'newer'}).items).toEqual(first.items);
    const last=commandPage(rows,{cursor:second.older});expect(last.items).toHaveLength(21);expect(last.older).toBeUndefined();
    expect(new Set([...first.items,...second.items,...last.items].map(row=>row.id)).size).toBe(71);
    expect(commandPage([...rows,op(72)],{cursor:first.older}).items).toEqual(second.items);
    expect(commandPage(rows,{status:'error',q:'command 1'}).items.every(row=>row.status==='error'&&row.command.includes('command 1'))).toBe(true);
  });
  it('orders tied sequences without omissions, labels bounded previews and rejects malformed cursors',()=>{
    const rows=Array.from({length:40},(_,i)=>({...op(i),startSequence:0}));
    const first=commandPage(rows),next=commandPage(rows,{cursor:first.older});expect(new Set([...first.items,...next.items].map(row=>row.id)).size).toBe(40);
    const large={...op(1),detail:{kind:'shell' as const,command:'x'.repeat(9000)},artifactIds:['art_cmd-1_input']};
    const row=commandPage([large]).items[0]!;expect(row.command).toHaveLength(4096);expect(row.truncated).toBe(true);expect(row.inputArtifactId).toBe('art_cmd-1_input');
    for(const cursor of ['oops','[-1,"x"]','[0,1]','[0,"x",1]'])expect(()=>commandCursor(cursor)).toThrow();
  });
});
