// The ingest path: harness journal → bounded read → adapter parse → seal (privacy) → store.
// Capture never waits on presentation: nothing here depends on a viewer being connected.

import { EventEmitter } from 'node:events';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { claudeAdapter } from '@drishya/adapter-claude';
import { codexAdapter } from '@drishya/adapter-codex';
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

export const defaultAdapters = (): Adapter[] => [claudeAdapter, codexAdapter];

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
}

export interface IngestorOptions {
  now?: () => Date;
  /** Following with nothing new for this long reads as idle. */
  idleMs?: number;
  /** Bytes one live turn reads per source before yielding to the next tick. */
  liveTurnBytes?: number;
}

const MAX_RECORD_BYTES = 16 * 1024 * 1024;

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
  private healthRecords = new Map<string, HealthRecord>();
  private lastEmitted = new Map<string, string>();
  private closed = false;
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
  async discover(): Promise<DiscoveredSource[]> {
    return (await this.discoverReport()).sources;
  }

  /**
   * Discovery plus a per-adapter error for any location that could not be read (B1, audit A05):
   * a permission failure must not look like a machine with no sessions.
   */
  async discoverReport(): Promise<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }> {
    const errors: DiscoveryError[] = [];
    const lists = await Promise.all(
      this.adapters.map((a) =>
        a.discover().catch((e: unknown) => {
          errors.push({ adapterId: a.descriptor.id, ...describeError(e) });
          return [] as DiscoveredSource[];
        }),
      ),
    );
    const all = lists.flat();
    for (const s of all) {
      // Shown in the session list before any import, so it gets the same policy. The path stays
      // exact: it is the import key, and local paths are deliberately visible in the local UI.
      if (s.title !== undefined) s.title = sanitize(s.title).value;
      if (s.cwd !== undefined) s.cwd = sanitize(s.cwd).value;
      const id = recordingIdFor(s.adapterId, s.path);
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
  async importSource(adapterId: string, mainPath: string, opts: { title?: string } & SyncOptions = {}): Promise<ImportResult> {
    const adapter = this.adapter(adapterId);
    const path = resolve(mainPath);
    await stat(path); // fail early, before creating a recording
    const recordingId = recordingIdFor(adapterId, path);
    const title = opts.title === undefined ? undefined : sanitize(opts.title).value;
    this.store.upsertRecording({ id: recordingId, adapterId, harness: adapter.descriptor.harness, sourcePath: path, title });
    this.store.upsertSource({ id: sourceIdFor(path), recordingId, path, role: 'main', cursor: initialCursor() });
    const r = await this.sync(recordingId, { turnBytes: opts.turnBytes });
    return { recordingId, ...r };
  }

  /**
   * Reads every source of a recording from its committed cursor. Unbounded unless `turnBytes` is
   * set; live turns are always bounded, and report `more` so the next turn continues.
   */
  sync(recordingId: string, opts: SyncOptions = {}): Promise<{ added: number; gaps: number; more: boolean }> {
    return this.locked(recordingId, () => this.syncUnlocked(recordingId, opts));
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
        const r = await this.readSource(adapter, src, rec.live, turnBytes);
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
      if (added) {
        const p = this.projection(recordingId);
        const cur = this.store.getRecording(recordingId)!;
        if (!cur.title && p.title) this.store.updateRecordingMeta(recordingId, { title: p.title });
        if (!cur.workspaceRoot && p.workspaceRoot) this.store.updateRecordingMeta(recordingId, { workspaceRoot: p.workspaceRoot });
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

  private async readSource(adapter: Adapter, src: SourceRow, live: boolean, turnBytes: number | undefined): Promise<{ added: number; gaps: number; more: boolean; missing: boolean; size?: number }> {
    let parser = this.parsers.get(src.id);
    if (!parser) {
      parser = adapter.createParser({ recordingId: src.recordingId, sourceId: src.id, sourcePath: src.path, agentId: src.agentId });
      // After a restart, rebuild call correlation from what is already stored.
      parser.prime(this.store.observationsOfKinds(src.recordingId, ['tool.call', 'session.meta']).filter((o) => o.source.sourceId === src.id));
      this.parsers.set(src.id, parser);
    }
    // A record must fit in one read, or a bounded turn could never get past it.
    const readOpts = turnBytes === undefined ? { acceptUnterminated: !live } : { acceptUnterminated: !live, maxReadBytes: turnBytes, maxRecordBytes: Math.min(MAX_RECORD_BYTES, turnBytes) };
    let cursor = src.cursor;
    let added = 0;
    let gaps = 0;
    let more = false;
    let size: number | undefined;
    for (let guard = 0; guard < 10_000; guard++) {
      let res;
      try {
        res = await readJsonl(src.path, cursor, readOpts);
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
      const sealed = [];
      for (const rec of res.records) {
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
      }
      if (res.reset) sealed.unshift(seal({ raw: gap('source-truncated', undefined, `source ${res.reset}; reading a new generation`, src.agentId), recordingId: src.recordingId, adapter: adapter.descriptor, sourceId: src.id, generation: res.cursor.generation, byteOffset: -1, observedAt }));
      const stored = this.store.appendObservations(src.recordingId, src.id, res.cursor, sealed);
      added += stored.length;
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
      projection = reduce(recordingId, this.store.observations(recordingId), this.store.blobs, { adapters: this.descriptors, live });
      this.store.putProjection(recordingId, REDUCER_VERSION, count, JSON.stringify(projection));
    }
    this.projectionCache.set(recordingId, { count, projection });
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
    const cacheKey = `${key}\u0000${roots.join('\u0000')}`;
    const count = unique.reduce((s, id) => s + this.store.countObservations(id), 0);
    const cached = this.projectionCache.get(cacheKey);
    if (cached && cached.count === count) return cached.projection;
    const live = unique.some((id) => this.store.getRecording(id)?.live);
    const obs = unique.flatMap((id) => this.store.observations(id));
    const projection = reduce(key, obs, this.store.blobs, { adapters: this.descriptors, live });
    // A combined view spanning worktrees has no single repository root. Its paths remain
    // evidence-backed per source, and the map uses captured paths instead of one checkout.
    if (mixedRoots) projection.workspaceRoot = undefined;
    this.projectionCache.set(cacheKey, { count, projection });
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
  startLive(recordingId: string, intervalMs = 750) {
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
    await Promise.allSettled([...running, ...this.locks.values()]);
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
      for (const key of this.projectionCache.keys()) if (key.split('+').includes(recordingId)) this.projectionCache.delete(key);
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

function gap(reason: string, bytes: number | undefined, detail: string | undefined, agentId: string | undefined): RawObservation {
  return { part: 0, kind: 'capture.gap', agentId: agentId ?? 'agent:main', payload: { reason, bytes, detail }, availability: 'metadata-only' };
}
