import {describe,it,expect} from 'vitest';
import {contentParity} from '../../../scripts/real-cases/content-parity.ts';

describe('genuine content parity inventory',()=>{
 it.each(['function_call','custom_tool_call','local_shell_call'])('counts native Codex %s records',type=>{
  expect(contentParity.scan({type:'response_item',payload:{type}},'codex')).toEqual({hits:1});
 });
 it('does not count tool names quoted in messages, outputs or malformed records',()=>{
  for(const row of [
   {type:'event_msg',payload:{type:'function_call'}},
   {type:'response_item',payload:{type:'function_call_output',output:'function_call custom_tool_call local_shell_call'}},
   {type:'response_item',payload:{type:'message',content:[{type:'output_text',text:'function_call'}]}},
   {type:'response_item'},
  ])expect(contentParity.scan(row,'codex')).toBeUndefined();
 });
 it('counts Claude tool blocks while excluding quoted and returned tool mentions',()=>{
  expect(contentParity.scan({message:{content:[{type:'tool_use'},{type:'text',text:'tool_use'},{type:'tool_result',content:'tool_use'},{type:'tool_use'}]}},'claude-code')).toEqual({hits:2});
  expect(contentParity.scan({message:{content:'tool_use'}},'claude-code')).toBeUndefined();
 });
 it('keeps every supported Codex record eligible for the cheap prefilter',()=>{
  for(const type of ['function_call','custom_tool_call','local_shell_call']){
   const line=JSON.stringify({type:'response_item',payload:{type}});
   expect(line.includes((contentParity.prefilter as Record<string,string>).codex!)).toBe(true);
  }
 });
});
