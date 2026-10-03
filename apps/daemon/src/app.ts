// Shared application wiring used by the server and the CLI.

import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Artifact, Projection, RecordingSummary, ReplayBundle, RepoGraph } from '@drishya/contracts';
import { buildGraph, graphFromPaths } from '@drishya/indexer';
import { Ingestor } from '@drishya/ingest';
import { PRIVACY_POLICY_VERSION, sanitize } from '@drishya/privacy';
import { Store } from '@drishya/store';

export const VERSION = '0.1.0-draft';

export function dataDir(): string {
  return resolve(process.env.DRISHYA_HOME ?? join(homedir(), '.drishya'));
}

export class App {
  readonly store: Store;
  readonly ingest: Ingestor;
  private graphs = new Map<string, RepoGraph>();

  constructor(dir = dataDir(), opts: { memory?: boolean } = {}) {
    this.store = new Store(dir, opts);
    this.ingest = new Ingestor(this.store);
  }

  recording(id: string): RecordingSummary {
    const r = this.store.getRecording(id);
    if (!r) throw new HttpError(404, 'recording not found');
    return r;
  }

  /** A projection for one recording, or several joined with "+" (combined view). */
  projection(idOrIds: string): Projection {
    const ids = idOrIds.split('+').filter(Boolean);
    for (const id of ids) this.recording(id);
    return this.ingest.combinedProjection(ids);
  }

  artifactText(projection: Projection, artifactId: string): { artifact: Artifact; text: string } {
    const artifact = projection.artifacts.find((a) => a.id === artifactId);
    if (!artifact) throw new HttpError(404, 'artifact not found');
    const text = artifact.blob ? this.store.blobs.get(artifact.blob) : '';
    if (text === undefined) throw new HttpError(410, 'artifact content is no longer stored');
    return { artifact, text };
  }

  /** The map root for a recording: a user-approved override, else the captured workspace. */
  graphRoot(rec: RecordingSummary): string | undefined {
    const root = rec.graphRoot ?? rec.workspaceRoot;
    if (!root) return undefined;
    try {
      return existsSync(root) && statSync(root).isDirectory() ? root : undefined;
    } catch {
      return undefined;
    }
  }

  async graph(idOrIds: string, refresh = false): Promise<RepoGraph> {
    const ids = idOrIds.split('+');
    const rec = this.recording(ids[0]!);
    const projection = this.projection(idOrIds);
    const root = this.graphRoot(rec);
    if (!root) return graphFromPaths(projection.files.map((f) => f.path));
    let g = this.graphs.get(root);
    if (!g || refresh) {
      const stored = !refresh ? this.store.getGraph(root) : undefined;
      // File and directory names are read from the workspace, so they get the capture policy too.
      // The same deterministic redaction runs on captured paths, so node ids still line up.
      g = stored ? (JSON.parse(stored) as RepoGraph) : sanitize(await buildGraph(root)).value;
      if (!stored) this.store.putGraph(root, g.generation, JSON.stringify(g));
      this.graphs.set(root, g);
    }
    return g;
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
    const graph = await this.graph(idOrIds);
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
    this.store.close();
  }
}

/** One summary for the whole exported selection, so its metadata describes every recording in it. */
function selectionSummary(id: string, recs: RecordingSummary[]): RecordingSummary {
  const first = recs[0]!;
  const times = (pick: (r: RecordingSummary) => string | undefined) => recs.map(pick).filter((t): t is string => !!t).sort();
  return {
    ...first,
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
