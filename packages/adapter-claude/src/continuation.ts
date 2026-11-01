import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initialCursor, readJsonl } from '@drishya/capture-core';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
interface Metadata { path: string; parent?: string; boundary?: string; ids: Set<string>; messages: Set<string>; complete: boolean }
const cache = new Map<string, { stamp: string; metadata: Metadata }>();

/** Metadata only. Reuse the capture reader's record bound; never retain native message bodies. */
async function metadata(path: string, headOnly = false): Promise<Metadata> {
  const info = await stat(path), stamp = `${info.dev}/${info.ino}/${info.size}/${info.mtimeMs}`;
  const previous = cache.get(path);
  if (!headOnly && previous?.stamp === stamp) return previous.metadata;
  const result: Metadata = { path, ids: new Set(), messages: new Set(), complete: true };
  let cursor = initialCursor(), first = true;
  do {
    const batch = await readJsonl(path, cursor, { maxReadBytes: 16 * 1024 * 1024, acceptUnterminated: false });
    for (const record of batch.records) {
      if (record.type !== 'record') { result.complete = false; continue; }
      const row = record.value as Record<string, unknown>;
      if (!row || typeof row !== 'object') continue;
      if (first && ['user', 'assistant', 'system'].includes(String(row.type))) {
        first = false;
        if (row.type === 'system' && row.subtype === 'compact_boundary' && typeof row.logicalParentUuid === 'string' && uuid.test(row.logicalParentUuid) && typeof row.uuid === 'string' && uuid.test(row.uuid)) {
          result.parent = row.logicalParentUuid; result.boundary = row.uuid;
        }
      }
      if (typeof row.uuid === 'string' && uuid.test(row.uuid)) {
        if (result.ids.size >= 200_000) { result.complete = false; break; }
        result.ids.add(row.uuid);
        if (row.type === 'user' || row.type === 'assistant') result.messages.add(row.uuid);
      }
    }
    if (headOnly && !first) return result;
    if (batch.cursor.offset <= cursor.offset) { if (batch.size > cursor.offset) result.complete = false; break; }
    cursor = batch.cursor;
    if (cursor.offset >= info.size || !result.complete && result.ids.size >= 200_000) break;
    await new Promise<void>(done => setImmediate(done));
  } while (true);
  if (!headOnly) {
    cache.delete(path); cache.set(path, { stamp, metadata: result });
    while (cache.size > 8) cache.delete(cache.keys().next().value!);
  }
  return result;
}

export interface ClaudeContinuation {
  boundaryRecordId: string;
  logicalParentRecordId: string;
  status: 'linked' | 'parent-missing' | 'ambiguous';
  parentPath?: string;
  candidatePaths: string[];
  sharedMessageRecords: number;
}

/** A copied UUID can have several local owners. Never choose one using clocks, folders or overlap size. */
export async function claudeContinuation(path: string, discoveredPaths: string[]): Promise<ClaudeContinuation | undefined> {
  path = resolve(path);
  const head = await metadata(path, true);
  if (!head.parent || !head.boundary) return;
  const child = await metadata(path), matches: Metadata[] = [];
  let complete = discoveredPaths.length <= 2048;
  for (const candidate of [...new Set(discoveredPaths.map(p => resolve(p)))].slice(0, 2048)) {
    if (candidate === path) continue;
    try { const item = await metadata(candidate); complete &&= item.complete; if (item.ids.has(head.parent)) matches.push(item); }
    catch { complete = false; }
  }
  const parent = matches.length === 1 ? matches[0] : undefined;
  return { boundaryRecordId: head.boundary, logicalParentRecordId: head.parent,
    status: parent && complete ? 'linked' : matches.length || !complete ? 'ambiguous' : 'parent-missing',
    parentPath: complete ? parent?.path : undefined, candidatePaths: matches.map(m => m.path),
    sharedMessageRecords: parent ? [...child.messages].filter(id => parent.messages.has(id)).length : 0 };
}
