import { describe, expect, it, vi } from 'vitest';
import type { ArtifactSlice } from '@drishya/contracts';
import { ArtifactCache } from '../src/lib/artifact-cache.ts';

function slice(text: string): ArtifactSlice {
  return { artifact: { id: 'test' } as ArtifactSlice['artifact'], available: true, start: 0, text, returnedLines: 1, totalLines: 1, totalBytes: text.length, truncated: false, hasMore: false };
}

describe('bounded artifact material', () => {
  it('evicts existing material when the low-resource budget is selected', async () => {
    const cache = new ArtifactCache();
    await cache.get('large', 'reader', async () => slice('x'.repeat(6 * 1024 * 1024)));
    cache.setLowResource(true);
    expect(cache.sizes().reader).toBeLessThanOrEqual(10 * 1024 * 1024);
    let fetched = false;
    await cache.get('large', 'reader', async () => { fetched = true; return slice('small'); });
    expect(fetched).toBe(true);
  });
  it('deduplicates a request and retries a rejected fetch', async () => {
    const cache = new ArtifactCache();
    let calls = 0;
    const fetch = async () => { calls++; return slice('hello'); };
    expect(cache.get('a', 'preview', fetch)).toBe(cache.get('a', 'preview', fetch));
    await cache.get('a', 'preview', fetch);
    expect(calls).toBe(1);
    await expect(cache.get('bad', 'reader', async () => { throw Error('offline'); })).rejects.toThrow('offline');
    expect((await cache.get('bad', 'reader', fetch)).text).toBe('hello');
  });

  it('evicts settled previews by decoded bytes without discarding the reader pool', async () => {
    const cache = new ArtifactCache();
    const large = 'x'.repeat(2_500_000); // 5 MiB decoded UTF-16 per response.
    await cache.get('reader', 'reader', async () => slice('held'));
    await cache.get('first', 'preview', async () => slice(large));
    await cache.get('second', 'preview', async () => slice(large));
    expect(cache.sizes().preview).toBeLessThanOrEqual(8 * 1024 * 1024);
    let calls = 0;
    await cache.get('first', 'preview', async () => { calls++; return slice('again'); });
    expect(calls).toBe(1);
    expect((await cache.get('reader', 'reader', async () => { throw Error('reader was evicted'); })).text).toBe('held');
  });

  it('holds the fifth response until an in-flight slot is free', async () => {
    const cache = new ArtifactCache();
    const release: Array<() => void> = [];
    let started = 0;
    const pending = Array.from({ length: 5 }, (_, i) => cache.get(`k${i}`, 'preview', () => new Promise<ArtifactSlice>((resolve) => {
      started++;
      release.push(() => resolve(slice('done')));
    })));
    await Promise.resolve();
    expect(started).toBe(4);
    expect(cache.sizes()).toMatchObject({ inFlight: 4, queued: 1 });
    release.shift()!();
    await pending[0];
    await vi.waitFor(() => expect(started).toBe(5));
    release.forEach((done) => done());
    await Promise.all(pending);
    expect(cache.sizes()).toMatchObject({ inFlight: 0, queued: 0 });
  });
});
