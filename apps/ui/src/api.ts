// Where the UI gets its data: the local daemon (live, importable) or a static replay bundle
// (the hosted demo). Both expose the same surface, so every screen works in both.

import type { ArtifactSlice, DiscoveredSource, Projection, RecordingHealth, RecordingSummary, ReplayBundle, RepoGraph } from '@drishya/contracts';

/** A session location discovery could not read, e.g. a permission failure. */
export interface DiscoveryError {
  adapterId: string;
  code: string;
  message: string;
}

export interface ExplainClaim {
  text: string;
  evidence: { key: string; step: number; ref: { type: string; id?: string; step?: number }; observationIds: string[] }[];
}

export interface Explanation {
  provenance: { kind: 'generated'; generator: string; version: string; observationIds: string[] };
  task: 'explain-operation' | 'briefing';
  summary: string;
  claims: ExplainClaim[];
  unknowns: string[];
  droppedClaims: number;
  evidenceCount: number;
}

export interface ModelPreview {
  endpoint: string;
  model: string;
  chars: number;
  items: number;
  messages: { role: string; content: string }[];
  /** Fingerprint of exactly this request. Sending requires it back, so consent covers only what was shown. */
  digest: string;
}

export interface Config {
  version: string;
  llm: { configured: boolean; baseUrl: string; models: { nano: string; super: string; ultra: string } };
  adapters: { id: string; label: string; capabilities: Record<string, string> }[];
}

export interface DataSource {
  kind: 'daemon' | 'bundle';
  config(): Promise<Config>;
  recordings(): Promise<RecordingSummary[]>;
  sources(): Promise<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }>;
  importSource(path: string, adapterId: string, live: boolean): Promise<{ recordingId: string }>;
  projection(id: string): Promise<Projection>;
  /** `refresh` rebuilds a stale map; otherwise the cached map is returned unchanged. */
  graph(id: string, refresh?: boolean): Promise<RepoGraph | undefined>;
  /** Approves scanning the recording's captured root for the map, and returns the full map. */
  approveGraph(id: string): Promise<RepoGraph>;
  artifact(id: string, artifactId: string): Promise<ArtifactSlice>;
  search(id: string, q: string): Promise<{ observationId: string; snippet: string }[]>;
  setLive(id: string, on: boolean): Promise<boolean>;
  /** Without `consent`, returns the preview. With the preview's digest as `consent`, sends exactly that request. */
  explain(id: string, operationId: string, consent?: string): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  briefing(id: string, range: { from?: number; to?: number }, consent?: string): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  exportUrl(id: string): string | undefined;
  forget(id: string): Promise<void>;
  /** New data (`added` > 0) or a capture-state change (`health` set, nothing added). */
  subscribe(
    onChange: (e: { recordingId: string; added: number; live: boolean; health?: RecordingHealth }) => void,
    hooks?: {
      /** Sent on every (re)connect: the daemon's current revision of each recording. */
      onSync?: (revisions: Record<string, number>) => void;
      onStatus?: (status: 'connected' | 'reconnecting' | 'signed-out') => void;
    },
  ): () => void;
}

