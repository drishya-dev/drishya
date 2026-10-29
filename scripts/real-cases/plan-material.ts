import type { RealCase } from './types.ts';
import { literalPlan } from '../../packages/capture-core/src/literal-plan.ts';

const claudeTools = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'ExitPlanMode', 'mcp__ccd_turn__update_plan']);

/** Count calls, not tool declarations or text that happens to mention planning. */
export const planMaterial: RealCase = {
  name: 'plan-material',
  about: 'Native plan proposals and task/checklist revisions',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '', codex: '' },
  scan(row, harness) {
    if (harness === 'claude-code') {
      const content = (row.message as { content?: unknown } | undefined)?.content;
      if (!Array.isArray(content)) return;
      const hits = content.filter(b => b?.type === 'tool_use' && claudeTools.has(b.name)).length;
      return hits ? { hits } : undefined;
    }
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type !== 'response_item' || !payload) return;
    if (payload.type === 'function_call' && payload.name === 'update_plan') return { hits: 1 };
    if (payload.type === 'custom_tool_call' && ['exec', 'functions.exec'].includes(String(payload.name)) &&
        typeof payload.input === 'string' && literalPlan(payload.input)) return { hits: 1 };
  },
  verify(projection, found) {
    const plans = projection.operations.filter(op => op.detail.kind === 'plan');
    const lists = plans.filter(op => op.detail.kind === 'plan' && !op.detail.document);
    const documents = plans.length - lists.length;
    return [
      `${found.hits} native plan calls; ${lists.length} projected list revisions; ${documents} captured proposal/file documents`,
      plans.length ? `Largest captured list: ${Math.max(0, ...lists.map(op => op.detail.kind === 'plan' ? op.detail.items.length : 0))} rows` : 'FAIL no native planning material reached the projection',
    ];
  },
};
