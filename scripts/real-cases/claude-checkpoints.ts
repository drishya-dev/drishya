import type { RealCase } from './types.ts';

/** Claude Code file-history snapshots that name at least one backup; counts only. The bytes are read by the daemon's checkpoint route, not here. */
export const claudeCheckpoints: RealCase = {
  name: 'claude-checkpoints',
  about: 'Claude Code file-history snapshots with backups; edits offer their file before the turn',
  harnesses: ['claude-code'],
  prefilter: 'file-history-snapshot',
  scan(row) {
    if (row.type !== 'file-history-snapshot') return;
    const tracked = (row.snapshot as { trackedFileBackups?: Record<string, { backupFileName?: unknown }> } | undefined)?.trackedFileBackups ?? {};
    const hits = Object.values(tracked).filter((b) => typeof b?.backupFileName === 'string').length;
    return hits ? { hits } : undefined;
  },
  verify(projection, found) {
    const withBackup = projection.operations.filter((o) => o.detail.kind === 'edit' && o.detail.beforeTurn?.backup).length;
    return [`${found.hits} backup references scanned; ${withBackup} edits offer their file before the turn`];
  },
};
