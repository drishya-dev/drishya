import { delimiter } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executable } from '../src/native-executable.ts';
import { nativeReadiness } from '../src/native-readiness.ts';
import { installNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

// SHIP-16: the browser suite's stand-in CLIs must be found and judged ready by the real readiness code, or the suite would be
// testing the wrong composer. POSIX only; on Windows the daemon needs a real `.exe`.
describe.skipIf(process.platform === 'win32')('browser-suite native CLI stubs', () => {
  it('are resolved from PATH and reported ready and signed in for both harnesses', async () => {
    const stubs = installNativeCliStubs()!;
    try {
      const env = { PATH: stubs.dir + delimiter + '/usr/bin' };
      expect(executable('claude', { env })).toBe(`${stubs.dir}/claude`);
      expect(executable('codex', { env })).toBe(`${stubs.dir}/codex`);
      for (const harness of ['claude-code', 'codex']) {
        const ready = await nativeReadiness(harness, stubs.dir, { resolveExecutable: (name) => executable(name, { env }) });
        expect(ready, harness).toEqual({ available: true, signedIn: true, supported: true, state: 'ready' });
      }
    } finally { stubs.remove(); }
  });
});
