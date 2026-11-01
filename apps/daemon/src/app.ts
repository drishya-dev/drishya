// Shared application wiring used by the server and the CLI.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Artifact, ArtifactSlice, Projection, RecordingSummary, ReplayBundle, RepoGraph } from '@drishya/contracts';
import { buildGraph, graphFromPaths, probeGeneration } from '@drishya/indexer';
import { Ingestor } from '@drishya/ingest';
import { PRIVACY_POLICY_VERSION, sanitize } from '@drishya/privacy';
import { Store } from '@drishya/store';
import { HistoryService } from './history.ts';
import { workingLocations } from '../../../packages/contracts/src/working-locations.ts';

export const VERSION = '0.1.0-draft';

export function dataDir(): string {
  return resolve(process.env.DRISHYA_HOME ?? join(homedir(), '.drishya'));
}

export class App {
  readonly store: Store;
  readonly ingest: Ingestor;
  readonly history: HistoryService;
  private graphs = new Map<string, RepoGraph>();
  private probes = new Map<string, { at: number; generation: string }>();
  private readonly graphProbeMs: number;
  private deleting = new Set<string>();

  /** `graphProbeMs`: how long a freshness probe of a map root is reused (default 15 s). */
  constructor(dir = dataDir(), opts: { memory?: boolean; graphProbeMs?: number } = {}) {
    this.store = new Store(dir, opts);
    this.ingest = new Ingestor(this.store);
    this.history = new HistoryService(dir, id => this.ingest.useHistoryWorker(id));
    this.graphProbeMs = opts.graphProbeMs ?? 15_000;
  }

  recording(id: string): RecordingSummary {
    if (this.deleting.has(id)) throw new HttpError(409, 'recording is being removed');
    const r = this.store.getRecording(id);
    if (!r) throw new HttpError(404, 'recording not found');
    return r;
  }

