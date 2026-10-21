import type { ReadingQuery, ReadingTarget } from '../../../packages/scene/src/reading-target.ts';
import type { FileEvidence } from '../../../packages/scene/src/file-evidence.ts';
import type {ReviewInsightsPage,FindingMembers,ReviewFinding} from '../../../packages/scene/src/review-insights.ts';
import type {CommandQuery,CommandPage} from '../../../packages/scene/src/commands.ts';
// Where the UI gets its data: the local daemon (live, importable) or a static replay bundle
// (the hosted demo). Both expose the same surface, so every screen works in both.

import type { ArtifactSlice, DiscoveredSource, Projection, RecordingHealth, RecordingSummary, ReplayBundle, RepoGraph } from '@drishya/contracts';
import type { SinceSnapshot } from '../../../packages/scene/src/since.ts';
import { verificationFor, type VerificationTrail } from '../../../packages/scene/src/verification.ts';
import { fixChainFor, type FixChain } from '../../../packages/scene/src/fix-chains.ts';
import { readBeforeWriteFor, type ReadBeforeWrite } from '../../../packages/scene/src/read-before-write.ts';
import type { CheckpointFile, PersistedOutput } from '@drishya/contracts';
import type { HistoryPage, HistoryQuery, HistorySummary } from '../../../packages/scene/src/history.ts';
import type { NowFacts } from '../../../packages/scene/src/now.ts';
import type { TurnLedger } from '../../../packages/scene/src/turns.ts';
import type { Marker } from '@drishya/scene';
import type { Operation } from '@drishya/contracts';
import type { BlobSearchResult, SessionSearchHit } from '../../../packages/store/src/search-types.ts';

/** The reader's mark: the last observation sequence they marked as seen, and the one before it. */
export interface ReadingBoundary {
  sequence: number;
  previousSequence?: number;
  revision: number;
  updatedAt: string;
}

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
  readingNotes?(id:string,start?:number):Promise<{bookmarks:{id:string;step:number;note:string;createdAt:string}[];total:number;start:number;count:number}>;
  kind: 'daemon' | 'bundle';
  /** Built-in synthetic fixture only; never used to classify a user's replay bundle. */
  sample?: 'recorded' | 'growing';
  completeSample?(): void;
  storage?(): Promise<{ bytes: number; budgetBytes: number; overBudget: boolean }>;
  config(): Promise<Config>;
  recordings(): Promise<ReaderRecording[]>;
  sources(): Promise<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }>;
  importSource(path: string, adapterId: string, live: boolean): Promise<{ recordingId: string }>;
  projection(id: string): Promise<Projection>;
  history?(id: string, query?: HistoryQuery): Promise<HistoryPage>;
  findingMembers?(id:string,key:string,page?:number,q?:string):Promise<FindingMembers>;
  reviewInsights?(id:string,page?:number,kind?:ReviewFinding['kind']):Promise<ReviewInsightsPage>;
  commands?(id:string,query:CommandQuery):Promise<CommandPage>;
  readingTarget?(id: string, query: ReadingQuery): Promise<ReadingTarget | null>;
  fileEvidence?(id: string, paths: string[], step?: number): Promise<FileEvidence[]>;
  summary?(id: string, from?: number): Promise<HistorySummary>;
  /** The newest captured state of a recording, independent of where the reader is scrolled. */
  now?(id: string): Promise<NowFacts>;
  /** What each turn did, over the whole recording, whatever window the reader holds. */
  turns?(id: string): Promise<{ turns: TurnLedger[] }>;
  historyMarker?(id: string, step: number, types: Marker['type'][], direction: 1 | -1): Promise<number | undefined>;
  fileOperations?(id: string, path: string, start: number, count: number, step?: number, query?: string): Promise<{ operations: Operation[]; total: number }>;
  /** `refresh` rebuilds a stale map; otherwise the cached map is returned unchanged. */
  graph(id: string, refresh?: boolean): Promise<RepoGraph | undefined>;
  /** Approves scanning the recording's captured root for the map, and returns the full map. */
  approveGraph(id: string): Promise<RepoGraph>;
  artifact(id: string, artifactId: string, range?: { start: number; count: number }): Promise<ArtifactSlice>;
  artifactFind?(id: string, artifactId: string, query: string, start: number, continuation?: string): Promise<BlobSearchResult>;
  search(id: string, q: string): Promise<SessionSearchHit[]>;
  setLive(id: string, on: boolean): Promise<boolean>;
  /** One bounded passive read of an already imported local journal. No persistent watch. */
  refreshRecording?(id:string):Promise<{added:number;more:boolean}>;
  sessionSegments?(id:string):Promise<{items:{source:DiscoveredSource;boundary:{ordinal:number;bytes:number}}[];partial:boolean}>;
  /** Without `consent`, returns the preview. With the preview's digest as `consent`, sends exactly that request. */
  explain(id: string, operationId: string, consent?: string): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  briefing(id: string, range: { from?: number; to?: number }, consent?: string): Promise<{ preview?: ModelPreview; cached?: Explanation; result?: Explanation }>;
  exportUrl(id: string): string | undefined;
  forget(id: string): Promise<void>;
  /** The reader's "seen through here" mark for one recording; null when never marked. */
  boundary(id: string): Promise<ReadingBoundary | null>;
  since?(id: string, after: number, page?: number): Promise<SinceSnapshot>;
  /** P2-C: test runs recorded after one change, over the whole session; null if not a change. */
  verification?(id: string, operationId: string): Promise<VerificationTrail | null>;
  fixChain?(id: string, operationId: string): Promise<FixChain | null>;
  readBefore?(id: string, operationId: string): Promise<ReadBeforeWrite | null>;
  /** DATA-4: full output Claude Code saved to a file, read on request and redacted. Local recordings only. */
  persistedOutput?(id: string, operationId: string): Promise<PersistedOutput>;
  /** DATA-5: a Claude Code checkpoint backup, read on request with workspace approval. Local recordings only. */
  checkpoint?(id: string, backup: string): Promise<CheckpointFile>;
  /** Moves the mark. Only explicit reader actions call this. */
  setBoundary(id: string, sequence: number): Promise<ReadingBoundary>;
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
/** Presentation hints do not change the immutable captured event contract. */
export interface ReaderRecording extends RecordingSummary { sourceBytes?: number }

