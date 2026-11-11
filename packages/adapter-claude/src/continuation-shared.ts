import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { initialCursor, readJsonl } from '@drishya/capture-core';

// CONTENT-21: Claude Code can start a new journal that copies the tail of an earlier one with the same entry uuids (a continuation or a
// fork) and no compact boundary row. The only evidence used is those shared uuids; never clocks, titles or folder names beyond "the same
// project folder", where Claude Code keeps a project's journals.
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const LEADING_ENTRIES = 400;

/** The first message uuids of a journal, in file order. Reads only as much as it needs. */
export async function leadingMessageIds(path: string, limit = LEADING_ENTRIES): Promise<string[]> {
  const ids: string[] = [];
  let cursor = initialCursor();
  for (;;) {
    const batch = await readJsonl(path, cursor, { maxReadBytes: 4 * 1024 * 1024, acceptUnterminated: false });
    for (const record of batch.records) {
      if (record.type !== 'record') continue;
      const row = record.value as Record<string, unknown>;
      if (row && (row.type === 'user' || row.type === 'assistant') && typeof row.uuid === 'string' && uuid.test(row.uuid) && !ids.includes(row.uuid)) ids.push(row.uuid);
      if (ids.length >= limit) return ids;
    }
    if (batch.cursor.offset <= cursor.offset || batch.cursor.offset >= batch.size) break;
    cursor = batch.cursor;
  }
  return ids;
}

/** Whether a journal mentions any of the strings: a read-only substring pass that parses nothing. */
export async function mentionsAny(path: string, needles: string[]): Promise<boolean> {
  try {
    const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of lines) if (needles.some(needle => line.includes(needle))) { lines.close(); return true; }
  } catch { /* an unreadable journal is simply not a candidate */ }
  return false;
}

/** Up to `count` entries spread across the window, so a copied tail is found wherever it starts. */
export const probeIds = (ids: string[], count = 8) => ids.length <= count ? ids : Array.from({ length: count }, (_, i) => ids[Math.floor(i * (ids.length - 1) / (count - 1))]!);
export const sameProject = (path: string, others: string[]) => [...new Set(others.map(p => resolve(p)))].filter(p => p !== resolve(path) && dirname(p) === dirname(resolve(path)));