  async forget(id: string) {
    this.recording(id);
    this.deleting.add(id);
    try {
      await this.ingest.stopLive(id);
      await this.history.forget(id);
      const removed = await this.ingest.forget(id);
      // CLI and HTTP deletion share this path: forgotten recordings must leave no
      // retained reading-location references, including combined session views.
      const key = 'ui-working-locations-v1';
      const row = this.store.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as { value: string } | undefined;
      if (row) {
        try {
          const saved = workingLocations(JSON.parse(row.value));
          saved.sessions = saved.sessions.filter(s => !s.id.split('+').includes(id));
          if (saved.last?.split('+').includes(id)) delete saved.last;
          this.store.db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(saved), key);
        } catch { this.store.db.prepare('DELETE FROM meta WHERE key=?').run(key); }
      }
      return removed;
    } finally { this.deleting.delete(id); }
  }

  /** Historical identity only; controller, grants and current files keep the physical selected id. */
  readingId(id: string): string {
    if (id.includes('+')) return id;
    this.recording(id);
    return this.store.lineageView(id)?.recordingIds.join('+') ?? id;
  }

  /** A projection for one recording, or several joined with "+" (combined view). */
  projection(idOrIds: string): Projection {
    const ids = this.readingId(idOrIds).split('+').filter(Boolean);
    for (const id of ids) this.recording(id);
    return this.ingest.combinedProjection(ids);
  }
  paged(idOrIds: string): boolean {
    const ids = this.readingId(idOrIds).split('+');
    return ids.reduce((count, id) => count + this.recording(id).observationCount, 0) > 10_000 ||
      ids.reduce((bytes, id) => bytes + this.store.sourceBytes(id), 0) > 32 * 1024 * 1024;
  }

  artifactText(projection: Projection, artifactId: string): { artifact: Artifact; text: string } {
    const artifact = projection.artifacts.find((a) => a.id === artifactId);
    if (!artifact) throw new HttpError(404, 'artifact not found');
    const text = artifact.blob ? this.store.blobs.get(artifact.blob) : '';
    if (text === undefined) throw new HttpError(410, 'artifact content is no longer stored');
    return { artifact, text };
  }

  /**
   * A bounded slice of an artifact's text (B2, audit A15): read by line range from the blob without
   * loading it whole, with the totals, the cut and unavailability stated rather than implied.
   */
  artifactSlice(projection: Projection, artifactId: string, start: number, count: number): ArtifactSlice {
    const artifact = projection.artifacts.find((a) => a.id === artifactId);
    if (!artifact) throw new HttpError(404, 'artifact not found');
    const none = { artifact, start, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
    if (!artifact.blob) return { ...none, available: false, reason: 'not-captured' };
    const slice = this.store.blobs.readLines(artifact.blob, start, count);
    if (!slice) return { ...none, available: false, reason: 'no-longer-stored' };
    return { artifact, available: true, start, ...slice };
  }

  /** A directory the map may scan only with care: missing, not a directory, or a whole drive/home. */
  private unscannable(root: string): string | undefined {
    let r: string;
    try {
      if (!existsSync(root) || !statSync(root).isDirectory()) return 'is not a directory on this machine';
      r = realpathSync(root);
    } catch {
      return 'cannot be read';
    }
    const home = realpathSync(homedir());
    if (dirname(r) === r || r.toLowerCase() === home.toLowerCase()) return 'is too broad to scan (a drive root or the home folder)';
    return undefined;
  }

  /**
   * The repository map. A folder is scanned only once approved (B2): an explicit `graphRoot`, set by
   * `--workspace` or by approving the captured root. Until then the map holds only the files the
   * recording touched and offers the captured root for approval. A cached map is never rebuilt
   * under a reader; it reports `stale` when a cheap probe sees the workspace changed, and
   * `refresh` rebuilds it.
   */
  async graph(idOrIds: string, refresh = false): Promise<RepoGraph> {
    const ids = this.readingId(idOrIds).split('+');
    const rec = this.recording(ids[0]!);
    const large = this.paged(idOrIds);
    const projection = large ? (await this.history.page(idOrIds, { count: 1 })).projection : this.projection(idOrIds);
    const filesOnly = () => graphFromPaths(projection.files.map((f) => f.path));
    if (!projection.workspaceRoot) return filesOnly();
    const root = rec.graphRoot || undefined;
    if (!root || this.unscannable(root)) {
      const captured = rec.workspaceRoot;
      return captured && !this.unscannable(captured) ? { ...filesOnly(), approvalNeeded: { root: captured } } : filesOnly();
    }
    let g = this.graphs.get(root);
    if (!g || refresh) {
      const stored = !refresh ? this.store.getGraph(root) : undefined;
      // File and directory names are read from the workspace, so they get the capture policy too.
      // The same deterministic redaction runs on captured paths, so node ids still line up.
      g = stored ? (JSON.parse(stored) as RepoGraph) : sanitize(await buildGraph(root)).value;
      if (!stored) this.store.putGraph(root, g.generation, JSON.stringify(g));
      this.graphs.set(root, g);
      this.probes.set(root, { at: Date.now(), generation: g.generation });
    }
    return { ...g, stale: (await this.probe(root)) !== g.generation };
  }

  /** The current generation of a root, reused for `graphProbeMs` so map requests stay cheap. */
  private async probe(root: string): Promise<string> {
    const cached = this.probes.get(root);
    if (cached && Date.now() - cached.at < this.graphProbeMs) return cached.generation;
    const generation = await probeGeneration(root);
    this.probes.set(root, { at: Date.now(), generation });
    return generation;
  }

  /**
   * Approves scanning a recording's captured root for the map. Only that root can be approved over
   * the API (no arbitrary folders), and never a drive root or the home folder.
   */
  async approveGraphRoot(id: string, root?: string): Promise<RepoGraph> {
    const rec = this.recording(id);
    const captured = rec.workspaceRoot;
    if (!captured) throw new HttpError(400, 'this recording captured no workspace root');
    if (root !== undefined && (typeof root !== 'string' || resolve(root) !== resolve(captured))) throw new HttpError(400, 'only the captured workspace root can be approved');
    const why = this.unscannable(captured);
    if (why) throw new HttpError(400, `the captured root ${why}`);
    this.store.updateRecordingMeta(id, { graphRoot: captured });
    return this.graph(id, true);
  }

  async exportBundle(idOrIds: string): Promise<ReplayBundle> {
    const ids = [...new Set(idOrIds.split('+').filter(Boolean))];
    const recordings = ids.map((id) => this.recording(id));
    const projection = this.projection(idOrIds);
    const artifactText: Record<string, string> = {};
    for (const a of projection.artifacts) {
      if (!a.blob) continue;
      const t = this.store.blobs.get(a.blob);
      if (t !== undefined) artifactText[a.id] = t;
    }
    // Staleness and approval describe this machine's workspace right now, not the exported recording.
    const { stale: _stale, approvalNeeded: _approval, ...graph } = await this.graph(idOrIds);
    const bundle: ReplayBundle = {
      format: 'drishya-replay',
      version: 1,
      exportedAt: new Date().toISOString(),
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      recording: selectionSummary(idOrIds, recordings),
      projection,
      graph: { ...graph, root: '' },
      artifactText,
    };
    // Every root in the selection (audit A03): each recording's captured, map and source
    // directories, plus every working directory its observations recorded, not just the first.
    const roots = new Set<string>();
    for (const r of recordings) {
      for (const p of [r.workspaceRoot, r.graphRoot, r.sourcePath ? dirname(r.sourcePath) : undefined]) if (p) roots.add(p);
      for (const p of this.store.workspaceRoots(r.id)) roots.add(p);
    }
    return rekeyIds(maskLocalPaths(bundle, [...roots]));
  }

  async close() {
    await this.ingest.close();
    await this.history.close();
    this.store.close();
  }
}

