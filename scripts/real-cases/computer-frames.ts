import { screenRun } from '../../packages/scene/src/screen.ts';
import type { RealCase } from './types.ts';

// SCREEN-1: computer-use steps and their captured frames (Claude Code). Codex has no recorded computer-use tool with frames yet (NATIVE-5).
const POINTER = /^(left_click|right_click|double_click|triple_click|middle_click|left_click_drag|mouse_move|hover|scroll)$/;

export const computerFrames: RealCase = {
  name: 'computer-frames',
  about: 'Claude Code computer tool steps with captured frames and recorded positions',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"tool_use"', codex: '"cua_repl"' },
  scan(row, harness) {
    if (harness === 'codex') return undefined;
    const content = (row.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return;
    const calls = content.filter((b) => b?.type === 'tool_use' && /(^|__)computer$/.test(String(b.name)));
    const pointer = calls.filter((b) => POINTER.test(String((b.input as { action?: unknown } | undefined)?.action))).length;
    return calls.length ? { hits: calls.length, only: pointer } : undefined;
  },
  verify(p, found) {
    const run = screenRun(p.operations);
    const placed = run.steps.filter((s) => s.marker).length;
    const unplaced = new Map<string, number>();
    for (const s of run.steps) if (s.unplaced) unplaced.set(s.unplaced, (unplaced.get(s.unplaced) ?? 0) + 1);
    const pointer = run.steps.filter((s) => s.point || s.from || s.unplaced).length;
    const kept = run.steps.filter((s) => s.image?.sha).length, omitted = run.steps.filter((s) => s.image?.omitted).length;
    const batched = run.steps.filter((s) => s.id.includes('#')).length, unmatched = new Set(run.steps.filter((s) => s.unmatchedImages).map((s) => s.operationId)).size;
    const bad = run.steps.filter((s) => s.marker && (s.marker.x < 0 || s.marker.x > 1 || s.marker.y < 0 || s.marker.y > 1)).length;
    return [
      `${found.hits} computer tool_use mentions (journal rows repeat a call; ${found.only} pointer mentions); ${run.total} steps read (${batched} from browser batches), ${run.frames} frames (${kept} kept, ${omitted} omitted)`,
      ...(unmatched ? [`${unmatched} batches returned images that could not be matched to their actions`] : []),
      `${placed} markers placed of ${pointer} pointer steps; not placed: ${[...unplaced].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`,
      ...(bad ? [`FAIL ${bad} markers fall outside their frame`] : []),
      ...(run.total ? ['PASS computer steps survive projection'] : ['FAIL no computer steps survived projection']),
    ];
  },
};
