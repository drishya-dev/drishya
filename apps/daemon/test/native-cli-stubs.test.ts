import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executable } from '../src/native-executable.ts';
import { nativeReadiness } from '../src/native-readiness.ts';
import { installNativeCliStubs, sweepStaleNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

// SHIP-16: the browser suite's stand-in CLIs must be found and judged ready by the real readiness code, or the suite would be
// testing the wrong composer. Windows uses the browser server fixture and has a separate readiness test.
describe('browser-suite native CLI stubs', () => {
  it.skipIf(process.platform === 'win32')('are resolved from PATH and reported ready and signed in for both harnesses', async () => {
    const stubs = installNativeCliStubs();
    expect(stubs, 'the stand-in shell scripts could be installed').toBeDefined();
    if (!stubs) return;
    try {
      const env = { PATH: stubs.dir + delimiter + '/usr/bin' };
      expect(executable('claude', { env })).toBe(join(stubs.dir, 'claude'));
      expect(executable('codex', { env })).toBe(join(stubs.dir, 'codex'));
      for (const harness of ['claude-code', 'codex']) {
        const ready = await nativeReadiness(harness, stubs.dir, { resolveExecutable: (name) => executable(name, { env }) });
        expect(ready, harness).toEqual({ available: true, signedIn: true, supported: true, state: 'ready' });
      }
    } finally { stubs.remove(); }
  });
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
