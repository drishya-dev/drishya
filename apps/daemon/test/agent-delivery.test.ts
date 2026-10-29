import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {REDUCER_VERSION} from '../../../packages/projection/src/reduce.ts';
import {legacyAgentDelivery} from '../../../packages/projection/src/agent-delivery.ts';

it('keeps native delivery findings once per child thread, encrypted shells explicit, and parent outcome unchanged',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-delivery-')),app=new App(join(dir,'home'));
  try{
    const rows:any[]=[{type:'session_meta',payload:{cwd:dir}},
      {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Delegate review'}]}},
      {type:'response_item',payload:{type:'function_call',name:'spawn_agent',call_id:'spawn',arguments:JSON.stringify({task_name:'review',message:'Review'})}},
      {type:'event_msg',payload:{type:'item_completed',item:{type:'SubAgentActivity',id:'spawn',agent_path:'/root/review',agent_thread_id:'child-thread',kind:'spawn'}}},
      {type:'response_item',payload:{type:'function_call_output',call_id:'spawn',output:'{"task_name":"review"}'}}];
    const delivery=(id:string,text:string,encrypted=false,sender='/root/review')=>({type:'response_item',payload:{type:'agent_message',id,author:sender,recipient:'/root',content:[{type:'input_text',text:`Message Type: ${text?'FINAL_ANSWER':'MESSAGE'}\nTask name: /root\nSender: ${sender}\nPayload:\n${text}`},...(encrypted?[{type:'encrypted_content',encrypted_content:'never-store-ciphertext'}]:[])]}});
    const body='Captured finding\n'+('long summary\n'.repeat(7000));
    const message=delivery('reply',body);
    rows.push(delivery('encrypted','',true),delivery('empty',''),message,message,delivery('distinct',body),delivery('unknown','Unknown child finding',false,'/root/unknown'));
    const path=join(dir,'rollout.jsonl');writeFileSync(path,rows.map((row,n)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,9,29,0,0,n)).toISOString()})).join('\n')+'\n');
    const id=(await app.ingest.importSource('codex',path)).recordingId,p=app.projection(id),op=p.operations.find(o=>o.detail.kind==='spawn')!;
    expect(p.timeline.filter(t=>t.type==='turn')).toHaveLength(1);
    expect(p.prose.some(x=>x.text.includes('Message Type:'))).toBe(false);
    expect(p.prose.filter(x=>x.agentId.endsWith('agent:review'))).toHaveLength(2);
    expect(p.prose.some(x=>x.agentId.endsWith('agent:unknown')&&x.text==='Unknown child finding')).toBe(true);
    expect(p.turns?.some(t=>t.outcome==='completed')).toBeFalsy();
    const thread=await app.history.delegationThread(id,op.id);
    expect(thread?.steps.filter(s=>s.label.includes('encrypted'))).toHaveLength(1);
    expect(thread?.steps.filter(s=>s.label.includes('no payload'))).toHaveLength(1);
    expect(thread?.steps.filter(s=>s.kind==='completed')).toHaveLength(0);
    const messages=thread!.steps.filter(s=>s.text);expect(messages).toHaveLength(2);
    expect(messages[0]?.truncated).toBe(true);expect(messages[0]?.artifactId).toBeTruthy();
    const artifact=await app.history.artifact(id,messages[0]!.artifactId!,0,10000);expect(artifact.text).toBe(body);
    expect(JSON.stringify(app.store.observationsOfKinds(id,['message.assistant']))).not.toContain('never-store-ciphertext');
    const before=await app.history.delegationThread(id,op.id,0,op.startSequence+1);expect(before?.steps.some(s=>s.kind==='message')).toBe(false);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

it('rebuilds an already imported legacy capture without rewriting sealed bytes or losing its original artifact',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-legacy-delivery-'));let app=new App(join(dir,'home'));
  try{
    const wrapper='Message Type: FINAL_ANSWER\nTask name: /root\nSender: /root/review\nPayload:\nCaptured legacy finding';
    const path=join(dir,'rollout.jsonl');writeFileSync(path,[
      {type:'session_meta',payload:{cwd:dir}},
      {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:wrapper}]}},
      {type:'response_item',payload:{type:'agent_message',author:'/root/review',content:[{type:'output_text',text:wrapper}]}},
    ].map(row=>JSON.stringify(row)).join('\n')+'\n');
    const id=(await app.ingest.importSource('codex',path)).recordingId;
    const stored=app.store.observationsOfKinds(id,['message.assistant'])[0]!;
    expect(stored.payload).not.toHaveProperty('delivery');
    expect(legacyAgentDelivery(stored,wrapper,'/root/another/review')).toBeUndefined();
    expect(legacyAgentDelivery({...stored,agentId:'agent:unknown'},wrapper)).toBeUndefined();
    expect(legacyAgentDelivery({...stored,source:{...stored.source,adapterId:'claude-code'}},wrapper)).toBeUndefined();
    const originalBody=JSON.stringify(stored);
    const prior=app.projection(id);app.store.putProjection(id,'r22',prior.observationCount,JSON.stringify({...prior,reducerVersion:'r22',prose:[]}));
    await app.close();app=new App(join(dir,'home'));
    const projected=app.projection(id),message=projected.prose[0]!;
    expect(projected.reducerVersion).toBe(REDUCER_VERSION);expect(message.text).toBe('Captured legacy finding');expect(message.agentId.endsWith('agent:review')).toBe(true);
    expect(projected.timeline.find(t=>t.type==='turn')).toMatchObject({prompt:wrapper});
    expect(JSON.stringify(app.store.observationById(id,stored.id))).toBe(originalBody);
    const artifact=await app.history.artifact(id,`art_${message.id}_prose`,0,100);
    expect(artifact.text).toBe(wrapper);expect(projected.artifacts[0]?.note).toContain('routing wrapper omitted');
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
