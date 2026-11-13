// The ingest path: harness journal → bounded read → adapter parse → seal (privacy) → store.
// Capture never waits on presentation: nothing here depends on a viewer being connected.

import { EventEmitter } from 'node:events';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { claudeAdapter } from '@drishya/adapter-claude';
import { claudeContinuation } from '../../adapter-claude/src/continuation.ts';
import { codexAdapter } from '@drishya/adapter-codex';
import { antigravityAdapter } from '@drishya/adapter-antigravity';
import {
  headRecords,
  initialCursor,
  readJsonl,
  recordingIdFor,
  seal,
  sourceIdFor,
  type Adapter,
  type RawObservation,
  type RecordParser,
} from '@drishya/capture-core';
import type { AdapterDescriptor, CaptureState, DiscoveredSource, Projection, RecordingHealth } from '@drishya/contracts';
import { PRIVACY_POLICY_VERSION, sanitize } from '@drishya/privacy';
import { reduce, REDUCER_VERSION } from '@drishya/projection';
import type { SourceRow, Store } from '@drishya/store';

export const defaultAdapters = (): Adapter[] => [claudeAdapter, codexAdapter, antigravityAdapter];

export interface ChangeEvent {
  type: 'recording';
  recordingId: string;
  /** The committed revision this notice describes. */
  revision: number;
  observationCount: number;
  added: number;
  live: boolean;
}

/** A recording's capture state changed (B1, audit A05). Separate from `change`: no new data. */
export interface HealthEvent {
  type: 'health';
  recordingId: string;
  health: RecordingHealth;
}

export interface DiscoveryError {
  adapterId: string;
  /** permission-denied, not-found or read-failed. */
  code: string;
  /** Sanitized. */
  message: string;
}

export interface ImportResult {
  recordingId: string;
  added: number;
  gaps: number;
  /** A bounded turn stopped with bytes still unread. */
  more: boolean;
}

export interface SyncOptions {
  /** Read at most this many bytes per source in this turn (and accept records up to this size). */
  turnBytes?: number;
  /** Passive catch-up must not seal a journal record that is still being written. */
  acceptUnterminated?: boolean;
}

export interface IngestorOptions {
  now?: () => Date;
  /** Following with nothing new for this long reads as idle. */
  idleMs?: number;
  /** Bytes one live turn reads per source before yielding to the next tick. */
  liveTurnBytes?: number;
}

/** Bytes of records sealed and stored before the ingest yields to the daemon's other work. */
const SLICE_BYTES = 1024 * 1024;
// Scheduling budget only: complete-record commit size and hard limits stay unchanged.
const RECORD_YIELD_MS = 8;
const MAX_RECORD_BYTES = 16 * 1024 * 1024;
const LEGACY_CODEX_RESCAN = 'codex-turn-details-rescan-v1:';
// CONTENT-20: journals imported before #310 never stored the `queued_command` rows (a message typed while the agent was working).
const LEGACY_CLAUDE_QUEUED_RESCAN = 'claude-queued-command-rescan-v1:';
interface LegacyRescanResult { attempted: number; completed: number; unavailable: number; failed: number }

/** What the ingestor remembers about a recording's collection; `health()` derives the state. */
interface HealthRecord {
  phase: 'importing' | 'ok' | 'missing-source' | 'unsupported' | 'failed';
  error?: { code: string; message: string };
  lastReadAt?: string;
  lastChangeAt?: string;
  followSince?: string;
  backlog: boolean;
  sources: RecordingHealth['sources'];
}

interface LiveRun {
  timer: NodeJS.Timeout;
  /** The turn in flight, if any, so stopping can wait for it instead of racing it. */
  current?: Promise<void>;
}

export class Ingestor extends EventEmitter {
  readonly store: Store;
  readonly adapters: Adapter[];
  private parsers = new Map<string, RecordParser>();
  private locks = new Map<string, Promise<unknown>>();
  private live = new Map<string, LiveRun>();
  private projectionCache = new Map<string, { count: number; projection: Projection }>();
  private workerOwnedRecordings = new Set<string>();
  private healthRecords = new Map<string, HealthRecord>();
  private lastEmitted = new Map<string, string>();
  private cacheProjection(key: string, count: number, projection: Projection) {
    // Legacy callers may request a complete view; keep only a normal-sized shared workspace.
    // The paged history worker owns long-session reader state, not this capture cache.
    if (count > 10_000 || key.split('\u0000')[0]!.split('+').some(id => this.workerOwnedRecordings.has(id))) { this.projectionCache.delete(key); return; }
    this.projectionCache.delete(key);
    this.projectionCache.set(key, { count, projection });
    while (this.projectionCache.size > 2 || [...this.projectionCache.values()].reduce((sum, entry) => sum + entry.count, 0) > 20_000) this.projectionCache.delete(this.projectionCache.keys().next().value!);
  }
  /** Reader ownership is sticky for this process: explicit full reads still work,
   * but capture must not retain another complete projection for worker-owned evidence. */
  useHistoryWorker(viewId: string): void {
    const ids = [...new Set(viewId.split('+').filter(Boolean))];
    if (!ids.length || ids.length > 16 || ids.some(id => !this.store.getRecording(id))) return;
    for (const id of ids) this.workerOwnedRecordings.add(id);
    for (const key of this.projectionCache.keys()) {
      if (key.split('\u0000')[0]!.split('+').some(id => this.workerOwnedRecordings.has(id))) this.projectionCache.delete(key);
    }
  }

