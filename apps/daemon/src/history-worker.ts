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
import { FOLD_FORMAT, ProjectionFold, REDUCER_VERSION, type FoldHead } from '@drishya/projection';
import { compose, dwellFor, markers, stepOfObservation, type Marker } from '@drishya/scene';
import type { HistoryPage, HistoryQuery } from '../../../packages/scene/src/history.ts';
import { historySummary } from '../../../packages/scene/src/history.ts';
import { nowFacts } from '../../../packages/scene/src/now.ts';
import { turnLedgers } from '../../../packages/scene/src/turns.ts';
import { contextReportCandidates } from './context-report-turns.ts';
import { SqliteBlobStore, Store, type LineageSeen } from '@drishya/store';
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
    CREATE TABLE IF NOT EXISTS folds(id TEXT PRIMARY KEY, key TEXT NOT NULL, meta TEXT NOT NULL, state BLOB NOT NULL);
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
let resident: { id: string; ids: string[]; fold: ProjectionFold; lineage?: ChunkedFold['lineage']; sequence: number; rows: number; ancestors: string; saved: number } | undefined;
/** PERF-4: a recent-first view of a large recording, answered while its full fold runs in the background. */
let tail: { id: string; ids: string[]; fold: ProjectionFold; observations: number; ancestors: string; last?: Projection } | undefined;
let background: { id: string; ids: string[]; cancelled: boolean; finished: Promise<void> } | undefined;
/** Observations a followed view appends in one go; a bigger backlog is rebuilt. */
const APPEND_BATCH = 5000;
/** A recording of at least this many observations opens from its tail first (a cold full fold of ~6,000 takes ~0.8 s here). */
// DRISHYA_TAIL_FIRST=0 switches recent-first opening off; a number sets the size (tests and measurements); DRISHYA_TAIL_PROMPTS sets how many prompts a tail holds.
const TAIL_FIRST_OBSERVATIONS = process.env.DRISHYA_TAIL_FIRST === '0' ? Infinity : Number(process.env.DRISHYA_TAIL_FIRST) > 0 ? Number(process.env.DRISHYA_TAIL_FIRST) : 6000;
const TAIL_HOLD_MS = Number(process.env.DRISHYA_TAIL_HOLD_MS) > 0 ? Number(process.env.DRISHYA_TAIL_HOLD_MS) : 0;
const TAIL_PROMPT_COUNT = Number(process.env.DRISHYA_TAIL_PROMPTS) > 0 ? Number(process.env.DRISHYA_TAIL_PROMPTS) : undefined;
/** What every part but the last holds: a followed lineage grows only at its end, so growth in an ancestor means a rebuild. (Counts, not revisions: following or pausing an ancestor changes its revision and not its content.) */
const ancestorRevisions = (ids: string[], counts: Record<string, number>) => JSON.stringify(ids.slice(0, -1).map((key) => counts[key]));
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
function build(id: string, ids: string[], live: boolean, counts: Record<string, number>): { projection: Projection; appended: boolean } {
  const last = ids.at(-1)!;
  const residentFor = () => resident?.id === id && resident.ids.join('+') === ids.join('+') && resident.ancestors === ancestorRevisions(ids, counts);
  // A stored view with no fold behind it (a restart) resumes the remembered fold instead of folding the history again.
  if (!residentFor() && (counts[last] ?? 0) >= TAIL_FIRST_OBSERVATIONS) resume(id, { ids, counts });
  if (resident && residentFor()) {
    const added = source.observations(last, resident.sequence, APPEND_BATCH + 1);
    // The rows stored must be exactly the rows folded plus these: a row deleted or rewritten under the fold is a rebuild.
    const total = source.countObservations(last);
    if (added.length <= APPEND_BATCH && total === resident.rows + added.length) {
      const accepted = resident.lineage ? resident.lineage.filter(added) : added;
      for (const o of accepted) rememberCapturedBlobs(o.payload);
      if (resident.fold.append(accepted)) {
        resident.sequence = Math.max(resident.sequence, ...added.map((o) => o.receivedSequence));
        resident.rows = total;
        scheduleCheckpoint();
        return { projection: shaped(resident.fold.snapshot(live), ids), appended: true };
      }
    }
  }
  if (process.env.DRISHYA_HISTORY_TIMING) console.error('history build: rebuilding;', resident ? `resident matches=${residentFor()} rows=${resident.rows} total=${source.countObservations(last)} seq=${resident.sequence}` : 'no resident');
  resident = undefined;
  capturedBlobs.clear();
  const chunked = new ChunkedFold(source, ids, io, reduceOptions(live), (o) => rememberCapturedBlobs(o.payload));
  while (!chunked.step(2000));
  const projection = shaped(chunked.fold.snapshot(live), ids);
  resident = { id, ids, fold: chunked.fold, lineage: chunked.lineage, sequence: source.lastSequence(last), rows: source.countObservations(last), ancestors: ancestorRevisions(ids, counts), saved: 0 };
  scheduleCheckpoint();
  return { projection, appended: false };
}

