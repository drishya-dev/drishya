import {agentDelivery} from '../../packages/adapter-codex/src/agent-delivery.ts';
import type {RealCase} from './types.ts';

export const agentDeliveries:RealCase={
  name:'agent-delivery',about:'Native Codex typed collaboration delivery wrappers and child plaintext',harnesses:['codex'],prefilter:'agent_message',
  scan(row){
    const p=row.payload as Record<string,any>|undefined;
    if(row.type!=='response_item'||p?.type!=='agent_message'||p.author==='/root')return;
    const text=(Array.isArray(p.content)?p.content:[]).filter((c:any)=>c.type==='input_text'||c.type==='output_text').map((c:any)=>c.text??'').join('\n');
    const value=agentDelivery(p,text);return value?{hits:1,only:value.text.trim()?1:0}:undefined;
  },
  verify(p,found){
    const child=p.prose.filter(x=>!x.agentId.endsWith('.agent:main')&&x.role==='assistant');
    const raw=child.filter(x=>/^Message Type: (MESSAGE|FINAL_ANSWER|NEW_TASK)\r?\nTask name:/.test(x.text));
    return [`${found.hits} native deliveries (${found.only} plaintext); ${child.length} captured child prose messages`,...(raw.length?[`FAIL ${raw.length} routing wrappers remain in child prose`]:['PASS no routing wrappers in child prose'])];
  },
};
