import { open, readdir, stat, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import {sanitize} from '@drishya/privacy';

/** Keep bounded discovery metadata independent of the potentially huge parsed prompt.
 * UTF-16 preserves the existing code-unit truncation, including isolated surrogates. */
export function discoveryTitle(value:string):string {
  return Buffer.from(sanitize(value.slice(0,160)).value,'utf16le').toString('utf16le');
}

/** Parses the first complete records of a journal, for discovery. Never reads the whole file. */
export async function headRecords(path: string, maxBytes = 256 * 1024, maxRecords = 400, stop?: (record: unknown) => boolean): Promise<unknown[]> {
  const fh = await open(path, 'r');
  try {
    return await readHead(fh, maxBytes, maxRecords, undefined, stop);
  } finally {
    await fh.close();
  }
}

async function readHead(fh: FileHandle, maxBytes: number, maxRecords: number, knownSize?: number, stop?: (record: unknown) => boolean): Promise<unknown[]> {
  const capacity=Math.min(maxBytes,knownSize??(await fh.stat()).size);
  if(!capacity)return [];
  const buf = Buffer.alloc(capacity);
  const { bytesRead } = await fh.read(buf, 0, capacity, 0);
  const out: unknown[] = [];
  let start=0;
  while(start<bytesRead && out.length<maxRecords) {
    const newline=buf.indexOf(10,start);
    if(newline<0 && bytesRead===maxBytes)break; // last line is probably cut
    const end=newline<0?bytesRead:newline;
    // Decode only the next record: callers may already have all the metadata
    // they need, while later tool outputs can fill the rest of the head budget.
    const t=buf.toString('utf8',start,end).trim();start=end+1;
    if (!t) continue;
    let record:unknown;
    try {
      record=JSON.parse(t);
    } catch {
      // a cut or malformed line tells discovery nothing
      continue;
    }
    out.push(record);
    if(stop?.(record))break;
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
    const head = await readHead(fh, 256 * 1024, 400, size);
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
