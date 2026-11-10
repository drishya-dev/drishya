import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initialCursor, readJsonl } from '@drishya/capture-core';
import { leadingMessageIds, mentionsAny, probeIds, sameProject } from './continuation-shared.ts';

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
  /** What the link rests on: the compact boundary's native parent uuid, or entry uuids copied into the new journal (CONTENT-21). */
  basis: 'native-logical-parent' | 'shared-entry-uuids';
}

/**
 * CONTENT-21. A journal whose leading entries were copied, uuid for uuid, from exactly one earlier journal of the same project folder.
 * Direction is structural: the earlier journal does not itself start with entries the new one holds (a full fork shares both ways and is
 * left ambiguous), and an ancestor of another match is not a competing parent. Nothing is chosen by time, title or overlap size.
 */
async function sharedContinuation(path: string, discoveredPaths: string[], depth: number): Promise<ClaudeContinuation | undefined> {
  const leading = await leadingMessageIds(path);
  if (!leading.length) return;
  const probes = probeIds(leading), window = new Set(leading);
  const hits: string[] = [];
  for (const candidate of sameProject(path, discoveredPaths)) if (await mentionsAny(candidate, probes)) hits.push(candidate);
  if (!hits.length) return;
  const child = await metadata(path), owners: { path: string; shared: number; complete: boolean }[] = [], siblings: string[] = [];
  let complete = true;
  for (const candidate of hits) {
    try {
      const item = await metadata(candidate), shared = leading.filter(id => item.messages.has(id)).length;
      complete &&= item.complete;
      if (shared * 2 <= leading.length) continue;
      const earlier = await leadingMessageIds(candidate);
      // The candidate also starts with entries this journal holds: neither is shown to be the earlier one.
      if (earlier.length && earlier.filter(id => child.messages.has(id)).length * 2 >= earlier.length) { siblings.push(candidate); continue; }
      owners.push({ path: candidate, shared, complete: item.complete });
    } catch { complete = false; }
  }
  // A journal that also starts with entries this one holds (a sibling copy of the same tail, or a full fork) is not shown to be earlier.
  if (!owners.length) return siblings.length ? { boundaryRecordId: leading[0]!, logicalParentRecordId: leading[0]!, basis: 'shared-entry-uuids', status: 'ambiguous', candidatePaths: siblings, sharedMessageRecords: 0 } : undefined;
  // A match that is the parent of another match is an ancestor in the same chain.
  const ancestors = new Set<string>();
  if (depth < 4) for (const owner of owners) {
    const up = await claudeContinuation(owner.path, discoveredPaths, depth + 1).catch(() => undefined);
    if (up?.parentPath) ancestors.add(resolve(up.parentPath));
  }
  const direct = owners.filter(owner => !ancestors.has(resolve(owner.path)));
  const linked = direct.length === 1 ? direct[0] : undefined;
  const firstShared = leading.find(id => linked && window.has(id)) ?? leading[0]!;
  return { boundaryRecordId: leading[0]!, logicalParentRecordId: firstShared, basis: 'shared-entry-uuids',
    status: linked && complete ? 'linked' : 'ambiguous', parentPath: linked && complete ? linked.path : undefined,
    candidatePaths: direct.map(owner => owner.path), sharedMessageRecords: linked?.shared ?? 0 };
}

/** A copied UUID can have several local owners. Never choose one using clocks, folders or overlap size. */
export async function claudeContinuation(path: string, discoveredPaths: string[], depth = 0): Promise<ClaudeContinuation | undefined> {
  path = resolve(path);
  const head = await metadata(path, true);
  if (!head.parent || !head.boundary) return sharedContinuation(path, discoveredPaths, depth);
  const child = await metadata(path), matches: Metadata[] = [];
  let complete = discoveredPaths.length <= 2048;
  for (const candidate of [...new Set(discoveredPaths.map(p => resolve(p)))].slice(0, 2048)) {
    if (candidate === path) continue;
    try { const item = await metadata(candidate); complete &&= item.complete; if (item.ids.has(head.parent)) matches.push(item); }
    catch { complete = false; }
  }
  // CONTENT-21: a copied uuid can sit in an earlier link of the same chain. A match that is the parent of another match is an ancestor,
  // not a competing parent; what remains after removing ancestors is the direct parent only if it is exactly one.
  const direct = matches.length > 1 && depth < 4 ? await withoutAncestors(child, matches, discoveredPaths, depth) : matches;
  const parent = direct.length === 1 ? direct[0] : undefined;
  return { boundaryRecordId: head.boundary, logicalParentRecordId: head.parent, basis: 'native-logical-parent',
    status: parent && complete ? 'linked' : direct.length || !complete ? 'ambiguous' : 'parent-missing',
    parentPath: complete ? parent?.path : undefined, candidatePaths: direct.map(m => m.path),
    sharedMessageRecords: parent ? [...child.messages].filter(id => parent.messages.has(id)).length : 0 };
}

async function withoutAncestors(child: Metadata, matches: Metadata[], discoveredPaths: string[], depth: number): Promise<Metadata[]> {
  const ancestors = new Set<string>();
  const earlier: Metadata[] = [];
  for (const match of matches) {
    const lead = await leadingMessageIds(match.path);
    if (!lead.length || lead.filter(id => child.messages.has(id)).length * 2 < lead.length) earlier.push(match);
  }
  matches = earlier;
  for (const match of matches) {
    const up = await claudeContinuation(match.path, discoveredPaths, depth + 1).catch(() => undefined);
    if (up?.status === 'linked' && up.parentPath) ancestors.add(resolve(up.parentPath));
  }
  return matches.filter(match => !ancestors.has(resolve(match.path)));
}
