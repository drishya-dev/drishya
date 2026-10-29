import {expect,it} from 'vitest';
import {agentDelivery} from '../src/agent-delivery.ts';
import {createParser} from '../src/index.ts';

const envelope=(text='',type='MESSAGE')=>`Message Type: ${type}\nTask name: /root\nSender: /root/review\nPayload:\n${text}`;
const payload=(text='',type='MESSAGE')=>({type:'agent_message',id:'native-delivery',author:'/root/review',recipient:'/root',content:[{type:'input_text',text:envelope(text,type)}]});
it('extracts only the outer typed wrapper and preserves quoted, nested and adjacent material verbatim',()=>{
  const text=`A quoted report:\n\`\`\`\n${envelope('nested')}\n\`\`\`\n${envelope('adjacent')}`;
  expect(agentDelivery(payload(),envelope(text))?.text).toBe(text);
  expect(agentDelivery(payload(),envelope(text,'FINAL_ANSWER'))?.delivery.type).toBe('FINAL_ANSWER');
});
it('requires native type and matching sender/recipient, and leaves ordinary quoted user text intact',()=>{
  for(const p of [{...payload(),type:'message',role:'user'},{...payload(),author:'/root/other'},{...payload(),recipient:'/root/other'}, {...payload(),recipient:undefined}])expect(agentDelivery(p,envelope('kept'))).toBeUndefined();
  const parser=createParser({recordingId:'r',sourceId:'s',sourcePath:'x'});
  const quoted=envelope('user quotation');
  expect(parser.parse({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:quoted}]}})[0]?.payload.text).toBe(quoted);
});
it('records empty, encrypted and partial states without exposing ciphertext or inventing completion',()=>{
  expect(agentDelivery(payload(),envelope())?.delivery.state).toBe('empty');
  const p={...payload(),content:[...payload().content,{type:'encrypted_content',text:'private-ciphertext'}]};
  expect(agentDelivery(p,envelope())?.delivery.state).toBe('encrypted');
  expect(agentDelivery(p,envelope('visible'))?.delivery.state).toBe('partial');
  expect(JSON.stringify(agentDelivery(p,envelope()))).not.toContain('private-ciphertext');
});
it('retains complete long summaries and unknown native senders as captured metadata',()=>{
  const text='long captured summary\n'.repeat(12000),p=payload(text,'FINAL_ANSWER');
  p.author='/root/unknown';p.content[0]!.text=envelope(text,'FINAL_ANSWER').replace('Sender: /root/review','Sender: /root/unknown');
  expect(agentDelivery(p,p.content[0]!.text)).toMatchObject({text,delivery:{sender:'/root/unknown',nativeId:'native-delivery',state:'complete'}});
});
