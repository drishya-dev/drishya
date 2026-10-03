// Local store: SQLite (WAL) via Node's built-in `node:sqlite`, and a content-addressed blob
// directory for large sanitized text. Only sealed (sanitized) observations reach this module.
//
// Why node:sqlite instead of better-sqlite3: it ships with Node 24, so a clean `npx` install
// needs no native build or prebuilt binary — the risk the engineering plan's clean-install
// gate exists for. It includes FTS5. Draft: it runs on the daemon thread; moving it into a
// dedicated worker is a tracked follow-up (engineering plan §1).

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { BlobText, Observation, RecordingSummary } from '@drishya/contracts';

// 2: recordings.revision (B1b).
export const SCHEMA_VERSION = 2;
/** Strings longer than this move out of the observation into the blob store. */
export const INLINE_LIMIT = 16 * 1024;
const PREVIEW = 2048;

export interface StoredCursor {
  offset: number;
  generation: number;
  fingerprint: string;
  inOversized?: boolean;
}

export interface SourceRow {
  id: string;
  recordingId: string;
  path: string;
  agentId?: string;
  role: 'main' | 'companion';
  cursor: StoredCursor;
}

export class BlobStore {
  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }
  private pathOf(sha: string) {
    return join(this.dir, sha.slice(0, 2), sha);
  }
  /** Atomic: written to a temp name and renamed, so a reference never points at half a file. */
  put(text: string): { sha: string; bytes: number } {
    const buf = Buffer.from(text, 'utf8');
    const sha = createHash('sha256').update(buf).digest('hex');
    const p = this.pathOf(sha);
    if (!existsSync(p)) {
      mkdirSync(dirname(p), { recursive: true });
      const tmp = `${p}.${randomUUID()}.tmp`;
      writeFileSync(tmp, buf, { mode: 0o600 });
      renameSync(tmp, p);
    }
    return { sha, bytes: buf.length };
  }
  get(sha: string): string | undefined {
    if (!/^[0-9a-f]{64}$/.test(sha)) return undefined;
    try {
      return readFileSync(this.pathOf(sha), 'utf8');
    } catch {
      return undefined;
    }
  }
  has(sha: string): boolean {
    return /^[0-9a-f]{64}$/.test(sha) && existsSync(this.pathOf(sha));
  }
  delete(sha: string) {
    if (/^[0-9a-f]{64}$/.test(sha)) rmSync(this.pathOf(sha), { force: true });
  }
}

export class Store {
  readonly db: DatabaseSync;
  readonly blobs: BlobStore;
  readonly dataDir: string;
  private stmts = new Map<string, StatementSync>();

