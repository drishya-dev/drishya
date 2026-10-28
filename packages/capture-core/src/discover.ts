import { open, readdir, stat, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';

/** Parses the first complete records of a journal, for discovery. Never reads the whole file. */
export async function headRecords(path: string, maxBytes = 256 * 1024, maxRecords = 400): Promise<unknown[]> {
  const fh = await open(path, 'r');
  try {
    return await readHead(fh, maxBytes, maxRecords);
  } finally {
    await fh.close();
  }
}

async function readHead(fh: FileHandle, maxBytes: number, maxRecords: number): Promise<unknown[]> {
  const buf = Buffer.alloc(maxBytes);
  const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
  const text = buf.subarray(0, bytesRead).toString('utf8');
  const lines = text.split('\n');
  if (bytesRead === maxBytes) lines.pop(); // last line is probably cut
  const out: unknown[] = [];
  for (const l of lines) {
    if (out.length >= maxRecords) break;
    const t = l.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // a cut or malformed line tells discovery nothing
    }
  }
  return out;
}

/** Bounded title records; non-title lines and the first clipped record are never parsed. */
export async function tailRecords(path: string, maxBytes = 64 * 1024): Promise<unknown[]> {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    return await readTail(fh, size, maxBytes);
  } finally {
    await fh.close();
  }
}

async function readTail(fh: FileHandle, size: number, maxBytes: number): Promise<unknown[]> {
  const start = Math.max(0, size - maxBytes);
  const buf = Buffer.alloc(size - start);
  const { bytesRead } = await fh.read(buf, 0, buf.length, start);
  let text = buf.subarray(0, bytesRead).toString('utf8');
  if (start > 0) {
    const firstBreak = text.indexOf('\n');
    if (firstBreak < 0) return [];
    text = text.slice(firstBreak + 1);
  }
  const out: unknown[] = [];
  for (const line of text.split('\n')) {
    if (!line.includes('custom-title') && !line.includes('summary') && !line.includes('ai-title')) continue;
    try { out.push(JSON.parse(line)); } catch { /* Cut or malformed records tell discovery nothing. */ }
  }
  return out;
}

/** Claude discovery shares one read-only handle and the size already obtained by fileInfo. */
export async function headAndTailRecords(path: string, size: number): Promise<{ head: unknown[]; tail: unknown[] }> {
  const fh = await open(path, 'r');
  try {
    const head = await readHead(fh, 256 * 1024, 400);
    const tail = size > 256 * 1024 ? await readTail(fh, size, 64 * 1024) : [];
    return { head, tail };
  } finally {
    await fh.close();
  }
}

export async function listFiles(dir: string, match: (name: string) => boolean, depth = 0, maxDepth = 4): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    // A harness that is not installed has no root: that is genuinely empty. A root that exists
    // but cannot be read is a failure discovery must report (B1, audit A05). Deeper unreadable
    // folders are skipped so one bad session folder does not hide the rest.
    if (depth === 0 && (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory() && depth < maxDepth) out.push(...(await listFiles(p, match, depth + 1, maxDepth)));
    else if (e.isFile() && match(e.name)) out.push(p);
  }
  return out;
}

export async function fileInfo(path: string): Promise<{ bytes: number; modifiedAt: string } | undefined> {
  try {
    const s = await stat(path);
    return { bytes: s.size, modifiedAt: s.mtime.toISOString() };
  } catch {
    return undefined;
  }
}
