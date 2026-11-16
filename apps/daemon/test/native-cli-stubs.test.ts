import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executable } from '../src/native-executable.ts';
import { nativeReadiness } from '../src/native-readiness.ts';
import { installNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

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
  });
});
