// Local store: SQLite (WAL) via Node's built-in `node:sqlite`, and a content-addressed blob
// directory for large sanitized text. Only sealed (sanitized) observations reach this module.
//
// Why node:sqlite instead of better-sqlite3: it ships with Node 24, so a clean `npx` install
// needs no native build or prebuilt binary — the risk the engineering plan's clean-install
// gate exists for. It includes FTS5. Draft: it runs on the daemon thread; moving it into a
// dedicated worker is a tracked follow-up (engineering plan §1).

import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { BlobText, Observation, RecordingSummary } from '@drishya/contracts';
import type { LibrarySearchQuery, LibrarySearchPage, SessionSearchHit } from './search-types.ts';

// 2: revisions. 3: normalized observation clock. 4: local reading boundaries.
export const SCHEMA_VERSION = 4;
const clockTime = (time: string | null | undefined) => time && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : null;
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

/** A slice of a blob's lines, with what a reader needs to know about the whole. */
export interface LineSlice {
  text: string;
  /** Lines in the whole blob, counted as splitting the text on newlines would. */
  totalLines: number;
  totalBytes: number;
  returnedLines: number;
  /** This response was cut at the byte cap before the requested count. */
  truncated: boolean;
  /** Lines exist after the returned ones. */
  hasMore: boolean;
}

interface LineIndex {
  totalLines: number;
  bytes: number;
  /** Byte offset of line k × LINE_STRIDE. */
  offsets: number[];
}

const LINE_STRIDE = 256;
const READ_CHUNK = 64 * 1024;
const MAX_LINE_INDEXES = 128;

import type { BlobSearchResult } from './search-types.ts';
export type { BlobSearchResult } from './search-types.ts';
interface BlobSearchState { sha: string; needle: string; first: number; line: number; position: number; chunks: Buffer[]; length: number; oversized: boolean }

export class BlobStore {
  /** Bytes read from blob files by line reads; tests use it to prove reads are bounded. */
  readonly stats = { bytesRead: 0 };
  private lineIndexes = new Map<string, LineIndex>();
  private searches = new Map<string, BlobSearchState>();
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
  /**
   * Lines [start, start + count) of a blob, capped at `maxBytes`, without loading the whole file
   * (B2, audit A15). The first read of a blob builds a sparse line index in one streaming pass;
   * later reads seek near their start. Returns undefined when the blob is not stored.
   */
  readLines(sha: string, start: number, count: number, maxBytes = 2 * 1024 * 1024): LineSlice | undefined {
    if (!this.has(sha)) return undefined;
    const index = this.lineIndex(sha);
    const first = Math.min(start, index.totalLines);
    const lines: Buffer[] = [];
    let cur: Buffer[] = [];
    let curLen = 0;
    let taken = 0; // bytes in `lines`, counting the newlines that will join them
    let truncated = false;
    // Stops collecting: either the byte cap (a lone oversized line is cut and reported) or `count`.
    const finishLine = (): boolean => {
      const sep = lines.length ? 1 : 0;
      if (taken + sep + curLen > maxBytes) {
        truncated = true;
        if (!lines.length) lines.push(Buffer.concat(cur).subarray(0, maxBytes));
        return true;
      }
      lines.push(Buffer.concat(cur));
      taken += sep + curLen;
      cur = [];
      curLen = 0;
      return lines.length >= count;
    };
    let line = Math.floor(first / LINE_STRIDE) * LINE_STRIDE;
    let pos = index.offsets[line / LINE_STRIDE] ?? index.bytes;
    let done = count <= 0 || first >= index.totalLines;
    const fd = openSync(this.pathOf(sha), 'r');
    try {
      const buf = Buffer.alloc(READ_CHUNK);
      while (!done && pos < index.bytes) {
        const n = readSync(fd, buf, 0, Math.min(READ_CHUNK, index.bytes - pos), pos);
        this.stats.bytesRead += n;
        if (n === 0) break;
        let i = 0;
        while (i < n && !done) {
          const nl = buf.indexOf(0x0a, i);
          const end = nl === -1 || nl >= n ? n : nl;
          if (line >= first) {
            cur.push(Buffer.from(buf.subarray(i, end)));
            curLen += end - i;
            if (curLen > maxBytes && finishLine()) done = true; // a line longer than the whole cap
          }
          if (done || end === n) break; // the line continues into the next chunk
          if (line >= first && finishLine()) done = true;
          line++;
          i = end + 1;
        }
        pos += n;
      }
      // The blob's last line has no newline after it.
      if (!done && line >= first && line < index.totalLines) finishLine();
    } finally {
      closeSync(fd);
    }
    const text = lines.map((l) => l.toString('utf8')).join('\n');
    return { text, totalLines: index.totalLines, totalBytes: index.bytes, returnedLines: lines.length, truncated, hasMore: first + lines.length < index.totalLines };
  }

