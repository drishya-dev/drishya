import {withFileRootEvidence} from './file-roots.ts';
import {createQueueEvidenceCache} from './queued-inputs.ts';
import {queuePage} from '../../../packages/scene/src/queued-inputs.ts';
import { fileOperationPage } from '../../../packages/scene/src/file-timeline.ts';
import { readingTarget } from '../../../packages/scene/src/reading-target.ts';
import { fileEvidence } from '../../../packages/scene/src/file-evidence.ts';
import { compareEvidence } from './git-compare-evidence.ts';
import {reviewInsights,findingMembers} from '../../../packages/scene/src/review-insights.ts';
import {commandPage} from '../../../packages/scene/src/commands.ts';
import {toolInventory,toolTrail} from '../../../packages/scene/src/tools.ts';
import {screenRun} from '../../../packages/scene/src/screen.ts';
import {gitSessionEvidence,commandAtWorkspace} from './git-session-evidence.ts';
import {delegationThread} from './delegation-thread.ts';
import { parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { sinceSnapshot } from '../../../packages/scene/src/since.ts';
import { verificationFor } from '../../../packages/scene/src/verification.ts';
import { fixChainFor } from '../../../packages/scene/src/fix-chains.ts';
import { readBeforeWriteFor } from '../../../packages/scene/src/read-before-write.ts';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ArtifactSlice, Observation, Operation, Projection } from '@drishya/contracts';
import { asOfProjection, isBlobText } from '@drishya/contracts';
import { buildTail, ChunkedFold, defaultAdapters } from '@drishya/ingest';
import { ProjectionFold, REDUCER_VERSION } from '@drishya/projection';
import { compose, dwellFor, markers, stepOfObservation, type Marker } from '@drishya/scene';
import type { HistoryPage, HistoryQuery } from '../../../packages/scene/src/history.ts';
import { historySummary } from '../../../packages/scene/src/history.ts';
import { nowFacts } from '../../../packages/scene/src/now.ts';
import { turnLedgers } from '../../../packages/scene/src/turns.ts';
import { contextReportCandidates } from './context-report-turns.ts';
import { SqliteBlobStore, Store } from '@drishya/store';
import { PRIVACY_POLICY_VERSION, sanitize } from '@drishya/privacy';

const source = new Store(workerData.dir, { readOnly: true });
const dir = join(workerData.dir, 'history');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const dbPath = join(dir, 'index.db');
let db: DatabaseSync;
try {
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 5000;');
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
} catch (error) {
  if (error instanceof Error && (error.message.includes('database is locked') || error.message.includes('busy'))) {
    console.error(`history: cache database ${dbPath} remained locked after 5s wait`);
  }
  throw error;
}
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
const HISTORY_VERSION = `h3-lineage-4096-${PRIVACY_POLICY_VERSION}`;
// At most one complete reducer workspace is resident, independent of how many recordings exist.
interface View { id: string; revision: string; projection: Projection; revisions: Record<string, number>; partial?: { observations: number } }
let cached: View | undefined;
const queueEvidenceFor = createQueueEvidenceCache(source);
/** The resident full fold of the last view built (PERF-4: the versioned `ProjectionFold`, as the daemon's followed recordings use). */
let resident: { id: string; ids: string[]; fold: ProjectionFold; lineage?: ChunkedFold['lineage']; sequence: number; ancestors: string } | undefined;
/** PERF-4: a recent-first view of a large recording, answered while its full fold runs in the background. */
let tail: { id: string; ids: string[]; fold: ProjectionFold; observations: number; ancestors: string } | undefined;
let background: { id: string; ids: string[]; cancelled: boolean; finished: Promise<void> } | undefined;
/** Observations a followed view appends in one go; a bigger backlog is rebuilt. */
const APPEND_BATCH = 5000;
/** A recording of at least this many observations opens from its tail first (a cold full fold of ~6,000 takes ~0.8 s here). */
const TAIL_FIRST_OBSERVATIONS = process.env.DRISHYA_TAIL_FIRST === '0' ? Infinity : 6000; // DRISHYA_TAIL_FIRST=0 switches recent-first opening off
/** The revisions of every part but the last: a followed lineage grows only at its end, so a change in an ancestor means a rebuild. */
const ancestorRevisions = (ids: string[], revisions: Record<string, number>) => JSON.stringify(ids.slice(0, -1).map((key) => revisions[key]));
const reduceOptions = (live: boolean) => ({ adapters, live, ordered: true, maxProseChars: 4096, maxInputChars: 4096 }) as const;
const yieldToLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

