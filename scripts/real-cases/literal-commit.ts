import { explicitCommitPaths } from '../../apps/daemon/src/git-session-evidence.ts';
import type { RealCase } from './types.ts';

// GIT-2: the strict commit link needs a literal `git commit ... -- <paths>` run in the session's own workspace root. Real journals rarely
// contain one; when none does, record one (AGENTS.md, Definition of done) and rerun.
export const literalCommit: RealCase = {
  name: 'literal-commit',
  about: 'Claude Code Bash calls that are a literal `git commit ... -- <paths>`',
  harnesses: ['claude-code'],
  prefilter: 'git commit',
  scan(row) {
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
