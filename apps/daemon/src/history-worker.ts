import {queuePage} from '../../../packages/scene/src/queued-inputs.ts';
import { fileOperationPage } from '../../../packages/scene/src/file-timeline.ts';
import { readingTarget } from '../../../packages/scene/src/reading-target.ts';
import { fileEvidence } from '../../../packages/scene/src/file-evidence.ts';
import {reviewInsights,findingMembers} from '../../../packages/scene/src/review-insights.ts';
import {commandPage} from '../../../packages/scene/src/commands.ts';
import {toolInventory,toolTrail} from '../../../packages/scene/src/tools.ts';
import {screenRun} from '../../../packages/scene/src/screen.ts';
import {gitSessionEvidence,commandAtWorkspace} from './git-session-evidence.ts';
import {delegationThread} from './delegation-thread.ts';
import { parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { sinceSnapshot } from '../../../packages/scene/src/since.ts';
import { verificationFor } from '../../../packages/scene/src/verification.ts';
import { fixChainFor } from '../../../packages/scene/src/fix-chains.ts';
import { readBeforeWriteFor } from '../../../packages/scene/src/read-before-write.ts';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ArtifactSlice, Observation, Operation, Projection } from '@drishya/contracts';
import { asOfProjection, isBlobText } from '@drishya/contracts';
import { defaultAdapters } from '@drishya/ingest';
import { createReducer, orderObservations, reduce, REDUCER_VERSION } from '@drishya/projection';
import { compose, dwellFor, markers, stepOfObservation, type Marker } from '@drishya/scene';
import type { HistoryPage, HistoryQuery } from '../../../packages/scene/src/history.ts';
import { historySummary } from '../../../packages/scene/src/history.ts';
import { nowFacts } from '../../../packages/scene/src/now.ts';
import { turnLedgers } from '../../../packages/scene/src/turns.ts';
import { SqliteBlobStore, Store } from '@drishya/store';
import { sanitize } from '@drishya/privacy';
import { prepareBriefing, prepareExplain, prepareLabels } from '@drishya/explain';

