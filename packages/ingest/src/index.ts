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
import type { AdapterDescriptor, DiscoveredSource, Projection } from '@drishya/contracts';
import { reduce, REDUCER_VERSION } from '@drishya/projection';
import type { SourceRow, Store } from '@drishya/store';

export const defaultAdapters = (): Adapter[] => [claudeAdapter, codexAdapter];

export interface ChangeEvent {
  type: 'recording';
  recordingId: string;
  observationCount: number;
  added: number;
  live: boolean;
}

export interface ImportResult {
  recordingId: string;
  added: number;
  gaps: number;
}

export class Ingestor extends EventEmitter {
  readonly store: Store;
  readonly adapters: Adapter[];
  private parsers = new Map<string, RecordParser>();
  private locks = new Map<string, Promise<unknown>>();
  private live = new Map<string, NodeJS.Timeout>();
  private projectionCache = new Map<string, { count: number; projection: Projection }>();
  private closed = false;

  constructor(store: Store, adapters: Adapter[] = defaultAdapters()) {
    super();
    this.store = store;
    this.adapters = adapters;
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
    const all = (await Promise.all(this.adapters.map((a) => a.discover().catch(() => [])))).flat();
    for (const s of all) {
      const id = recordingIdFor(s.adapterId, s.path);
      if (this.store.getRecording(id)) s.importedRecordingId = id;
    }
    return all.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  /** Picks the adapter whose format matches the file's first records. */
  async sniff(path: string): Promise<Adapter | undefined> {
    const head = await headRecords(path, 128 * 1024, 50);
    return this.adapters.find((a) => a.sniff(head));
  }

  /** Imports (or resumes importing) a journal and its companions. Idempotent. */
  async importSource(adapterId: string, mainPath: string, opts: { title?: string } = {}): Promise<ImportResult> {
    const adapter = this.adapter(adapterId);
    const path = resolve(mainPath);
    await stat(path); // fail early, before creating a recording
    const recordingId = recordingIdFor(adapterId, path);
    this.store.upsertRecording({ id: recordingId, adapterId, harness: adapter.descriptor.harness, sourcePath: path, title: opts.title });
    this.store.upsertSource({ id: sourceIdFor(path), recordingId, path, role: 'main', cursor: initialCursor() });
    const r = await this.sync(recordingId);
    return { recordingId, ...r };
  }

  /** Reads every source of a recording from its committed cursor. */
  sync(recordingId: string): Promise<{ added: number; gaps: number }> {
    return this.locked(recordingId, () => this.syncUnlocked(recordingId));
  }

  private async syncUnlocked(recordingId: string): Promise<{ added: number; gaps: number }> {
    const rec = this.store.getRecording(recordingId);
    if (!rec) throw new Error(`no recording ${recordingId}`);
    const adapterId = (this.store.db.prepare('SELECT adapter_id AS a FROM recordings WHERE id = ?').get(recordingId) as { a: string }).a;
    const adapter = this.adapter(adapterId);

    // New companion files (e.g. a subagent started since the last read) join the recording.
    const set = await adapter.sourceSet(rec.sourcePath!);
    for (const c of set.companions) this.store.upsertSource({ id: sourceIdFor(c.path), recordingId, path: c.path, agentId: c.agentId, role: 'companion', cursor: initialCursor() });

    let added = 0;
    let gaps = 0;
    for (const src of this.store.getSources(recordingId)) {
      const r = await this.readSource(adapter, src, rec.live);
      added += r.added;
      gaps += r.gaps;
    }
    if (added) {
      const p = this.projection(recordingId);
      const cur = this.store.getRecording(recordingId)!;
      if (!cur.title && p.title) this.store.updateRecordingMeta(recordingId, { title: p.title });
      if (!cur.workspaceRoot && p.workspaceRoot) this.store.updateRecordingMeta(recordingId, { workspaceRoot: p.workspaceRoot });
      const ev: ChangeEvent = { type: 'recording', recordingId, observationCount: cur.observationCount, added, live: cur.live };
      this.emit('change', ev);
    }
    return { added, gaps };
  }

  private async readSource(adapter: Adapter, src: SourceRow, live: boolean): Promise<{ added: number; gaps: number }> {
    let parser = this.parsers.get(src.id);
    if (!parser) {
      parser = adapter.createParser({ recordingId: src.recordingId, sourceId: src.id, sourcePath: src.path, agentId: src.agentId });
      // After a restart, rebuild call correlation from what is already stored.
      parser.prime(this.store.observationsOfKinds(src.recordingId, ['tool.call', 'session.meta']).filter((o) => o.source.sourceId === src.id));
      this.parsers.set(src.id, parser);
    }
    let cursor = src.cursor;
    let added = 0;
    let gaps = 0;
    for (let guard = 0; guard < 10_000; guard++) {
      let res;
      try {
        res = await readJsonl(src.path, cursor, { acceptUnterminated: !live });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { added, gaps };
        throw e;
      }
      if (res.reset) {
        // The file was truncated or replaced: a new generation, parsed from scratch.
        parser = adapter.createParser({ recordingId: src.recordingId, sourceId: src.id, sourcePath: src.path, agentId: src.agentId });
        this.parsers.set(src.id, parser);
      }
      const observedAt = new Date().toISOString();
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
      if (!progressed || res.cursor.offset >= res.size) break;
    }
    return { added, gaps };
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
    const key = unique.join('+');
    const count = unique.reduce((s, id) => s + this.store.countObservations(id), 0);
    const cached = this.projectionCache.get(key);
    if (cached && cached.count === count) return cached.projection;
    const live = unique.some((id) => this.store.getRecording(id)?.live);
    const obs = unique.flatMap((id) => this.store.observations(id));
    const projection = reduce(key, obs, this.store.blobs, { adapters: this.descriptors, live });
    this.projectionCache.set(key, { count, projection });
    return projection;
  }

  // ── live tailing ──────────────────────────────────────────────────────────

  /**
   * Passive tailing by polling file size. Polling, not fs.watch: watch events are unreliable
   * on Windows and network drives, and a 750 ms poll of a few stat calls costs nothing.
   */
  startLive(recordingId: string, intervalMs = 750) {
    if (this.live.has(recordingId)) return;
    this.store.updateRecordingMeta(recordingId, { live: true });
    this.projectionCache.delete(recordingId);
    const sizes = new Map<string, number>();
    let tick = 0;
    const timer = setInterval(async () => {
      tick++;
      // A tick queued before stopLive/close must not touch a store that is shutting down.
      if (this.closed || !this.live.has(recordingId)) return;
      try {
        let changed = tick % 4 === 0; // periodically look for new companion files
        for (const s of this.store.getSources(recordingId)) {
          const size = (await stat(s.path).catch(() => undefined))?.size ?? 0;
          if (sizes.get(s.path) !== size) changed = true;
          sizes.set(s.path, size);
        }
        if (changed && !this.closed && this.live.has(recordingId)) await this.sync(recordingId);
      } catch (e) {
        this.emit('error', e);
      }
    }, intervalMs);
    timer.unref();
    this.live.set(recordingId, timer);
    this.emit('change', { type: 'recording', recordingId, observationCount: this.store.countObservations(recordingId), added: 0, live: true } satisfies ChangeEvent);
  }

  async stopLive(recordingId: string) {
    const t = this.live.get(recordingId);
    if (t) clearInterval(t);
    this.live.delete(recordingId);
    this.store.updateRecordingMeta(recordingId, { live: false });
    // Read the final bytes, including an unterminated last line, now that it is complete.
    await this.sync(recordingId);
    this.projectionCache.delete(recordingId);
    this.emit('change', { type: 'recording', recordingId, observationCount: this.store.countObservations(recordingId), added: 0, live: false } satisfies ChangeEvent);
  }

  isLive(recordingId: string) {
    return this.live.has(recordingId);
  }

  /** Recordings flagged live by an earlier process are not live now; clear the stale flag. */
  resetLiveFlags() {
    for (const r of this.store.listRecordings()) if (r.live && !this.live.has(r.id)) this.store.updateRecordingMeta(r.id, { live: false });
  }

  stopAll() {
    for (const t of this.live.values()) clearInterval(t);
    this.live.clear();
  }

  /** Stops tailing and waits for any read in flight, so the store can be closed safely. */
  async close() {
    this.closed = true;
    this.stopAll();
    await Promise.allSettled([...this.locks.values()]);
  }

  forget(recordingId: string) {
    const t = this.live.get(recordingId);
    if (t) clearInterval(t);
    this.live.delete(recordingId);
    this.projectionCache.delete(recordingId);
    for (const s of this.store.getSources(recordingId)) this.parsers.delete(s.id);
  }

  private locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(key, next.catch(() => undefined));
    return next;
  }
}

function gap(reason: string, bytes: number | undefined, detail: string | undefined, agentId: string | undefined): RawObservation {
  return { part: 0, kind: 'capture.gap', agentId: agentId ?? 'agent:main', payload: { reason, bytes, detail }, availability: 'metadata-only' };
}
