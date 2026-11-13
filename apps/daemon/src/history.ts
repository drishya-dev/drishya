import type {RecordedRoot} from './file-roots.ts';
import type {QueueQuery, QueuePage} from '@drishya/contracts';
import type { FileOperationPage } from '../../../packages/scene/src/file-timeline.ts';
import type { ReadingQuery, ReadingTarget } from '../../../packages/scene/src/reading-target.ts';
import type { FileEvidence } from '../../../packages/scene/src/file-evidence.ts';
import type {ReviewInsightsPage,FindingMembers,ReviewFinding} from '../../../packages/scene/src/review-insights.ts';
import type {CommandQuery,CommandPage} from '../../../packages/scene/src/commands.ts';
import type {ScreenRun} from '../../../packages/scene/src/screen.ts';
import type {ToolInventory,ToolTrail,ToolFilter} from '../../../packages/scene/src/tools.ts';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { ArtifactSlice } from '@drishya/contracts';
import type { BlobSearchResult } from '@drishya/store';
import type { HistoryPage, HistoryQuery, HistorySummary } from '../../../packages/scene/src/history.ts';
import type { NowFacts } from '../../../packages/scene/src/now.ts';
import type { TurnLedger } from '../../../packages/scene/src/turns.ts';
import type { Marker } from '@drishya/scene';
import type { SinceSnapshot } from '../../../packages/scene/src/since.ts';
import type { VerificationTrail } from '../../../packages/scene/src/verification.ts';
import type { FixChain } from '../../../packages/scene/src/fix-chains.ts';
import type { ReadBeforeWrite } from '../../../packages/scene/src/read-before-write.ts';
import type { ModelConfig, Prepared } from '@drishya/explain';
import type {LibrarySearchQuery,LibrarySearchPage} from '../../../packages/store/src/search-types.ts';
import type {GitSessionQuery,GitSessionEvidence} from './git-session-evidence.ts';
import type {DelegationThread} from './delegation-types.ts';

/** One worker owns the derived history index. Capture's SQLite writer remains the ingestor. */
export class HistoryService {
  private worker?: Worker;
  private onlineWorker?: Worker;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private sequence = 0;
  private closed = false;
  private exitPromise?: Promise<void>;
  private startingWorker?: Promise<Worker>;
  constructor(privateDir: string, onRead?: (id: string) => void) { this.dir = privateDir; this.onRead = onRead; }
  private readonly onRead?: (id: string) => void;
  private readonly dir: string;

  private async ensureWorker(): Promise<Worker> {
    if (this.closed) throw new Error('History service is closed');
    if (this.worker) return this.worker;
    if (this.startingWorker) return this.startingWorker;

    const start = (async () => {
      if (this.exitPromise) {
        await this.exitPromise;
      }
      if (this.closed) throw new Error('History service is closed');
      if (this.worker) return this.worker;

      const extension = import.meta.url.endsWith('.mjs') ? 'mjs' : 'ts';
      const worker = new Worker(new URL(`./history-worker.${extension}`, import.meta.url), {
        workerData: { dir: this.dir },
        resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 16 },
      });

      let resolveExit!: () => void;
      this.exitPromise = new Promise<void>((resolve) => { resolveExit = resolve; });

      this.worker = worker;
      worker.once('online', () => { if (this.worker === worker) this.onlineWorker = worker; });
      worker.on('message', (message: { id: number; value?: unknown; error?: string }) => {
        const task = this.pending.get(message.id);
        if (!task) return;
        this.pending.delete(message.id);
        if (message.error) task.reject(new Error(message.error)); else task.resolve(message.value);
        if (!this.pending.size) worker.unref();
      });

      const fail = (error: Error) => {
        if (this.worker !== worker) return; // an old worker's exit must not reject its replacement's requests
        for (const task of this.pending.values()) task.reject(error);
        this.pending.clear();
        if (this.worker === worker) { this.worker = undefined; this.onlineWorker = undefined; }
      };

      worker.on('error', (err) => {
        if (err instanceof Error && (err.message.includes('database is locked') || err.message.includes('busy'))) {
          console.error(`history: cache database ${join(this.dir, 'history', 'index.db')} remained locked after 5s wait`);
        }
        void worker.terminate().catch(() => {});
        fail(err);
      });
      worker.on('exit', (code) => {
        fail(new Error(`History worker exited (${code})`));
        resolveExit();
      });
      worker.unref();
      return worker;
    })();

    this.startingWorker = start;
    start.finally(() => {
      if (this.startingWorker === start) this.startingWorker = undefined;
    });

