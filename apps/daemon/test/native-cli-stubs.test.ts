import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executable } from '../src/native-executable.ts';
import { nativeReadiness } from '../src/native-readiness.ts';
import { installNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

// SHIP-16: the browser suite's stand-in CLIs must be found and judged ready by the real readiness code, or the suite would be
// testing the wrong composer.
describe('browser-suite native CLI stubs', () => {
  it('are resolved from PATH and reported ready and signed in for both harnesses', async () => {
    const stubs = installNativeCliStubs();
    try {
      const env = { PATH: stubs.dir + delimiter + '/usr/bin' };
      const extension = process.platform === 'win32' ? '.exe' : '';
      expect(executable('claude', { env })).toBe(join(stubs.dir, 'claude' + extension));
      expect(executable('codex', { env })).toBe(join(stubs.dir, 'codex' + extension));
      for (const harness of ['claude-code', 'codex']) {
        const ready = await nativeReadiness(harness, stubs.dir, { resolveExecutable: (name) => executable(name, { env }) });
        expect(ready, harness).toEqual({ available: true, signedIn: true, supported: true, state: 'ready' });
      }
    } finally { stubs.remove(); }
  });

  it('rejects real invocation arguments even when their first word matches a metadata probe', () => {
    const stubs = installNativeCliStubs();
    try {
      const env = { PATH: stubs.dir };
      const codex = executable('codex', { env })!;
      const claude = executable('claude', { env })!;
      expect(spawnSync(codex, ['app-server', '--listen', 'stdio://']).status).toBe(1);
      expect(spawnSync(claude, ['auth', 'login']).status).toBe(1);
    } finally { stubs.remove(); }
  });
});
