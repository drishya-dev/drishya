import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import type { PersistedOutput } from '@drishya/contracts';
import { sanitize } from '@drishya/privacy';

const LIMIT = 4 * 1024 * 1024;

/** Resolve the harness boundary and verify the opened file identity before reading any bytes. */
export async function readHarnessText(
  path: string,
  boundary: string,
  allowed: (file: string, root: string) => boolean,
): Promise<PersistedOutput> {
  try {
    const real = await realpath(path);
    const root = await realpath(boundary);
    if (!allowed(real, root)) return { available: false, reason: 'outside-harness-folder' };

    const before = await lstat(real, { bigint: true });
    if (!before.isFile() || before.ino === 0n) return { available: false, reason: 'removed' };
    const file = await open(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const opened = await file.stat({ bigint: true });
      const current = await realpath(path);
      const currentRoot = await realpath(boundary);
      const after = await lstat(real, { bigint: true });
      if (current !== real || currentRoot !== root || !opened.isFile() || !after.isFile()
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