/** The projection of a combined or lineage view, as the reader shows it: no single workspace when the parts disagree. */
function shaped(projection: Projection, ids: string[]): Projection {
  if (ids.length === 1) return projection;
  const roots = ids.map((key) => {
    const root = source.getRecording(key)?.workspaceRoot?.replace(/\\/g, '/').replace(/\/+$/, '');
    return root && /^[A-Za-z]:\//.test(root) ? root.toLowerCase() : root;
  });
  if (roots.some((root) => !root) || new Set(roots).size !== 1) projection.workspaceRoot = undefined;
  return projection;
}

/** Folds a whole view in this thread with no pause, or resumes the resident fold with what was stored after it. */
function build(id: string, ids: string[], live: boolean, revisions: Record<string, number>): { projection: Projection; appended: boolean } {
  const last = ids.at(-1)!;
  if (resident?.id === id && resident.ids.join('+') === ids.join('+') && resident.ancestors === ancestorRevisions(ids, revisions)) {
    const added = source.observations(last, resident.sequence, APPEND_BATCH + 1);
    if (added.length <= APPEND_BATCH) {
      const accepted = resident.lineage ? resident.lineage.filter(added) : added;
      for (const o of accepted) rememberCapturedBlobs(o.payload);
      if (resident.fold.append(accepted)) {
        resident.sequence = Math.max(resident.sequence, ...added.map((o) => o.receivedSequence));
        return { projection: shaped(resident.fold.snapshot(live), ids), appended: true };
      }
    }
  }
  resident = undefined;
  capturedBlobs.clear();
  const chunked = new ChunkedFold(source, ids, io, reduceOptions(live), (o) => rememberCapturedBlobs(o.payload));
  while (!chunked.step(2000));
  const projection = shaped(chunked.fold.snapshot(live), ids);
  resident = { id, ids, fold: chunked.fold, lineage: chunked.lineage, sequence: chunked.fold.sequenceOf(last), ancestors: ancestorRevisions(ids, revisions) };
  return { projection, appended: false };
}

/** What a read of one view needs from the source store, taken in one short read so the revisions and the rows agree. */
function lookup(id: string) {
  const ids = [...new Set(id.split('+').filter(Boolean))];
  if (!ids.length || ids.length > 16) throw new Error('Choose between one and sixteen recordings');
  source.db.exec('BEGIN');
  try {
    const recordings = ids.map((key) => { const rec = source.getRecording(key); if (!rec) throw new Error('Recording not found'); return rec; });
    const revisions = Object.fromEntries(recordings.map((r) => [r.id, r.revision ?? 0]));
    const revision = JSON.stringify(recordings.map((r) => [r.id, r.revision, r.live, REDUCER_VERSION, HISTORY_VERSION]));
    return { ids, recordings, revisions, revision, live: recordings.some((r) => r.live), observations: recordings.reduce((n, r) => n + r.observationCount, 0) };
  } finally { source.db.exec('COMMIT'); }
}
type Lookup = ReturnType<typeof lookup>;