    return start;
  }

  private async request<T>(method: string, args: unknown): Promise<T> {
    if (this.closed) throw new Error('History service is closed');
    const viewId = (args as { id?: unknown } | undefined)?.id;
    if (typeof viewId === 'string' && method !== 'forget') this.onRead?.(viewId);
    const worker = await this.ensureWorker();
    const id = ++this.sequence;
    const result = new Promise<T>((resolve, reject) => this.pending.set(id, { resolve: (value) => resolve(value as T), reject }));
    worker.ref();
    worker.postMessage({ id, method, args });
    return result;
  }

  /** No worker is created for diagnostics; this samples the existing isolate only. */
  async diagnosticHeap() {
    const worker = this.worker;
    if (!worker || this.onlineWorker !== worker) return undefined;
    const heap = await worker.getHeapStatistics();
    return { threadId: worker.threadId, heapUsed: heap.used_heap_size, heapPhysical: heap.total_physical_size, external: heap.external_memory };
  }
  diagnosticSqlite() {
    return this.worker ? this.request<Record<string, unknown>>('diagnostic-sqlite', {}) : Promise.resolve(undefined);
  }

  page(id: string, query: HistoryQuery = {}) { return this.request<HistoryPage>('page', { id, query }); }
  /** HTTP callers receive worker-encoded bytes, avoiding a second full page on the daemon heap. */
  pageBytes(id: string, query: HistoryQuery = {}) { return this.request<Uint8Array<ArrayBuffer>>('page-bytes', { id, query }); }
  findingMembers(id:string,key:string,page=0,q='') {return this.request<FindingMembers>('finding-members',{id,key,page,q});}
  reviewInsights(id:string,page=0,kind?:ReviewFinding['kind']) {return this.request<ReviewInsightsPage>('review-insights',{id,page,kind});}
  commands(id:string,query:CommandQuery) {return this.request<CommandPage>('commands',{id,query});}
  queue(id: string, owner: string, query: QueueQuery): Promise<QueuePage> {return this.request('queue', {id, owner, query});}
  screen(id:string,step?:number) {return this.request<ScreenRun>('screen',{id,step});}
  tools(id:string,step?:number) {return this.request<ToolInventory>('tools',{id,step});}
  toolTrail(id:string,filter:ToolFilter,from?:{id?:string;at?:number},step?:number) {return this.request<ToolTrail>('tool-trail',{id,filter,from,step});}
  gitSessionEvidence(id:string,query:GitSessionQuery) {return this.request<GitSessionEvidence>('git-session-evidence',{id,query});}
  delegationThread(id:string,operationId:string,start=0,step?:number,taskStart=0) {return this.request<DelegationThread|null>('delegation-thread',{id,operationId,start,step,taskStart});}
  searchLibrary(query:LibrarySearchQuery) {return this.request<LibrarySearchPage>('search-library',{query});}
  summary(id: string, from = 0) { return this.request<HistorySummary>('summary', { id, from }); }
  readingTarget(id: string, query: ReadingQuery) { return this.request<ReadingTarget | null>('reading-target', { id, query }); }
  fileEvidence(id: string, paths: string[], step?: number) { return this.request<FileEvidence[]>('file-evidence', { id, paths, step }); }
  compareEvidence(id: string, paths: string[]) { return this.request<import('./git-compare-types.ts').CompareEvidence>('compare-evidence', { id, paths }); }
  fileRoots(id:string,roots:RecordedRoot[],workspaceRoot:string|undefined) {return this.request<RecordedRoot[]>('file-roots',{id,roots,workspaceRoot});}
  now(id: string) { return this.request<NowFacts>('now', { id }); }
  contextReport(id: string) { return this.request<{ time?: string; prompt: string }[]>('context-report', { id }); }
  turns(id: string) { return this.request<TurnLedger[]>('turns', { id }); }
  since(id: string, after: number, page = 0) { return this.request<SinceSnapshot>('since', { id, after, page }); }
  readBefore(id: string, operationId: string) { return this.request<ReadBeforeWrite | null>('read-before', { id, operationId }); }
  fixChain(id: string, operationId: string) { return this.request<FixChain | null>('fix-chain', { id, operationId }); }
  verification(id: string, operationId: string) { return this.request<VerificationTrail | null>('verification', { id, operationId }); }
  artifactChunk(id: string, artifactId: string, start: number, field?: 'text'|'structured') { return this.request<unknown>('artifact-chunk', { id, artifactId, start, field }); }
  artifact(id: string, artifactId: string, start: number, count: number) { return this.request<ArtifactSlice>('artifact', { id, artifactId, start, count }); }
  artifactFind(id: string, artifactId: string, query: string, start: number, continuation?: string) { return this.request<BlobSearchResult | undefined>('artifact-find', { id, artifactId, query, start, continuation }); }
  file(id: string, path: string, start = 0, count = 100, step?: number, query = '', selectedOperationId?: string) { return this.request<FileOperationPage>('file', { id, path, start, count, step, query, selectedOperationId }); }
  prepare(id: string, task: string, model: ModelConfig, body: Record<string, unknown>) { return this.request<Prepared>('prepare', { id, task, model: { ...model, apiKey: undefined }, body }); }
  marker(id: string, step: number, types: Marker['type'][], direction: 1 | -1) { return this.request<number | undefined>('marker', { id, step, types, direction }); }
  forget(id: string) { return this.request<void>('forget', { id }); }
  async close() {
    if (this.closed) return;
    // Await requests before terminating so derived writes never race shutdown/cleanup.
    if (this.worker) {
      try {
        await this.request('close', {});
      } catch {
        // worker may have already exited or errored
      }
    }
    this.closed = true;
    if (this.worker) await this.worker.terminate();
    if (this.exitPromise) await this.exitPromise;
  }
}
