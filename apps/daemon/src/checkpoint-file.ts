// DATA-5 (review125 S5): Claude Code keeps a backup of each file at the start of a turn. The
// recording stores only the backup's name; the bytes are read here when the person asks, with the
// same workspace approval as current-file reading, redacted, and never stored. Retention may have
// removed the backup already.
import { open, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { CheckpointFile, CheckpointPayload } from '@drishya/contracts';
import { isDeniedPath, sanitize } from '@drishya/privacy';
import type { Store } from '@drishya/store';

const LIMIT = 4 * 1024 * 1024;
/** Claude Code backup names, as the adapter accepts them: a hash and a version. No path parts. */
const BACKUP_NAME = /^[0-9a-f]{8,64}@v\d+$/;

export async function readCheckpointFile(store: Store, recordingId: string, backup: string, approved: boolean): Promise<CheckpointFile> {
  const recording = store.getRecording(recordingId);
  if (!recording?.sourcePath || recording.harness !== 'claude-code' || !BACKUP_NAME.test(backup)) return { available: false, reason: 'not-recorded' };
  // Only a backup this recording's own checkpoints name, and the path it was recorded for.
  const entry = store.observationsOfKinds(recordingId, ['checkpoint'])
    .flatMap((o) => (o.payload as CheckpointPayload).files ?? [])
    .find((f) => f.backup?.name === backup);
  if (!entry) return { available: false, reason: 'not-recorded' };
  if (isDeniedPath(entry.path)) return { available: false, reason: 'protected' };
  if (!approved) return { available: false, reason: 'needs-workspace-approval' };
  // <claude home>/projects/<project>/<session>.jsonl → <claude home>/file-history/<session>/<backup>
  const session = basename(recording.sourcePath, '.jsonl');
  const file = join(dirname(dirname(dirname(recording.sourcePath))), 'file-history', session, backup);
  let size: number;
  try { size = (await stat(file)).size; } catch { return { available: false, reason: 'removed' }; }
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(size, LIMIT));
    await handle.read(buffer, 0, buffer.length, 0);
    const clean = sanitize(buffer.toString('utf8'), { maxStringBytes: LIMIT });
    return { available: true, text: clean.value, bytes: size, truncated: size > LIMIT, redacted: clean.redactions.length > 0 };
  } finally { await handle.close(); }
}
