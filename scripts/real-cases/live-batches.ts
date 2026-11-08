import type { RealCase } from './types.ts';
import { compose } from '../../packages/scene/src/index.ts';
export const liveBatches: RealCase = {
  name: 'live-batches', about: 'Real captured result batches, including a later journal entry',
  harnesses: ['claude-code', 'codex'], prefilter: { 'claude-code': 'tool_result', codex: 'function_call_output' },
  scan(row: any, harness) {
    if (harness === 'codex') return row.type === 'response_item' && row.payload?.type === 'function_call_output' ? { hits: 1 } : undefined;
    const content = row.message?.content;
    const count = row.type === 'user' && Array.isArray(content) ? content.filter((item: any) => item.type === 'tool_result').length : 0;
    return count ? { hits: count } : undefined;
  },
  verify(p) {
    const results = p.timeline.flatMap((item, position) => item.type === 'op-end' ? [position] : []);
    if (results.length < 2) return ['FAIL fewer than two captured outcomes'];
    const since = results.at(-2)!;
    const scene = compose(p, { step: p.timeline.length, since });
    const expected = new Set(p.timeline.slice(since).flatMap(item => item.type === 'op-end' ? [item.operationId] : []));
    const actual = new Set(scene.passages.flatMap(ps => ps.ops.filter(op => op.resolving).map(op => op.id)));
    return [`${expected.size === actual.size && [...expected].every(id => actual.has(id)) ? 'PASS' : 'FAIL'} ${expected.size} distinct captured outcomes resolve in the final applied interval`,
      `${p.operations.length} operations; ${results.length} result positions; composer deterministic: ${JSON.stringify(scene) === JSON.stringify(compose(p, { step: p.timeline.length, since }))}`];
  },
};