/** The view already built for this revision: resident, or saved in the history index by an earlier run. */
function stored(id: string, ctx: Lookup): View | undefined {
  if (cached?.id === id && cached.revision === ctx.revision) return cached;
  const saved = db.prepare('SELECT revision, header FROM views WHERE id=?').get(id) as { revision: string; header: string } | undefined;
  if (saved?.revision !== ctx.revision) return undefined;
  const projection = JSON.parse(saved.header) as Projection;
  for (const kind of ['operations', 'prose', 'artifacts', 'links', 'timeline', 'passages'] as const) {
    const items = [];
    for (const row of db.prepare('SELECT body FROM items WHERE view_id=? AND kind=? ORDER BY position').iterate(id, kind)) items.push(JSON.parse(String(row.body)));
    projection[kind] = items as never;
  }
  for (const kind of ['context-readings', 'compactions', 'compactionSummaries'] as const) {
    const items = [...db.prepare('SELECT body FROM items WHERE view_id=? AND kind=? ORDER BY position').iterate(id, kind)].map(row => JSON.parse(String(row.body)));
    if (kind === 'context-readings') { if (projection.context) projection.context.readings = items; }
    else if (items.length) projection[kind] = items as never;
  }
  cached = { id, revision: ctx.revision, projection, revisions: ctx.revisions };
  return cached;
}

/**
 * Writes a built projection to the history index: the header row, then every item, then the row that says the view
 * is complete (its revision). A generator so a long write can pause between chunks; `chunked` gives each chunk its
 * own transaction (the caller then yields to the event loop), otherwise the caller holds one transaction around it.
 */
function* persistView(id: string, revision: string, projection: Projection, appended: boolean, chunked: boolean): Generator<void> {
  const header = JSON.stringify({ ...projection, operations: [], prose: [], artifacts: [], links: [], timeline: [], passages: [], compactions: undefined, compactionSummaries: undefined,
    ...(projection.context ? { context: { ...projection.context, readings: [] } } : {}) });
  const begin = () => { if (chunked) db.exec('BEGIN IMMEDIATE'); };
  const commit = () => { if (chunked) db.exec('COMMIT'); };
  const rollback = () => { if (chunked) db.exec('ROLLBACK'); };
  begin();
  try {
    if (!appended) db.prepare('DELETE FROM views WHERE id=?').run(id);
    // Until the last chunk lands the row names a revision nobody asks for, so a half-written view is never read.
    db.prepare('INSERT INTO views VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,header=excluded.header').run(id, chunked ? 'writing' : revision, header);
    commit();
  } catch (error) { rollback(); throw error; }
  const insert = db.prepare(`INSERT INTO items VALUES(?,?,?,?,?) ON CONFLICT(view_id,kind,id) DO UPDATE SET
    position=excluded.position,body=excluded.body WHERE body<>excluded.body OR position<>excluded.position`);
  const CHUNK = 1500;
  const write = (rows: () => void) => { begin(); try { rows(); commit(); } catch (error) { rollback(); throw error; } };
  for (const kind of ['operations', 'prose', 'artifacts', 'links', 'timeline', 'passages'] as const) {
    const items = projection[kind];
    for (let from = 0; from < items.length; from += CHUNK) {
      write(() => { for (let position = from; position < Math.min(items.length, from + CHUNK); position++) insert.run(id, kind, items[position]!.id, position, JSON.stringify(items[position])); });
      if (chunked) yield;
    }
  }
  // Readings at one boundary fold as new receipts arrive. Remove obsolete derived rows on append too.
  write(() => {
    for (const kind of ['context-readings', 'compactions', 'compactionSummaries'] as const) {
      db.prepare('DELETE FROM items WHERE view_id=? AND kind=?').run(id, kind);
      const items = kind === 'context-readings' ? projection.context?.readings : projection[kind];
      items?.forEach((item, position) => insert.run(id, kind, item.id, position, JSON.stringify(item)));
    }
  });
  const file = db.prepare('INSERT OR IGNORE INTO file_ops VALUES(?,?,?,?)');
  for (let from = 0; from < projection.operations.length; from += CHUNK) {
    write(() => { for (let position = from; position < Math.min(projection.operations.length, from + CHUNK); position++) for (const path of projection.operations[position]!.paths) file.run(id, path.path, projection.operations[position]!.id, position); });
    if (chunked) yield;
  }
  if (chunked) { begin(); db.prepare('UPDATE views SET revision=? WHERE id=?').run(revision, id); commit(); }
}