  private closed = false;
  private legacyCodexRescan?: Promise<LegacyRescanResult>;
  private legacyClaudeRescan?: Promise<LegacyRescanResult>;
  private readonly now: () => Date;
  private readonly idleMs: number;
  private readonly liveTurnBytes: number;

  constructor(store: Store, adapters: Adapter[] = defaultAdapters(), opts: IngestorOptions = {}) {
    super();
    this.store = store;
    this.adapters = adapters;
    this.now = opts.now ?? (() => new Date());
    this.idleMs = opts.idleMs ?? 60_000;
    this.liveTurnBytes = opts.liveTurnBytes ?? MAX_RECORD_BYTES;
  }

  get descriptors(): Record<string, AdapterDescriptor> {
    return Object.fromEntries(this.adapters.map((a) => [a.descriptor.id, a.descriptor]));
  }

  adapter(id: string): Adapter {
    const a = this.adapters.find((x) => x.descriptor.id === id);
    if (!a) throw new Error(`unknown adapter ${id}`);
    return a;
  }

  /** Lists harness sessions on this machine, marking the ones already imported. */
  async discover(adapterId?:string): Promise<DiscoveredSource[]> {
    return (await this.discoverReport(adapterId)).sources;
  }

  /**
   * Discovery plus a per-adapter error for any location that could not be read (B1, audit A05):
   * a permission failure must not look like a machine with no sessions.
   */
  async discoverReport(adapterId?:string): Promise<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }> {
    const errors: DiscoveryError[] = [];
    const lists = await Promise.all(
      this.adapters.filter(a=>!adapterId||a.descriptor.id===adapterId).map((a) =>
        a.discover().catch((e: unknown) => {
          errors.push({ adapterId: a.descriptor.id, ...describeError(e) });
          return [] as DiscoveredSource[];
        }),
      ),
    );
    const all = lists.flat();
    for (const adapter of this.adapters.filter(a => !adapterId || a.descriptor.id === adapterId)) {
      for (const diagnostic of adapter.diagnostics?.() ?? []) errors.push({ adapterId: adapter.descriptor.id, code: diagnostic.code, message: sanitize(diagnostic.message).value });
    }
    for (const s of all) {
      // Shown in the session list before any import, so it gets the same policy. The path stays
      // exact: it is the import key, and local paths are deliberately visible in the local UI.
      if (s.title !== undefined) s.title = sanitize(s.title).value;
      if (s.cwd !== undefined) s.cwd = sanitize(s.cwd).value;
      const existing = this.existingNativeSource(this.adapter(s.adapterId), s.path);
      if (existing?.sourcePath) s.path = existing.sourcePath;
      const id = existing?.id ?? recordingIdFor(s.adapterId, s.path);
      if (this.store.getRecording(id)) s.importedRecordingId = id;
    }
    return { sources: all.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)), errors };
  }

  /** Picks the adapter whose format matches the file's first records. */
  async sniff(path: string): Promise<Adapter | undefined> {
    const head = await headRecords(path, 128 * 1024, 50);
    return this.adapters.find((a) => a.sniff(head));
  }

  /** Imports (or resumes importing) a journal and its companions. Idempotent. */
  private existingNativeSource(adapter: Adapter, path: string) {
    if (!adapter.identity) return undefined;
    const identity = adapter.identity(path);
    return this.store.listRecordings().find(recording => recording.harness === adapter.descriptor.harness && recording.sourcePath && adapter.identity!(recording.sourcePath) === identity);
  }

  async importSource(adapterId: string, mainPath: string, opts: { title?: string; lineageSeen?: Set<string>; lineageSources?: string[] } & SyncOptions = {}): Promise<ImportResult> {
    const adapter = this.adapter(adapterId);
    const path = this.existingNativeSource(adapter, resolve(mainPath))?.sourcePath ?? resolve(mainPath);
    await stat(adapter.readPath ? await adapter.readPath(path) : path); // fail early, before creating a recording
    const recordingId = recordingIdFor(adapterId, path);
    const title = opts.title === undefined ? undefined : sanitize(opts.title).value;
    this.store.upsertRecording({ id: recordingId, adapterId, harness: adapter.descriptor.harness, sourcePath: path, title });
    this.store.upsertSource({ id: sourceIdFor(path), recordingId, path, role: 'main', cursor: initialCursor() });
    const r = await this.sync(recordingId, { turnBytes: opts.turnBytes });
    if (adapterId === 'claude-code') await this.refreshLineage(recordingId, opts.lineageSeen ?? new Set(), opts.lineageSources);
    return { recordingId, ...r };
  }

  /**
   * One background startup pass (CONTENT-21): a Claude recording imported before shared-uuid continuations were recognised has no link.
   * Each recording is checked once (marker per recording); a link, if found, imports the earlier journal like any other ancestor.
   */
  refreshClaudeLineages(): Promise<number> {
    return this.claudeLineagePass ??= (async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
      let checked = 0;
      for (const recording of this.store.listRecordings().filter(r => r.harness === 'claude-code')) {
        if (this.closed) break;
        const key = 'claude-shared-lineage-v1:' + recording.id;
        if (this.store.db.prepare('SELECT 1 FROM meta WHERE key=?').get(key)) continue;
        // An exact link is already known; only recordings with no link, an ambiguous or a missing parent are looked at again.
        if (this.store.lineageView(recording.id)?.links.some(link => link.childRecordingId === recording.id && link.status === 'linked')) continue;
        try {
          await this.locked(recording.id, () => this.refreshLineage(recording.id, new Set()));
          this.store.db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)').run(key, '1');
          checked++;
        } catch { /* a missing journal is retried on a later start */ }
      }
      return checked;
    })();
  }
  private claudeLineagePass?: Promise<number>;

  /** Derived links are read from discovered native files; importing an ancestor never grants current-workspace access. */
  private async refreshLineage(id: string, seen: Set<string>, paths?: string[]): Promise<void> {
    if (seen.has(id) || seen.size >= 16) return;
    seen.add(id);
    const rec = this.store.getRecording(id);
    if (!rec?.sourcePath) return;
    paths ??= (await this.discover('claude-code')).map(source => source.path);
    const link = await claudeContinuation(rec.sourcePath, paths);
    if (!link) return;
    const candidates = link.candidatePaths.map(path => recordingIdFor('claude-code', path));
    const parent = link.parentPath ? recordingIdFor('claude-code', link.parentPath) : undefined;
    this.store.putLineage({ childRecordingId: id, parentRecordingId: parent, status: link.status, basis: link.basis, childSourceId: sourceIdFor(rec.sourcePath), boundaryRecordId: link.boundaryRecordId, logicalParentRecordId: link.logicalParentRecordId, candidateRecordingIds: candidates, sharedMessageRecords: link.sharedMessageRecords });
    if (parent && link.parentPath && !seen.has(parent)) {
      if (!this.store.getRecording(parent)) await this.importSource('claude-code', link.parentPath, { lineageSeen: seen, lineageSources: paths });
      else await this.refreshLineage(parent, seen, paths);
    }
  }

  /**
   * Reads every source of a recording from its committed cursor. Unbounded unless `turnBytes` is
   * set; live turns are always bounded, and report `more` so the next turn continues.
   */
  sync(recordingId: string, opts: SyncOptions = {}): Promise<{ added: number; gaps: number; more: boolean }> {
    return this.locked(recordingId, () => this.syncUnlocked(recordingId, opts));
  }

  /** Explicit enrichment, serialized with passive capture; every source is still opened read-only. */
  rescan(recordingId: string): Promise<{ added: number; gaps: number; more: boolean }> {
    return this.locked(recordingId, async () => {
      const recording = this.store.getRecording(recordingId);
      if (!recording?.sourcePath) throw new Error('The original journal is unavailable. Captured history remains readable.');
      const row = this.store.db.prepare('SELECT adapter_id AS adapter FROM recordings WHERE id = ?').get(recordingId) as { adapter: string };
      const adapter = this.adapter(row.adapter);
      if (!(await stat(adapter.readPath ? await adapter.readPath(recording.sourcePath) : recording.sourcePath)).isFile()) throw new Error('The original journal is unavailable. Captured history remains readable.');
      for (const source of this.store.getSources(recordingId)) {
        if (!(await stat(source.path).catch(() => undefined))?.isFile()) continue;
        this.store.rewindSource(source);
        // Parse from the beginning rather than prime with future calls/settings from the old cursor.
        this.parsers.set(source.id, adapter.createParser({ recordingId, sourceId: source.id, sourcePath: source.path, agentId: source.agentId }));
      }
      const result = await this.syncUnlocked(recordingId, { acceptUnterminated: false });
      if (adapter.descriptor.id === 'claude-code') await this.refreshLineage(recordingId, new Set());
      return result;
    });
  }

  /** One background startup pass; successful native rereads are remembered across restarts. */
  rescanLegacyCodex(): Promise<LegacyRescanResult> {
    // obs_rec_kind(recording_id, kind) bounds this check without loading captured history.
    return this.legacyCodexRescan ??= this.rescanLegacyOnce('codex', LEGACY_CODEX_RESCAN,
      recording => !this.store.db.prepare("SELECT 1 FROM observations WHERE recording_id=? AND kind='turn.detail' LIMIT 1").get(recording.id));
  }

  /**
   * One background startup pass (CONTENT-20). Observations are stored once and a source's cursor only moves forward, so a Claude Code
   * journal imported before the adapter kept `queued_command` rows never gained the person's mid-turn messages. A journal that has
   * none is marked done without a reread; the rest are re-read once (rows already stored are skipped by their stable ids).
   */
  rescanLegacyClaude(): Promise<LegacyRescanResult> {
    return this.legacyClaudeRescan ??= this.rescanLegacyOnce('claude-code', LEGACY_CLAUDE_QUEUED_RESCAN, async recording => {
      for (const source of this.store.getSources(recording.id)) if (await journalMentions(source.path, '"queued_command"')) return true;
      // Nothing to add: remember that, so a large journal is not read again on the next start.
      this.store.db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)').run(LEGACY_CLAUDE_QUEUED_RESCAN + recording.id, '1');
      return false;
    });
  }

  private async rescanLegacyOnce(harness: 'codex' | 'claude-code', prefix: string, needed: (recording: { id: string }) => boolean | Promise<boolean>): Promise<LegacyRescanResult> {
    const result: LegacyRescanResult = { attempted: 0, completed: 0, unavailable: 0, failed: 0 };
    // Let the listening server return before any native read. Never hold startup on old history.
    await new Promise<void>(resolve => setImmediate(resolve));
    if (this.closed) return result;
    const candidates = this.store.listRecordings().filter(r => r.harness === harness);
    for (const recording of candidates) {
      if (this.closed) break;
      if (!this.store.getRecording(recording.id)) continue;
      const key = prefix + recording.id;
      if (this.store.db.prepare('SELECT 1 FROM meta WHERE key=?').get(key)) continue;
      if (!await needed(recording)) continue;
      result.attempted++;
      try {
        // rescan already owns the recording lock. Do not wrap it in another same-recording lock.
        let scan = await this.rescan(recording.id);
        while (scan.more && !this.closed) {
          await new Promise<void>(resolve => setImmediate(resolve));
          if (this.closed) break;
          scan = await this.sync(recording.id, { acceptUnterminated: false });
        }
        if (!scan.more && this.store.getRecording(recording.id)) {
          const health = this.healthRecords.get(recording.id);
          // readSource can resolve normally after a source disappears. That is not a completed reread.
          if (!health || health.phase !== 'ok' || !health.sources.length || health.sources.some(source => source.state !== 'ok')) {
            result.unavailable++;
            continue;
          }
          this.store.db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)').run(key, '1');
          result.completed++;
        }
      } catch (error) {
        if (!this.store.getRecording(recording.id)) continue;
        const errno = (error as NodeJS.ErrnoException)?.code;
        const missing = errno === 'ENOENT';
        if (missing) result.unavailable++; else result.failed++;
        this.setHealth(recording.id, {
          phase: missing ? 'missing-source' : 'failed',
          error: { code: missing ? 'missing-source' : errno === 'EACCES' || errno === 'EPERM' ? 'permission-denied' : 'read-failed',
            message: missing ? 'The original journal is unavailable. Captured history remains readable.' : 'The journal could not be enriched. Captured history remains readable.' },
        });
        // No completion marker: a later startup may retry a restored/readable source.
      }
    }
    return result;
  }

  private async syncUnlocked(recordingId: string, opts: SyncOptions): Promise<{ added: number; gaps: number; more: boolean }> {
    const rec = this.store.getRecording(recordingId);
    if (!rec) throw new Error(`no recording ${recordingId}`);
    const adapterId = (this.store.db.prepare('SELECT adapter_id AS a FROM recordings WHERE id = ?').get(recordingId) as { a: string }).a;
    const adapter = this.adapters.find((x) => x.descriptor.id === adapterId);
    if (!adapter) {
      this.setHealth(recordingId, { phase: 'unsupported', error: { code: 'unsupported', message: `This version of Drishya has no reader for ${adapterId} recordings. What was captured still replays.` } });
      return { added: 0, gaps: 0, more: false };
    }
    if (!this.live.has(recordingId) && this.healthRecords.get(recordingId)?.phase !== 'ok') this.setHealth(recordingId, { phase: 'importing' });
    const turnBytes = opts.turnBytes ?? (this.live.has(recordingId) ? this.liveTurnBytes : undefined);

    try {
      // New companion files (e.g. a subagent started since the last read) join the recording.
      const set = await adapter.sourceSet(rec.sourcePath!);
      for (const c of set.companions) this.store.upsertSource({ id: sourceIdFor(c.path), recordingId, path: c.path, agentId: c.agentId, role: 'companion', cursor: initialCursor() });

      let added = 0;
      let gaps = 0;
      let more = false;
      let mainMissing = false;
      const sources: RecordingHealth['sources'] = [];
      for (const src of this.store.getSources(recordingId)) {
        const r = await this.readSource(adapter, src, rec.live, turnBytes, opts.acceptUnterminated);
        added += r.added;
        gaps += r.gaps;
        more ||= r.more;
        sources.push({ path: src.path, role: src.role, state: r.missing ? 'missing' : 'ok', bytes: r.size });
        if (r.missing && src.role === 'main') mainMissing = true;
      }
      const at = this.now().toISOString();
      const prev = this.healthRecords.get(recordingId);
      this.setHealth(recordingId, {
        phase: mainMissing ? 'missing-source' : 'ok',
        error: mainMissing ? { code: 'missing-source', message: 'The session journal is no longer at its recorded path. What was already captured still replays.' } : undefined,
        lastReadAt: at,
        lastChangeAt: added ? at : prev?.lastChangeAt,
        backlog: more,
        sources,
      });
      const cur = this.store.getRecording(recordingId)!;
      if (added || (!cur.workspaceRoot && !prev?.lastReadAt)) {
        // Collection must not rebuild/render all prior work just to obtain a list label.
        // These fields are sanitized captured metadata; full reduction is a reader concern.
        {
          const meta = this.store.captureMetadata(recordingId);
          this.store.updateRecordingMeta(recordingId, {
            ...(meta.title && meta.title !== cur.title ? { title: meta.title } : {}),
            ...(!cur.workspaceRoot && meta.workspaceRoot ? { workspaceRoot: meta.workspaceRoot } : {}),
          });
        }
      }
      // A completed bulk read no longer needs its SQLite working pages. Keep
      // cache_size unchanged for subsequent work; this asks SQLite to release
      // unused pages rather than retaining the import's native working set.
      if (added && !more && this.store.sourceBytes(recordingId) > 32 * 1024 * 1024) this.store.db.exec('PRAGMA shrink_memory');
      if (added) {
        if (adapterId === 'antigravity') for (const key of this.projectionCache.keys()) {
          if (key.split('\u0000')[0]!.split('+').includes(recordingId)) this.projectionCache.delete(key);
        }
        const ev: ChangeEvent = { type: 'recording', recordingId, revision: cur.revision ?? 0, observationCount: cur.observationCount, added, live: cur.live };
        this.emit('change', ev);
      }
      return { added, gaps, more };
    } catch (e) {
      // A failed read is a visible state with a stable code, never a swallowed error.
      this.setHealth(recordingId, { phase: 'failed', error: describeError(e), lastReadAt: this.now().toISOString() });
      throw e;
    }
  }

  private async readSource(adapter: Adapter, src: SourceRow, live: boolean, turnBytes: number | undefined, acceptUnterminated = !live): Promise<{ added: number; gaps: number; more: boolean; missing: boolean; size?: number }> {
    const readPath = adapter.readPath ? await adapter.readPath(src.path) : src.path;
    const switched = !!adapter.readPath && (src.cursor.readPath ?? src.path) !== readPath && src.cursor.offset > 0;
    if (switched) this.parsers.delete(src.id);
    let parser = this.parsers.get(src.id);
    if (!parser) {
      parser = adapter.createParser({ recordingId: src.recordingId, sourceId: src.id, sourcePath: src.path, agentId: src.agentId });
      // After a restart, rebuild call correlation from what is already stored.
      if (!switched) parser.prime(this.store.observationsOfKinds(src.recordingId, ['tool.call', 'tool.result', 'session.meta', 'turn.start', 'turn.end', ...(adapter.descriptor.id === 'antigravity' ? ['checkpoint'] : [])]).filter((o) => o.source.sourceId === src.id));
      this.parsers.set(src.id, parser);
    }
    // A record must fit in one read, or a bounded turn could never get past it.
    const readOpts = turnBytes === undefined ? { acceptUnterminated } : { acceptUnterminated, maxReadBytes: turnBytes, maxRecordBytes: Math.min(MAX_RECORD_BYTES, turnBytes) };
    let cursor = switched ? { ...initialCursor(), generation: src.cursor.generation + 1 } : src.cursor;
    let added = 0;
    let gaps = 0;
    let more = false;
    let size: number | undefined;
    for (let guard = 0; guard < 10_000; guard++) {
      let res;
      try {
        res = await readJsonl(readPath, cursor, readOpts);
        if (adapter.readPath) Object.assign(res.cursor, { readPath });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { added, gaps, more: false, missing: true };
        throw e;
      }
      size = res.size;
      if (res.reset) {
        // The file was truncated or replaced: a new generation, parsed from scratch.
        parser = adapter.createParser({ recordingId: src.recordingId, sourceId: src.id, sourcePath: src.path, agentId: src.agentId });
        this.parsers.set(src.id, parser);
      }
      const observedAt = this.now().toISOString();
      // Seal and store one read in slices of about SLICE_BYTES, committing the cursor after
      // each and yielding between them. A whole 4 MiB read sealed and written at once held the
      // daemon thread for 110-150 ms on a large Codex journal (PERF-2), stalling API requests.
      let sealed = [];
      let sliceBytes = 0;
      let yieldedAt = performance.now();
      if (res.reset) sealed.unshift(seal({ raw: gap('source-truncated', undefined, `source ${res.reset}; reading a new generation`, src.agentId), recordingId: src.recordingId, adapter: adapter.descriptor, sourceId: src.id, generation: res.cursor.generation, byteOffset: -1, observedAt }));
      for (let r = 0; r < res.records.length; r++) {
        const rec = res.records[r]!;
        let raws: RawObservation[];
        if (rec.type === 'record') {
          try {
            raws = parser.parse(rec.value);
          } catch (e) {
            raws = [gap('unsupported-content', rec.bytes, `adapter error: ${e instanceof Error ? e.message.slice(0, 120) : 'unknown'}`, src.agentId)];
          }
        } else {
          raws = [gap(rec.type === 'oversized' ? 'oversized-record' : 'malformed-record', rec.bytes, rec.type === 'malformed' ? rec.error : undefined, src.agentId)];
        }
        for (const raw of raws) {
          if (raw.kind === 'capture.gap') gaps++;
          sealed.push(seal({ raw, recordingId: src.recordingId, adapter: adapter.descriptor, sourceId: src.id, generation: res.cursor.generation, byteOffset: rec.offset, observedAt }));
        }
        sliceBytes += rec.bytes;
        const last = r === res.records.length - 1;
        if (!last && sliceBytes < SLICE_BYTES) {
          if (performance.now() - yieldedAt >= RECORD_YIELD_MS) {
            // No transaction is open. Sealed values remain private in this slice;
            // readers see only the prior atomic cursor/data commit. Blob writes
            // happen later in appendObservations, never across this yield.
            await new Promise((ok) => setImmediate(ok));
            yieldedAt = performance.now();
          }
          continue;
        }
        // Records before the last are complete lines, so the slice ends exactly after this one.
        const through = last ? res.cursor : { ...res.cursor, offset: rec.offset + rec.bytes, inOversized: false };
        added += this.store.appendObservations(src.recordingId, src.id, through, sealed).length;
        sealed = [];
        sliceBytes = 0;
        if (!last) await new Promise((ok) => setImmediate(ok));
        yieldedAt = performance.now();
      }
      // A read with no records still moves the cursor (an oversized line being skipped, a reset).
      if (!res.records.length || sealed.length) added += this.store.appendObservations(src.recordingId, src.id, res.cursor, sealed).length;
      const progressed = res.cursor.offset !== cursor.offset || res.cursor.generation !== cursor.generation;
      cursor = res.cursor;
      if (turnBytes !== undefined) {
        // One bounded read per turn. A trailing partial line makes no progress, so it never
        // reports `more` and never spins the live loop.
        more = progressed && res.cursor.offset < res.size;
        break;
      }
      if (!progressed || res.cursor.offset >= res.size) break;
      await new Promise((ok) => setImmediate(ok)); // let the API and other recordings run between batches
    }
    return { added, gaps, more, missing: false, size };
  }

  // ── capture health ────────────────────────────────────────────────────────

  /** The observer's current state for a recording, derived from its last reads and the clock. */
  health(recordingId: string): RecordingHealth {
    const h = this.healthRecords.get(recordingId);
    const live = this.live.has(recordingId);
    let state: CaptureState;
    switch (h?.phase) {
      case 'importing':
        state = live ? 'following' : 'importing';
        break;
      case 'missing-source':
      case 'unsupported':
      case 'failed':
        state = h.phase;
        break;
      default: {
        if (!live) {
          state = 'stopped';
          break;
        }
        const since = Math.max(Date.parse(h?.lastChangeAt ?? '') || 0, Date.parse(h?.followSince ?? '') || 0);
        state = since && this.now().getTime() - since > this.idleMs ? 'idle' : 'following';
      }
    }
    return {
      state,
      live,
      lastReadAt: h?.lastReadAt,
      lastChangeAt: h?.lastChangeAt,
      backlog: h?.backlog ?? false,
      error: h?.error,
      sources: h?.sources ?? this.store.getSources(recordingId).map((s) => ({ path: s.path, role: s.role, state: 'ok' as const })),
    };
  }

  private setHealth(recordingId: string, patch: Partial<HealthRecord>) {
    const prev = this.healthRecords.get(recordingId) ?? { phase: 'ok' as const, backlog: false, sources: [] };
    const next: HealthRecord = { ...prev, ...patch };
    if ('error' in patch) next.error = patch.error;
    this.healthRecords.set(recordingId, next);
    this.announceHealth(recordingId);
  }

  /** Emits `health` only when the visible state or error changes. */
  private announceHealth(recordingId: string) {
    const health = this.health(recordingId);
    const key = `${health.state}|${health.error?.code ?? ''}`;
    if (this.lastEmitted.get(recordingId) === key) return;
    this.lastEmitted.set(recordingId, key);
    this.emit('health', { type: 'health', recordingId, health } satisfies HealthEvent);
  }

  /** The projection, rebuilt only when observations changed or the reducer version moved. */
  projection(recordingId: string): Projection {
    const count = this.store.countObservations(recordingId);
    const cached = this.projectionCache.get(recordingId);
    if (cached && cached.count === count && cached.projection.reducerVersion === REDUCER_VERSION) return cached.projection;
    const stored = this.store.getProjection(recordingId);
    const live = this.store.getRecording(recordingId)?.live ?? false;
    let projection: Projection;
    if (stored && stored.observationCount === count && stored.reducerVersion === REDUCER_VERSION && !live) {
      projection = JSON.parse(stored.body);
    } else {
      projection = reduce(recordingId, this.store.orderedObservations(recordingId), this.store.blobs, { adapters: this.descriptors, live, ordered: true });
      if (count <= 10_000) this.store.putProjection(recordingId, REDUCER_VERSION, count, JSON.stringify(projection));
    }
    const lineage = this.store.lineageView(recordingId);
    if (lineage?.recordingIds.length === 1) projection.lineage = lineage;
    this.cacheProjection(recordingId, count, projection);
    return projection;
  }

  /**
   * Several recordings as one scene, e.g. Claude writing and Codex reviewing the same
   * repository. Ids are namespaced per recording, so the reducer merges them by source time.
   */
  combinedProjection(ids: string[]): Projection {
    const unique = [...new Set(ids)];
    if (unique.length === 1) return this.projection(unique[0]!);
    const roots = unique.map((id) => this.store.getRecording(id)?.workspaceRoot?.replace(/\\/g, '/').replace(/\/+$/, ''));
    const mixedRoots = roots.some((root) => !root) || new Set(roots.map((root) => /^[a-z]:\//i.test(root!) ? root!.toLowerCase() : root)).size !== 1;
    const key = unique.join('+');
    const lineage = this.store.lineageForIds(unique);
    const cacheKey = `${key}\u0000${roots.join('\u0000')}\u0000${JSON.stringify(lineage?.links)}`;
    const count = unique.reduce((s, id) => s + this.store.countObservations(id), 0);
    const cached = this.projectionCache.get(cacheKey);
    if (cached && cached.count === count) return cached.projection;
    const live = unique.some((id) => this.store.getRecording(id)?.live);
    const projection = reduce(lineage?.currentRecordingId ?? key, lineage ? this.store.lineageObservations(lineage) : this.store.orderedObservations(unique), this.store.blobs, { adapters: this.descriptors, live, ordered: true, lineage });
    // A combined view spanning worktrees has no single repository root. Its paths remain
    // evidence-backed per source, and the map uses captured paths instead of one checkout.
    if (mixedRoots) projection.workspaceRoot = undefined;
    this.cacheProjection(cacheKey, count, projection);
    return projection;
  }

  // ── live tailing ──────────────────────────────────────────────────────────

  /**
   * Passive tailing by polling file size. Polling, not fs.watch: watch events are unreliable
   * on Windows and network drives, and a 750 ms poll of a few stat calls costs nothing.
   *
   * Ticks coalesce (B1, audit A06): at most one turn runs per recording, and ticks that arrive
   * meanwhile collapse into a single pending wake-up. Each turn reads a bounded number of bytes;
   * a backlog continues on the next pass instead of in one long read.
   */
  startLive(recordingId: string, intervalMs = 500) {
    if (this.live.has(recordingId)) return;
    this.store.updateRecordingMeta(recordingId, { live: true });
    this.projectionCache.delete(recordingId);
    const sizes = new Map<string, number>();
    let tick = 0;
    let pending = false;
    const run: LiveRun = { timer: undefined as unknown as NodeJS.Timeout };
    const turns = async () => {
      do {
        pending = false;
        // A tick queued before stopLive/close must not touch a store that is shutting down.
        if (this.closed || this.live.get(recordingId) !== run) return;
        tick++;
        let changed = tick % 4 === 0 || (this.healthRecords.get(recordingId)?.backlog ?? false); // periodic look for new companions
        for (const s of this.store.getSources(recordingId)) {
          const size = (await stat(s.path).catch(() => undefined))?.size ?? -1;
          if (sizes.get(s.path) !== size) changed = true;
          sizes.set(s.path, size);
        }
        if (!changed || this.closed || this.live.get(recordingId) !== run) continue;
        try {
          if ((await this.sync(recordingId)).more) pending = true;
        } catch {
          // Recorded as `failed` health by sync; the next tick tries again.
        }
      } while (pending && !this.closed && this.live.get(recordingId) === run);
    };
    const wake = () => {
      if (run.current) {
        pending = true;
        return;
      }
      run.current = turns().finally(() => {
        run.current = undefined;
        this.announceHealth(recordingId); // following → idle shows up even without new data
      });
    };
    run.timer = setInterval(wake, intervalMs);
    run.timer.unref();
    this.live.set(recordingId, run);
    this.setHealth(recordingId, { followSince: this.now().toISOString() });
    this.emit('change', { type: 'recording', recordingId, revision: this.store.getRecording(recordingId)?.revision ?? 0, observationCount: this.store.countObservations(recordingId), added: 0, live: true } satisfies ChangeEvent);
  }

  async stopLive(recordingId: string) {
    const run = this.live.get(recordingId);
    if (run) clearInterval(run.timer);
    this.live.delete(recordingId);
    await run?.current; // let a turn in flight finish rather than overlap the final read
    this.store.updateRecordingMeta(recordingId, { live: false });
    // Read the final bytes, including an unterminated last line, now that it is complete.
    await this.sync(recordingId).catch(() => undefined); // a failure is recorded as health
    this.projectionCache.delete(recordingId);
    this.announceHealth(recordingId);
    this.emit('change', { type: 'recording', recordingId, revision: this.store.getRecording(recordingId)?.revision ?? 0, observationCount: this.store.countObservations(recordingId), added: 0, live: false } satisfies ChangeEvent);
  }

  isLive(recordingId: string) {
    return this.live.has(recordingId);
  }

  /** Recordings flagged live by an earlier process are not live now; clear the stale flag. */
  resetLiveFlags() {
    for (const r of this.store.listRecordings()) if (r.live && !this.live.has(r.id)) this.store.updateRecordingMeta(r.id, { live: false });
  }

  stopAll() {
    for (const run of this.live.values()) clearInterval(run.timer);
    this.live.clear();
  }

  /** Stops tailing and waits for any read in flight, so the store can be closed safely. */
  async close() {
    this.closed = true;
    const running = [...this.live.values()].map((r) => r.current);
    this.stopAll();
    await Promise.allSettled([...running, ...this.locks.values(), this.legacyCodexRescan, this.legacyClaudeRescan, this.claudeLineagePass]);
  }

  /**
   * Stops tailing, waits for any read in flight (audit A08: a queued ingest must not write into a
   * recording being deleted), then deletes its rows and the blobs only it used.
   */
  async forget(recordingId: string): Promise<{ blobsRemoved: number }> {
    const run = this.live.get(recordingId);
    if (run) clearInterval(run.timer);
    this.live.delete(recordingId);
    await run?.current;
    return this.locked(recordingId, async () => {
      for (const s of this.store.getSources(recordingId)) this.parsers.delete(s.id);
      for (const key of this.projectionCache.keys()) if (key.split('\u0000')[0]!.split('+').includes(recordingId)) this.projectionCache.delete(key);
      this.workerOwnedRecordings.delete(recordingId);
      this.healthRecords.delete(recordingId);
      this.lastEmitted.delete(recordingId);
      return this.store.deleteRecording(recordingId);
    });
  }

  /** True when any stored observation was sealed under an older privacy policy; re-import to apply the current one. */
  privacyOutdated(recordingId: string): boolean {
    return this.store.policyVersions(recordingId).some((v) => v !== PRIVACY_POLICY_VERSION);
  }

  private locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(key, next.catch(() => undefined));
    return next;
  }
}

/** A stable code and a sanitized message for an error, for health and discovery reports. */
function describeError(e: unknown): { code: string; message: string } {
  const errno = (e as NodeJS.ErrnoException)?.code;
  const code = errno === 'EACCES' || errno === 'EPERM' ? 'permission-denied' : errno === 'ENOENT' ? 'not-found' : 'read-failed';
  const raw = e instanceof Error ? e.message : String(e);
  return { code, message: sanitize(raw).value.slice(0, 300) };
}

/** Whether a journal holds the text anywhere: a cheap read-only pass that parses nothing. An unreadable journal reports false. */
async function journalMentions(path: string, needle: string): Promise<boolean> {
  try {
    const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of lines) if (line.includes(needle)) { lines.close(); return true; }
  } catch { /* a missing journal is reported by the rescan itself */ }
  return false;
}

function gap(reason: string, bytes: number | undefined, detail: string | undefined, agentId: string | undefined): RawObservation {
  return { part: 0, kind: 'capture.gap', agentId: agentId ?? 'agent:main', payload: { reason, bytes, detail }, availability: 'metadata-only' };
}
