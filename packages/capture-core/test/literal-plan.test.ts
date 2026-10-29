import { expect, it } from 'vitest';
import { literalPlan, literalPlanConfirmed } from '../src/literal-plan.ts';

const request = JSON.stringify({ plan: [{ step: 'Literal ) text\nnext', status: 'in_progress' }] });
it('requires the native empty-object acknowledgement rather than an outer wrapper success', () => {
  expect(literalPlanConfirmed('{}')).toBe(true);
  expect(literalPlanConfirmed('Chunk ID: synthetic\nWall time: 0.1 seconds\nOutput:\n\n{}')).toBe(true);
  for (const value of [undefined, 'Plan updated', '{"isError":true}', '{"error":"denied"}', 'null', '[]', '{"content":[{"type":"text","text":"Error"}]}']) expect(literalPlanConfirmed(value)).toBe(false);
  for (const value of ['nested failure\nOutput:\n{}', 'Output:\n{}', 'Wall time: 0.1 seconds\nOutput:\nOutput:\n{}', 'Wall time: 0.1 seconds\nProcess exited with code 1\nOutput:\n{}']) expect(literalPlanConfirmed(value)).toBe(false);
});
it('decodes one awaited JSON plan call and preserves literal text/status', () => {
  for (const source of [`await tools.update_plan(${request});`, `text(await tools.update_plan(${request}));`]) {
    expect(literalPlan(source)).toEqual([{ text: 'Literal ) text\nnext', status: 'in_progress' }]);
  }
  expect(literalPlan('await tools.update_plan({"plan":[]})')).toEqual([]);
});
it('never executes or promotes dynamic, deferred, mixed or malformed scripts', () => {
  for (const source of [
    `if (false) await tools.update_plan(${request});`,
    `() => tools.update_plan(${request})`,
    `await tools.update_plan(${request}); await tools.update_plan(${request});`,
    `text(await tools.update_plan(${request})); throw new Error('later')`,
    'const rows = []; await tools.update_plan({plan: rows})',
    'await tools.update_plan({"plan":[{"step":danger(),"status":"pending"}]})',
    'await tools.update_plan({"plan":[{"step":"x"}]})',
    'await tools.update_plan({"plan":[],"unrecognized":true})',
    `await tools.update_plan(${JSON.stringify({plan:Array.from({length:2001},()=>({step:'x',status:'pending'}))})})`,
    ' '.repeat(2 * 1024 * 1024 + 1),
  ]) expect(literalPlan(source)).toBeUndefined();
});
