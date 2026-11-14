// Incremental, bounded JSONL reading. Never accumulates an oversized line in memory
// (engineering plan §5: "a 2 GB session is not necessarily many small lines").

import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';

export interface SourceCursor {
  /** Byte offset just past the last fully consumed line. */
  offset: number;
  generation: number;
  /** Hash of the first bytes of the file; a change means the file was replaced. */
  fingerprint: string;
  /** The offset is inside an oversized line that is still being skipped. */
  inOversized?: boolean;
  /** Sanitized, adapter-owned discovery/inspection state; never native journal content. */
  adapterCheckpoint?: unknown;
}

export type JsonlRecord =
  | { type: 'record'; offset: number; bytes: number; value: unknown }
  | { type: 'malformed'; offset: number; bytes: number; error: string }
  | { type: 'oversized'; offset: number; bytes: number };

export interface ReadResult {
  records: JsonlRecord[];
  cursor: SourceCursor;
  /** Set when the file was truncated or replaced since the given cursor. */
  reset?: 'truncated' | 'replaced';
  size: number;
}

export interface ReadOptions {
  maxRecordBytes?: number;
  /** Hard byte ceiling. May yield earlier at a complete-record soft batch; continue from cursor. */
  maxReadBytes?: number;
  /** Accept a final line with no trailing newline (the file is complete, not being written). */
  acceptUnterminated?: boolean;
}

const FINGERPRINT_BYTES = 1024;
const CHUNK = 1 << 20;
// Yield at complete records before an ingest turn must seal/store a large array. This
// is a soft batch budget, separate from the hard read and individual-record limits.
const BATCH_BYTES = 4 * 1024 * 1024;

export async function fingerprintOf(path: string): Promise<string> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(FINGERPRINT_BYTES);
    const { bytesRead } = await fh.read(buf, 0, FINGERPRINT_BYTES, 0);
    // An empty or growing-but-short file has an unstable prefix; only fingerprint what exists.
    return createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex').slice(0, 16) + ':' + bytesRead;
  } finally {
    await fh.close();
  }
}

export const initialCursor = (): SourceCursor => ({ offset: 0, generation: 0, fingerprint: '' });

export async function readJsonl(path: string, from: SourceCursor, opts: ReadOptions = {}): Promise<ReadResult> {
  const maxRecord = opts.maxRecordBytes ?? 16 * 1024 * 1024;
  const maxRead = opts.maxReadBytes ?? 64 * 1024 * 1024;
  const st = await stat(path);
  let cursor = { ...from };
  let reset: ReadResult['reset'];

  const fp = await fingerprintOf(path);
  if (cursor.fingerprint) {
    const [, oldLen] = cursor.fingerprint.split(':');
    const [, newLen] = fp.split(':');
    const comparable = Number(oldLen) === FINGERPRINT_BYTES && Number(newLen) === FINGERPRINT_BYTES;
    if (st.size < cursor.offset) reset = 'truncated';
    else if (comparable && fp !== cursor.fingerprint) reset = 'replaced';
  }
  if (reset) cursor = { offset: 0, generation: cursor.generation + 1, fingerprint: '' };
  cursor.fingerprint = fp;

  const records: JsonlRecord[] = [];
  if (st.size <= cursor.offset) return { records, cursor, reset, size: st.size };

  const fh = await open(path, 'r');
  try {
    const batchStart = cursor.offset;
    let pos = cursor.offset;
    const end = Math.min(st.size, cursor.offset + maxRead);
    let pending: Buffer[] = [];
    let pendingBytes = 0;
    let lineStart = pos;
    let skipping = cursor.inOversized ?? false; // inside an oversized line: discard until its newline
    let gapReported = skipping; // the prior bounded turn already persisted this line's gap

    while (pos < end) {
      const len = Math.min(CHUNK, end - pos);
      const buf = Buffer.alloc(len);
      const { bytesRead } = await fh.read(buf, 0, len, pos);
      if (bytesRead === 0) break;
      let i = 0;
      while (i < bytesRead) {
        const nl = buf.indexOf(0x0a, i);
        const stop = nl === -1 || nl >= bytesRead ? bytesRead : nl;
        const piece = buf.subarray(i, stop);
        if (!skipping) {
          if (pendingBytes + piece.length > maxRecord) {
            skipping = true;
            pending = [];
            pendingBytes = 0;
          } else {
            pending.push(piece);
            pendingBytes += piece.length;
          }
        }
        if (stop === bytesRead) break; // line continues into the next chunk
        const lineEnd = pos + stop + 1;
        const bytes = lineEnd - lineStart;
        if (skipping) {
          if (!gapReported) records.push({ type: 'oversized', offset: lineStart, bytes });
        } else pushLine(records, Buffer.concat(pending), lineStart, bytes);
        pending = [];
        pendingBytes = 0;
        skipping = false;
        gapReported = false;
        cursor.inOversized = false;
        lineStart = lineEnd;
        cursor.offset = lineEnd;
        i = stop + 1;
        if (cursor.offset - batchStart >= BATCH_BYTES) return { records, cursor, reset, size: st.size };
      }
      pos += bytesRead;
    }

    // An oversized line longer than this whole read: consume what was skipped so the next
    // call makes progress instead of re-reading the same bytes forever.
    if (skipping && lineStart < end && !(end === st.size && opts.acceptUnterminated)) {
      if (!gapReported) records.push({ type: 'oversized', offset: lineStart, bytes: end - lineStart });
      cursor.offset = end;
      cursor.inOversized = true;
      return { records, cursor, reset, size: st.size };
    }

    // A trailing line without a newline is only accepted for a completed file, and only
    // once it parses — a writer may be half-way through it.
    if (lineStart < end && end === st.size && opts.acceptUnterminated) {
      const bytes = end - lineStart;
      if (skipping) {
        if (!gapReported) records.push({ type: 'oversized', offset: lineStart, bytes });
        cursor.offset = end;
      } else {
        const text = Buffer.concat(pending).toString('utf8').trim();
        if (text) {
          try {
            records.push({ type: 'record', offset: lineStart, bytes, value: JSON.parse(text) });
            cursor.offset = end;
          } catch {
            // leave it for the next read
          }
        } else cursor.offset = end;
      }
    }
  } finally {
    await fh.close();
  }
  return { records, cursor, reset, size: st.size };
}

function pushLine(records: JsonlRecord[], buf: Buffer, offset: number, bytes: number) {
  const text = buf.toString('utf8').replace(/\r$/, '').trim();
  if (!text) return;
  try {
    records.push({ type: 'record', offset, bytes, value: JSON.parse(text) });
  } catch (e) {
    records.push({ type: 'malformed', offset, bytes, error: parseErrorText(e) });
  }
}

/**
 * A parse error without the input it quotes. V8 messages embed a short slice of the line, e.g.
 * `Unexpected token 's', "{"a": sk-ant-ab"... is not valid JSON`; that slice can be a secret's
 * head too short for any redaction rule, so it never leaves this function.
 */
function parseErrorText(e: unknown): string {
  if (!(e instanceof Error)) return 'parse error';
  const m = e.message;
  const i = m.indexOf('"');
  const j = m.lastIndexOf('"');
  return (i >= 0 && j > i ? `${m.slice(0, i)}<input omitted>${m.slice(j + 1)}` : m).slice(0, 200);
}
