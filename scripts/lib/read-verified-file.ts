import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { dirname } from 'node:path';

const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);

/** Read a stable regular file at a canonical path. Callers may supply a lower byte limit. */
export function readVerifiedFile(path: string, maxBytes?: number): Buffer {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.ino === 0n) throw new Error('Input must be a regular file.');

  const fd = openSync(path, READ_FLAGS);
  try {
    const opened = fstatSync(fd, { bigint: true });
    const directory = dirname(path);
    const current = lstatSync(path, { bigint: true });
    if (!opened.isFile() || !current.isFile() || realpathSync(directory) !== directory
      || opened.dev !== before.dev || opened.ino !== before.ino
      || opened.dev !== current.dev || opened.ino !== current.ino) {
      throw new Error('Input changed while opening.');
    }
    const limit = maxBytes === undefined ? before.size : BigInt(maxBytes);
    if (opened.size > limit) throw new Error('Input exceeds the byte limit.');

    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const read = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (read === 0) throw new Error('Input changed while reading.');
      offset += read;
    }
    const after = fstatSync(fd, { bigint: true });
    if (after.size !== opened.size || after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) {
      throw new Error('Input changed while reading.');
    }
    return bytes;
  } finally {
    closeSync(fd);
  }
}