// ── PERF-4 step 4: a remembered fold per recording ────────────────────────────────────────────────────────────────────
// The resident fold is written to the history index (Drishya-owned data: the observations it folds are already sealed, so
// nothing here holds a secret the store does not) and read back after a restart or a session switch, so a cold open appends
// only what is new. A checkpoint is used only while EVERY input that decides what the fold would produce is the one it was
// written for; anything else rebuilds, as before.
const adaptersDigest = createHash('sha256').update(JSON.stringify(adapters)).digest('hex').slice(0, 16);
/** What a fold's result depends on besides the observations: code, options, privacy policy, adapters, the recordings read. */
const checkpointKey = (ids: string[]) => JSON.stringify([FOLD_FORMAT, REDUCER_VERSION, HISTORY_VERSION, reduceOptions(false).maxProseChars, reduceOptions(false).maxInputChars, adaptersDigest, ids]);
const dropCheckpoint = (id: string) => { db.prepare('DELETE FROM folds WHERE id=?').run(id); };
let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
/** Rewriting the checkpoint on every live append would cost more than it saves: it follows a quiet spell of the session. */
const CHECKPOINT_QUIET_MS = process.env.DRISHYA_CHECKPOINT_QUIET_MS ? Number(process.env.DRISHYA_CHECKPOINT_QUIET_MS) : 20_000;
/** Appended rows since the saved checkpoint that make another one worth writing. */
const CHECKPOINT_MIN_GAIN = 200;

/** Writes the resident fold. Returns false when there was nothing worth writing. */
function saveCheckpoint(force = false): boolean {
  const r = resident;
  if (!r || (!force && (r.rows < TAIL_FIRST_OBSERVATIONS || (r.saved > 0 && r.rows - r.saved < CHECKPOINT_MIN_GAIN)))) return false;
  const checkpoint = r.fold.checkpoint();
  const meta = JSON.stringify({ head: checkpoint.head, blobs: checkpoint.blobs, sequence: r.sequence, rows: r.rows, ancestors: r.ancestors, lineage: r.lineage?.exportSeen() });
  db.prepare('INSERT INTO folds VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET key=excluded.key, meta=excluded.meta, state=excluded.state').run(r.id, checkpointKey(r.ids), meta, checkpoint.state);
  r.saved = r.rows;
  return true;
}
function scheduleCheckpoint() {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => { checkpointTimer = undefined; try { saveCheckpoint(); } catch (error) { console.error('history: checkpoint not written:', error instanceof Error ? error.message : error); } }, CHECKPOINT_QUIET_MS);
  checkpointTimer.unref?.();
}

/**
 * Resumes the resident fold from the remembered one, when it is the one this view would build. Everything it checks:
 * the key (reducer, fold format, privacy policy, options, adapters, the recordings and their order), that no ancestor
 * of a lineage grew, that the last recording still holds at least the rows folded, that the lineage is the same, that
 * the head is a head this code can append to (restore), and that the blobs the state names are still stored.
 */
