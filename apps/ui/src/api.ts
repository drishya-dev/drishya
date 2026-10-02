// Where the UI gets its data: the local daemon (live, importable) or a static replay bundle
// (the hosted demo). Both expose the same surface, so every screen works in both.

import type { DiscoveredSource, Projection, RecordingSummary, ReplayBundle, RepoGraph } from '@drishya/contracts';

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
  sources(): Promise<DiscoveredSource[]>;
  importSource(path: string, adapterId: string, live: boolean): Promise<{ recordingId: string }>;
  projection(id: string): Promise<Projection>;
  graph(id: string): Promise<RepoGraph | undefined>;
  artifact(id: string, artifactId: string): Promise<string>;
  search(id: string, q: string): Promise<{ observationId: string; snippet: string }[]>;
  setLive(id: string, on: boolean): Promise<boolean>;
  explain(id: string, operationId: string, confirm: boolean): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  briefing(id: string, range: { from?: number; to?: number }, confirm: boolean): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  exportUrl(id: string): string | undefined;
  forget(id: string): Promise<void>;
  subscribe(onChange: (e: { recordingId: string; added: number; live: boolean }) => void): () => void;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
  if (!res.ok) throw new HttpError(res.status, body.error ?? res.statusText);
  return body as T;
}

/** Exchanges the one-time launch token in the URL fragment for a session cookie. */
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
  sources: async () => (await req<{ sources: DiscoveredSource[] }>('/v1/sources')).sources,
  importSource: (path, adapterId, live) => req('/v1/import', { method: 'POST', json: { path, adapterId, live } }),
  projection: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/projection`),
  graph: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/graph`),
  artifact: async (id, art) => (await req<{ text: string }>(`/v1/recordings/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(art)}`)).text,
  search: async (id, q) => (await req<{ hits: { observationId: string; snippet: string }[] }>(`/v1/recordings/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`)).hits,
  setLive: async (id, on) => (await req<{ live: boolean }>(`/v1/recordings/${encodeURIComponent(id)}/live`, { method: 'POST', json: { on } })).live,
  explain: (id, operationId, confirm) => req(`/v1/recordings/${encodeURIComponent(id)}/explain`, { method: 'POST', json: { operationId, confirm } }),
  briefing: (id, range, confirm) => req(`/v1/recordings/${encodeURIComponent(id)}/briefing`, { method: 'POST', json: { ...range, confirm } }),
  exportUrl: (id) => `/v1/recordings/${encodeURIComponent(id)}/export`,
  forget: async (id) => {
    await req(`/v1/recordings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  subscribe(onChange) {
    const es = new EventSource('/v1/changes');
    es.addEventListener('change', (e) => onChange(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  },
};

/** A static replay bundle: read-only, no model calls, no capture. */
export function bundleSource(bundle: ReplayBundle): DataSource {
  const unsupported = () => Promise.reject(new Error('Not available in a replay bundle — run Drishya locally.'));
  return {
    kind: 'bundle',
    config: async () => ({ version: 'bundle', llm: { configured: false, baseUrl: '', models: { nano: '', super: '', ultra: '' } }, adapters: [] }),
    recordings: async () => [bundle.recording],
    sources: async () => [],
    importSource: unsupported,
    projection: async () => bundle.projection,
    graph: async () => bundle.graph,
    artifact: async (_id, art) => bundle.artifactText[art] ?? '',
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
