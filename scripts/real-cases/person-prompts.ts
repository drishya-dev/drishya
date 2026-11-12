import { injectedMessage, isPersonPrompt } from '../../packages/contracts/src/index.ts';
import { reviewInsights } from '../../packages/scene/src/review-insights.ts';
import { markers } from '../../packages/scene/src/index.ts';
import { agentDeliveries } from './agent-delivery.ts';
import type { RealCase } from './types.ts';
export const personPrompts: RealCase = {
  name: 'person-prompts', about: 'Person-only prompt counts, Claude notices/slash commands and Codex collaboration',
  harnesses: ['claude-code', 'codex'], prefilter: { 'claude-code': '', codex: 'agent_message' },
  scan(row: any, harness) {
    if (harness === 'codex') return typeof row.payload?.author === 'string' && row.payload.author.startsWith('/root/') ? agentDeliveries.scan(row, harness) : undefined;
    if (row.isSidechain || row.isMeta) return;
    const content = row.type === 'user' ? row.message?.content : row.type === 'attachment' && row.attachment?.type === 'queued_command' ? row.attachment.prompt : undefined;
    const texts = typeof content === 'string' ? [content] : Array.isArray(content) ? content.filter((p: any) => p?.type === 'text').map((p: any) => p.text) : [];
    const notes = texts.filter((text: unknown): text is string => typeof text === 'string').map(injectedMessage).filter(Boolean);
    return notes.length ? { hits: notes.length, only: notes.filter(note => note!.kind === 'slash-command').length } : undefined;
  },
  verify(p) {
    const turns = p.timeline.filter(item => item.type === 'turn');
    const people = turns.filter(item => isPersonPrompt(item.prompt));
    const notes = turns.filter(item => !isPersonPrompt(item.prompt));
    const tasks = notes.filter(item => injectedMessage(item.prompt ?? '')?.kind === 'background-task').length;
    const commands = notes.filter(item => injectedMessage(item.prompt ?? '')?.kind === 'slash-command').length;
    const overview = reviewInsights(p), ticks = markers(p).filter(item => item.type === 'turn');
    return [`${turns.length} retained turns; ${people.length} person prompts; ${notes.length} notices (${tasks} background, ${commands} slash); ${p.prose.filter(item => item.role === 'assistant' && !item.agentId.endsWith('.agent:main')).length} collaboration deliveries`,
      `${overview.promptCount === people.length && ticks.length === people.length ? 'PASS' : 'FAIL'} overview and rail marker counts equal person prompts; notice turns retained`];
  },
};
