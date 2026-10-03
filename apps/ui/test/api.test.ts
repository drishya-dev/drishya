import { afterEach, describe, expect, it, vi } from 'vitest';
import { daemon } from '../src/api.ts';

class FakeEventSource {
  static current: FakeEventSource;
  listeners = new Map<string, () => void>();
  closed = false;

  constructor(_url: string) { FakeEventSource.current = this; }
  addEventListener(name: string, listener: () => void) { this.listeners.set(name, listener); }
  emit(name: string) { this.listeners.get(name)?.(); }
  close() { this.closed = true; }
}

afterEach(() => vi.unstubAllGlobals());

describe('daemon change stream authentication', () => {
  it('signs out when a restarted daemon rejects the old cookie', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
    const statuses: string[] = [];
    const stop = daemon.subscribe(() => undefined, { onStatus: (status) => statuses.push(status) });
    FakeEventSource.current.emit('error');
    await vi.waitFor(() => expect(statuses).toContain('signed-out'));
    expect(FakeEventSource.current.closed).toBe(true);
    stop();
  });

  it('keeps retrying while the daemon is unreachable', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const statuses: string[] = [];
    const stop = daemon.subscribe(() => undefined, { onStatus: (status) => statuses.push(status) });
    FakeEventSource.current.emit('error');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(statuses).toEqual(['reconnecting']);
    expect(FakeEventSource.current.closed).toBe(false);
    stop();
  });
});
