import { isPersonPrompt } from '../../packages/contracts/src/index.ts';
import { reviewInsights } from '../../packages/scene/src/review-insights.ts';
import { markers } from '../../packages/scene/src/index.ts';
import type { RealCase } from './types.ts';

// CONTENT-20: every message the person typed is a prompt, including the ones typed while the agent was working. Claude Code records those as
// `attachment` rows of type `queued_command` (origin human, commandMode prompt), not as `user` rows. Expected total, counted from the journal
// by role and shape: person turn starts plus human queued commands. Task notices (origin task-notification), another session's message
// (origin peer), compaction summaries, tool results and meta rows are not prompts.
// The adapter turns every text block of one row into its own message, so a row of [reminder, typed text] is a notice and a prompt.
// A row is a person prompt when any text block is one, or when it holds only images.
const blocks = (content: unknown): string[] => typeof content === 'string' ? [content]
  : Array.isArray(content) ? content.filter((p: any) => p?.type === 'text' && typeof p.text === 'string' && p.text.trim()).map((p: any) => p.text) : [];
const isPersonRow = (content: unknown) => { const texts = blocks(content); return texts.length ? texts.some(isPersonPrompt) : hasImage(content); };
const hasImage = (content: unknown) => Array.isArray(content) && content.some((p: any) => p?.type === 'image');

// A resumed journal copies earlier rows with the same uuid; the reducer keeps one of each, so the journal count must too.
let seen = new Set<string>();
const firstTime = (row: any) => typeof row.uuid !== 'string' || (!seen.has(row.uuid) && !!seen.add(row.uuid));

export const midTurnPrompts: RealCase = {
  name: 'mid-turn-prompts',
  about: 'Prompt totals count a person\'s messages typed while the agent was working (Claude queued_command), not notices',
  harnesses: ['claude-code'], prefilter: '"type":"', reset() { seen = new Set(); },
  scan(row: any) {
    if (row.isSidechain || row.isMeta) return;
    if (row.type === 'user') {
      const content = row.message?.content;
      if (row.isCompactSummary || (Array.isArray(content) && content.some((p: any) => p?.type === 'tool_result'))) return;
      return isPersonRow(content) && firstTime(row) ? { hits: 1 } : undefined;
    }
    const attachment = row.type === 'attachment' ? row.attachment : undefined;
    if (attachment?.type !== 'queued_command' || attachment.origin?.kind !== 'human' || attachment.commandMode !== 'prompt') return;
    return isPersonRow(attachment.prompt) && firstTime(row) ? { hits: 1, only: 1 } : undefined;
  },
  verify(p, found) {
    const people = p.timeline.filter(item => item.type === 'turn' && isPersonPrompt(item.prompt));
    const ticks = markers(p).filter(item => item.type === 'turn').length, overview = reviewInsights(p).promptCount;
    // A resumed session's recording joins its parent journals: the projection then holds more than the one journal scanned.
    const joined = (p.lineage?.recordingIds.length ?? 1) > 1;
    return [
      `${found.hits} journal person prompts (${found.only} typed mid-turn); ${people.length} person prompts projected; ${ticks} rail ticks; overview ${overview}`,
      joined ? `${people.length >= found.hits ? 'PASS' : 'FAIL'} joined view of ${p.lineage!.recordingIds.length} journals holds at least this journal's prompts`
        : `${people.length === found.hits ? 'PASS' : 'FAIL'} projected person prompts equal the journal's turn starts plus human queued commands`,
      `${ticks === people.length && overview === people.length ? 'PASS' : 'FAIL'} rail ticks and overview equal the person prompts`,
    ];
  },
};