  /** Literal find over immutable redacted content, resumed by a single-use opaque
   * cursor. Each worker task scans <=4 MiB/10k lines, returns <=50 locations and
   * retains <=256 KiB of one unfinished line in an eight-cursor LRU. */
  findLines(sha: string, query: string, start = 0, continuation?: string): BlobSearchResult | undefined {
    if (!this.has(sha)) return undefined;
    if (!query || query.length > 200 || /[\r\n]/.test(query) || !Number.isSafeInteger(start) || start < 0) throw new RangeError('Invalid stored search');
    const index = this.lineIndex(sha), needle = query.toLowerCase();
    let state = continuation ? this.searches.get(continuation) : undefined;
    if (continuation && (!state || state.sha !== sha || state.needle !== needle)) return { matches: [], totalLines: index.totalLines, scannedThrough: start, skippedLines: 0, available: false, reason: 'continuation-expired' };
    if (continuation) this.searches.delete(continuation);
    if (!state) {
      const first = Math.min(start, index.totalLines), line = Math.floor(first / LINE_STRIDE) * LINE_STRIDE;
      state = { sha, needle, first, line, position: index.offsets[line / LINE_STRIDE] ?? index.bytes, chunks: [], length: 0, oversized: false };
    }
    const cursor = state, matches: number[] = [];
    let scanned = 0, skippedLines = 0, read = 0;
    const finish = () => {
      if (cursor.line >= cursor.first) {
        scanned++;
        if (cursor.oversized) skippedLines++;
        else if (Buffer.concat(cursor.chunks).toString('utf8').toLowerCase().includes(needle)) matches.push(cursor.line);
      }
      cursor.line++; cursor.chunks = []; cursor.length = 0; cursor.oversized = false;
    };
    const fd = openSync(this.pathOf(sha), 'r');
    try {
      const buffer = Buffer.alloc(READ_CHUNK);
      while (cursor.position < index.bytes && read < 4 * 1024 * 1024 && scanned < 10_000 && matches.length < 50) {
        const base = cursor.position;
        const n = readSync(fd, buffer, 0, Math.min(buffer.length, index.bytes - base, 4 * 1024 * 1024 - read), base);
        this.stats.bytesRead += n; read += n;
        if (!n) break;
        let offset = 0;
        while (offset < n && scanned < 10_000 && matches.length < 50) {
          const newline = buffer.indexOf(10, offset);
          const end = newline < 0 || newline >= n ? n : newline;
          if (cursor.line >= cursor.first && !cursor.oversized) {
            cursor.length += end - offset;
            if (cursor.length > 256 * 1024) { cursor.oversized = true; cursor.chunks = []; }
            else cursor.chunks.push(Buffer.from(buffer.subarray(offset, end)));
          }
          cursor.position = base + (end === n ? n : end + 1);
          if (end === n) break;
          finish(); offset = end + 1;
        }
      }
      if (cursor.position >= index.bytes && cursor.line < index.totalLines && scanned < 10_000 && matches.length < 50) finish();
    } finally { closeSync(fd); }
    let next: string | undefined;
    if (cursor.line < index.totalLines) {
      next = randomUUID(); this.searches.set(next, cursor);
      if (this.searches.size > 8) this.searches.delete(this.searches.keys().next().value!);
    }
    return { matches, totalLines: index.totalLines, scannedThrough: cursor.line, continuation: next, skippedLines, available: true };
  }