/** A whole view, built here and now (nothing else is served meanwhile). Callers that may wait use `full` instead. */
function current(id: string): View {
  const ctx = lookup(id);
  const hit = stored(id, ctx);
  if (hit) return hit;
  let releaseWorkingSet = false;
  source.db.exec('BEGIN');
  try {
    // Individual histories use repeatable streaming SQL reads. Combined histories retain the
    // reducer's cross-source ordering and worktree identity until their merged disk cursor lands.
    cached = undefined;
    const built = build(id, ctx.ids, ctx.live, ctx.revisions);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const _ of persistView(id, ctx.revision, built.projection, built.appended, false));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    cached = { id, revision: ctx.revision, projection: built.projection, revisions: ctx.revisions };
    releaseWorkingSet = ctx.ids.some(key => source.sourceBytes(key) > 32 * 1024 * 1024);
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

/** The whole view, waiting for a background fold of it if one is running. */
async function full(id: string): Promise<View> {
  const ids = [...new Set(id.split('+').filter(Boolean))];
  for (let wait = 0; wait < 4 && background && !background.cancelled && background.ids.join('+') === ids.join('+'); wait++) await background.finished;
  return current(id);
}

/** PERF-4 step 1: the last prompts of a large recording, reduced on their own. Appends what is stored since, or rebuilds. */
function tailView(id: string, ctx: Lookup): View {
  const last = ctx.ids.at(-1)!;
  if (tail?.id === id && tail.ids.join('+') === ctx.ids.join('+') && tail.ancestors === ancestorRevisions(ctx.ids, ctx.revisions)) {
    const added = source.observations(last, tail.fold.sequenceOf(last), APPEND_BATCH + 1);
    if (added.length <= APPEND_BATCH && tail.fold.append(added)) return { id, revision: ctx.revision, projection: shaped(tail.fold.snapshot(ctx.live), ctx.ids), revisions: ctx.revisions, partial: { observations: tail.observations + added.length } };
  }
  const built = buildTail(source, ctx.ids, io, reduceOptions(ctx.live));
  tail = { id, ids: ctx.ids, fold: built.fold, observations: built.observations, ancestors: ancestorRevisions(ctx.ids, ctx.revisions) };
  return { id, revision: ctx.revision, projection: shaped(built.fold.snapshot(ctx.live), ctx.ids), revisions: ctx.revisions, ...(built.complete ? {} : { partial: { observations: built.observations } }) };
}

/**
 * PERF-4 step 2: the full fold, in slices between the requests the worker is asked, so a long history never holds the
 * thread. Starts only after the recent-first view has been answered. When done it catches up with what arrived
 * meanwhile, writes the view, and tells the daemon (which tells the open page, so the swap arrives like any live update).
 */
function startBackground(id: string, ctx: Lookup): void {
  if (background && !background.cancelled && background.id === id) return;
  if (background) background.cancelled = true;
  const job: NonNullable<typeof background> = { id, ids: ctx.ids, cancelled: false, finished: Promise.resolve() };
  job.finished = (async () => {
    await yieldToLoop(); // the response that started this goes out first
    capturedBlobs.clear();
    const chunked = new ChunkedFold(source, ctx.ids, io, reduceOptions(ctx.live), (o) => rememberCapturedBlobs(o.payload));
    for (;;) {
      const start = performance.now();
      let done = false;
      while (!done && performance.now() - start < 20) done = chunked.step(200);
      if (job.cancelled) return;
      if (done) break;
      await yieldToLoop();
    }
    if (job.cancelled) return;
    // Catch up with what was stored while the fold ran: one short read, then the append.
    const now = lookup(id);
    const last = ctx.ids.at(-1)!;
    const added = source.observations(last, chunked.fold.sequenceOf(last), APPEND_BATCH + 1);
    const accepted = chunked.lineage ? chunked.lineage.filter(added) : added;
    for (const o of accepted) rememberCapturedBlobs(o.payload);
    if (ancestorRevisions(ctx.ids, now.revisions) !== ancestorRevisions(ctx.ids, ctx.revisions) || added.length > APPEND_BATCH || !chunked.fold.append(accepted)) { if (background === job) background = undefined; return; } // the next request rebuilds in one go
    const projection = shaped(chunked.fold.snapshot(now.live), ctx.ids);
    const write = persistView(id, now.revision, projection, false, true);
    for (let step = write.next(); !step.done; step = write.next()) { await yieldToLoop(); if (job.cancelled) return; }
    resident = { id, ids: ctx.ids, fold: chunked.fold, lineage: chunked.lineage, sequence: Math.max(chunked.fold.sequenceOf(last), ...added.map((o) => o.receivedSequence)), ancestors: ancestorRevisions(ctx.ids, ctx.revisions) };
    cached = { id, revision: now.revision, projection, revisions: now.revisions };
    tail = undefined;
    if (background === job) background = undefined;
    parentPort!.postMessage({ event: 'full-ready', viewId: id });
  })().catch((error) => { if (background === job) background = undefined; console.error('history: background fold failed:', error instanceof Error ? error.message : error); });
  background = job;
}

/** What a page is answered from: the whole view when it exists, else (when the caller allows) the recent-first one. */
async function pageView(id: string, allowPartial: boolean): Promise<View> {
  if (!allowPartial) return full(id);
  const ctx = lookup(id);
  const hit = stored(id, ctx);
  if (hit) return hit;
  const resumable = resident?.id === id && resident.ids.join('+') === ctx.ids.join('+') && resident.ancestors === ancestorRevisions(ctx.ids, ctx.revisions);
  if (resumable || ctx.observations < TAIL_FIRST_OBSERVATIONS) return full(id);
  const view = tailView(id, ctx);
  if (view.partial) startBackground(id, ctx);
  return view;
}

async function page(id: string, query: HistoryQuery): Promise<HistoryPage> {
  const view = await pageView(id, !!query.tailFirst);
  const { projection: full, revisions } = view;
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
  const anchor = query.anchorPassageId ? scene.passages.findIndex((ps) => ps.id === query.anchorPassageId) : -1;
  const start = Math.max(0, Math.min(Math.max(0, scene.passages.length - count), Math.floor(query.start ?? (anchor >= 0 ? anchor : target >= 0 ? target - Math.floor(count / 2) : scene.passages.length - count))));
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
  return { ...(view.partial ? { partial: view.partial } : {}), ...(since !== undefined ? { since: Math.max(0, Math.min(step, since)) } : {}), ...(lastQueue?.type === 'queue' ? {queueBoundary: {ownerRecordingId: lastQueue.ownerRecordingId, observationId: lastQueue.sourceObservationId}} : {}), projection, scene, start, operationCount: historical.operations.length, summary: historySummary(historical), references, loadedPassageIds: passages.map((ps) => ps.id), revisions,
    markers: allMarkers.filter((_, i) => i % stride === 0), dwell: dwellFor(full, step) };
}

async function artifact(id: string, artifactId: string, start: number, count: number): Promise<ArtifactSlice> {
  await full(id);
  const row = db.prepare("SELECT body FROM items WHERE view_id=? AND kind='artifacts' AND id=?").get(id, artifactId) as { body: string } | undefined;
  if (!row) throw new Error('Artifact not found');
  const artifact = JSON.parse(row.body) as Projection['artifacts'][number];
  const empty = { artifact, start, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
  if (!artifact.blob) return { ...empty, available: false, reason: 'not-captured' };
  const slice = source.blobs.readLines(artifact.blob, start, count) ?? blobs.readLines(artifact.blob, start, count);
  return slice ? { artifact, available: true, start, ...slice } : { ...empty, available: false, reason: 'no-longer-stored' };
}

async function artifactChunk(id: string, artifactId: string, start: number, requestedField?: 'text'|'structured') {
  if (artifactId.startsWith('result:')) {
    const operationId = artifactId.slice(7);
    const projection = (await full(id)).projection;
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
  const descriptor = await artifact(id, artifactId, 0, 0);
  if (!descriptor.available || !descriptor.artifact.blob) return descriptor;
  // Prose is bounded in history pages, but its recorded body must remain readable
  // even when one line exceeds the line-slice response budget.
  const prose = descriptor.artifact.kind === 'excerpt' && db.prepare("SELECT id FROM items WHERE view_id=? AND kind='prose' AND id=?").get(id, artifactId.replace(/^art_(.*)_prose$/, '$1'));
  if (descriptor.artifact.kind !== 'output' && !prose) throw Error('Only recorded output or prose supports text continuation');
  const sha = descriptor.artifact.blob;
  const chunk = source.blobs.readTextChunk(sha, start) ?? blobs.readTextChunk(sha, start);
  return chunk ? { artifact: descriptor.artifact, available: true, ...chunk } : { artifact: descriptor.artifact, available: false, reason: 'no-longer-stored' };
}

async function artifactFind(id: string, artifactId: string, query: string, start: number, continuation?: string) {
  await full(id);
  const row = db.prepare("SELECT body FROM items WHERE view_id=? AND kind='artifacts' AND id=?").get(id, artifactId) as { body: string } | undefined;
  if (!row) throw new Error('Artifact not found');
  const item = JSON.parse(row.body) as Projection['artifacts'][number];
  if (!item.blob) return undefined;
  const store = source.blobs.has(item.blob) ? source.blobs : blobs;
  return store.findLines(item.blob, query, start, continuation);
}

async function file(id: string, path: string, start: number, count: number, step?: number, query = '', selectedOperationId?: string) {
  const whole = (await full(id)).projection;
  const historical = step === undefined ? whole : asOfProjection(whole, step);
  return fileOperationPage(historical.operations, path, start, count, query, selectedOperationId);
}

parentPort!.on('message', async (message: { id: number; method: string; args: any }) => {
  try {
    const a = message.args;
    let value: unknown;
    if (message.method === 'diagnostic-sqlite') {
      const config = (connection: DatabaseSync) => Object.fromEntries(['cache_size', 'mmap_size', 'page_size', 'temp_store'].map(key => [key, Object.values(connection.prepare('PRAGMA ' + key).get() ?? {})[0] ?? null]));
      value = { captured: config(source.db), derived: config(db), fullProjectionResident: !!cached, reducerResident: !!resident };
    }
    else if (message.method === 'search-library') value = source.searchLibrary(a.query);
    else if(message.method==='finding-members')value=findingMembers((await full(a.id)).projection,a.key,a.page,a.q);
    else if(message.method==='review-insights')value=reviewInsights((await full(a.id)).projection,a.page,a.kind);
    else if (message.method === 'commands') value=commandPage((await full(a.id)).projection.operations,a.query);
    else if (message.method === 'tools') value=toolInventory(a.step===undefined?(await full(a.id)).projection:asOfProjection((await full(a.id)).projection,a.step));
    else if (message.method === 'tool-trail') value=toolTrail(a.step===undefined?(await full(a.id)).projection:asOfProjection((await full(a.id)).projection,a.step),a.filter,a.from);
    else if (message.method === 'queue') {
      const view=await full(a.id), revision=JSON.stringify(view.revisions);
      value=queuePage(view.projection.timeline,a.owner,a.query,queueEvidenceFor(view.projection,a.owner,revision,a.id));
    }
    else if (message.method === 'screen') value=screenRun((a.step===undefined?(await full(a.id)).projection:asOfProjection((await full(a.id)).projection,a.step)).operations);
    else if(message.method==='git-session-evidence'){
      const projection=(await full(a.id)).projection;
      value=gitSessionEvidence(projection,a.query,op=>commandAtWorkspace(op.observationIds.slice(0,8).map(id=>source.observationById(a.id,id)).filter((o):o is Observation=>!!o),projection.workspaceRoot));
    }
    else if(message.method==='delegation-thread'){
      const projection=(await full(a.id)).projection;
      value=delegationThread(source,projection,a.operationId,a.start,a.step,a.taskStart);
    }
    else if (message.method === 'page') value = await page(a.id, a.query);
    else if (message.method === 'page-bytes') value = new TextEncoder().encode(JSON.stringify(await page(a.id, a.query)));
    else if (message.method === 'artifact') value = await artifact(a.id, a.artifactId, a.start, a.count);
    else if (message.method === 'artifact-chunk') value = await artifactChunk(a.id, a.artifactId, a.start, a.field);
    else if (message.method === 'artifact-find') value = await artifactFind(a.id, a.artifactId, a.query, a.start, a.continuation);
    else if (message.method === 'file') value = await file(a.id, a.path, a.start, a.count, a.step, a.query, a.selectedOperationId);
    else if (message.method === 'summary') value = historySummary((await full(a.id)).projection, a.from);
    else if (message.method === 'reading-target') value = readingTarget((await full(a.id)).projection, a.query);
    else if (message.method === 'file-evidence') value = fileEvidence(a.step === undefined ? (await full(a.id)).projection : asOfProjection((await full(a.id)).projection, a.step), a.paths);
    else if (message.method === 'compare-evidence') value = compareEvidence((await full(a.id)).projection, a.paths);
    else if(message.method==='file-roots') value=withFileRootEvidence(a.roots,(await full(a.id)).projection,a.workspaceRoot);
    else if (message.method === 'now') value = nowFacts((await full(a.id)).projection);
    else if (message.method === 'context-report') value = contextReportCandidates((await full(a.id)).projection.timeline);
    else if (message.method === 'turns') value = turnLedgers((await full(a.id)).projection).slice(-2000);
    else if (message.method === 'since') value = sinceSnapshot((await full(a.id)).projection, a.after, a.page);
    else if (message.method === 'read-before') value = readBeforeWriteFor((await full(a.id)).projection, a.operationId) ?? null;
    else if (message.method === 'fix-chain') value = fixChainFor((await full(a.id)).projection, a.operationId) ?? null;
    else if (message.method === 'verification') value = verificationFor((await full(a.id)).projection, a.operationId) ?? null;
    else if (message.method === 'marker') {
      const p = (await full(a.id)).projection;
      const candidates = markers(p).filter((m) => a.types.includes(m.type) && (a.direction > 0 ? m.step > a.step : m.step < a.step));
      value = (a.direction > 0 ? candidates[0] : candidates.at(-1))?.step;
    } else if (message.method === 'forget') {
      for (const row of db.prepare('SELECT id FROM views').all()) if (String(row.id).split('+').includes(a.id)) db.prepare('DELETE FROM views WHERE id=?').run(String(row.id));
      cached = undefined;
      resident = undefined;
      tail = undefined;
      if (background) background.cancelled = true;
      background = undefined;
      const referenced = new Set<string>();
      for (const row of db.prepare("SELECT body FROM items WHERE kind='artifacts'").iterate()) {
        const sha = (JSON.parse(String(row.body)) as { blob?: string }).blob;
        if (sha) referenced.add(sha);
      }
      // Derived blobs are disposable. Only rows of our own derived table are swept; captured
      // source blobs and harness paths are untouched.
      for (const sha of [...blobs.shas()]) if (!referenced.has(sha)) blobs.delete(sha);
    } else if (message.method === 'close') { if (background) background.cancelled = true; background = undefined; cached = undefined; resident = undefined; tail = undefined; db.close(); source.close(); }
    else throw new Error('Unknown history request');
    // The encoder owns this exact-sized buffer; transfer it instead of cloning the
    // page's object graph and re-encoding it on capture's event loop.
    if (message.method === 'page-bytes') parentPort!.postMessage({ id: message.id, value }, [(value as Uint8Array<ArrayBuffer>).buffer]);
    else parentPort!.postMessage({ id: message.id, value });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('database is locked') || error.message.includes('busy'))) {
      console.error(`history: cache database ${dbPath} remained locked after 5s wait`);
    }
    parentPort!.postMessage({ id: message.id, error: sanitize(error instanceof Error ? error.message : 'History request failed').value });
  }
});
