import { describe, expect, it, vi } from 'vitest';
import { latestOnly, liveRefresh, needsReload } from '../src/lib/sync.ts';

// B1b (audit A07): after a reconnect, the viewer compares the revisions it rendered with the
// server's, and reloads only what changed.
describe('needsReload', () => {
  it('reloads an open recording whose revision moved while disconnected', () => {
    expect(needsReload('rec_a', { rec_a: 3 }, { rec_a: 5 })).toBe(true);
  });
  it('does nothing when the revision is unchanged', () => {
    expect(needsReload('rec_a', { rec_a: 5 }, { rec_a: 5 })).toBe(false);
  });
  it('checks every part of a combined view', () => {
    expect(needsReload('rec_a+rec_b', { rec_a: 1, rec_b: 1 }, { rec_a: 1, rec_b: 2 })).toBe(true);
  });
  it('reloads when it never knew the revision', () => {
    expect(needsReload('rec_a', {}, { rec_a: 0 })).toBe(true);
  });
});

// B1b (audit A12): a slow response for a recording the user has already left must not land.
describe('latestOnly', () => {
  it('lets only the newest request of a key apply its result', async () => {
    const guard = latestOnly();
    const slow = guard('projection');
    const fast = guard('projection');
    expect(slow()).toBe(false);
    expect(fast()).toBe(true);
  });
  it('keeps keys independent', () => {
    const guard = latestOnly();
    const a = guard('projection');
    guard('graph');
    expect(a()).toBe(true);
  });
});

describe('liveRefresh', () => {
  it('refreshes during a continuous stream instead of waiting for silence', async () => {
    vi.useFakeTimers();
    const refresh=vi.fn(async()=>{}), queue=liveRefresh(refresh,()=>{});
    try {
      for(let i=0;i<20;i++){queue.schedule();await vi.advanceTimersByTimeAsync(50);}
      expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(6);
    } finally {queue.close();vi.useRealTimers();}
  });
  it('serializes slow refreshes, retains notices arriving during work and cancels queued work', async () => {
    vi.useFakeTimers();
    let resolve!:()=>void;
    const refresh=vi.fn(()=>new Promise<void>(r=>{resolve=r;})), failed=vi.fn(),queue=liveRefresh(refresh,failed);
    try {
      queue.schedule();await vi.advanceTimersByTimeAsync(150);
      queue.schedule();queue.schedule();await vi.advanceTimersByTimeAsync(500);
      expect(refresh).toHaveBeenCalledTimes(1);
      resolve();await vi.advanceTimersByTimeAsync(150);
      expect(refresh).toHaveBeenCalledTimes(2);
      queue.schedule();queue.close();resolve();await vi.advanceTimersByTimeAsync(500);
      expect(refresh).toHaveBeenCalledTimes(2);expect(failed).not.toHaveBeenCalled();
    } finally {queue.close();vi.useRealTimers();}
  });
});
