// SHIP-16: the browser suite must not depend on which native CLIs the machine happens to have.
//
// With no `claude` or `codex` on PATH (every hosted runner, and any Linux or macOS machine that only observes), the composer shows its
// setup row, which is 176 px taller than the ready composer and reserves that much space for the Toolbox and the history. Most specs
// were written on a machine that has both installed, so 12 of them failed on the first Linux run for that reason alone.
//
// These stubs answer only the two metadata probes `nativeReadiness` makes (capability help and sign-in status) with a ready, signed-in
// reply. They run nothing else: any other invocation exits 1, so a spec that tried to start a turn would fail loudly, not pass on a fake.
// POSIX only: on Windows the daemon finds `claude.exe` and `codex.exe` by file name and a script cannot stand in for one.
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const CLAUDE = `#!/bin/sh
case "$1" in
  --help) echo "Usage: claude --input-format --output-format --permission-prompt-tool --replay-user-messages" ;;
  auth) echo '{"loggedIn":true}' ;;
  *) echo "drishya test stub: only metadata probes are answered" >&2; exit 1 ;;
esac
`;
const CODEX = `#!/bin/sh
case "$1" in
  app-server) echo "codex app-server --listen" ;;
  login) echo "Logged in using a test stub" ;;
  *) echo "drishya test stub: only metadata probes are answered" >&2; exit 1 ;;
esac
`;

/** Writes the stubs to a fresh temporary folder and returns it, or undefined where scripts cannot be native CLIs (Windows). */
export function installNativeCliStubs(): { dir: string; remove: () => void } | undefined {
  if (process.platform === 'win32') return undefined;
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'drishya-native-cli-')));
  for (const [name, body] of [['claude', CLAUDE], ['codex', CODEX]] as const) {
    writeFileSync(join(dir, name), body);
    chmodSync(join(dir, name), 0o755);
  }
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Puts the stubs first on PATH for this process (and the workers it starts); returns the cleanup. */
export function useNativeCliStubs(): () => void {
  const stubs = installNativeCliStubs();
  if (!stubs) return () => {};
  process.env.PATH = `${stubs.dir}${delimiter}${process.env.PATH ?? ''}`;
  return stubs.remove;
}