function resume(id: string, ctx: Pick<Lookup, 'ids' | 'counts'>): boolean {
  if (resident?.id === id) return false;
  const row = db.prepare('SELECT key, meta, state FROM folds WHERE id=?').get(id) as { key: string; meta: string; state: Uint8Array } | undefined;
  if (!row) return false;
  const reject = () => { dropCheckpoint(id); return false; };
  if (row.key !== checkpointKey(ctx.ids)) return reject();
  let meta: { head: FoldHead; blobs: string[]; sequence: number; rows: number; ancestors: string; lineage?: LineageSeen };
  try { meta = JSON.parse(row.meta); } catch { return reject(); }
  const last = ctx.ids.at(-1)!;
  if (meta.ancestors !== ancestorRevisions(ctx.ids, ctx.counts) || ctx.counts[last]! < meta.rows || source.lastSequence(last) < meta.sequence) return reject();
  const lineage = ctx.ids.length > 1 ? source.lineageForIds(ctx.ids) : undefined;
  if (ctx.ids.length > 1 && (!lineage || !meta.lineage)) return reject();
  const reader = lineage ? source.lineageReader(lineage, meta.lineage) : undefined;
  if (meta.blobs.some((sha) => !source.blobs.has(sha) && !blobs.has(sha))) return reject();
  const fold = ProjectionFold.restore({ head: meta.head, state: Buffer.from(row.state.buffer, row.state.byteOffset, row.state.byteLength), blobs: meta.blobs }, io, { ...reduceOptions(false), ...(lineage ? { lineage } : {}) });
  if (!fold) return reject();
  capturedBlobs.clear();
  resident = { id, ids: ctx.ids, fold, lineage: reader, sequence: meta.sequence, rows: meta.rows, ancestors: meta.ancestors, saved: meta.rows };
  return true;
}

/** What a read of one view needs from the source store, taken in one short read so the revisions and the rows agree. */
function lookup(id: string) {
  const ids = [...new Set(id.split('+').filter(Boolean))];
  if (!ids.length || ids.length > 16) throw new Error('Choose between one and sixteen recordings');
  source.db.exec('BEGIN');
  try {
    const recordings = ids.map((key) => { const rec = source.getRecording(key); if (!rec) throw new Error('Recording not found'); return rec; });
    const revisions = Object.fromEntries(recordings.map((r) => [r.id, r.revision ?? 0]));
    const counts = Object.fromEntries(recordings.map((r) => [r.id, r.observationCount]));
    const revision = JSON.stringify(recordings.map((r) => [r.id, r.revision, r.live, REDUCER_VERSION, HISTORY_VERSION]));
    return { ids, recordings, revisions, counts, revision, live: recordings.some((r) => r.live), observations: recordings.reduce((n, r) => n + r.observationCount, 0) };
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
    const t0 = performance.now();
    const built = build(id, ctx.ids, ctx.live, ctx.counts);
    const t1 = performance.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const _ of persistView(id, ctx.revision, built.projection, built.appended, false));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (process.env.DRISHYA_HISTORY_TIMING) console.error('history current: build', Math.round(t1 - t0), 'ms appended', built.appended, 'persist', Math.round(performance.now() - t1), 'ms');
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

/**
 * The whole view. A large recording is folded in the background even when nobody asked for its latest work first (the
 * Files tree or the toolbox may be the first request to arrive): building it here would hold this thread for seconds,
 * with the recent-first page of the same recording queued behind it. Small recordings are built at once.
 */
class Loading extends Error { constructor() { super('loading'); } }
async function full(id: string, wait = true): Promise<View> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctx = lookup(id);
    const hit = stored(id, ctx);
    if (hit) return hit;
    if (ctx.observations >= TAIL_FIRST_OBSERVATIONS && attempt === 0) resume(id, ctx);
    const resumable = resident?.id === id && resident.ids.join('+') === ctx.ids.join('+') && resident.ancestors === ancestorRevisions(ctx.ids, ctx.counts);
    if (resumable || ctx.observations < TAIL_FIRST_OBSERVATIONS || attempt === 3) break;
    startBackground(id, ctx);
    // A caller that would only hold a connection open until the whole view exists is told it is still loading and asks again.
    if (!wait) throw new Loading();
    await background?.finished;
  }
  return current(id);
}

