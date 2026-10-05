import { parentPort, workerData } from 'node:worker_threads';
import { sinceSnapshot } from '../../../packages/scene/src/since.ts';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ArtifactSlice, Observation, Operation, Projection } from '@drishya/contracts';
import { asOfProjection } from '@drishya/contracts';
import { defaultAdapters } from '@drishya/ingest';
import { createReducer, orderObservations, reduce, REDUCER_VERSION } from '@drishya/projection';
import { compose, dwellFor, markers, stepOfObservation, type Marker } from '@drishya/scene';
import type { HistoryPage, HistoryQuery } from '../../../packages/scene/src/history.ts';
import { historySummary } from '../../../packages/scene/src/history.ts';
import { BlobStore, Store } from '@drishya/store';
import { sanitize } from '@drishya/privacy';
import { prepareBriefing, prepareExplain, prepareLabels } from '@drishya/explain';

const source = new Store(workerData.dir, { readOnly: true });
const dir = join(workerData.dir, 'history');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const blobs = new BlobStore(join(dir, 'blobs'));
const io = { get: (sha: string) => source.blobs.get(sha) ?? blobs.get(sha), put: (text: string) => blobs.put(text) };
const db = new DatabaseSync(join(dir, 'index.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA cache_size=-8192;
  CREATE TABLE IF NOT EXISTS views(id TEXT PRIMARY KEY, revision TEXT NOT NULL, header TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS items(view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY(view_id,kind,id));
  CREATE INDEX IF NOT EXISTS item_position ON items(view_id,kind,position);
  CREATE TABLE IF NOT EXISTS file_ops(view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
    path TEXT NOT NULL, op_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(view_id,path,op_id));
  CREATE INDEX IF NOT EXISTS file_position ON file_ops(view_id,path,position);
`);
const adapters = Object.fromEntries(defaultAdapters().map((a) => [a.descriptor.id, a.descriptor]));
const HISTORY_VERSION = 'h1-4096';
// At most one complete reducer workspace is resident, independent of how many recordings exist.
let cached: { id: string; revision: string; projection: Projection; revisions: Record<string, number> } | undefined;
let incremental: { id: string; reducer: ReturnType<typeof createReducer>; sequence: number; clock: string; roots: Set<string> } | undefined;

function build(id: string, ids: string[], live: boolean): { projection: Projection; appended: boolean } {
  if (ids.length === 1 && incremental?.id === id) {
    const added = source.observations(ids[0]!, incremental.sequence, 10_001);
    const valid = added.length <= 10_000 && added.every((o) => {
      const cwd = (o.payload as { cwd?: unknown }).cwd;
      return !!o.sourceTime && !Number.isNaN(Date.parse(o.sourceTime)) && new Date(o.sourceTime).toISOString() >= incremental!.clock &&
        (!o.workspaceRoot || incremental!.roots.has(o.workspaceRoot)) && (typeof cwd !== 'string' || incremental!.roots.has(cwd));
    });
    if (valid) {
      const ordered = orderObservations(added);
      incremental.reducer.append(ordered);
      if (ordered.length) incremental.clock = new Date(ordered.at(-1)!.sourceTime!).toISOString();
      incremental.sequence = Math.max(incremental.sequence, ...added.map((o) => o.receivedSequence));
      return { projection: incremental.reducer.snapshot(live), appended: true };
    }
  }
  incremental = undefined;
  if (ids.length !== 1) {
    const projection = reduce(id, source.orderedObservations(ids), io, { adapters, live, ordered: true, maxProseChars: 4096, maxInputChars: 4096 });
    const roots = ids.map((key) => {
      const root = source.getRecording(key)?.workspaceRoot?.replace(/\\/g, '/').replace(/\/+$/, '');
      return root && /^[A-Za-z]:\//.test(root) ? root.toLowerCase() : root;
    });
    if (roots.some((root) => !root) || new Set(roots).size !== 1) projection.workspaceRoot = undefined;
    return { projection, appended: false };
  }
  let clock = '';
  const roots = new Set<string>();
  const ordered = source.orderedObservations(ids[0]!);
  const tracked = { *[Symbol.iterator]() { for (const o of ordered) {
    if (o.sourceTime && !Number.isNaN(Date.parse(o.sourceTime))) clock = new Date(o.sourceTime).toISOString();
    if (o.workspaceRoot) roots.add(o.workspaceRoot);
    const cwd = (o.payload as { cwd?: unknown }).cwd;
    if (typeof cwd === 'string') roots.add(cwd);
    yield o;
  } } };
  const reducer = createReducer(id, tracked, io, { adapters, live, ordered: true, maxProseChars: 4096, maxInputChars: 4096 });
  const projection = reducer.snapshot(live);
  incremental = { id, reducer, sequence: projection.lastSequence, clock, roots };
  return { projection, appended: false };
}

function current(id: string) {
  const ids = [...new Set(id.split('+').filter(Boolean))];
  if (!ids.length || ids.length > 16) throw new Error('Choose between one and sixteen recordings');
  source.db.exec('BEGIN');
  try {
    const recordings = ids.map((key) => { const rec = source.getRecording(key); if (!rec) throw new Error('Recording not found'); return rec; });
    const revisions = Object.fromEntries(recordings.map((r) => [r.id, r.revision ?? 0]));
    const revision = JSON.stringify(recordings.map((r) => [r.id, r.revision, r.live, REDUCER_VERSION, HISTORY_VERSION]));
    if (cached?.id === id && cached.revision === revision) return cached;
    const saved = db.prepare('SELECT revision, header FROM views WHERE id=?').get(id) as { revision: string; header: string } | undefined;
    let projection: Projection;
    if (saved?.revision === revision) {
      projection = JSON.parse(saved.header) as Projection;
      for (const kind of ['operations', 'prose', 'artifacts', 'links', 'timeline', 'passages'] as const) {
        const items = [];
        for (const row of db.prepare('SELECT body FROM items WHERE view_id=? AND kind=? ORDER BY position').iterate(id, kind)) items.push(JSON.parse(String(row.body)));
        projection[kind] = items as never;
      }
    } else {
      // Individual histories use repeatable streaming SQL reads. Combined histories retain the
      // reducer's cross-source ordering and worktree identity until their merged disk cursor lands.
      cached = undefined;
      const built = build(id, ids, recordings.some((r) => r.live));
      projection = built.projection;
      const header = { ...projection, operations: [], prose: [], artifacts: [], links: [], timeline: [], passages: [] };
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!built.appended) db.prepare('DELETE FROM views WHERE id=?').run(id);
        db.prepare('INSERT INTO views VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,header=excluded.header').run(id, revision, JSON.stringify(header));
        const insert = db.prepare(`INSERT INTO items VALUES(?,?,?,?,?) ON CONFLICT(view_id,kind,id) DO UPDATE SET
          position=excluded.position,body=excluded.body WHERE body<>excluded.body OR position<>excluded.position`);
        for (const kind of ['operations', 'prose', 'artifacts', 'links', 'timeline', 'passages'] as const) {
          projection[kind].forEach((item, position) => insert.run(id, kind, item.id, position, JSON.stringify(item)));
        }
        const file = db.prepare('INSERT OR IGNORE INTO file_ops VALUES(?,?,?,?)');
        projection.operations.forEach((op, position) => op.paths.forEach((path) => file.run(id, path.path, op.id, position)));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    cached = { id, revision, projection, revisions };
    return cached;
  } finally { source.db.exec('COMMIT'); }
}

function page(id: string, query: HistoryQuery): HistoryPage {
  const { projection: full, revisions } = current(id);
  const requestedStep = query.step !== undefined && query.observationId ? stepOfObservation(full, query.observationId) ?? query.step : query.step;
  const step = Math.max(0, Math.min(full.timeline.length, Math.floor(requestedStep ?? full.timeline.length)));
  const historical = asOfProjection(full, step);
  const scene = compose(full, { step, filter: query.filter, selectedOperationId: query.selectedOperationId });
  const count = Math.max(1, Math.min(64, Math.floor(query.count ?? 32)));
  const opMap = new Map(historical.operations.map((op) => [op.id, op]));
  const proseMap = new Map(historical.prose.map((pr) => [pr.id, pr]));
  const target = scene.passages.findIndex((ps) => ps.ops.some((op) => op.id === query.selectedOperationId ||
    (query.observationId && opMap.get(op.id)?.observationIds.includes(query.observationId))) ||
    ps.prose.some((pr) => query.observationId && proseMap.get(pr.id)?.observationIds.includes(query.observationId)));
  const start = Math.max(0, Math.min(Math.max(0, scene.passages.length - count), Math.floor(query.start ?? (target >= 0 ? target - count / 2 : scene.passages.length - count))));
  const selected = new Set(scene.passages.slice(start, start + count).map((ps) => ps.id));
  for (const pin of query.pinnedPassageIds?.slice(0, 3) ?? []) selected.add(pin);
  const passages = scene.passages.filter((ps) => selected.has(ps.id));
  const opIds = new Set(passages.flatMap((ps) => ps.ops.map((op) => op.id)));
  const proseIds = new Set(passages.flatMap((ps) => ps.prose.map((pr) => pr.id)));
  const operations = historical.operations.filter((op) => opIds.has(op.id));
  const prose = historical.prose.filter((pr) => proseIds.has(pr.id));
  const artifactIds = new Set(operations.flatMap((op) => op.artifactIds));
  for (const pr of prose) if (pr.truncated) artifactIds.add(`art_${pr.id}_prose`);
  const evidenceIds = new Set([...operations.flatMap((op) => op.observationIds), ...prose.flatMap((pr) => pr.observationIds)]);
  const links = historical.links.filter((link) => opIds.has(link.from) || opIds.has(link.to) || link.sourceObservationIds.some((key) => evidenceIds.has(key)));
  const targets = new Set(links.flatMap((link) => [link.from, link.to]));
  const references = Object.fromEntries(historical.operations.filter((op) => targets.has(op.id)).map((op) => [op.id, { title: op.title, step: (op.endSequence ?? op.startSequence) + 1 }]));
  const projection: Projection = {
    ...historical, operations, prose,
    artifacts: historical.artifacts.filter((a) => artifactIds.has(a.id)),
    links,
    passages: historical.passages.filter((ps) => selected.has(ps.id)),
    timeline: full.timeline.slice(Math.max(0, step - 128), step),
  };
  // Only stable passage metadata crosses the boundary for unloaded work. Content loads on demand.
  scene.passages = scene.passages.map((ps) => selected.has(ps.id) ? ps : { ...ps, ops: [], prose: [], turnPrompt: undefined, unloaded: true });
  const allMarkers = markers(full);
  const stride = Math.max(1, Math.ceil(allMarkers.length / 500));
  return { projection, scene, start, operationCount: historical.operations.length, summary: historySummary(historical), references, loadedPassageIds: passages.map((ps) => ps.id), revisions,
    markers: allMarkers.filter((_, i) => i % stride === 0), dwell: dwellFor(full, step) };
}

function artifact(id: string, artifactId: string, start: number, count: number): ArtifactSlice {
  current(id);
  const row = db.prepare("SELECT body FROM items WHERE view_id=? AND kind='artifacts' AND id=?").get(id, artifactId) as { body: string } | undefined;
  if (!row) throw new Error('Artifact not found');
  const artifact = JSON.parse(row.body) as Projection['artifacts'][number];
  const empty = { artifact, start, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
  if (!artifact.blob) return { ...empty, available: false, reason: 'not-captured' };
  const slice = source.blobs.readLines(artifact.blob, start, count) ?? blobs.readLines(artifact.blob, start, count);
  return slice ? { artifact, available: true, start, ...slice } : { ...empty, available: false, reason: 'no-longer-stored' };
}

function file(id: string, path: string, start: number, count: number, step?: number, query = '') {
  const full = current(id).projection;
  const historical = step === undefined ? full : asOfProjection(full, step);
  const operations = historical.operations.filter((op) => op.paths.some((ref) => ref.path === path) && (!query || `${op.title} ${op.kind}`.toLowerCase().includes(query.toLowerCase())));
  return { total: operations.length, operations: operations.slice(Math.max(0, start), Math.max(0, start) + Math.min(200, Math.max(1, count))) };
}

parentPort!.on('message', (message: { id: number; method: string; args: any }) => {
  try {
    const a = message.args;
    let value: unknown;
    if (message.method === 'page') value = page(a.id, a.query);
    else if (message.method === 'artifact') value = artifact(a.id, a.artifactId, a.start, a.count);
    else if (message.method === 'file') value = file(a.id, a.path, a.start, a.count, a.step, a.query);
    else if (message.method === 'summary') value = historySummary(current(a.id).projection, a.from);
    else if (message.method === 'since') value = sinceSnapshot(current(a.id).projection, a.after);
    else if (message.method === 'prepare') {
      const p = current(a.id).projection;
      const art = (id: string) => { const item = p.artifacts.find((art) => art.id === id); return item?.blob ? io.get(item.blob) : undefined; };
      if (a.task === 'explain') {
        if (!p.operations.some((op) => op.id === a.body.operationId)) throw new Error('operation not found');
        value = prepareExplain(p, String(a.body.operationId), art, a.model);
      } else if (a.task === 'briefing') value = prepareBriefing(p, art, a.model, { from: a.body.from, to: a.body.to });
      else value = prepareLabels(p, a.model);
    }
    else if (message.method === 'marker') {
      const p = current(a.id).projection;
      const candidates = markers(p).filter((m) => a.types.includes(m.type) && (a.direction > 0 ? m.step > a.step : m.step < a.step));
      value = (a.direction > 0 ? candidates[0] : candidates.at(-1))?.step;
    } else if (message.method === 'forget') {
      for (const row of db.prepare('SELECT id FROM views').all()) if (String(row.id).split('+').includes(a.id)) db.prepare('DELETE FROM views WHERE id=?').run(String(row.id));
      cached = undefined;
      incremental = undefined;
      const referenced = new Set<string>();
      for (const row of db.prepare("SELECT body FROM items WHERE kind='artifacts'").iterate()) {
        const sha = (JSON.parse(String(row.body)) as { blob?: string }).blob;
        if (sha) referenced.add(sha);
      }
      // Derived blobs are disposable. Only validated content-addressed files under our own
      // blob directory are swept; captured source blobs and harness paths are untouched.
      for (const prefix of readdirSync(blobs.dir, { withFileTypes: true })) {
        if (!prefix.isDirectory() || !/^[0-9a-f]{2}$/.test(prefix.name)) continue;
        for (const entry of readdirSync(join(blobs.dir, prefix.name), { withFileTypes: true })) {
          const sha = entry.name;
          if (entry.isFile() && /^[0-9a-f]{64}$/.test(sha) && sha.startsWith(prefix.name) && !referenced.has(sha)) blobs.delete(sha);
        }
      }
    } else if (message.method === 'close') { cached = undefined; db.close(); source.close(); }
    else throw new Error('Unknown history request');
    parentPort!.postMessage({ id: message.id, value });
  } catch (error) { parentPort!.postMessage({ id: message.id, error: sanitize(error instanceof Error ? error.message : 'History request failed').value }); }
});
