// Which repository a captured folder belongs to, for grouping worktrees on Home.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const AGENT_WORKTREE = /^(.*?)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+(?:[\\/]|$)/i;
const LINKED_GITDIR = /^gitdir:\s*(.+?)\s*$/m;
const WORKTREE_ADMIN = /^(.*?)[\\/]\.git[\\/]worktrees[\\/][^\\/]+$/;
const POINTER_BYTES = 4096, CACHE_LIMIT = 4096;

// A linked worktree's `.git` is a one-line pointer to its repository. Only that pointer is read:
// no workspace content, so this needs no workspace approval. A deleted worktree stays its own group.
async function resolveRepository(cwd: string): Promise<string | undefined> {
  const agent = AGENT_WORKTREE.exec(cwd)?.[1];
  if (agent) return agent;
  const pointer = await readFile(join(cwd, '.git'), 'utf8').catch(() => undefined);
  if (!pointer || pointer.length > POINTER_BYTES) return undefined;
  const gitdir = LINKED_GITDIR.exec(pointer)?.[1];
  return gitdir ? WORKTREE_ADMIN.exec(resolve(cwd, gitdir))?.[1] : undefined;
}

export function repositoryRoots() {
  const known = new Map<string, Promise<string | undefined>>();
  return (cwd: string | undefined): Promise<string | undefined> => {
    if (!cwd) return Promise.resolve(undefined);
    let found = known.get(cwd);
    if (!found) {
      if (known.size >= CACHE_LIMIT) known.clear();
      known.set(cwd, found = resolveRepository(cwd));
    }
    return found;
  };
}
