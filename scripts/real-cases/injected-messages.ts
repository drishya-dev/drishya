import { injectedMessage } from '../../apps/ui/src/lib/injected-messages.ts';
import type { RealCase } from './types.ts';

// CONTENT-11: notices Claude Code wrote in the user role (background tasks, command echoes, interruptions, reminders).
export const injectedMessages: RealCase = {
  name: 'injected-messages',
  about: 'Claude Code user-role messages that are notices, not typed prompts (task notifications strict)',
  harnesses: ['claude-code'],
  prefilter: '"type":"user"',
  scan(row) {
    if (row.type !== 'user' || row.isSidechain || row.isMeta) return;
    const content = (row.message as { content?: unknown } | undefined)?.content;
    const texts = typeof content === 'string' ? [content] : Array.isArray(content) ? content.filter((b) => b?.type === 'text').map((b) => String(b.text)) : [];
    const notes = texts.map(injectedMessage).filter(Boolean);
    if (!notes.length) return;
    return { hits: notes.length, only: notes.filter((n) => n!.kind === 'background-task').length };
  },
  verify(p, found) {
    const turns = p.timeline.filter((t) => t.type === 'turn') as { prompt?: string }[];
    const notices = turns.filter((t) => t.prompt && injectedMessage(t.prompt));
    const tasks = notices.filter((t) => injectedMessage(t.prompt!)?.kind === 'background-task');
    return [
      `${found.hits} notices in the journal (${found.only} background-task); ${notices.length} turns the UI now labels as Claude Code's (${tasks.length} background-task), of ${turns.length} turns`,
      ...(notices.length < found.hits ? [`FAIL ${found.hits - notices.length} notices were not presented as turns at all`] : []),
    ];
  },
};
