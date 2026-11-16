// DATA-4 (review125 S5): Claude Code saves a command's output to a file when it is too large for the
// journal and records only a reference. The file is read here only when the person asks, from the
// harness's own tool-results folder for this recording's project, and redacted like any capture.
// Nothing is stored; retention may already have removed the file.
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { basename, dirname, sep } from 'node:path';
import { sanitize } from '@drishya/privacy';
import type { PersistedOutput } from '@drishya/contracts';
import type { Store } from '@drishya/store';

const LIMIT = 4 * 1024 * 1024;


const inside = (path: string, dir: string) => {
  const a = process.platform === 'win32' ? path.toLowerCase() : path;
  const b = process.platform === 'win32' ? dir.toLowerCase() : dir;
  return a.startsWith(b.endsWith(sep) ? b : b + sep);
};

export async function readPersistedOutput(store: Store, recordingId: string, operationId: string): Promise<PersistedOutput> {
  const recording = store.getRecording(recordingId);
  // Operation ids are `<recording>.<native call id>`, with a `#…` suffix for split operations.
  const native = operationId.startsWith(`${recordingId}.`) ? operationId.slice(recordingId.length + 1).split('#')[0]! : operationId;
  const result = store.operationObservations(recordingId, native).findLast((o) => o.kind === 'tool.result');
  const outcome = (result?.payload as { outcome?: { stdout?: unknown; run?: { persistedOutput?: { path?: unknown } } } } | undefined)?.outcome;
  const path = outcome?.run?.persistedOutput?.path;
  if (!recording?.sourcePath || recording.harness !== 'claude-code' || typeof path !== 'string') return { available: false, reason: 'not-recorded' };
  // A command that touched a protected file (e.g. .env) had its output omitted at ingest; keep it that way.
  if (typeof outcome?.stdout === 'string' && outcome.stdout.startsWith('[OMITTED')) return { available: false, reason: 'protected' };
  try {
    const real = await realpath(path);
    const projectPath = dirname(recording.sourcePath);
    const project = await realpath(projectPath);
    if (basename(dirname(real)) !== 'tool-results' || !inside(real, project)) return { available: false, reason: 'outside-harness-folder' };

    const before = await lstat(real, { bigint: true });
    if (!before.isFile() || before.ino === 0n) return { available: false, reason: 'removed' };
    const file = await open(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      // Check the opened file and the canonical paths again before reading any bytes.
      const opened = await file.stat({ bigint: true });
      const current = await realpath(path);
      const currentProject = await realpath(projectPath);
      const after = await lstat(real, { bigint: true });
      if (current !== real || currentProject !== project || !opened.isFile() || !after.isFile()
        || opened.ino !== before.ino || opened.dev !== before.dev || after.ino !== opened.ino || after.dev !== opened.dev) {
        return { available: false, reason: 'removed' };
      }
      const size = Number(opened.size);
      const buffer = Buffer.alloc(Math.min(size, LIMIT));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      const clean = sanitize(buffer.subarray(0, bytesRead).toString('utf8'), { maxStringBytes: LIMIT });
      return { available: true, text: clean.value, bytes: size, truncated: size > bytesRead, redacted: clean.redactions.length > 0 };
    } finally { await file.close(); }
  } catch { return { available: false, reason: 'removed' }; }
}
