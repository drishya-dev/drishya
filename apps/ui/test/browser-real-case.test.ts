import {describe,expect,it} from 'vitest';
import {browserOps} from '../../../scripts/real-cases/browser-ops.ts';
describe('real browser evidence case',()=>{
 it('counts native Codex web items and search calls, not tool definitions or quoted output',()=>{
  for(const row of [
   {type:'event_msg',payload:{type:'item_completed',item:{type:'Extension',kind:'web.search'}}},
   {type:'response_item',payload:{type:'web_search_call'}},
   {type:'response_item',payload:{type:'function_call',name:'web_search'}},
   {type:'event_msg',payload:{type:'item_completed',item:{type:'McpToolCall',server:'playwright'}}},
  ])expect(browserOps.scan(row,'codex')).toEqual({hits:1});
  for(const row of [
   {type:'response_item',payload:{type:'function_call_output',output:'web_search_call'}},
   {type:'event_msg',payload:{type:'item_completed',item:{type:'Extension',kind:'image.generation'}}},
   {type:'event_msg',payload:{type:'item_completed',item:{type:'McpToolCall',server:'database'}}},
   {type:'response_item',payload:{type:'message',content:[{type:'input_text',text:'web_search'}]}},
  ])expect(browserOps.scan(row,'codex')).toBeUndefined();
 });
 it('requires actual Claude invocations and fails if no browser/web evidence reaches projection',()=>{
  expect(browserOps.scan({message:{content:[{type:'tool_use',name:'WebFetch'},{type:'tool_use',name:'mcp__Claude_Browser__computer'}]}},'claude-code')).toEqual({hits:2});
  expect(browserOps.scan({message:{content:[{type:'text',text:'WebFetch'}]}},'claude-code')).toBeUndefined();
  expect(browserOps.verify!({operations:[]} as never,{hits:1,only:0}).some(s=>s.startsWith('FAIL'))).toBe(true);
 });
});
