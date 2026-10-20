import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {sessionLinks} from '../src/git-session-links.ts';
let dir:string,app:App,id:string;
const made='3f2a9c1e5b7d4a6c8e0f1a2b3c4d5e6f708192a3',seen='9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3',absent='0123456789abcdef0123456789abcdef01234567';
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-git-links-'));app=new App(join(dir,'store'));
  const t=(n:number)=>`2026-10-20T10:0${n}:00Z`,call=(n:number,cmd:string,output:string)=>[{type:'response_item',timestamp:t(n),payload:{type:'function_call',name:'exec_command',call_id:`c${n}`,arguments:JSON.stringify({cmd})}},{type:'response_item',timestamp:t(n),payload:{type:'function_call_output',call_id:`c${n}`,output}}];
  const rows=[{type:'session_meta',timestamp:t(0),payload:{id:'g',cwd:dir}},{type:'event_msg',timestamp:t(1),payload:{type:'task_started',turn_id:'a'}},
    {type:'event_msg',timestamp:t(2),payload:{type:'task_started',turn_id:'b'}},...call(2,'git commit -m fix',`[main ${made.slice(0,7)}] fix cart\n 1 file changed`),
    ...call(3,'git log --oneline',`${seen.slice(0,7)} older commit by someone else`)];
  const path=join(dir,'g.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');id=(await app.ingest.importSource('codex',path)).recordingId;
});
afterAll(async()=>{if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

it('links a commit to the first captured output that shows its hash, with the turn',()=>{
  const links=sessionLinks(app.store,id,[made,seen,absent]);
  expect(links[made]).toMatchObject({turn:2,time:'2026-10-20T10:02:00Z'});expect(links[made]!.observationId).toBeTruthy();
  expect(links[seen]).toBeDefined();
  expect(links[absent]).toBeUndefined();
});
it('never links a combined recording, and ignores prose and calls',()=>{expect(sessionLinks(app.store,'a+b',[made])).toEqual({});});