/** One summary for the whole exported selection, so its metadata describes every recording in it. */
function selectionSummary(id: string, recs: RecordingSummary[]): RecordingSummary {
  const first = recs[0]!;
  const times = (pick: (r: RecordingSummary) => string | undefined) => recs.map(pick).filter((t): t is string => !!t).sort();
  return {
    ...first,
    // Accounting belongs to one native recording; a joined selection has no reported total.
    stats: recs.length === 1 ? first.stats : undefined,
    id,
    title: [...new Set(recs.map((r) => r.title).filter(Boolean))].join(' + '),
    // `harness` stays one id (the UI keys labels and styles on it); projection.harnesses lists all.
    sourcePath: undefined,
    graphRoot: undefined,
    createdAt: times((r) => r.createdAt)[0] ?? first.createdAt,
    updatedAt: times((r) => r.updatedAt).at(-1) ?? first.updatedAt,
    firstSourceTime: times((r) => r.firstSourceTime)[0],
    lastSourceTime: times((r) => r.lastSourceTime).at(-1),
    observationCount: recs.reduce((n, r) => n + r.observationCount, 0),
    live: false,
    pinned: false,
    // A revision counts commits in this local store; it means nothing to a bundle's reader.
    revision: undefined,
  };
}

/**
 * Local absolute paths never leave the machine in a bundle: workspace roots become
 * "<workspace>" and the home directory "~", in every string, in both slash styles and in the
 * dash-joined form harnesses use for per-project directories (C--Users-me-repo).
 */
export function maskLocalPaths<T>(value: T, roots: (string | undefined)[]): T {
  const pairs: [string, string][] = [];
  // A one- or two-character root ("/", "C:") would mangle every string without hiding anything.
  for (const r of roots) if (r && r.replace(/[\\/]+$/, '').length > 2) pairs.push([r.replace(/[\\/]+$/, ''), '<workspace>']);
  pairs.push([homedir(), '~']);
  const variants: [string, string][] = [];
  for (const [p, to] of pairs) {
    const fwd = p.replace(/\\/g, '/');
    const back = p.replace(/\//g, '\\');
    const dashed = p.replace(/[^A-Za-z0-9]/g, '-');
    for (const v of new Set([p, fwd, back, ...(dashed.length >= 8 ? [dashed] : [])])) variants.push([v, to]);
  }
  variants.sort((a, b) => b[0].length - a[0].length); // longest first: workspace before home
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = variants.map(([v, to]) => [new RegExp(esc(v), process.platform === 'win32' ? 'gi' : 'g'), to] as const);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return re.reduce((s, [r, to]) => s.replace(r, to), v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/**
 * Recording, source and observation ids are hashes of local paths. A path like
 * C:\Users\<name>\… is guessable, so a short hash of it can be reversed. Bundles get neutral,
 * sequential ids instead — consistent within the bundle, meaningless outside it.
 */
export function rekeyIds<T>(value: T): T {
  const names = new Map<string, string>();
  const re = /(?<![0-9A-Za-z])(rec|obs|src)_[0-9a-f]{16,24}(?![0-9a-f])/g;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string')
      return v.replace(re, (m, kind: string) => {
        if (!names.has(m)) names.set(m, `${kind}_x${String(names.size + 1).padStart(4, '0')}`);
        return names.get(m)!;
      });
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [walk(k) as string, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