  private lineIndex(sha: string): LineIndex {
    const cached = this.lineIndexes.get(sha);
    if (cached) {
      this.lineIndexes.delete(sha); // refresh LRU position
      this.lineIndexes.set(sha, cached);
      return cached;
    }
    const offsets = [0]; // offsets[k] = where line k × LINE_STRIDE starts
    let lines = 1;
    let pos = 0;
    const fd = openSync(this.pathOf(sha), 'r');
    try {
      const buf = Buffer.alloc(READ_CHUNK);
      for (;;) {
        const n = readSync(fd, buf, 0, READ_CHUNK, pos);
        this.stats.bytesRead += n;
        if (n === 0) break;
        for (let i = buf.indexOf(0x0a, 0); i !== -1 && i < n; i = buf.indexOf(0x0a, i + 1)) {
          lines++; // a newline at byte i starts line `lines - 1` at i + 1
          if ((lines - 1) % LINE_STRIDE === 0) offsets.push(pos + i + 1);
        }
        pos += n;
      }
    } finally {
      closeSync(fd);
    }
    const index = { totalLines: lines, bytes: pos, offsets };
    this.lineIndexes.set(sha, index);
    if (this.lineIndexes.size > MAX_LINE_INDEXES) this.lineIndexes.delete(this.lineIndexes.keys().next().value!);
    return index;
  }

  delete(sha: string) {
    this.lineIndexes.delete(sha);
    if (/^[0-9a-f]{64}$/.test(sha)) rmSync(this.pathOf(sha), { force: true });
  }
}

export class Store {
  readonly db: DatabaseSync;
  readonly blobs: BlobStore;
  readonly dataDir: string;
  private stmts = new Map<string, StatementSync>();

