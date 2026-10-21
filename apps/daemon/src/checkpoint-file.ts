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
  let file: string | undefined, size = 0;
  for (const session of sessions) {
    const candidate = join(home, 'file-history', session, backup);
    try { size = (await stat(candidate)).size; file = candidate; break; } catch { /* try the next folder */ }
  }
  if (!file) return { available: false, reason: 'removed' };
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(size, LIMIT));
    await handle.read(buffer, 0, buffer.length, 0);
    const clean = sanitize(buffer.toString('utf8'), { maxStringBytes: LIMIT });
    return { available: true, text: clean.value, bytes: size, truncated: size > LIMIT, redacted: clean.redactions.length > 0 };
  } finally { await handle.close(); }
}
