import {execFile,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,it} from 'vitest';
import {executable} from '../src/native-executable.ts';

it('an aborted resolved Git process releases its repository when close is delivered',async()=>{
  const bin=executable('git');expect(bin).toBeDefined();
  const dir=mkdtempSync(join(tmpdir(),'drishya-native-git-close-'));
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe native Git fixture');
  try{
    execFileSync(bin!,['init','-q'],{cwd:dir,windowsHide:true});
    const controller=new AbortController();
    let failure:Error|null|undefined;
    const child=execFile(bin!,['hash-object','--stdin'],{cwd:dir,signal:controller.signal,windowsHide:true},error=>{failure=error;});
    const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
    try{
      await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
      // Hold stdin open through startup so abort exercises the Git process.
      await new Promise<void>(resolve=>setTimeout(resolve,35));
      controller.abort();await closed;
      expect(failure).toMatchObject({code:'ABORT_ERR'});
      expect(()=>rmSync(dir,{recursive:true,force:true})).not.toThrow();
    }finally{
      child.stdin?.end();controller.abort();await closed;
    }
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
