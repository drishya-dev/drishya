import {execFile,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createInterface} from 'node:readline';
import {expect,it} from 'vitest';
import {executable} from '../src/native-executable.ts';

it('reports native Git exit when the running process is aborted',async()=>{
  const bin=executable('git');expect(bin).toBeDefined();
  const dir=mkdtempSync(join(tmpdir(),'drishya-native-git-close-'));
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe native Git fixture');
  try{
    execFileSync(bin!,['init','-q'],{cwd:dir,windowsHide:true});
    const controller=new AbortController();
    let failure:Error|null|undefined;
    const child=execFile(bin!,['cat-file','--batch-check'],{cwd:dir,signal:controller.signal,timeout:3000,windowsHide:true},error=>{failure=error;});
    const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
    const lines=createInterface({input:child.stdout!});
    try{
      await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
      // Wait for Git to read from the repository while keeping the process open for the abort.
      const reply=once(lines,'line').then(([line])=>line as string);
      child.stdin!.write('HEAD\n');
      expect(await Promise.race([reply,closed])).toBe('HEAD missing');
      controller.abort();
      await closed;
      expect(failure).toMatchObject({code:'ABORT_ERR'});
      expect(child.signalCode).toBe('SIGTERM');
    }finally{
      lines.close();
      controller.abort();
      await closed;
    }
  }finally{
    // Windows may hold a transient filesystem handle after Git has exited.
    rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
