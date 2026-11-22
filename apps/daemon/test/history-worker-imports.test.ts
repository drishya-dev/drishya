import {Worker} from 'node:worker_threads';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect,it} from 'vitest';
import {Store} from '@drishya/store';
import {defaultAdapters} from '@drishya/ingest';

it('starts read-only history without loading native journal parser modules',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-reader-imports-')),log=join(dir,'native-parser-imports.txt'),hook=join(dir,'imports.mjs');
  new Store(dir).close();
  writeFileSync(hook,`import {registerHooks} from 'node:module';import {appendFileSync} from 'node:fs';registerHooks({resolve(specifier,context,next){if(/adapter-(claude|codex|antigravity)/.test(specifier))appendFileSync(${JSON.stringify(log)},'native parser import\\n');return next(specifier,context);}});`);
  const worker=new Worker(new URL('../src/history-worker.ts',import.meta.url),{workerData:{dir,adapters:Object.fromEntries(defaultAdapters().map(adapter=>[adapter.descriptor.id,adapter.descriptor]))},execArgv:['--import',pathToFileURL(hook).href]});
  try{
    const reply=await new Promise<{value?:unknown;error?:string}>((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);worker.postMessage({id:1,method:'diagnostic-sqlite',args:{}});});
    expect(reply.error).toBeUndefined();expect(reply.value).toBeDefined();
    expect(existsSync(log)?readFileSync(log,'utf8').split('\n').filter(Boolean).length:0).toBe(0);
  }finally{await worker.terminate();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe worker fixture');rmSync(dir,{recursive:true,force:true});}
});