export interface WorkspaceStatus { approved: boolean; root?: string; scope: 'current-workspace' }
export interface CurrentFile { path: string; scope: 'current-workspace'; text: string; start: number; totalLines: number; returnedLines: number; hasMore: boolean; redacted: boolean; modifiedAt: string }
export interface PromptAttachment { name: string; type: 'text' | 'image'; data: string; mime?: string }
export type { TurnOptions, NativeSettings } from '../../daemon/src/native-types.ts';
import type { TurnOptions, NativeSettings, NativeUsage } from '../../daemon/src/native-types.ts';
export interface ControllerStatus {
  inputRequests?:import('../../daemon/src/native-input-types.ts').NativeInputRequest[];
  settings?: NativeSettings;
  attachments?: { name: string; type: 'text' | 'image' }[];
  submittedPrompt?: string;
  afterSequence?: number;
  phase?: 'waiting' | 'thinking' | 'responding' | 'tool';
  preview?: { id: string; role: 'response' | 'reasoning'; exposure?: 'summary' | 'full'; text: string };
  usage?: NativeUsage;
  runId?: string; state: 'idle' | 'connecting' | 'running' | 'approval' | 'completed' | 'failed' | 'stopped';
  harness: string; available: boolean; output: string; error?: string; tools: string[]; inventory: 'unknown' | 'runtime';
  approvals: { id: string; name: string; detail: string }[]; promptRedacted?: boolean;
}
/** Explicit local workspace/controller capabilities; offline bundles never call them. */
export const workspaceApi = {
  searchLibrary: (query:import('../../../packages/store/src/search-types.ts').LibrarySearchQuery) => req<import('../../../packages/store/src/search-types.ts').LibrarySearchPage>(`/v1/search-library?${new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined&&value!=='').map(([key,value])=>[key,String(value)]))}`),
  workingLocations: () => req<import('../../../packages/contracts/src/working-locations.ts').WorkingLocations>('/v1/working-locations'),
  saveWorkingLocations: (snapshot:import('../../../packages/contracts/src/working-locations.ts').WorkingLocations,keepalive=false) => req<{saved:boolean;revisions:Record<string,number>}>('/v1/working-locations',{method:'PUT',json:snapshot,keepalive}),
  gitStatus: (id: string) => req<{ approved: boolean; scope: 'current-git' }>(`/v1/recordings/${encodeURIComponent(id)}/git`),
  approveGit: (id: string) => req<{ approved: boolean; scope: 'current-git' }>(`/v1/recordings/${encodeURIComponent(id)}/git/approve`, { method: 'POST', json: {} }),
  gitSnapshot: (id: string, start = 0) => req<import('../../daemon/src/git-types.ts').GitSnapshot>(`/v1/recordings/${encodeURIComponent(id)}/git/snapshot?start=${encodeURIComponent(start)}`),
  gitHistory:(id:string,query:{start?:number;referenceStart?:number;reference?:string;q?:string;generation?:string}={})=>req<import('../../daemon/src/git-types.ts').GitHistoryPage>(`/v1/recordings/${encodeURIComponent(id)}/git/history?${new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]))}`),
  gitCommit:(id:string,hash:string,parent=0,start=0,generation?:string)=>req<import('../../daemon/src/git-types.ts').GitCommitDetail>(`/v1/recordings/${encodeURIComponent(id)}/git/commit?${new URLSearchParams({hash,parent:String(parent),start:String(start),...(generation?{generation}:{})})}`),
  status: (id: string) => req<WorkspaceStatus>(`/v1/recordings/${encodeURIComponent(id)}/workspace`),
  approve: (id: string) => req<WorkspaceStatus>(`/v1/recordings/${encodeURIComponent(id)}/workspace/approve`, { method: 'POST', json: {} }),
  file: (id: string, path: string, start: number) => req<CurrentFile>(`/v1/recordings/${encodeURIComponent(id)}/workspace/file?${new URLSearchParams({ path, start: String(start), count: '200' })}`),
  document: (id:string,path:string) => req<CurrentFile>(`/v1/recordings/${encodeURIComponent(id)}/workspace/document?${new URLSearchParams({path})}`),
  controller: (id: string) => req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller`),
  settings: (id: string) => req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller/settings`, { method: 'POST', json: {} }),
  prompt: (id: string, prompt: string, exclusive: boolean, attachments?: PromptAttachment[], options?: TurnOptions) => req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller/prompt`, { method: 'POST', json: { prompt, exclusive, attachments, options } }),
  answer:(id:string,runId:string,requestId:string,answers:Record<string,{options:string[];text?:string}>)=>req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller/answer`,{method:'POST',json:{runId,requestId,answers}}),
  decide: (id: string, runId: string, approvalId: string, allow: boolean) => req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller/approval`, { method: 'POST', json: { runId, approvalId, allow } }),
  stop: (id: string, runId: string) => req<ControllerStatus>(`/v1/recordings/${encodeURIComponent(id)}/controller/stop`, { method: 'POST', json: { runId } }),
};

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

export const recordedUsageApi = {
  available: (id: string) => req<{ available: boolean }>(`/v1/recordings/${encodeURIComponent(id)}/rescan`),
  rescan: (id: string) => req<{ added: number; more: boolean }>(`/v1/recordings/${encodeURIComponent(id)}/rescan`, { method: 'POST', json: {} }),
};

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
  readingNotes:(id,start=0)=>req(`/v1/recordings/${encodeURIComponent(id)}/bookmarks?start=${start}&count=25`),
  findingMembers:(id,key,page=0,q='')=>req(`/v1/recordings/${encodeURIComponent(id)}/finding-members?${new URLSearchParams({key,page:String(page),q})}`),
  reviewInsights:(id,page=0,kind)=>req(`/v1/recordings/${encodeURIComponent(id)}/review-insights?${new URLSearchParams({page:String(page),...(kind?{kind}:{})})}`),
  commands:(id,query)=>req(`/v1/recordings/${encodeURIComponent(id)}/commands?${new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)]))}`),
  storage: () => req('/v1/storage'),
  readingTarget: (id, query) => req(`/v1/recordings/${encodeURIComponent(id)}/reading-target?${new URLSearchParams(Object.entries(query).filter(([,value]) => value !== undefined).map(([key,value]) => [key, String(value)]))}`),
  fileEvidence: (id, paths, step) => req(`/v1/recordings/${encodeURIComponent(id)}/file-evidence?${new URLSearchParams([...paths.map(path => ['path', path]), ...(step === undefined ? [] : [['step', String(step)]])])}`),
  summary: (id, from = 0) => req(`/v1/recordings/${encodeURIComponent(id)}/summary?from=${from}`),
  now: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/now`),
  turns: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/turns`),
  kind: 'daemon',
  config: () => req('/v1/config'),
  recordings: async () => (await req<{ recordings: ReaderRecording[] }>('/v1/recordings')).recordings,
  sources: () => req<{ sources: DiscoveredSource[]; errors: DiscoveryError[] }>('/v1/sources'),
  importSource: (path, adapterId, live) => req('/v1/import', { method: 'POST', json: { path, adapterId, live } }),
  projection: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/projection`),
  history: (id, query = {}) => req(`/v1/recordings/${encodeURIComponent(id)}/history`, { method: 'POST', json: query }),
  historyMarker: async (id, step, types, direction) => (await req<{ step?: number }>(`/v1/recordings/${encodeURIComponent(id)}/history-marker`, { method: 'POST', json: { step, types, direction } })).step,
  fileOperations: (id, path, start, count, step, query = '') => req(`/v1/recordings/${encodeURIComponent(id)}/file-operations?${new URLSearchParams({ path, start: String(start), count: String(count), ...(step === undefined ? {} : { step: String(step) }), q: query })}`),
  graph: (id, refresh) => req(`/v1/recordings/${encodeURIComponent(id)}/graph${refresh ? '?refresh=1' : ''}`),
  approveGraph: (id) => req(`/v1/recordings/${encodeURIComponent(id)}/graph/approve`, { method: 'POST', json: {} }),
  artifact: (id, art, range) => req<ArtifactSlice>(`/v1/recordings/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(art)}${range ? `?start=${range.start}&count=${range.count}` : ''}`),
  artifactFind: (id, art, query, start, continuation) => req<BlobSearchResult>(`/v1/recordings/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(art)}?${new URLSearchParams({ find: query, start: String(start), ...(continuation ? { cursor: continuation } : {}) })}`),
  search: async (id, q) => (await req<{ hits: SessionSearchHit[] }>(`/v1/recordings/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`)).hits,
  setLive: async (id, on) => (await req<{ live: boolean }>(`/v1/recordings/${encodeURIComponent(id)}/live`, { method: 'POST', json: { on } })).live,
  refreshRecording: id => req(`/v1/recordings/${encodeURIComponent(id)}/refresh`,{method:'POST',json:{}}),
  sessionSegments: id=>req(`/v1/recordings/${encodeURIComponent(id)}/segments`),
  explain: (id, operationId, consent) => req(`/v1/recordings/${encodeURIComponent(id)}/explain`, { method: 'POST', json: { operationId, consent } }),
  briefing: (id, range, consent) => req(`/v1/recordings/${encodeURIComponent(id)}/briefing`, { method: 'POST', json: { ...range, consent } }),
  exportUrl: (id) => `/v1/recordings/${encodeURIComponent(id)}/export`,
  forget: async (id) => {
    await req(`/v1/recordings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  boundary: async (id) => (await req<{ boundary: ReadingBoundary | null }>(`/v1/recordings/${encodeURIComponent(id)}/boundary`)).boundary,
  since: (id, after, page = 0) => req(`/v1/recordings/${encodeURIComponent(id)}/since?after=${after}&page=${page}`),
  readBefore: async (id, operationId) => {
    try {
      return await req<ReadBeforeWrite>(`/v1/recordings/${encodeURIComponent(id)}/read-before/${encodeURIComponent(operationId)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
  checkpoint: (id, backup) => req<CheckpointFile>(`/v1/recordings/${encodeURIComponent(id)}/checkpoint/${encodeURIComponent(backup)}`),
  persistedOutput: (id, operationId) => req<PersistedOutput>(`/v1/recordings/${encodeURIComponent(id)}/persisted-output/${encodeURIComponent(operationId)}`),
  fixChain: async (id, operationId) => {
    try {
      return await req<FixChain>(`/v1/recordings/${encodeURIComponent(id)}/fix-chain/${encodeURIComponent(operationId)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
  verification: async (id, operationId) => {
    try {
      return await req<VerificationTrail>(`/v1/recordings/${encodeURIComponent(id)}/verification/${encodeURIComponent(operationId)}`);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
  setBoundary: async (id, sequence) => (await req<{ boundary: ReadingBoundary }>(`/v1/recordings/${encodeURIComponent(id)}/boundary`, { method: 'POST', json: { sequence } })).boundary,
  subscribe(onChange, hooks) {
    const es = new EventSource('/v1/changes');
    let closed = false;
    let checking = false;
    // EventSource reconnects by itself; each new connection opens with a `sync` of revisions.
    es.addEventListener('sync', (e) => {
      if (closed) return;
      hooks?.onStatus?.('connected');
      hooks?.onSync?.((JSON.parse((e as MessageEvent).data) as { revisions: Record<string, number> }).revisions);
    });
    es.addEventListener('error', () => {
      if (closed) return;
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
    // A bundle carries the whole projection, so freshness is computed here exactly as the worker would.
    verification: async (_id, operationId) => verificationFor(bundle.projection, operationId) ?? null,
    fixChain: async (_id, operationId) => fixChainFor(bundle.projection, operationId) ?? null,
    readBefore: async (_id, operationId) => readBeforeWriteFor(bundle.projection, operationId) ?? null,
    importSource: unsupported,
    artifactFind: async (_id, art, query, start, continuation) => {
      const text = bundle.artifactText[art];
      if (text === undefined) return { available: false, matches: [], totalLines: 0, scannedThrough: start, skippedLines: 0 };
      const lines = text.split('\n'), matches: number[] = [];
      let cursor = continuation ? Number(continuation) : start, scanned = 0, skippedLines = 0;
      if (!query || query.length > 200 || !Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Invalid stored search');
      for (; cursor < lines.length && scanned < 10_000 && matches.length < 50; cursor++, scanned++) {
        const line = lines[cursor]!;
        if (line.length > 256 * 1024) { skippedLines++; continue; }
        if (line.toLowerCase().includes(query.toLowerCase())) matches.push(cursor);
      }
      return { available: true, matches, totalLines: lines.length, scannedThrough: cursor, skippedLines, continuation: cursor < lines.length ? String(cursor) : undefined };
    },
    projection: async () => bundle.projection,
    graph: async () => bundle.graph,
    approveGraph: unsupported,
    artifact: async (_id, art, range) => {
      // A bundle carries whole sanitized texts; one it omits was not exported, so it is unavailable.
      const artifact = bundle.projection.artifacts.find((a) => a.id === art)!;
      const text = bundle.artifactText[art];
      if (text === undefined) return { artifact, available: false, reason: 'not-captured', start: 0, text: '', returnedLines: 0, totalLines: 0, totalBytes: 0, truncated: false, hasMore: false };
      const all = text.split('\n');
      const start = range?.start ?? 0;
      const count = range?.count ?? 20_000;
      const selected = all.slice(start, start + count);
      return { artifact, available: true, start, text: selected.join('\n'), returnedLines: selected.length, totalLines: all.length, totalBytes: new TextEncoder().encode(text).length, truncated: false, hasMore: start + selected.length < all.length };
    },
    search: async (_id, q) => {
      const t = q.toLowerCase();
      const hits: SessionSearchHit[] = [];
      for (const p of bundle.projection.prose) if (p.text.toLowerCase().includes(t)) hits.push({ observationId: p.observationIds[0]!, snippet: snippet(p.text, t), kind: p.role === 'user' ? 'message.user' : p.role === 'reasoning' ? 'reasoning' : 'message.assistant' });
      for (const o of bundle.projection.operations) if (o.title.toLowerCase().includes(t)) hits.push({ observationId: o.observationIds[0]!, snippet: o.title, kind: 'tool.call', tool: o.tool, ...(o.paths[0] ? { path: o.paths[0].path } : {}) });
      return hits.slice(0, 50);
    },
    setLive: unsupported,
    explain: unsupported,
    briefing: unsupported,
    exportUrl: () => undefined,
    forget: unsupported,
    boundary: async () => null,
    setBoundary: unsupported,
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
