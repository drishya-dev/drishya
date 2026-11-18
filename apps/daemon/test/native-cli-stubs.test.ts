import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executable } from '../src/native-executable.ts';
import { nativeReadiness } from '../src/native-readiness.ts';
import { installNativeCliStubs, sweepStaleNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

// SHIP-16: the browser suite's stand-in CLIs must be found and judged ready by the real readiness code, or the suite would be
// testing the wrong composer. On Windows the stand-in is a compiled `.exe`, because the daemon only accepts a real one.
describe('browser-suite native CLI stubs', () => {
  it('are resolved from PATH and reported ready and signed in for both harnesses', async () => {
    const stubs = installNativeCliStubs();
    // Windows without a working .NET Framework compiler (or with an antivirus that refuses the built exe): the suite then runs with the machine's
    // own CLIs, as before. A hosted runner must have them, or the browser job would silently run against the wrong composer.
    if (!stubs && !process.env.CI) return;
    expect(stubs, 'the stand-in CLIs could be built and run').toBeDefined();
    if (!stubs) return;
    try {
      const env = { PATH: stubs.dir + delimiter + (process.platform === 'win32' ? 'C:\Windows\System32' : '/usr/bin') };
      const ext = process.platform === 'win32' ? '.exe' : '';
      expect(executable('claude', { env })).toBe(join(stubs.dir, `claude${ext}`));
      expect(executable('codex', { env })).toBe(join(stubs.dir, `codex${ext}`));
      for (const harness of ['claude-code', 'codex']) {
        const ready = await nativeReadiness(harness, stubs.dir, { resolveExecutable: (name) => executable(name, { env }) });
        expect(ready, harness).toEqual({ available: true, signedIn: true, supported: true, state: 'ready' });
      }
    } finally { stubs.remove(); }
    // Compiling the Windows stand-in with csc.exe and running four readiness probes took 7.5 s on a busy hosted Windows runner (18 Nov).
  }, 60_000);
  // CI-2: an interrupted run, or a stub .exe a virus scanner still held, left its folder in the temp directory. Each run sweeps
  // folders older than a day and leaves a younger one, which may belong to a run going on at the same time.
  it('sweeps stub folders an earlier run left behind, but not a current one', () => {
    const stale = mkdtempSync(join(tmpdir(), 'drishya-native-cli-')), current = mkdtempSync(join(tmpdir(), 'drishya-native-cli-'));
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(stale, twoDaysAgo, twoDaysAgo);
    try {
      sweepStaleNativeCliStubs();
      expect(existsSync(stale)).toBe(false);
      expect(existsSync(current)).toBe(true);
    } finally { rmSync(stale, { recursive: true, force: true }); rmSync(current, { recursive: true, force: true }); }
  });
});
