import type { ArtifactSlice } from '@drishya/contracts';

export type MaterialScope = 'preview' | 'reader';

// Four in-flight 2 MiB responses can decode to at most ~16 MiB of UTF-16 text.
// The two settled pools use 48 MiB, keeping decoded text at or below 64 MiB.
const BUDGET = { preview: 8 * 1024 * 1024, reader: 40 * 1024 * 1024 };
const MAX_IN_FLIGHT = 4;

interface Entry {
  scope: MaterialScope;
  promise: Promise<ArtifactSlice>;
  bytes: number;
}

/** LRU by settled decoded text, with one shared request queue and failure retry. */
export class ArtifactCache {
  private entries = new Map<string, Entry>();
  private used = { preview: 0, reader: 0 };
  private active = 0;
  private pending: Array<() => void> = [];

  get(key: string, scope: MaterialScope, fetch: () => Promise<ArtifactSlice>): Promise<ArtifactSlice> {
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.promise;
    }
    let start!: () => void;
    const promise = new Promise<ArtifactSlice>((resolve, reject) => {
      start = () => {
        this.active++;
        void Promise.resolve().then(fetch).then((slice) => {
          const entry = this.entries.get(key);
          if (entry?.promise === promise) {
            const bytes = slice.text.length * 2;
            if (bytes <= BUDGET[scope]) {
              entry.bytes = bytes;
              this.used[scope] += bytes;
              this.evict(scope);
            } else this.entries.delete(key);
          }
          resolve(slice);
        }, (error) => {
          this.entries.delete(key);
          reject(error);
        }).finally(() => {
          this.active--;
          this.pending.shift()?.();
        });
      };
    });
    this.entries.set(key, { scope, promise, bytes: 0 });
    if (this.active < MAX_IN_FLIGHT) start();
    else this.pending.push(start);
    return promise;
  }

  private evict(scope: MaterialScope) {
    for (const [key, entry] of this.entries) {
      if (this.used[scope] <= BUDGET[scope]) break;
      if (entry.scope !== scope || !entry.bytes) continue;
      this.entries.delete(key);
      this.used[scope] -= entry.bytes;
    }
  }

  /** Exposed for deterministic budget checks, not UI telemetry. */
  sizes() { return { ...this.used, inFlight: this.active, queued: this.pending.length }; }
}

export const materialCache = new ArtifactCache();
