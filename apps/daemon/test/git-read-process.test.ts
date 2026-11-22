import {EventEmitter} from 'node:events';
import {expect,it,vi} from 'vitest';
const held=vi.hoisted(()=>({complete:undefined as ((error:Error|null,stdout:string)=>void)|undefined,child:undefined as any}));
vi.mock('../src/native-executable.ts',()=>({executable:()=>process.execPath}));
vi.mock('node:child_process',()=>({execFile:vi.fn((_bin,_args,_options,complete)=>{held.complete=complete;return held.child;})}));
import {readGit} from '../src/git-review.ts';

it('does not release an aborted Git read before the child process closes',async()=>{
  held.child=new EventEmitter();
  let settled=false;
  const result=readGit('/synthetic/root',['rev-parse','HEAD']).then(()=>{settled=true;},error=>{settled=true;return error;});
  held.complete!(Object.assign(Error('Synthetic aborted subprocess'),{code:'ABORT_ERR'}),'');
  await new Promise<void>(resolve=>setImmediate(resolve));
  try{expect(settled).toBe(false);}
  finally{held.child.emit('close',1);await result;}
  expect(await result).toMatchObject({status:422});expect(settled).toBe(true);
});
