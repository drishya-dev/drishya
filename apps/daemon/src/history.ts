import type {CommandQuery,CommandPage} from '../../../packages/scene/src/commands.ts';
import { Worker } from 'node:worker_threads';
import type { ArtifactSlice, Operation } from '@drishya/contracts';
import type { BlobSearchResult } from '@drishya/store';
import type { HistoryPage, HistoryQuery, HistorySummary } from '../../../packages/scene/src/history.ts';
import type { Marker } from '@drishya/scene';
import type { SinceSnapshot } from '../../../packages/scene/src/since.ts';
import type { VerificationTrail } from '../../../packages/scene/src/verification.ts';
import type { ModelConfig, Prepared } from '@drishya/explain';
import type {LibrarySearchQuery,LibrarySearchPage} from '../../../packages/store/src/search-types.ts';

/** One worker owns the derived history index. Capture's SQLite writer remains the ingestor. */
export class HistoryService {
  private worker?: Worker;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private sequence = 0;
  private closed = false;
  constructor(privateDir: string) { this.dir = privateDir; }
  private readonly dir: string;

  private request<T>(method: string, args: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new Error('History service is closed'));
    if (!this.worker) {
      const extension = import.meta.url.endsWith('.mjs') ? 'mjs' : 'ts';
      const worker = new Worker(new URL(`./history-worker.${extension}`, import.meta.url), { workerData: { dir: this.dir }, resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 16 } });
      this.worker = worker;
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
        if (this.worker === worker) this.worker = undefined;
      };
      worker.on('error', fail);
      worker.on('exit', (code) => fail(new Error(`History worker exited (${code})`)));
      worker.unref();
    }
    const id = ++this.sequence;
    const result = new Promise<T>((resolve, reject) => this.pending.set(id, { resolve: (value) => resolve(value as T), reject }));
    this.worker.ref();
    this.worker.postMessage({ id, method, args });
    return result;
  }

  page(id: string, query: HistoryQuery = {}) { return this.request<HistoryPage>('page', { id, query }); }
  commands(id:string,query:CommandQuery) {return this.request<CommandPage>('commands',{id,query});}
  searchLibrary(query:LibrarySearchQuery) {return this.request<LibrarySearchPage>('search-library',{query});}
  summary(id: string, from = 0) { return this.request<HistorySummary>('summary', { id, from }); }
  since(id: string, after: number, page = 0) { return this.request<SinceSnapshot>('since', { id, after, page }); }
  verification(id: string, operationId: string) { return this.request<VerificationTrail | null>('verification', { id, operationId }); }
  artifact(id: string, artifactId: string, start: number, count: number) { return this.request<ArtifactSlice>('artifact', { id, artifactId, start, count }); }
  artifactFind(id: string, artifactId: string, query: string, start: number, continuation?: string) { return this.request<BlobSearchResult | undefined>('artifact-find', { id, artifactId, query, start, continuation }); }
  file(id: string, path: string, start = 0, count = 100, step?: number, query = '') { return this.request<{ operations: Operation[]; total: number }>('file', { id, path, start, count, step, query }); }
  prepare(id: string, task: string, model: ModelConfig, body: Record<string, unknown>) { return this.request<Prepared>('prepare', { id, task, model: { ...model, apiKey: undefined }, body }); }
  marker(id: string, step: number, types: Marker['type'][], direction: 1 | -1) { return this.request<number | undefined>('marker', { id, step, types, direction }); }
  forget(id: string) { return this.request<void>('forget', { id }); }
  async close() {
    if (this.closed) return;
    // Await requests before terminating so derived writes never race shutdown/cleanup.
    if (this.worker) await this.request('close', {});
    this.closed = true;
    if (this.worker) await this.worker.terminate();
  }
}
