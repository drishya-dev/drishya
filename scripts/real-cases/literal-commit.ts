import { explicitCommitPaths } from '../../apps/daemon/src/git-session-evidence.ts';
import {typedItem} from '../../packages/adapter-codex/src/items.ts';
import type { RealCase } from './types.ts';

// GIT-2: the strict commit link needs a literal `git commit ... -- <paths>` run in the session's own workspace root. Real journals rarely
// contain one; when none does, record one (AGENTS.md, Definition of done) and rerun.
export const literalCommit: RealCase = {
  name: 'literal-commit',
  about: 'Native literal `git commit ... -- <paths>` calls with an explicit path list',
  harnesses: ['claude-code', 'codex'],
  prefilter: 'git commit',
  scan(row, harness) {
    if (harness === 'codex') {
      const p = row.payload as Record<string, unknown> | undefined;
      if(row.type==='event_msg'&&p?.type==='item_completed'){
        const item=typedItem(p.item)?.payload;
        return item?.item==='command'&&typeof item.command==='string'&&explicitCommitPaths(item.command)?{hits:1}:undefined;
      }
      if (row.type !== 'response_item' || p?.type !== 'function_call' || !['exec_command', 'shell_command'].includes(String(p.name))) return;
      let input: Record<string, unknown>;
      try { input = JSON.parse(String(p.arguments)) as Record<string, unknown>; } catch { return; }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return;
      const command = input.cmd ?? input.command;
      return typeof command === 'string' && explicitCommitPaths(command) ? { hits: 1 } : undefined;
    }
    const content = (row.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return;
    const hits = content.filter((b) => b?.type === 'tool_use' && b.name === 'Bash' && typeof (b.input as { command?: unknown })?.command === 'string' && explicitCommitPaths((b.input as { command: string }).command)).length;
    return hits ? { hits } : undefined;
  },
  verify(p, found) {
    const commands = p.operations.filter((op) => op.detail.kind === 'shell' && explicitCommitPaths((op.detail as { command: string }).command)).length;
    return [`${found.hits} literal commit commands in the journal; ${commands} shell operations in the projection (the link itself needs the workspace's Git: GET /v1/recordings/:id/git/history)`];
  },
};