const source = new Store(workerData.dir, { readOnly: true });
const dir = join(workerData.dir, 'history');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(dir, 'index.db'));
// Everything here is a rebuildable cache, so a commit need not reach the disk before returning.
db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA cache_size=-8192;
  CREATE TABLE IF NOT EXISTS views(id TEXT PRIMARY KEY, revision TEXT NOT NULL, header TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS items(view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY(view_id,kind,id));
  CREATE INDEX IF NOT EXISTS item_position ON items(view_id,kind,position);
  CREATE TABLE IF NOT EXISTS file_ops(view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
    path TEXT NOT NULL, op_id TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(view_id,path,op_id));
  CREATE INDEX IF NOT EXISTS file_position ON file_ops(view_id,path,position);
`);
// Derived blobs live in index.db (PERF-2): one file per artifact made a cold rebuild of a large
// history spend seconds creating and renaming files. Earlier versions kept them in history/blobs;
// that directory is disposable and every view is rebuilt under the new HISTORY_VERSION.
rmSync(join(dir, 'blobs'), { recursive: true, force: true });
const blobs = new SqliteBlobStore(db, join(dir, 'blobs'));
// A global hash match alone is not ownership: forgetting another recording may remove it.
// Reuse only references held by observations of this view, which source-store GC preserves.
const capturedBlobs = new Set<string>();
function rememberCapturedBlobs(value: unknown): void {
  if (isBlobText(value)) { capturedBlobs.add(value.$blob); return; }
  if (Array.isArray(value)) { for (const child of value) rememberCapturedBlobs(child); }
  else if (value && typeof value === 'object') for (const child of Object.values(value)) rememberCapturedBlobs(child);
}
const io = {
  get: (sha: string) => source.blobs.get(sha) ?? blobs.get(sha),
  put: (text: string) => {
    // Most long typed/wrapper output already lives in the captured blob store. Its exact
    // hash can serve the artifact too; duplicating those bytes in index.db adds writes and
    // temporary SQLite buffers on every cold history build, without adding evidence.
    const sha = createHash('sha256').update(text).digest('hex');
    return capturedBlobs.has(sha) && source.blobs.has(sha) ? { sha, bytes: Buffer.byteLength(text) } : blobs.put(text);
  },
};
const adapters = Object.fromEntries(defaultAdapters().map((a) => [a.descriptor.id, a.descriptor]));
const HISTORY_VERSION = 'h3-lineage-4096';
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
      for (const o of ordered) rememberCapturedBlobs(o.payload);
      incremental.reducer.append(ordered);
      if (ordered.length) incremental.clock = new Date(ordered.at(-1)!.sourceTime!).toISOString();
      incremental.sequence = Math.max(incremental.sequence, ...added.map((o) => o.receivedSequence));
      return { projection: incremental.reducer.snapshot(live), appended: true };
    }
  }
  incremental = undefined;
  capturedBlobs.clear();
  if (ids.length !== 1) {
    const lineage = source.lineageForIds(ids);
    const input = lineage ? source.lineageObservations(lineage) : source.orderedObservations(ids);
    const ordered = { *[Symbol.iterator]() { for (const o of input) { rememberCapturedBlobs(o.payload); yield o; } } };
    const projection = reduce(lineage?.currentRecordingId ?? id, ordered, io, { adapters, live, ordered: true, maxProseChars: 4096, maxInputChars: 4096, lineage });
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
    rememberCapturedBlobs(o.payload);
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
  let releaseWorkingSet = false;
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
      for (const kind of ['context-readings', 'compactions', 'compactionSummaries'] as const) {
        const items = [...db.prepare('SELECT body FROM items WHERE view_id=? AND kind=? ORDER BY position').iterate(id, kind)].map(row => JSON.parse(String(row.body)));
        if (kind === 'context-readings') { if (projection.context) projection.context.readings = items; }
        else if (items.length) projection[kind] = items;
      }
    } else {
      // Individual histories use repeatable streaming SQL reads. Combined histories retain the
      // reducer's cross-source ordering and worktree identity until their merged disk cursor lands.
      cached = undefined;
      const built = build(id, ids, recordings.some((r) => r.live));
      projection = built.projection;
      const header = { ...projection, operations: [], prose: [], artifacts: [], links: [], timeline: [], passages: [], compactions: undefined, compactionSummaries: undefined,
        ...(projection.context ? { context: { ...projection.context, readings: [] } } : {}) };
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!built.appended) db.prepare('DELETE FROM views WHERE id=?').run(id);
        db.prepare('INSERT INTO views VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,header=excluded.header').run(id, revision, JSON.stringify(header));
        const insert = db.prepare(`INSERT INTO items VALUES(?,?,?,?,?) ON CONFLICT(view_id,kind,id) DO UPDATE SET
          position=excluded.position,body=excluded.body WHERE body<>excluded.body OR position<>excluded.position`);
        for (const kind of ['operations', 'prose', 'artifacts', 'links', 'timeline', 'passages'] as const) {
          projection[kind].forEach((item, position) => insert.run(id, kind, item.id, position, JSON.stringify(item)));
        }
        // Readings at one boundary fold as new receipts arrive. Remove obsolete derived rows on append too.
        for (const kind of ['context-readings', 'compactions', 'compactionSummaries'] as const) {
          db.prepare('DELETE FROM items WHERE view_id=? AND kind=?').run(id, kind);
          const items = kind === 'context-readings' ? projection.context?.readings : projection[kind];
          items?.forEach((item, position) => insert.run(id, kind, item.id, position, JSON.stringify(item)));
        }
        const file = db.prepare('INSERT OR IGNORE INTO file_ops VALUES(?,?,?,?)');
        projection.operations.forEach((op, position) => op.paths.forEach((path) => file.run(id, path.path, op.id, position)));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    cached = { id, revision, projection, revisions };
    releaseWorkingSet = ids.some(key => source.sourceBytes(key) > 32 * 1024 * 1024);
    return cached;
  } finally {
    source.db.exec('COMMIT');
    if (releaseWorkingSet) {
      // Full projection/reducer state remains available for warm reads and
      // incremental append. Release only unused SQLite bulk-read/write pages.
      source.db.exec('PRAGMA shrink_memory');
      db.exec('PRAGMA shrink_memory');
    }
  }
}

function page(id: string, query: HistoryQuery): HistoryPage {
  const { projection: full, revisions } = current(id);
  const requestedStep = query.step !== undefined && query.observationId ? stepOfObservation(full, query.observationId) ?? query.step : query.step;
  const step = Math.max(0, Math.min(full.timeline.length, Math.floor(requestedStep ?? full.timeline.length)));
  const historical = asOfProjection(full, step);
  const since = query.since === step && query.previousSince !== undefined ? query.previousSince : query.since;
  const scene = compose(full, { step, since, filter: query.filter, selectedOperationId: query.selectedOperationId });
  const count = Math.max(1, Math.min(64, Math.floor(query.count ?? 32)));
  const opMap = new Map(historical.operations.map((op) => [op.id, op]));
  const proseMap = new Map(historical.prose.map((pr) => [pr.id, pr]));
  const promptTarget = query.promptStep === undefined ? undefined : scene.passages.find(p => p.turnStep !== undefined && p.turnStep >= query.promptStep! - 1)?.id;
  const target = scene.passages.findIndex((ps) => ps.id === promptTarget || ps.ops.some((op) => op.id === query.selectedOperationId ||
    (query.observationId && opMap.get(op.id)?.observationIds.includes(query.observationId))) ||
    ps.prose.some((pr) => query.observationId && proseMap.get(pr.id)?.observationIds.includes(query.observationId)));
  const start = Math.max(0, Math.min(Math.max(0, scene.passages.length - count), Math.floor(query.start ?? (target >= 0 ? target - Math.floor(count / 2) : scene.passages.length - count))));
  const selected = new Set(scene.passages.slice(start, start + count).map((ps) => ps.id));
  for (const pin of query.pinnedPassageIds?.slice(0, 3) ?? []) selected.add(pin);
  const passages = scene.passages.filter((ps) => selected.has(ps.id));
  const opIds = new Set(passages.flatMap((ps) => ps.ops.map((op) => op.id)));
  for (const op of historical.operations) if (opIds.has(op.id) && op.parentOperationId) opIds.add(op.parentOperationId);
  const proseIds = new Set(passages.flatMap((ps) => ps.prose.map((pr) => pr.id)));
  const operations = historical.operations.filter((op) => opIds.has(op.id));
  const prose = historical.prose.filter((pr) => proseIds.has(pr.id));
  const noticeIds = new Set(passages.flatMap((ps) => ps.notices?.map((n) => n.id) ?? []));
  const notices = historical.notices?.filter((n) => noticeIds.has(n.id));
  const compactionIds = new Set(passages.flatMap(ps => ps.compactionIds ?? []));
  const compactions = historical.compactions?.filter(c => compactionIds.has(c.id));
  const summaryIds = new Set([...passages.flatMap(ps => ps.compactionSummaryIds ?? []), ...compactions?.flatMap(c => c.summaryId ? [c.summaryId] : []) ?? []]);
  const compactionSummaries = historical.compactionSummaries?.filter(s => summaryIds.has(s.id));
  const readingIds = new Set([historical.context?.latest?.id, ...compactions?.flatMap(c => [c.priorReadingId, c.nextReadingId]) ?? []]);
  const context = historical.context ? { latest: historical.context.latest, readings: historical.context.readings.filter(r => readingIds.has(r.id)) } : undefined;
  const artifactIds = new Set(operations.flatMap((op) => op.artifactIds));
  for (const pr of prose) if (pr.truncated) artifactIds.add(`art_${pr.id}_prose`);
  for (const summary of compactionSummaries ?? []) if (summary.artifactId) artifactIds.add(summary.artifactId);
  const evidenceIds = new Set([...operations.flatMap((op) => op.observationIds), ...prose.flatMap((pr) => pr.observationIds)]);
  const links = historical.links.filter((link) => opIds.has(link.from) || opIds.has(link.to) || link.sourceObservationIds.some((key) => evidenceIds.has(key)));
  const targets = new Set(links.flatMap((link) => [link.from, link.to]));
  const references = Object.fromEntries(historical.operations.filter((op) => targets.has(op.id)).map((op) => [op.id, { title: op.title, step: (op.endSequence ?? op.startSequence) + 1 }]));
  const projection: Projection = {
    ...historical, operations, prose, ...(notices?.length ? { notices } : { notices: undefined }),
    context, compactions, compactionSummaries,
    artifacts: historical.artifacts.filter((a) => artifactIds.has(a.id)),
    links,
    passages: historical.passages.filter((ps) => selected.has(ps.id)),
    timeline: full.timeline.slice(Math.max(0, step - 128), step),
  };
  // Keep a bounded captured chapter label across the full history, not just the
  // loaded window. Full prompt/material content still loads on demand.
  scene.passages = scene.passages.map((ps) => selected.has(ps.id) ? ps : { ...ps, ops: [], prose: [], turnPrompt: ps.turnPrompt && (ps.turnPrompt.length > 240 ? `${ps.turnPrompt.slice(0, 240)}…` : ps.turnPrompt), unloaded: true });
  const allMarkers = markers(full);
  const stride = Math.max(1, Math.ceil(allMarkers.length / 500));
  const lastQueue = full.timeline.slice(0, step).findLast(item => item.type === 'queue');
  return { ...(since !== undefined ? { since: Math.max(0, Math.min(step, since)) } : {}), ...(lastQueue?.type === 'queue' ? {queueBoundary: {ownerRecordingId: lastQueue.ownerRecordingId, observationId: lastQueue.sourceObservationId}} : {}), projection, scene, start, operationCount: historical.operations.length, summary: historySummary(historical), references, loadedPassageIds: passages.map((ps) => ps.id), revisions,
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

function artifactChunk(id: string, artifactId: string, start: number, requestedField?: 'text'|'structured') {
  if (artifactId.startsWith('result:')) {
    const operationId = artifactId.slice(7);
    const projection = current(id).projection;
    const op = projection.operations.find(op => op.id === operationId);
    if (!op || !['mcp','other'].includes(op.detail.kind) || op.endSequence === undefined) throw Error('Recorded result not found');
    const owner = id.split('+').find(recording => operationId.startsWith(recording + '.'));
    if (!owner) throw Error('Recorded result owner not found');
    const receipt = op.observationIds.map(observation => source.observationById(owner, observation)).filter((row): row is Observation => row?.kind === 'tool.result').at(-1);
    const payload = receipt?.payload as {text?: unknown; structured?: unknown} | undefined;
    const fields = (['text','structured'] as const).filter(key => payload?.[key] !== undefined);
    const field = requestedField ?? (fields.includes('text') ? 'text' : 'structured');
    let value = payload?.[field];
    if (!receipt || value === undefined) return {available:false,reason:'not-captured',fields,field};
    let partial: string | undefined;
    if (field === 'structured') {
      value = JSON.stringify(value, (_key, item: unknown) => {
        if (!isBlobText(item)) return item;
        const text = source.blobs.get(item.$blob);
        if (text !== undefined) return text;
        partial = 'Some captured structured values are no longer stored; unavailable references are shown explicitly.';
        return {$blob:item.$blob,availability:'no-longer-stored'};
      }, 2);
    }
    if (typeof value !== 'string' && !isBlobText(value)) return {available:false,reason:'not-captured',fields,field};
    const stored = typeof value === 'string' ? blobs.put(value) : undefined;
    const sha = stored?.sha ?? (isBlobText(value) ? value.$blob : '');
    const chunk = (stored ? blobs : source.blobs).readTextChunk(sha, start);
    const provenance = field === 'structured' ? {kind:'derived',rule:'captured-structured-json-v1',observationIds:[receipt.id]} : {kind:'captured',observationIds:[receipt.id]};
    const descriptor = {id:artifactId,kind:'output',observedAtSequence:op.endSequence,availability:receipt.availability,provenance,redacted:receipt.redactions.length>0,blob:sha,bytes:chunk?.totalBytes};
    return chunk ? {artifact:descriptor,available:true,...chunk,fields,field,partial} : {artifact:descriptor,available:false,reason:'no-longer-stored',fields,field};
  }
  const descriptor = artifact(id, artifactId, 0, 0);
  if (!descriptor.available || !descriptor.artifact.blob) return descriptor;
  // Prose is bounded in history pages, but its recorded body must remain readable
  // even when one line exceeds the line-slice response budget.
  const prose = descriptor.artifact.kind === 'excerpt' && db.prepare("SELECT id FROM items WHERE view_id=? AND kind='prose' AND id=?").get(id, artifactId.replace(/^art_(.*)_prose$/, '$1'));
  if (descriptor.artifact.kind !== 'output' && !prose) throw Error('Only recorded output or prose supports text continuation');
  const sha = descriptor.artifact.blob;
  const chunk = source.blobs.readTextChunk(sha, start) ?? blobs.readTextChunk(sha, start);
  return chunk ? { artifact: descriptor.artifact, available: true, ...chunk } : { artifact: descriptor.artifact, available: false, reason: 'no-longer-stored' };
}

function artifactFind(id: string, artifactId: string, query: string, start: number, continuation?: string) {
  current(id);
  const row = db.prepare("SELECT body FROM items WHERE view_id=? AND kind='artifacts' AND id=?").get(id, artifactId) as { body: string } | undefined;
  if (!row) throw new Error('Artifact not found');
  const item = JSON.parse(row.body) as Projection['artifacts'][number];
  if (!item.blob) return undefined;
  const store = source.blobs.has(item.blob) ? source.blobs : blobs;
  return store.findLines(item.blob, query, start, continuation);
}

function file(id: string, path: string, start: number, count: number, step?: number, query = '', selectedOperationId?: string) {
  const full = current(id).projection;
  const historical = step === undefined ? full : asOfProjection(full, step);
  return fileOperationPage(historical.operations, path, start, count, query, selectedOperationId);
}

parentPort!.on('message', (message: { id: number; method: string; args: any }) => {
  try {
    const a = message.args;
    let value: unknown;
    if (message.method === 'diagnostic-sqlite') {
      const config = (connection: DatabaseSync) => Object.fromEntries(['cache_size', 'mmap_size', 'page_size', 'temp_store'].map(key => [key, Object.values(connection.prepare('PRAGMA ' + key).get() ?? {})[0] ?? null]));
      value = { captured: config(source.db), derived: config(db), fullProjectionResident: !!cached, reducerResident: !!incremental };
    }
    else if (message.method === 'search-library') value = source.searchLibrary(a.query);
    else if(message.method==='finding-members')value=findingMembers(current(a.id).projection,a.key,a.page,a.q);
    else if(message.method==='review-insights')value=reviewInsights(current(a.id).projection,a.page,a.kind);
    else if (message.method === 'commands') value=commandPage(current(a.id).projection.operations,a.query);
    else if (message.method === 'tools') value=toolInventory(a.step===undefined?current(a.id).projection:asOfProjection(current(a.id).projection,a.step));
    else if (message.method === 'tool-trail') value=toolTrail(a.step===undefined?current(a.id).projection:asOfProjection(current(a.id).projection,a.step),a.filter,a.from);
    else if (message.method === 'queue') value=queuePage(current(a.id).projection.timeline, a.owner, a.query);
    else if (message.method === 'screen') value=screenRun((a.step===undefined?current(a.id).projection:asOfProjection(current(a.id).projection,a.step)).operations);
    else if(message.method==='git-session-evidence'){
      const projection=current(a.id).projection;
      value=gitSessionEvidence(projection,a.query,op=>commandAtWorkspace(op.observationIds.slice(0,8).map(id=>source.observationById(a.id,id)).filter((o):o is Observation=>!!o),projection.workspaceRoot));
    }
    else if(message.method==='delegation-thread'){
      const projection=current(a.id).projection;
      value=delegationThread(source,projection,a.operationId,a.start,a.step,a.taskStart);
    }
    else if (message.method === 'page') value = page(a.id, a.query);
    else if (message.method === 'page-bytes') value = new TextEncoder().encode(JSON.stringify(page(a.id, a.query)));
    else if (message.method === 'artifact') value = artifact(a.id, a.artifactId, a.start, a.count);
    else if (message.method === 'artifact-chunk') value = artifactChunk(a.id, a.artifactId, a.start, a.field);
    else if (message.method === 'artifact-find') value = artifactFind(a.id, a.artifactId, a.query, a.start, a.continuation);
    else if (message.method === 'file') value = file(a.id, a.path, a.start, a.count, a.step, a.query, a.selectedOperationId);
    else if (message.method === 'summary') value = historySummary(current(a.id).projection, a.from);
    else if (message.method === 'reading-target') value = readingTarget(current(a.id).projection, a.query);
    else if (message.method === 'file-evidence') value = fileEvidence(a.step === undefined ? current(a.id).projection : asOfProjection(current(a.id).projection, a.step), a.paths);
    else if (message.method === 'now') value = nowFacts(current(a.id).projection);
    else if (message.method === 'turns') value = turnLedgers(current(a.id).projection).slice(-2000);
    else if (message.method === 'since') value = sinceSnapshot(current(a.id).projection, a.after, a.page);
    else if (message.method === 'read-before') value = readBeforeWriteFor(current(a.id).projection, a.operationId) ?? null;
    else if (message.method === 'fix-chain') value = fixChainFor(current(a.id).projection, a.operationId) ?? null;
    else if (message.method === 'verification') value = verificationFor(current(a.id).projection, a.operationId) ?? null;
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
      // Derived blobs are disposable. Only rows of our own derived table are swept; captured
      // source blobs and harness paths are untouched.
      for (const sha of [...blobs.shas()]) if (!referenced.has(sha)) blobs.delete(sha);
    } else if (message.method === 'close') { cached = undefined; db.close(); source.close(); }
    else throw new Error('Unknown history request');
    // The encoder owns this exact-sized buffer; transfer it instead of cloning the
    // page's object graph and re-encoding it on capture's event loop.
    if (message.method === 'page-bytes') parentPort!.postMessage({ id: message.id, value }, [(value as Uint8Array<ArrayBuffer>).buffer]);
    else parentPort!.postMessage({ id: message.id, value });
  } catch (error) { parentPort!.postMessage({ id: message.id, error: sanitize(error instanceof Error ? error.message : 'History request failed').value }); }
});
