import { EventEmitter } from 'node:events';
import { win32 } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openBrowser } from '../src/commands.ts';

// SHIP-16: found by the first Linux run. `drishya serve` crashed with "Error: spawn xdg-open ENOENT" on a machine without an opener.
function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { unref: () => void };
  child.unref = () => {};
  return child;
}

describe('opening the browser is best effort', () => {
  it('survives the opener being missing: the late spawn error is swallowed, not thrown', () => {
    const child = fakeChild();
    let called: unknown[] = [];
    openBrowser('http://127.0.0.1:7878/#code=x', ((...args: unknown[]) => { called = args; return child; }) as never, 'linux');
    expect(called[0]).toBe('xdg-open');
    // An EventEmitter with no 'error' listener throws on emit; that is exactly what took the server down.
    expect(() => child.emit('error', Object.assign(new Error('spawn xdg-open ENOENT'), { code: 'ENOENT' }))).not.toThrow();
  });

  it('survives spawn throwing synchronously', () => {
    expect(() => openBrowser('http://127.0.0.1:7878/', (() => { throw new Error('EPERM'); }) as never, 'linux')).not.toThrow();
  });

  it('picks the opener for each platform', () => {
    const seen: Record<string, unknown[]> = {};
    for (const platform of ['darwin', 'linux', 'win32']) openBrowser('http://127.0.0.1:7878/?a=1&b=2', ((cmd: string, args: string[]) => { seen[platform] = [cmd, args]; return fakeChild(); }) as never, platform);
    expect(seen.darwin).toEqual(['open', ['http://127.0.0.1:7878/?a=1&b=2']]);
    expect(seen.linux).toEqual(['xdg-open', ['http://127.0.0.1:7878/?a=1&b=2']]);
    expect(seen.win32).toEqual([
      win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'),
      ['/d', '/c', 'start', '""', 'http://127.0.0.1:7878/?a=1^&b=2'],
    ]);
  });
});
