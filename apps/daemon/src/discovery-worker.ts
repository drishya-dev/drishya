import {parentPort,workerData} from 'node:worker_threads';
import {claudeAdapter} from '../../../packages/adapter-claude/src/index.ts';
import {codexAdapter} from '../../../packages/adapter-codex/src/index.ts';
import {sanitize} from '@drishya/privacy';
import type {DiscoveryResult} from './discovery.ts';

const results:DiscoveryResult[]=[];
for(const adapter of [claudeAdapter,codexAdapter]){
  if(!(workerData.ids as string[]).includes(adapter.descriptor.id))continue;
  try{results.push({id:adapter.descriptor.id,sources:await adapter.discover()});}
  catch(error){
    const code=(error as NodeJS.ErrnoException)?.code;
    results.push({id:adapter.descriptor.id,error:{...(typeof code==='string'?{code}:{}),message:sanitize(error instanceof Error?error.message:'Source could not be read').value}});
  }
}
parentPort!.postMessage(results);
parentPort!.close();