/** PERF-4 step 1: the last prompts of a large recording, reduced on their own. Appends what is stored since, or rebuilds. */
function tailView(id: string, ctx: Lookup): View {
  const last = ctx.ids.at(-1)!;
  if (tail?.id === id && tail.ids.join('+') === ctx.ids.join('+') && tail.ancestors === ancestorRevisions(ctx.ids, ctx.counts)) {
    const added = source.observations(last, tail.fold.sequenceOf(last), APPEND_BATCH + 1);
    if (added.length <= APPEND_BATCH && tail.fold.append(added)) {
      const projection = shaped(tail.fold.snapshot(ctx.live), ctx.ids);
      tail.last = projection;
      return { id, revision: ctx.revision, projection, revisions: ctx.revisions, partial: { observations: tail.observations + added.length } };
    }
  }
  const built = buildTail(source, ctx.ids, io, reduceOptions(ctx.live), { prompts: TAIL_PROMPT_COUNT });
  const projection = shaped(built.fold.snapshot(ctx.live), ctx.ids);
  tail = { id, ids: ctx.ids, fold: built.fold, observations: built.observations, ancestors: ancestorRevisions(ctx.ids, ctx.counts), last: projection };
  return { id, revision: ctx.revision, projection, revisions: ctx.revisions, ...(built.complete ? {} : { partial: { observations: built.observations } }) };
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
    if (TAIL_HOLD_MS) await new Promise((resolve) => setTimeout(resolve, TAIL_HOLD_MS)); // a test switch: lets a browser spec look at the recent-first page
    // Folded again (at most twice more) if an ancestor of the lineage grew or the catch-up cannot append while it ran; then the
    // next request that needs the whole view builds it in one go.
    for (let attempt = 0; attempt < 3; attempt++) {
      const from = attempt === 0 ? ctx : lookup(id);
      capturedBlobs.clear();
      const chunked = new ChunkedFold(source, from.ids, io, reduceOptions(from.live), (o) => rememberCapturedBlobs(o.payload));
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
      const last = from.ids.at(-1)!;
      const added = source.observations(last, chunked.fold.sequenceOf(last), APPEND_BATCH + 1);
      // Counted in the same tick as the read: rows stored while the view is written below are not in this fold (the next append takes them).
      const rowsFolded = source.countObservations(last);
      const accepted = chunked.lineage ? chunked.lineage.filter(added) : added;
      for (const o of accepted) rememberCapturedBlobs(o.payload);
      if (ancestorRevisions(from.ids, now.counts) !== ancestorRevisions(from.ids, from.counts) || added.length > APPEND_BATCH || !chunked.fold.append(accepted)) continue;
      const lap = (label: string, since: number) => { if (process.env.DRISHYA_HISTORY_TIMING) console.error('history background', label, Math.round(performance.now() - since), 'ms'); };
      let mark = performance.now();
      const projection = shaped(chunked.fold.snapshot(now.live), from.ids);
      lap('snapshot', mark);
      const write = persistView(id, now.revision, projection, false, true);
      let longest = 0;
      for (let step = write.next(); !step.done; ) { mark = performance.now(); step = write.next(); longest = Math.max(longest, performance.now() - mark); await yieldToLoop(); if (job.cancelled) return; }
      lap('longest write chunk', performance.now() - longest);
      resident = { id, ids: from.ids, fold: chunked.fold, lineage: chunked.lineage, sequence: Math.max(chunked.fold.sequenceOf(last), ...added.map((o) => o.receivedSequence)), rows: rowsFolded, ancestors: ancestorRevisions(from.ids, from.counts), saved: 0 };
      cached = { id, revision: now.revision, projection, revisions: now.revisions };
      tail = undefined;
      if (background === job) background = undefined;
      parentPort!.postMessage({ event: 'full-ready', viewId: id });
      // The whole fold is the expensive thing to lose: remembered shortly after the swap, once the page's burst of requests it
      // causes has been answered (serialising a large fold holds this thread for about half a second). A close flushes it anyway.
      if (checkpointTimer) clearTimeout(checkpointTimer);
      checkpointTimer = setTimeout(() => { checkpointTimer = undefined; try { const began = performance.now(); saveCheckpoint(true); if (process.env.DRISHYA_HISTORY_TIMING) console.error('history background checkpoint', Math.round(performance.now() - began), 'ms'); } catch (error) { console.error('history: checkpoint not written:', error instanceof Error ? error.message : error); } }, process.env.DRISHYA_CHECKPOINT_QUIET_MS ? 50 : 3000).unref();
      return;
    }
    if (background === job) background = undefined;
  })().catch((error) => { if (background === job) background = undefined; console.error('history: background fold failed:', error instanceof Error ? error.message : error); });
  background = job;
}

