import { describe, expect, it } from 'vitest';
import type { Operation } from '@drishya/contracts';
import { browserStep, groupBrowserSteps, safeWebUrl } from '../src/lib/browser-evidence.ts';
const op = (id: string, server = 'Claude_Browser', tool = 'computer', input: unknown = { action: 'scroll' }): Operation => ({id,agentId:'a',detail:{kind:'mcp',server,tool,input}} as Operation);
describe('captured browser presentation', () => {
 it('recognizes browser tools without interpreting generic MCP or scripts', () => {
  expect(browserStep(op('1'))?.action).toBe('scroll');
  expect(browserStep(op('1','database','find'))).toBeUndefined();
  expect(browserStep(op('1','browser','exec_command'))).toBeUndefined();
  expect(browserStep(op('1','browser','navigate', 'const url="https://invented.invalid"'))?.url).toBeUndefined();
  expect(browserStep(op('1','playwright','browser_navigate','{"url":"https://captured.invalid"}'))?.url).toBe('https://captured.invalid');
 });
 it('retains batch actions and limits presentation without dropping raw input', () => {
  const input={actions:Array.from({length:20},(_,i)=>({name:'computer',input:{action:`step ${i}`}}))};
  const item=op('1','Claude_Browser','browser_batch',input), step=browserStep(item)!;
  expect(step.batch).toHaveLength(12);expect(step.batchCount).toBe(20);expect(step.batch![0]?.action).toBe('step 0');expect(item.detail.kind==='mcp'&&item.detail.input).toBe(input);
 });
 it('groups only adjacent same-agent/server evidence and preserves every original slot', () => {
  const all=[op('1'),op('2'),op('3','database'),op('4'),{...op('5'),agentId:'b'},op('6','Playwright')];
  const slots=all.map(o=>({id:o.id})), groups=groupBrowserSteps(slots,new Map(all.map(o=>[o.id,o])));
  expect(groups.map(g=>g.map(o=>o.id))).toEqual([['1','2'],['3'],['4'],['5'],['6']]);
  expect(groups.flat()).toEqual(slots);
  expect(groupBrowserSteps([{id:'1'},{id:'missing'},{id:'2'}],new Map(all.map(o=>[o.id,o]))).map(g=>g.length)).toEqual([1,1,1]);
 });
 it('keeps a matching tool visible when adjacent browser steps are filtered out', () => {
  const all=[op('1'),op('2'),op('3')];
  const groups=groupBrowserSteps([{id:'1',matchesFilter:false},{id:'2',matchesFilter:false},{id:'3',matchesFilter:true}],new Map(all.map(o=>[o.id,o])));
  expect(groups.map(g=>g.map(item=>item.id))).toEqual([['1','2'],['3']]);
 });
 it('never carries a previous URL onto a step that did not capture it', () => {
  expect(browserStep(op('1','Claude_Browser','navigate',{url:'https://captured.invalid'}))?.url).toBeDefined();
  expect(browserStep(op('2'))?.url).toBeUndefined();
 });
 it('keeps unsafe and credential-bearing URLs inert', () => {
  for(const url of ['javascript:alert(1)','file:///secret','//relative.invalid','https://','https://user:pass@example.invalid'])expect(safeWebUrl(url)).toBe(false);
  expect(safeWebUrl('https://example.invalid/?q=test')).toBe(true);
 });
});