export class HttpError extends Error {
  status: number;
  /** The parsed error body, e.g. the fresh consent preview a 409 carries. */
  body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** The updated preview when a send was refused because the evidence changed after review. */
export function changedPreview(e: unknown): ModelPreview | undefined {
  return e instanceof HttpError && e.status === 409 ? (e.body.preview as ModelPreview | undefined) : undefined;
}

async function req<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.json !== undefined ? { 'content-type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new HttpError(res.status, body.error ?? res.statusText, body);
  return body as T;
}

/**
 * Exchanges the launch token in the URL fragment for a session cookie, then removes it from the
 * address bar. The token stays valid for the daemon's lifetime; sessions expire and can be revoked.
 */
export async function signIn(): Promise<'ok' | 'no-daemon' | 'signed-out'> {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  try {
    if (token) {
      await req('/v1/session', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      history.replaceState(null, '', location.pathname + location.search); // the token leaves the address bar
    }
    await req('/v1/config');
    return 'ok';
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return 'signed-out';
    return 'no-daemon';
  }
}

export const daemon: DataSource = {
  kind: 'daemon',
  config: () => req('/v1/config'),
  recordings: async () => (await req<{ recordings: RecordingSummary[] }>('/v1/recordings')).recordings,
  sources: () => req<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }>('/v1/sources'),
  importSource: (path, adapterId, live) => req('/v1/import', { method: 'POST', json: { path, adapterId, live } }),
  projection: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/projection`),
  graph: (id, refresh) => req(`/v1/recordings/${encodeURIComponent(id)}/graph${refresh ? '?refresh=1' : ''}`),
  approveGraph: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/graph/approve`, { method: 'POST', json: {} }),
  artifact: (id, art) => req<ArtifactSlice>(`/v1/recordings/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(art)}`),
  search: async (id, q) => (await req<{ hits: { observationId: string; snippet: string }[] }>(`/v1/recordings/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`)).hits,
  setLive: async (id, on) => (await req<{ live: boolean }>(`/v1/recordings/${encodeURIComponent(id)}/live`, { method: 'POST', json: { on } })).live,
  explain: (id, operationId, consent) => req(`/v1/recordings/${encodeURIComponent(id)}/explain`, { method: 'POST', json: { operationId, consent } }),
  briefing: (id, range, consent) => req(`/v1/recordings/${encodeURIComponent(id)}/briefing`, { method: 'POST', json: { ...range, consent } }),
  exportUrl: (id) => `/v1/recordings/${encodeURIComponent(id)}/export`,
  forget: async (id) => {
    await req(`/v1/recordings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  subscribe(onChange, hooks) {
    const es = new EventSource('/v1/changes');
    let closed = false;
    let checking = false;
    // EventSource reconnects by itself; each new connection opens with a `sync` of revisions.
    es.addEventListener('sync', (e) => {
      hooks?.onStatus?.('connected');
      hooks?.onSync?.((JSON.parse((e as MessageEvent).data) as { revisions: Record<string, number> }).revisions);
    });
    es.addEventListener('error', () => {
      hooks?.onStatus?.('reconnecting');
      if (checking || closed) return;
      checking = true;
      // EventSource hides HTTP status codes. After a daemon restart its old cookie is invalid;
      // distinguish that 401 from a temporarily unreachable daemon instead of retrying forever.
      void fetch('/v1/revisions', { cache: 'no-store' }).then((res) => {
        if (closed || res.status !== 401) return;
        closed = true;
        es.close();
        hooks?.onStatus?.('signed-out');
      }).catch(() => undefined).finally(() => { checking = false; });
    });
    es.addEventListener('change', (e) => onChange(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('health', (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as { recordingId: string; health: RecordingHealth };
      onChange({ recordingId: ev.recordingId, added: 0, live: ev.health.live, health: ev.health });
    });
    return () => { closed = true; es.close(); };
  },
};

/** A static replay bundle: read-only, no model calls, no capture. */
export function bundleSource(bundle: ReplayBundle): DataSource {
  const unsupported = () => Promise.reject(new Error('Not available in a replay bundle — run Drishya locally.'));
  return {
    kind: 'bundle',
    config: async () => ({ version: 'bundle', llm: { configured: false, baseUrl: '', models: { nano: '', super: '', ultra: '' } }, adapters: [] }),
    recordings: async () => [bundle.recording],
    sources: async () => ({ sources: [], errors: [] }),
    importSource: unsupported,
    projection: async () => bundle.projection,
    graph: async () => bundle.graph,
    approveGraph: unsupported,
    artifact: async (_id, art) => {
      // A bundle carries whole sanitized texts; one it omits was not exported, so it is unavailable.
      const artifact = bundle.projection.artifacts.find((a) => a.id === art)!;
      const text = bundle.artifactText[art];
      if (text === undefined) return { artifact, available: false, reason: 'not-captured', start: 0, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
      const lines = text.split('\n').length;
      return { artifact, available: true, start: 0, text, returnedLines: lines, totalLines: lines, totalBytes: new TextEncoder().encode(text).length, truncated: false, hasMore: false };
    },
    search: async (_id, q) => {
      const t = q.toLowerCase();
      const hits: { observationId: string; snippet: string }[] = [];
      for (const p of bundle.projection.prose) if (p.text.toLowerCase().includes(t)) hits.push({ observationId: p.observationIds[0]!, snippet: snippet(p.text, t) });
      for (const o of bundle.projection.operations) if (o.title.toLowerCase().includes(t)) hits.push({ observationId: o.observationIds[0]!, snippet: o.title });
      return hits.slice(0, 50);
    },
    setLive: unsupported,
    explain: unsupported,
    briefing: unsupported,
    exportUrl: () => undefined,
    forget: unsupported,
    subscribe: () => () => undefined,
  };
}

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q);
  const s = Math.max(0, i - 40);
  return (s ? '…' : '') + text.slice(s, i) + '«' + text.slice(i, i + q.length) + '»' + text.slice(i + q.length, i + q.length + 60) + '…';
}

export async function loadBundle(url: string): Promise<ReplayBundle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const b = (await res.json()) as ReplayBundle;
  if (b.format !== 'drishya-replay') throw new Error('Not a Drishya replay bundle');
  return b;
}
