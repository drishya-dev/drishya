import { toolInventory, toolTrail } from '../../packages/scene/src/tools.ts';
import type { RealCase } from './types.ts';

// TOOLS-1: the tools a harness lists as available, and walking the uses of a tool. Claude Code lists them in attachment rows
// (prompt snapshot, deferred-tool changes); Codex lists tool groups in `additional_tools` rows. Names and counts only.
export const toolsAvailable: RealCase = {
  name: 'tools-available',
  about: 'Available-tool lists (Claude Code attachments, Codex additional_tools) and the trail through a tool\'s uses',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"attachment"', codex: 'additional_tools' },
  scan(row, harness) {
    if (harness === 'codex') {
      const p = row.payload as { type?: string; tools?: unknown } | undefined;
      return row.type === 'response_item' && p?.type === 'additional_tools' && Array.isArray(p.tools) && p.tools.length ? { hits: 1 } : undefined;
    }
    const a = row.attachment as { type?: string; tools?: unknown; addedNames?: unknown } | undefined;
    if (row.type !== 'attachment' || !a) return;
    if (a.type === 'prompt_snapshot' && Array.isArray(a.tools) && a.tools.length) return { hits: 1, only: 1 };
    if (a.type === 'deferred_tools_delta' && Array.isArray(a.addedNames) && a.addedNames.length) return { hits: 1 };
    return undefined;
  },
  verify(p, found) {
    const inventory = toolInventory(p);
    const listed = inventory.tools.filter((t) => t.listed), unusedListed = listed.filter((t) => !t.uses), usedUnlisted = inventory.tools.filter((t) => !t.listed);
    const lines = [`${found.hits} list rows in the journal; ${listed.length} listed tools (${unusedListed.length} never used), ${usedUnlisted.length} used but not listed; ${inventory.tools.filter((t) => t.uses).length} tools used in all`];
    if (!inventory.recorded) lines.push('FAIL the journal has list rows but the projection holds no available tools');
    // Walk the most used tool from its first use to its last and back: every use is reached once, in order.
    const top = [...inventory.tools].filter((t) => t.filterTool).sort((a, b) => b.uses - a.uses)[0];
    if (top) {
      const filter = { tool: top.filterTool, ...(top.server ? { server: top.server } : {}) };
      const total = toolTrail(p, filter).total;
      const forward: string[] = [];
      let step = toolTrail(p, filter).first;
      while (step && forward.length <= total) { forward.push(step.id); step = toolTrail(p, filter, { id: step.id }).next; }
      const backward: string[] = [];
      let back = toolTrail(p, filter).last;
      while (back && backward.length <= total) { backward.push(back.id); back = toolTrail(p, filter, { id: back.id }).previous; }
      const ok = forward.length === total && backward.length === total && new Set(forward).size === total && forward.join() === [...backward].reverse().join();
      lines.push(`${ok ? 'PASS' : 'FAIL'} the most used tool has ${total} uses; walking forward reached ${forward.length}, backward ${backward.length}`);
    }
    return lines;
  },
};