  constructor(dataDir: string, opts: { memory?: boolean } = {}) {
    this.dataDir = dataDir;
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(opts.memory ? ':memory:' : join(dataDir, 'drishya.db'));
    this.blobs = new BlobStore(join(dataDir, 'blobs'));
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        adapter_id TEXT NOT NULL,
        harness TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        workspace_root TEXT,
        graph_root TEXT,
        source_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        first_source_time TEXT,
        last_source_time TEXT,
        observation_count INTEGER NOT NULL DEFAULT 0,
        live INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        agent_id TEXT,
        role TEXT NOT NULL,
        cursor TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS observations (
        rowid INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        kind TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        operation_id TEXT,
        source_time TEXT,
        body TEXT NOT NULL,
        UNIQUE(recording_id, seq)
      );
      CREATE INDEX IF NOT EXISTS obs_rec_kind ON observations(recording_id, kind);
      CREATE INDEX IF NOT EXISTS obs_rec_op ON observations(recording_id, operation_id);
      CREATE TABLE IF NOT EXISTS projections (
        recording_id TEXT PRIMARY KEY REFERENCES recordings(id) ON DELETE CASCADE,
        reducer_version TEXT NOT NULL,
        observation_count INTEGER NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS graphs (
        root TEXT PRIMARY KEY,
        generation TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS generated (
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        body TEXT NOT NULL,
        PRIMARY KEY (recording_id, key)
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        step INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(text, recording_id UNINDEXED, observation_id UNINDEXED, tokenize = 'unicode61');
    `);
    // Stores created before revisions existed (B1b) gain the column; existing rows start at 0.
    const cols = (this.db.prepare('PRAGMA table_info(recordings)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('revision')) this.db.exec('ALTER TABLE recordings ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
    this.db.prepare('INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
    this.db.prepare('UPDATE meta SET value = ? WHERE key = ?').run(String(SCHEMA_VERSION), 'schema_version');
  }

  private q(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      this.db.exec('COMMIT');
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // ── recordings ─────────────────────────────────────────────────────────────

  upsertRecording(r: { id: string; adapterId: string; harness: string; sourcePath: string; title?: string; workspaceRoot?: string }) {
    const now = new Date().toISOString();
    this.q(`INSERT INTO recordings(id, adapter_id, harness, title, workspace_root, source_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`).run(r.id, r.adapterId, r.harness, r.title ?? '', r.workspaceRoot ?? null, r.sourcePath, now, now);
  }

  updateRecordingMeta(id: string, m: { title?: string; workspaceRoot?: string; graphRoot?: string; live?: boolean; pinned?: boolean }) {
    if (m.title !== undefined) this.q('UPDATE recordings SET title = ? WHERE id = ?').run(m.title, id);
    if (m.graphRoot !== undefined) this.q('UPDATE recordings SET graph_root = ? WHERE id = ?').run(m.graphRoot, id);
    if (m.workspaceRoot !== undefined) this.q('UPDATE recordings SET workspace_root = ? WHERE id = ?').run(m.workspaceRoot, id);
    if (m.live !== undefined) this.q('UPDATE recordings SET live = ? WHERE id = ?').run(m.live ? 1 : 0, id);
    if (m.pinned !== undefined) this.q('UPDATE recordings SET pinned = ? WHERE id = ?').run(m.pinned ? 1 : 0, id);
  }

  listRecordings(): RecordingSummary[] {
    return (this.q('SELECT * FROM recordings ORDER BY COALESCE(last_source_time, updated_at) DESC').all() as any[]).map(rowToRecording);
  }

  /** Current revision of every recording, for reconnecting viewers to compare with what they rendered. */
  revisions(): Record<string, number> {
    return Object.fromEntries((this.q('SELECT id, revision FROM recordings').all() as { id: string; revision: number }[]).map((r) => [r.id, r.revision]));
  }

  getRecording(id: string): RecordingSummary | undefined {
    const r = this.q('SELECT * FROM recordings WHERE id = ?').get(id) as any;
    return r ? rowToRecording(r) : undefined;
  }

  /**
   * Deletes a recording's rows, then the blob files only it referenced. Blobs are shared by
   * content hash, so a file another recording still references stays. Rows go first, in one
   * transaction: a crash before the file sweep leaves an unreferenced blob, never a dangling
   * reference. This removes files; it does not promise forensic erasure of the disk.
   */
  deleteRecording(id: string): { blobsRemoved: number } {
    const candidates = new Set<string>();
    const bodies = [
      ...(this.q('SELECT body FROM observations WHERE recording_id = ?').all(id) as { body: string }[]),
      ...(this.q('SELECT body FROM projections WHERE recording_id = ?').all(id) as { body: string }[]),
    ];
    for (const { body } of bodies) for (const m of body.matchAll(/"(?:\$blob|blob)":"([0-9a-f]{64})"/g)) candidates.add(m[1]!);
    this.tx(() => {
      this.q('DELETE FROM search WHERE recording_id = ?').run(id);
      this.q('DELETE FROM recordings WHERE id = ?').run(id);
    });
    const stillObs = this.q('SELECT 1 FROM observations WHERE instr(body, ?) > 0 LIMIT 1');
    const stillProj = this.q('SELECT 1 FROM projections WHERE instr(body, ?) > 0 LIMIT 1');
    let blobsRemoved = 0;
    for (const sha of candidates) {
      if (stillObs.get(sha) || stillProj.get(sha)) continue;
      this.blobs.delete(sha);
      blobsRemoved++;
    }
    return { blobsRemoved };
  }

  /** The privacy policy versions a recording's stored observations were sealed under. */
  policyVersions(recordingId: string): string[] {
    const rows = this.q(`SELECT DISTINCT json_extract(body, '$.privacyPolicyVersion') AS v FROM observations WHERE recording_id = ?`).all(recordingId) as { v: unknown }[];
    return rows.map((r) => String(r.v ?? 'unknown'));
  }

  // ── sources and cursors ────────────────────────────────────────────────────

  upsertSource(s: SourceRow) {
    this.q(`INSERT INTO sources(id, recording_id, path, agent_id, role, cursor) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING`).run(s.id, s.recordingId, s.path, s.agentId ?? null, s.role, JSON.stringify(s.cursor));
  }

  getSources(recordingId: string): SourceRow[] {
    return (this.q('SELECT * FROM sources WHERE recording_id = ? ORDER BY role DESC, path').all(recordingId) as any[]).map((r) => ({
      id: r.id,
      recordingId: r.recording_id,
      path: r.path,
      agentId: r.agent_id ?? undefined,
      role: r.role,
      cursor: JSON.parse(r.cursor),
    }));
  }

  findSourceByPath(path: string): SourceRow | undefined {
    const r = this.q('SELECT * FROM sources WHERE path = ?').get(path) as any;
    return r ? { id: r.id, recordingId: r.recording_id, path: r.path, agentId: r.agent_id ?? undefined, role: r.role, cursor: JSON.parse(r.cursor) } : undefined;
  }

  // ── observations ───────────────────────────────────────────────────────────

  /**
   * Appends sealed observations and advances the source cursor in one transaction, so a crash
   * can never record the offset without the observations or the reverse. Duplicates (same
   * stable id) are skipped — re-importing a source adds nothing.
   */
  appendObservations(recordingId: string, sourceId: string, cursor: StoredCursor, obs: Omit<Observation, 'receivedSequence'>[]): Observation[] {
    return this.tx(() => {
      const added: Observation[] = [];
      let seq = (this.q('SELECT COALESCE(MAX(seq), -1) AS m FROM observations WHERE recording_id = ?').get(recordingId) as { m: number }).m;
      const exists = this.q('SELECT 1 FROM observations WHERE id = ?');
      const ins = this.q('INSERT INTO observations(id, recording_id, seq, kind, agent_id, operation_id, source_time, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const fts = this.q('INSERT INTO search(text, recording_id, observation_id) VALUES (?, ?, ?)');
      for (const o of obs) {
        if (exists.get(o.id)) continue;
        seq += 1;
        const full: Observation = { ...o, payload: this.externalize(o.payload) as Observation['payload'], receivedSequence: seq };
        ins.run(full.id, recordingId, seq, full.kind, full.agentId, full.operationId ?? null, full.sourceTime ?? null, JSON.stringify(full));
        const text = searchableText(o);
        if (text) fts.run(text, recordingId, full.id);
        added.push(full);
      }
      this.q('UPDATE sources SET cursor = ? WHERE id = ?').run(JSON.stringify(cursor), sourceId);
      if (added.length) {
        const times = added.map((a) => a.sourceTime).filter(Boolean).sort() as string[];
        // The revision moves in the same transaction as the data, so a reader that sees revision N
        // also sees every observation it counts (audit A07).
        this.q(`UPDATE recordings SET observation_count = observation_count + ?, updated_at = ?, revision = revision + 1,
                first_source_time = COALESCE(MIN(first_source_time, ?), first_source_time, ?),
                last_source_time = CASE WHEN last_source_time IS NULL OR last_source_time < ? THEN ? ELSE last_source_time END
                WHERE id = ?`).run(added.length, new Date().toISOString(), times[0] ?? null, times[0] ?? null, times.at(-1) ?? null, times.at(-1) ?? null, recordingId);
      }
      return added;
    });
  }

  observations(recordingId: string, after = -1, limit = 1_000_000): Observation[] {
    return (this.q('SELECT body FROM observations WHERE recording_id = ? AND seq > ? ORDER BY seq LIMIT ?').all(recordingId, after, limit) as { body: string }[]).map((r) => JSON.parse(r.body));
  }

  observationsOfKinds(recordingId: string, kinds: string[]): Observation[] {
    const marks = kinds.map(() => '?').join(',');
    return (this.db.prepare(`SELECT body FROM observations WHERE recording_id = ? AND kind IN (${marks}) ORDER BY seq`).all(recordingId, ...kinds) as { body: string }[]).map((r) => JSON.parse(r.body));
  }

  /** Every distinct working directory a recording's observations captured, e.g. for export masking. */
  workspaceRoots(recordingId: string): string[] {
    const rows = this.q(`SELECT DISTINCT json_extract(body, '$.workspaceRoot') AS r FROM observations WHERE recording_id = ?
                         UNION SELECT DISTINCT json_extract(body, '$.payload.cwd') FROM observations WHERE recording_id = ? AND kind = 'session.meta'`).all(recordingId, recordingId) as { r: unknown }[];
    return rows.map((x) => x.r).filter((r): r is string => typeof r === 'string' && r.length > 0);
  }

  countObservations(recordingId: string): number {
    return (this.q('SELECT COUNT(*) AS n FROM observations WHERE recording_id = ?').get(recordingId) as { n: number }).n;
  }

  /** Moves long strings into blobs, leaving a small reference with a preview. */
  externalize(v: unknown): unknown {
    if (typeof v === 'string') {
      if (v.length <= INLINE_LIMIT) return v;
      const { sha, bytes } = this.blobs.put(v);
      const ref: BlobText = { $blob: sha, bytes, preview: v.slice(0, PREVIEW) };
      return ref;
    }
    if (Array.isArray(v)) return v.map((x) => this.externalize(x));
    if (v && typeof v === 'object') {
      if (typeof (v as BlobText).$blob === 'string') return v;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.externalize(x)]));
    }
    return v;
  }

  // ── projections and graphs (rebuildable caches) ────────────────────────────

  getProjection(recordingId: string): { reducerVersion: string; observationCount: number; body: string } | undefined {
    const r = this.q('SELECT reducer_version, observation_count, body FROM projections WHERE recording_id = ?').get(recordingId) as any;
    return r ? { reducerVersion: r.reducer_version, observationCount: r.observation_count, body: r.body } : undefined;
  }

  putProjection(recordingId: string, reducerVersion: string, observationCount: number, body: string) {
    this.q(`INSERT INTO projections(recording_id, reducer_version, observation_count, body) VALUES (?, ?, ?, ?)
            ON CONFLICT(recording_id) DO UPDATE SET reducer_version = excluded.reducer_version, observation_count = excluded.observation_count, body = excluded.body`).run(recordingId, reducerVersion, observationCount, body);
  }

  getGraph(root: string): string | undefined {
    return (this.q('SELECT body FROM graphs WHERE root = ?').get(root) as { body: string } | undefined)?.body;
  }

  putGraph(root: string, generation: string, body: string) {
    this.q('INSERT INTO graphs(root, generation, body) VALUES (?, ?, ?) ON CONFLICT(root) DO UPDATE SET generation = excluded.generation, body = excluded.body').run(root, generation, body);
  }

  // ── generated (model-written, derived) content ─────────────────────────────

  putGenerated(recordingId: string, key: string, body: unknown) {
    this.q(`INSERT INTO generated(recording_id, key, created_at, body) VALUES (?, ?, ?, ?)
            ON CONFLICT(recording_id, key) DO UPDATE SET created_at = excluded.created_at, body = excluded.body`).run(recordingId, key, new Date().toISOString(), JSON.stringify(body));
  }

  getGenerated(recordingId: string, key: string): unknown {
    const r = this.q('SELECT body FROM generated WHERE recording_id = ? AND key = ?').get(recordingId, key) as { body: string } | undefined;
    return r ? JSON.parse(r.body) : undefined;
  }

  listGenerated(recordingId: string): { key: string; createdAt: string; body: unknown }[] {
    return (this.q('SELECT key, created_at, body FROM generated WHERE recording_id = ? ORDER BY created_at').all(recordingId) as any[]).map((r) => ({ key: r.key, createdAt: r.created_at, body: JSON.parse(r.body) }));
  }

  // ── search and bookmarks ───────────────────────────────────────────────────

  search(recordingId: string, query: string, limit = 50): { observationId: string; snippet: string }[] {
    const safe = query.replace(/["*^:()]/g, ' ').trim().split(/\s+/).filter(Boolean).map((t) => `"${t}"`).join(' ');
    if (!safe) return [];
    return (this.q(`SELECT observation_id, snippet(search, 0, '«', '»', '…', 12) AS snippet FROM search WHERE search MATCH ? AND recording_id = ? LIMIT ?`).all(safe, recordingId, limit) as any[]).map((r) => ({ observationId: r.observation_id, snippet: r.snippet }));
  }

  addBookmark(recordingId: string, step: number, note: string) {
    const id = randomUUID();
    this.q('INSERT INTO bookmarks(id, recording_id, step, note, created_at) VALUES (?, ?, ?, ?, ?)').run(id, recordingId, step, note, new Date().toISOString());
    return id;
  }

  bookmarks(recordingId: string) {
    return this.q('SELECT id, step, note, created_at AS createdAt FROM bookmarks WHERE recording_id = ? ORDER BY step').all(recordingId);
  }

  close() {
    this.db.close();
  }

  /** Test helper: removes the data directory. */
  static destroy(dataDir: string) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function rowToRecording(r: any): RecordingSummary {
  return {
    id: r.id,
    title: r.title,
    harness: r.harness,
    workspaceRoot: r.workspace_root ?? undefined,
    graphRoot: r.graph_root ?? undefined,
    sourcePath: r.source_path ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    firstSourceTime: r.first_source_time ?? undefined,
    lastSourceTime: r.last_source_time ?? undefined,
    observationCount: r.observation_count,
    live: !!r.live,
    pinned: !!r.pinned,
    revision: r.revision ?? 0,
  };
}

/** Sanitized text worth searching: prose, commands, queries, paths. Bounded. */
function searchableText(o: Omit<Observation, 'receivedSequence'>): string {
  const p = o.payload as Record<string, any>;
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v.slice(0, 20_000));
  };
  push(p.text);
  push(p.title);
  if (o.kind === 'tool.call') {
    push(p.tool);
    const i = p.intent ?? {};
    push(i.path);
    push(i.command);
    push(i.query);
    push(i.url);
  }
  return parts.join('\n');
}
