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
 it('takes the URL from returned page text when the input omitted one, labelled from result', () => {
  const step = browserStep({
    id: 'g1',
    agentId: 'a',
    detail: {
      kind: 'mcp',
      server: 'Claude_Browser',
      tool: 'get_page_text',
      input: { max_chars: 12000 },
      resultPreview: 'Title: RouteLab | Delivery planning\nURL: http://127.0.0.1:8501/\nSource element: <main>\n---\n\nTab Context:\n- url: https://other.invalid/',
    },
  } as Operation)!;
  expect(step.url).toBe('http://127.0.0.1:8501/');
  expect(step.urlFromResult).toBe(true);
  const direct = browserStep(op('g2', 'Claude_Browser', 'get_page_text', { url: 'https://explicit.invalid/' }))!;
  expect(direct.url).toBe('https://explicit.invalid/');
  expect(direct.urlFromResult).toBe(false);
  const unsafe = browserStep({
    id: 'g3',
    agentId: 'a',
    detail: {
      kind: 'mcp',
      server: 'Claude_Browser',
      tool: 'get_page_text',
      input: {},
      resultPreview: 'Title: Bad\nURL: javascript:alert(1)\n---',
    },
  } as Operation)!;
  expect(unsafe.url).toBeUndefined();
  expect(unsafe.urlFromResult).toBe(false);
  const tabOnly = browserStep({
    id: 'g4',
    agentId: 'a',
    detail: {
      kind: 'mcp',
      server: 'Claude_Browser',
      tool: 'get_page_text',
      input: {},
      resultPreview: 'Title: Plain\n---\n\nTab Context:\nURL: https://later.invalid/',
    },
  } as Operation)!;
  expect(tabOnly.url).toBeUndefined();
 });
 it('keeps unsafe and credential-bearing URLs inert', () => {
  for(const url of ['javascript:alert(1)','file:///secret','//relative.invalid','https://','https://user:pass@example.invalid'])expect(safeWebUrl(url)).toBe(false);
  expect(safeWebUrl('https://example.invalid/?q=test')).toBe(true);
 });
});


describe('recorded Antigravity native browser scripts', () => {
 const native = (id: string, input: unknown): Operation => ({ id, agentId: 'a', tool: 'webview_browser', detail: { kind: 'other', input, resultPreview: 'Captured browser result' } } as Operation);
 it('uses native script evidence without inventing MCP identity or executing/interpreting code', () => {
  const input = { intention: 'Captured instruction', observation: 'Model-authored observation', script: 'throw new Error("never execute"); /* click https://invented.invalid */', urls: ['http://127.0.0.1:4317/'] };
  const operation = native('a', input), step = browserStep(operation)!;
  expect(step.server).toBe('webview_browser'); expect(step.action).toBe('Run browser script');
  expect(step.url).toBe('http://127.0.0.1:4317/'); expect(step.query).toBeUndefined();
  expect(step.excerpt).toBe('Captured browser result'); expect(operation.detail.kind).toBe('other');
  expect(operation.detail.kind === 'other' && operation.detail.input).toBe(input);
 });
 it('does not borrow a URL from script text, a prior action, or choose among several declared pages', () => {
  expect(browserStep(native('a',{script:'location.href="https://invented.invalid"'}))?.url).toBeUndefined();
  expect(browserStep(native('b',{script:'return 3',urls:['https://one.invalid','https://two.invalid']}))?.url).toBeUndefined();
  const value=browserStep(native('c',{script:'return 3',urls:['javascript:alert(1)']}))!;
  expect(safeWebUrl(value.url!)).toBe(false);
 });
 it('groups adjacent native script receipts without merging their input or result material', () => {
  const all=[native('a',{script:'first'}),native('b',{script:'second'}),op('c')];
  expect(groupBrowserSteps(all.map(o=>({id:o.id})),new Map(all.map(o=>[o.id,o]))).map(g=>g.map(o=>o.id))).toEqual([['a','b'],['c']]);
 });
});
