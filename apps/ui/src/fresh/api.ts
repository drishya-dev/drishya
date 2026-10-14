import type { ArtifactSlice, DiscoveredSource, RecordingSummary, RepoGraph } from '@drishya/contracts';
import type { HistoryPage } from '../../../../packages/scene/src/history.ts';
import type { NativeSettings, NativeUsage } from '../../../daemon/src/native-types.ts';
import type { GitSnapshot } from '../../../daemon/src/git-types.ts';

export interface NativeState {
  state: 'idle' | 'connecting' | 'running' | 'approval' | 'completed' | 'failed' | 'stopped';
  harness: string; available: boolean; output: string; tools: string[]; inventory: 'unknown' | 'runtime';
  runId?: string; error?: string; phase?: string; settings?: NativeSettings; usage?: NativeUsage;
  preview?: { id: string; role: 'response' | 'reasoning'; exposure?: string; text: string };
  submittedPrompt?: string; afterSequence?: number; promptRedacted?: boolean; attachments?: { name: string; type: 'text' | 'image' }[];
  approvals: { id: string; name: string; detail: string }[];
}
export interface WorkspaceState { approved: boolean; root?: string; scope: 'current-workspace' }
export interface CurrentFile { path: string; scope: string; text: string; start: number; totalLines: number; returnedLines: number; hasMore: boolean; redacted: boolean; modifiedAt: string }
export interface Attachment { name: string; type: 'text' | 'image'; data: string; mime?: string }
export interface SearchResult { observationId?: string; id?: string; sequence?: number; kind?: string; text?: string; snippet?: string; [key: string]: unknown }
export interface LocalConfig { version: string; dataDir: string; adapters: { label: string; harness: string; capabilities: Record<string, string> }[]; llm: { configured: boolean; baseUrl: string; models: Record<string, string> } }
export interface StorageInfo { [key: string]: unknown }
export type { ArtifactSlice, DiscoveredSource, RecordingSummary, RepoGraph, HistoryPage, GitSnapshot };

export function createFreshApi(token: string) {
  async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/v1/${path}`, {
      method, credentials: 'same-origin', signal,
      headers: { ...(token && path === 'session' ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? `Local server returned ${response.status}`);
    return result as T;
  }
  const rec = (id: string) => `recordings/${encodeURIComponent(id)}`;
  return {
    request,
    recordings: () => request<{ recordings: RecordingSummary[] }>('recordings'),
    sources: () => request<{ sources: DiscoveredSource[]; errors: { message?: string; [key: string]: unknown }[] }>('sources'),
    import: (source: DiscoveredSource) => request<{ recordingId: string }>('import', { path: source.path, adapterId: source.adapterId, live: true }),
    history: (id: string, query: object, signal?: AbortSignal) => request<HistoryPage>(`${rec(id)}/history`, query, 'POST', signal),
    graph: (id: string, refresh = false) => request<RepoGraph>(`${rec(id)}/graph${refresh ? '?refresh=1' : ''}`),
    graphApprove: (id: string) => request<RepoGraph>(`${rec(id)}/graph/approve`, {}),
    workspace: (id: string) => request<WorkspaceState>(`${rec(id)}/workspace`),
    workspaceApprove: (id: string) => request<WorkspaceState>(`${rec(id)}/workspace/approve`, {}),
    file: (id: string, path: string, start = 0) => request<CurrentFile>(`${rec(id)}/workspace/file?path=${encodeURIComponent(path)}&start=${start}&count=200`),
    artifact: (id: string, art: string, start = 0) => request<ArtifactSlice>(`${rec(id)}/artifacts/${encodeURIComponent(art)}?start=${start}&count=400`),
    native: (id: string) => request<NativeState>(`${rec(id)}/controller`),
    settings: (id: string) => request<NativeState>(`${rec(id)}/controller/settings`, {}),
    prompt: (id: string, prompt: string, attachments: Attachment[], options: object) => request<NativeState>(`${rec(id)}/controller/prompt`, { prompt, attachments, options, exclusive: true }),
    stop: (id: string, runId: string) => request<NativeState>(`${rec(id)}/controller/stop`, { runId }),
    approval: (id: string, runId: string, approvalId: string, allow: boolean) => request<NativeState>(`${rec(id)}/controller/approval`, { runId, approvalId, allow }),
    live: (id: string, on: boolean) => request(`${rec(id)}/live`, { on }),
    sync: (id: string) => request(`${rec(id)}/sync`, {}),
    search: (id: string, q: string, signal?: AbortSignal) => request<{ hits: SearchResult[] }>(`${rec(id)}/search?q=${encodeURIComponent(q)}`, undefined, 'GET', signal),
    gitStatus: (id: string) => request<{ approved: boolean; root?: string; scope: string }>(`${rec(id)}/git`),
    gitApprove: (id: string) => request<{ approved: boolean }>(`${rec(id)}/git/approve`, {}),
    git: (id: string, start = 0) => request<GitSnapshot>(`${rec(id)}/git/snapshot?start=${start}`),
    config: () => request<LocalConfig>('config'),
    storage: () => request<StorageInfo>('storage'),
    bookmark: (id: string, step: number, note: string) => request(`${rec(id)}/bookmarks`, { step, note }),
    boundary: (id: string, sequence: number) => request(`${rec(id)}/boundary`, { sequence }),
    export: (id: string) => request<unknown>(`${rec(id)}/export`),
  };
}
export type FreshApi = ReturnType<typeof createFreshApi>;