  constructor(dataDir: string, opts: { memory?: boolean; readOnly?: boolean } = {}) {
    this.dataDir = dataDir;
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(opts.memory ? ':memory:' : join(dataDir, 'drishya.db'), { readOnly: opts.readOnly });
    this.blobs = new BlobStore(join(dataDir, 'blobs'));
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000; PRAGMA temp_store = FILE; PRAGMA cache_size = -8192;');
    if (!opts.readOnly) {
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
      this.migrate();
    }
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
      CREATE TABLE IF NOT EXISTS reading_boundaries (
        recording_id TEXT PRIMARY KEY REFERENCES recordings(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        previous_sequence INTEGER,
        revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL
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
    const observationCols = (this.db.prepare('PRAGMA table_info(observations)').all() as { name: string }[]).map((column) => column.name);
    if (!observationCols.includes('clock_time')) {
      this.tx(() => {
        this.db.exec('ALTER TABLE observations ADD COLUMN clock_time TEXT');
        const update = this.db.prepare('UPDATE observations SET clock_time=? WHERE rowid=?');
        for (const row of this.db.prepare('SELECT rowid,source_time FROM observations').iterate()) update.run(clockTime(row.source_time as string | null), row.rowid!);
      });
    }
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
    for (const table of ['observations', 'projections']) {
      for (const row of this.db.prepare(`SELECT body FROM ${table} WHERE recording_id = ?`).iterate(id)) {
        for (const m of String(row.body).matchAll(/"(?:\$blob|blob)":"([0-9a-f]{64})"/g)) candidates.add(m[1]!);
      }
    }
    this.tx(() => {
      this.q('DELETE FROM search WHERE recording_id = ?').run(id);
      this.q('DELETE FROM recordings WHERE id = ?').run(id);
    });
    const shared = new Set<string>();
    for (const table of ['observations', 'projections']) {
      for (const row of this.db.prepare(`SELECT body FROM ${table}`).iterate()) {
        for (const m of String(row.body).matchAll(/"(?:\$blob|blob)":"([0-9a-f]{64})"/g)) if (candidates.has(m[1]!)) shared.add(m[1]!);
      }
    }
    let blobsRemoved = 0;
    for (const sha of candidates) {
      if (shared.has(sha)) continue;
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
        this.q('UPDATE observations SET clock_time=? WHERE id=?').run(clockTime(full.sourceTime), full.id);
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

  /** Repeatable disk-backed ordering matching the reducer's source-clock carry-forward. */
  orderedObservations(recordingId: string | string[]): Iterable<Observation> {
    const store = this;
    const ids = typeof recordingId === 'string' ? [recordingId] : [...new Set(recordingId)];
    const marks = ids.map(() => '?').join(',');
    const rank = ids.map((_, i) => `WHEN ? THEN ${i}`).join(' ');
    return {
      *[Symbol.iterator]() {
        const rows = store.db.prepare(`
          WITH timed AS (
            SELECT body, seq, recording_id,
              MAX(CASE WHEN clock_time IS NOT NULL THEN seq END) OVER (
                PARTITION BY recording_id, json_extract(body, '$.source.sourceId') ORDER BY seq
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS clock_seq
            FROM observations WHERE recording_id IN (${marks})
          ) SELECT timed.body FROM timed LEFT JOIN observations clock
            ON clock.recording_id = timed.recording_id AND clock.seq = timed.clock_seq
          ORDER BY COALESCE(clock.clock_time, ''), timed.seq,
            CASE timed.recording_id ${rank} END
        `).iterate(...ids, ...ids) as Iterable<{ body: string }>;
        for (const row of rows) yield JSON.parse(row.body) as Observation;
      },
    };
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
  sourceBytes(recordingId: string): number {
    return Number(this.q("SELECT COALESCE(SUM(json_extract(cursor, '$.offset')),0) AS bytes FROM sources WHERE recording_id=?").get(recordingId)?.bytes ?? 0);
  }

  captureMetadata(recordingId: string): { title?: string; workspaceRoot?: string } {
    // Title-only metadata can precede the native session header. It must not hide
    // a later captured root, nor may a companion agent choose the workspace.
    const meta = this.q(`SELECT body FROM observations WHERE recording_id = ? AND kind = 'session.meta' AND agent_id = 'agent:main'
      AND (COALESCE(json_extract(body,'$.workspaceRoot'),'')<>'' OR COALESCE(json_extract(body,'$.payload.cwd'),'')<>'')
      ORDER BY seq LIMIT 1`).get(recordingId) as { body: string } | undefined;
    const user = this.q("SELECT body FROM observations WHERE recording_id = ? AND kind = 'message.user' AND agent_id = 'agent:main' ORDER BY seq LIMIT 1").get(recordingId) as { body: string } | undefined;
    const observation = meta ? JSON.parse(meta.body) as Observation : undefined;
    const payload = observation?.payload as { title?: string; cwd?: string } | undefined;
    const titled = this.q(`SELECT body FROM observations WHERE recording_id=? AND kind='session.meta'
      AND json_type(body,'$.payload.title')='text' AND json_extract(body,'$.payload.title')<>''
      AND COALESCE(json_extract(body,'$.payload.titleRank'),1)>=0
      ORDER BY COALESCE(json_extract(body,'$.payload.titleRank'),1) DESC, seq DESC LIMIT 1`).get(recordingId) as { body: string } | undefined;
    const capturedTitle = titled ? ((JSON.parse(titled.body) as Observation).payload as { title: string }).title : undefined;
    const prompt = user ? (JSON.parse(user.body) as Observation).payload as { text?: string | BlobText } : undefined;
    const text = typeof prompt?.text === 'string' ? prompt.text : prompt?.text?.preview;
    return { title: capturedTitle ?? text?.replace(/\s+/g, ' ').trim().slice(0, 120), workspaceRoot: observation?.workspaceRoot ?? payload?.cwd };
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

  /** Hits come with the turn they fall in (turn.start count for the same agent, else prompts for harnesses that record none) and the tool call they belong to, shown in capture order. */
  search(recordingId: string, query: string, limit = 50): SessionSearchHit[] {
    const safe = query.replace(/["*^:()]/g, ' ').trim().split(/\s+/).filter(Boolean).map((t) => `"${t}"`).join(' ');
    if (!safe) return [];
    const rows = this.q(`SELECT search.observation_id AS observationId, snippet(search, 0, '«', '»', '…', 12) AS snippet, o.seq AS seq, o.kind AS kind, o.source_time AS time, o.operation_id AS operationId,
        json_extract(o.body, '$.payload.tool') AS tool, json_extract(o.body, '$.payload.intent.path') AS path, json_extract(o.body, '$.payload.intent.command') AS command,
        (SELECT COUNT(*) FROM observations u WHERE u.recording_id = o.recording_id AND u.agent_id = o.agent_id AND u.kind = CASE WHEN EXISTS (SELECT 1 FROM observations s WHERE s.recording_id = o.recording_id AND s.agent_id = o.agent_id AND s.kind = 'turn.start') THEN 'turn.start' ELSE 'message.user' END AND u.seq <= o.seq) AS turn
      FROM search JOIN observations o ON o.id = search.observation_id AND o.recording_id = search.recording_id
      WHERE search MATCH ? AND search.recording_id = ? LIMIT ?`).all(safe, recordingId, limit) as any[];
    return rows.sort((x, y) => x.seq - y.seq).map((r) => ({
      observationId: r.observationId, snippet: r.snippet, kind: r.kind, ...(r.operationId ? { operationId: r.operationId } : {}), ...(r.time ? { time: r.time } : {}), ...(r.turn ? { turn: r.turn } : {}),
      ...(typeof r.tool === 'string' ? { tool: r.tool } : {}), ...(typeof r.path === 'string' ? { path: r.path } : {}), ...(typeof r.command === 'string' ? { command: r.command.slice(0, 120) } : {}),
    }));
  }

  /** One worker-side FTS query, never an unbounded list of recording IDs. */
  searchLibrary(query: LibrarySearchQuery): LibrarySearchPage {
    if(query.q.length>200)throw new Error('Library search is limited to 200 characters');
    const safe = query.q.replace(/["*^:()]/g, ' ').trim().split(/\s+/).filter(Boolean).map(t => `"${t}"`).join(' ');
    if (!safe) return {items:[]};
    const count=Math.max(1,Math.min(50,Math.trunc(query.count??50)));
    const where=['search MATCH ?', 'search.rowid < ?'];
    const args: (string|number)[]=[safe,query.before??Number.MAX_SAFE_INTEGER];
    for(const [value,column] of [[query.root,'r.workspace_root ='],[query.harness,'r.harness ='],[query.from,'o.clock_time >='],[query.to,'o.clock_time <=']] as const) {
      if(!value)continue;where.push(`${column} ?`);args.push(value);
    }
    const rows=this.q(`SELECT search.rowid AS cursor, search.recording_id AS recordingId,search.observation_id AS observationId,
      substr(snippet(search,0,'','', '…',20),1,1600) AS snippet,r.title,r.workspace_root AS workspaceRoot,r.harness,o.source_time AS sourceTime
      FROM search JOIN observations o ON o.id=search.observation_id AND o.recording_id=search.recording_id
      JOIN recordings r ON r.id=search.recording_id WHERE ${where.join(' AND ')} ORDER BY search.rowid DESC LIMIT ?`).all(...args,count+1) as unknown as (LibrarySearchPage['items'][number]&{cursor:number})[];
    const page=rows.slice(0,count);
    return {items:page.map(({cursor,...row})=>({...row,title:row.title??undefined,workspaceRoot:row.workspaceRoot??undefined,sourceTime:row.sourceTime??undefined})),...(rows.length>count?{nextBefore:page.at(-1)!.cursor}:{})};
  }

  addBookmark(recordingId: string, step: number, note: string) {
    const id = randomUUID();
    this.q('INSERT INTO bookmarks(id, recording_id, step, note, created_at) VALUES (?, ?, ?, ?, ?)').run(id, recordingId, step, note, new Date().toISOString());
    return id;
  }

  // ── reading boundary (P2-A) ────────────────────────────────────────────────

  /**
   * The local reader's mark: the last observation sequence they marked as seen. It moves only on
   * an explicit mark (opening a recording is not proof of reading it), and keeps the previous mark
   * for undo.
   */
  getBoundary(recordingId: string): { sequence: number; previousSequence?: number; revision: number; updatedAt: string } | undefined {
    const r = this.q('SELECT sequence, previous_sequence, revision, updated_at FROM reading_boundaries WHERE recording_id = ?').get(recordingId) as
      | { sequence: number; previous_sequence: number | null; revision: number; updated_at: string }
      | undefined;
    return r ? { sequence: r.sequence, previousSequence: r.previous_sequence ?? undefined, revision: r.revision, updatedAt: r.updated_at } : undefined;
  }

  setBoundary(recordingId: string, sequence: number, revision: number) {
    this.q(`INSERT INTO reading_boundaries(recording_id, sequence, previous_sequence, revision, updated_at) VALUES (?, ?, NULL, ?, ?)
            ON CONFLICT(recording_id) DO UPDATE SET previous_sequence = sequence, sequence = excluded.sequence, revision = excluded.revision, updated_at = excluded.updated_at`)
      .run(recordingId, sequence, revision, new Date().toISOString());
  }

  bookmarks(recordingId: string) {
    return this.q('SELECT id, step, note, created_at AS createdAt FROM bookmarks WHERE recording_id = ? ORDER BY step').all(recordingId);
  }

  bookmarkPage(recordingId:string,start=0,count=25) {
    const total=(this.q('SELECT COUNT(*) AS n FROM bookmarks WHERE recording_id = ?').get(recordingId) as {n:number}).n;
    const bookmarks=this.q('SELECT id, step, note, created_at AS createdAt FROM bookmarks WHERE recording_id = ? ORDER BY step, id LIMIT ? OFFSET ?').all(recordingId,count,start);
    return {bookmarks,total,start,count};
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
