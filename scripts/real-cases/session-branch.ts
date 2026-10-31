import { asOfProjection } from '../../packages/contracts/src/as-of.ts';
import type { RealCase } from './types.ts';

export const sessionBranch: RealCase = {
  name: 'session-branch',
  about: 'Captured branch/root identity with provenance and partial replay omission',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"gitBranch"', codex: 'session_meta' },
  scan(row, harness) {
    const payload = row.payload as { cwd?: unknown; git?: { branch?: unknown } } | undefined;
    const branch = harness === 'codex' ? row.type === 'session_meta' ? payload?.git?.branch : undefined : row.gitBranch;
    const root = harness === 'codex' ? payload?.cwd : row.cwd;
    return typeof branch === 'string' && branch.trim() && typeof root === 'string' && root.trim() ? { hits: 1 } : undefined;
  },
  verify(projection, found) {
    const branch = projection.recordedBranch;
    const valid = !!branch?.name.trim() && !!branch.workspaceRoot.trim() && branch.provenance.kind === 'captured' && branch.provenance.observationIds.length === 1;
    const partial = projection.timeline.length > 0;
    const replayOmitted = !partial || asOfProjection(projection, 0).recordedBranch === undefined;
    return [
      `${valid ? '' : 'FAIL '}${found.hits} raw branch/root records; ${valid ? 1 : 0} captured projection identity with provenance`,
      `${replayOmitted ? '' : 'FAIL '}${partial ? 1 : 0} partial replay checks; ${replayOmitted ? 0 : 1} leaked branch identities`,
    ];
  },
};
