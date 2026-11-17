// DATA-5 (review125 S5): Claude Code keeps a backup of each file at the start of a turn. The
// recording stores only the backup's name; the bytes are read here when the person asks, with the
// same workspace approval as current-file reading, redacted, and never stored. Retention may have
// removed the backup already.
import { basename, dirname, join } from 'node:path';
import type { CheckpointFile, CheckpointPayload } from '@drishya/contracts';
import { isDeniedPath } from '@drishya/privacy';
import type { Store } from '@drishya/store';
import { readHarnessText } from './harness-text.ts';

/** Claude Code backup names, as the adapter accepts them: a hash and a version. No path parts. */
const BACKUP_NAME = /^[0-9a-f]{8,64}@v\d+$/;
/** Claude Code session ids name folders; accept only id-shaped names. */
const SESSION = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export async function readCheckpointFile(store: Store, recordingId: string, backup: string, approved: boolean): Promise<CheckpointFile> {
  const recording = store.getRecording(recordingId);
  if (!recording?.sourcePath || recording.harness !== 'claude-code' || !BACKUP_NAME.test(backup)) return { available: false, reason: 'not-recorded' };
  // Only a backup this recording's own checkpoints name, and the path it was recorded for.
  let entry: CheckpointPayload['files'][number] | undefined, recorded: string | undefined;
  for (const o of store.observationsOfKinds(recordingId, ['checkpoint'])) {
    const payload = o.payload as CheckpointPayload;
    entry = payload.files?.find((f) => f.backup?.name === backup);
    if (entry) { recorded = payload.session; break; }
  }
  if (!entry) return { available: false, reason: 'not-recorded' };
  if (isDeniedPath(entry.path)) return { available: false, reason: 'protected' };
  if (!approved) return { available: false, reason: 'needs-workspace-approval' };
  // <claude home>/projects/<project>/<session>.jsonl → <claude home>/file-history/<session>/<backup>.
  // The session the checkpoint was written under first, then the journal's own.
  const home = dirname(dirname(dirname(recording.sourcePath)));
  const sessions = [...new Set([recorded, basename(recording.sourcePath, '.jsonl')])].filter((s): s is string => !!s && SESSION.test(s));
  for (const session of sessions) {
    const folder = join('file-history', session, backup);
    const file = await readHarnessText(join(home, folder), home, (real, root) => real === join(root, folder));
    if (file.available) return file;
    if (file.reason === 'outside-harness-folder') break;
  }
  return { available: false, reason: 'removed' };
}
