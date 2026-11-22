import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {App} from '../src/app.ts';

let app:App|undefined,dir:string|undefined;
afterEach(async()=>{await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe history fixture');rmSync(dir,{recursive:true,force:true});}});

it('loads the visible extracted action for a wrapper receipt outside the resident page',async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-wrapper-search-'));app=new App(join(dir,'data'));
  const rows:unknown[]=[{type:'session_meta',payload:{id:'synthetic-wrapper-search',cwd:dir}}];
  for(let n=0;n<80;n++){
    rows.push({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:`Synthetic prompt ${n}`}]}});
    rows.push({type:'response_item',payload:{type:'function_call',name:n===1?'exec':'functions.exec_command',call_id:`call-${n}`,arguments:JSON.stringify(n===1?{code:'text(await tools.exec_command({cmd:"echo child"}));'}:{cmd:`echo synthetic-${n}`})}});
    if(n===1)rows.push({type:'event_msg',payload:{type:'item_completed',thread_id:'synthetic',turn_id:'turn',item:{type:'CommandExecution',id:'child',command:['pwsh','-Command','echo child'],cwd:dir,status:'completed',exit_code:0,aggregated_output:'child output'}}});
    rows.push({type:'response_item',payload:{type:'function_call_output',call_id:`call-${n}`,output:n===1?'synthetic-wrapper-receipt-needle':`output-${n}`}});
  }
  const path=join(dir,'source.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  const id=(await app.ingest.importSource('codex',path)).recordingId;
  const hit=app.store.search(id,'synthetic-wrapper-receipt-needle',50)[0]!;
  expect(hit).toBeDefined();
  const whole=app.projection(id),wrapper=whole.operations.find(op=>op.observationIds.includes(hit.observationId))!;
  const child=whole.operations.find(op=>op.parentOperationId===wrapper.id)!;
  expect(child).toBeDefined();
  const tail=await app.history.page(id,{count:2});
  expect(tail.projection.operations.some(op=>op.id===child.id)).toBe(false);
  const found=await app.history.page(id,{observationId:hit.observationId,count:2});
  expect(found.projection.operations.some(op=>op.id===child.id)).toBe(true);
  expect(found.scene.passages.some(ps=>ps.ops.some(op=>op.id===child.id))).toBe(true);
});