/** What a page is answered from: the whole view when it exists, else (when the caller allows) the recent-first one. */
async function pageView(id: string, allowPartial: boolean, wait = true): Promise<View> {
  if (!allowPartial) return full(id, wait);
  const ctx = lookup(id);
  const hit = stored(id, ctx);
  if (hit) return hit;
  // A remembered fold (after a restart or a session switch) is resumed and appended with the new tail: no recent-first detour.
  if (ctx.observations >= TAIL_FIRST_OBSERVATIONS) resume(id, ctx);
  const resumable = resident?.id === id && resident.ids.join('+') === ctx.ids.join('+') && resident.ancestors === ancestorRevisions(ctx.ids, ctx.counts);
  if (resumable || ctx.observations < TAIL_FIRST_OBSERVATIONS) return full(id);
  const view = tailView(id, ctx);
  if (view.partial) startBackground(id, ctx);
  return view;
}

async function page(id: string, query: HistoryQuery): Promise<HistoryPage> {
  const view = await pageView(id, !!query.tailFirst, !query.loadingOk);
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


/**
 * PERF-4: while a view is shown from its latest work only, the material of those operations (their result previews, their
 * prose, their outputs) is read from that same recent-first projection: a card must not wait for the whole history to show
 * what the page already has. Anything the recent-first projection does not hold waits for the whole view.
 */
function shownFromTail(id: string): Projection | undefined {
  return tail?.id === id && tail.last && background && !background.cancelled && background.id === id ? tail.last : undefined;
}
async function artifactDescriptor(id: string, artifactId: string): Promise<Projection['artifacts'][number] | undefined> {
  const early = shownFromTail(id)?.artifacts.find((a) => a.id === artifactId);
  if (early) return early;
  await full(id);
  const row = db.prepare("SELECT body FROM items WHERE view_id=? AND kind='artifacts' AND id=?").get(id, artifactId) as { body: string } | undefined;
  return row ? JSON.parse(row.body) as Projection['artifacts'][number] : undefined;
}
async function artifact(id: string, artifactId: string, start: number, count: number): Promise<ArtifactSlice> {
  const artifact = await artifactDescriptor(id, artifactId);
  if (!artifact) throw new Error('Artifact not found');
  const empty = { artifact, start, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
  if (!artifact.blob) return { ...empty, available: false, reason: 'not-captured' };
  const slice = source.blobs.readLines(artifact.blob, start, count) ?? blobs.readLines(artifact.blob, start, count);
  return slice ? { artifact, available: true, start, ...slice } : { ...empty, available: false, reason: 'no-longer-stored' };
}

async function artifactChunk(id: string, artifactId: string, start: number, requestedField?: 'text'|'structured') {
  if (artifactId.startsWith('result:')) {
    const operationId = artifactId.slice(7);
    const early = shownFromTail(id)?.operations.find(op => op.id === operationId);
    const projection = early ? shownFromTail(id)! : (await full(id)).projection;
    const op = early ?? projection.operations.find(op => op.id === operationId);
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
  const proseId = artifactId.replace(/^art_(.*)_prose$/, '$1');
  const early = shownFromTail(id);
  const prose = descriptor.artifact.kind === 'excerpt' && (early?.prose.some((item) => item.id === proseId) || (await full(id), db.prepare("SELECT id FROM items WHERE view_id=? AND kind='prose' AND id=?").get(id, proseId)));
  if (descriptor.artifact.kind !== 'output' && !prose) throw Error('Only recorded output or prose supports text continuation');
  const sha = descriptor.artifact.blob;
  const chunk = source.blobs.readTextChunk(sha, start) ?? blobs.readTextChunk(sha, start);
  return chunk ? { artifact: descriptor.artifact, available: true, ...chunk } : { artifact: descriptor.artifact, available: false, reason: 'no-longer-stored' };
}

async function artifactFind(id: string, artifactId: string, query: string, start: number, continuation?: string) {
  const item = await artifactDescriptor(id, artifactId);
  if (!item) throw new Error('Artifact not found');
  if (!item.blob) return undefined;
  const store = source.blobs.has(item.blob) ? source.blobs : blobs;
  return store.findLines(item.blob, query, start, continuation);
}

async function file(id: string, path: string, start: number, count: number, step?: number, query = '', selectedOperationId?: string) {
  const whole = (await full(id)).projection;
  const historical = step === undefined ? whole : asOfProjection(whole, step);
  return fileOperationPage(historical.operations, path, start, count, query, selectedOperationId);
}

parentPort!.on('message', async (message: { id: number; method: string; args: any; sentAt?: number }) => {
  const began = Date.now();
  if (process.env.DRISHYA_HISTORY_TIMING) console.error('history', message.method, 'queued', began - (message.sentAt ?? began), 'ms');
  try {
    const a = message.args;
    let value: unknown;
    if (message.method === 'diagnostic-sqlite') {
      const config = (connection: DatabaseSync) => Object.fromEntries(['cache_size', 'mmap_size', 'page_size', 'temp_store'].map(key => [key, Object.values(connection.prepare('PRAGMA ' + key).get() ?? {})[0] ?? null]));
      value = { captured: config(source.db), derived: config(db), fullProjectionResident: !!cached, reducerResident: !!resident };
    }
    else if (message.method === 'search-library') value = source.searchLibrary(a.query);
    else if(message.method==='finding-members')value=findingMembers((await full(a.id, a.wait !== false)).projection,a.key,a.page,a.q);
    else if(message.method==='review-insights')value=reviewInsights((await full(a.id, a.wait !== false)).projection,a.page,a.kind);
    else if (message.method === 'commands') value=commandPage((await full(a.id, a.wait !== false)).projection.operations,a.query);
    else if (message.method === 'tools') value=toolInventory(a.step===undefined?(await full(a.id, a.wait !== false)).projection:asOfProjection((await full(a.id, a.wait !== false)).projection,a.step));
    else if (message.method === 'tool-trail') value=toolTrail(a.step===undefined?(await full(a.id, a.wait !== false)).projection:asOfProjection((await full(a.id, a.wait !== false)).projection,a.step),a.filter,a.from);
    else if (message.method === 'queue') {
      const view=await full(a.id, a.wait !== false), revision=JSON.stringify(view.revisions);
      value=queuePage(view.projection.timeline,a.owner,a.query,queueEvidenceFor(view.projection,a.owner,revision,a.id));
    }
    else if (message.method === 'screen') value=screenRun((a.step===undefined?(await full(a.id, a.wait !== false)).projection:asOfProjection((await full(a.id, a.wait !== false)).projection,a.step)).operations);
    else if(message.method==='git-session-evidence'){
      const projection=(await full(a.id, a.wait !== false)).projection;
      value=gitSessionEvidence(projection,a.query,op=>commandAtWorkspace(op.observationIds.slice(0,8).map(id=>source.observationById(a.id,id)).filter((o):o is Observation=>!!o),projection.workspaceRoot));
    }
    else if(message.method==='delegation-thread'){
      const projection=(await full(a.id, a.wait !== false)).projection;
      value=delegationThread(source,projection,a.operationId,a.start,a.step,a.taskStart);
    }
    else if (message.method === 'page') value = await page(a.id, a.query);
    else if (message.method === 'page-bytes') value = new TextEncoder().encode(JSON.stringify(await page(a.id, a.query)));
    else if (message.method === 'artifact') value = await artifact(a.id, a.artifactId, a.start, a.count);
    else if (message.method === 'artifact-chunk') value = await artifactChunk(a.id, a.artifactId, a.start, a.field);
    else if (message.method === 'artifact-find') value = await artifactFind(a.id, a.artifactId, a.query, a.start, a.continuation);
    else if (message.method === 'file') value = await file(a.id, a.path, a.start, a.count, a.step, a.query, a.selectedOperationId);
    else if (message.method === 'summary') value = historySummary((await full(a.id, a.wait !== false)).projection, a.from);
    else if (message.method === 'reading-target') value = readingTarget((await full(a.id, a.wait !== false)).projection, a.query);
    else if (message.method === 'file-evidence') value = fileEvidence(a.step === undefined ? (await full(a.id, a.wait !== false)).projection : asOfProjection((await full(a.id, a.wait !== false)).projection, a.step), a.paths);
    else if (message.method === 'compare-evidence') value = compareEvidence((await full(a.id, a.wait !== false)).projection, a.paths);
    else if(message.method==='file-roots') value=withFileRootEvidence(a.roots,(await full(a.id, a.wait !== false)).projection,a.workspaceRoot);
    else if (message.method === 'now') value = nowFacts(shownFromTail(a.id) ?? (await full(a.id, a.wait !== false)).projection);
    else if (message.method === 'context-report') value = contextReportCandidates((await full(a.id, a.wait !== false)).projection.timeline);
    else if (message.method === 'turns') value = turnLedgers(shownFromTail(a.id) ?? (await full(a.id, a.wait !== false)).projection).slice(-2000);
    else if (message.method === 'since') value = sinceSnapshot((await full(a.id, a.wait !== false)).projection, a.after, a.page);
    else if (message.method === 'read-before') value = readBeforeWriteFor((await full(a.id, a.wait !== false)).projection, a.operationId) ?? null;
    else if (message.method === 'fix-chain') value = fixChainFor((await full(a.id, a.wait !== false)).projection, a.operationId) ?? null;
    else if (message.method === 'verification') value = verificationFor((await full(a.id, a.wait !== false)).projection, a.operationId) ?? null;
    else if (message.method === 'marker') {
      const p = (await full(a.id, a.wait !== false)).projection;
      const candidates = markers(p).filter((m) => a.types.includes(m.type) && (a.direction > 0 ? m.step > a.step : m.step < a.step));
      value = (a.direction > 0 ? candidates[0] : candidates.at(-1))?.step;
    } else if (message.method === 'forget') {
      for (const row of db.prepare('SELECT id FROM views').all()) if (String(row.id).split('+').includes(a.id)) db.prepare('DELETE FROM views WHERE id=?').run(String(row.id));
      for (const row of db.prepare('SELECT id FROM folds').all()) if (String(row.id).split('+').includes(a.id)) dropCheckpoint(String(row.id));
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
    } else if (message.method === 'close') { if (checkpointTimer) clearTimeout(checkpointTimer); try { if (resident && resident.saved < resident.rows) saveCheckpoint(); } catch { /* the next open rebuilds */ } if (background) background.cancelled = true; background = undefined; cached = undefined; resident = undefined; tail = undefined; db.close(); source.close(); }
    else throw new Error('Unknown history request');
    // The encoder owns this exact-sized buffer; transfer it instead of cloning the
    // page's object graph and re-encoding it on capture's event loop.
    if (message.method === 'page-bytes') parentPort!.postMessage({ id: message.id, value }, [(value as Uint8Array<ArrayBuffer>).buffer]);
    else parentPort!.postMessage({ id: message.id, value });
    if (process.env.DRISHYA_HISTORY_TIMING) console.error('history', message.method, 'done in', Date.now() - began, 'ms', message.method === 'page-bytes' ? JSON.stringify(message.args.query).slice(0, 80) : '');
  } catch (error) {
    if (error instanceof Loading) { parentPort!.postMessage({ id: message.id, error: 'loading', loading: true }); return; }
    if (error instanceof Error && (error.message.includes('database is locked') || error.message.includes('busy'))) {
      console.error(`history: cache database ${dbPath} remained locked after 5s wait`);
    }
    parentPort!.postMessage({ id: message.id, error: sanitize(error instanceof Error ? error.message : 'History request failed').value });
  }
});
