// SHIP-16: the browser suite must not depend on which native CLIs the machine happens to have.
//
// With no `claude` or `codex` on PATH (every hosted runner, and any Linux or macOS machine that only observes), the composer shows its
// setup row, which is 176 px taller than the ready composer and reserves that much space for the Toolbox and the history. Most specs
// were written on a machine that has both installed, so 12 of them failed on the first Linux run for that reason alone.
//
// These stubs answer only the two metadata probes `nativeReadiness` makes (capability help and sign-in status) with a ready, signed-in
// reply. They run nothing else: any other invocation exits 1, so a spec that tried to start a turn would fail loudly, not pass on a fake.
// On Windows, browser-server.ts supplies the metadata launch through the controller factory.
import { chmodSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

const PREFIX = 'drishya-native-cli-';
const DAY = 24 * 60 * 60 * 1000;

/** Removes stub folders an earlier run left behind: one that was interrupted before its teardown, or whose .exe a virus scanner was
 * still holding when the run removed it. Only folders older than a day, so a run going on at the same time keeps its own. */
export function sweepStaleNativeCliStubs(now = Date.now()) {
  let names: string[];
  try { names = readdirSync(tmpdir()).filter(name => name.startsWith(PREFIX)); } catch { return; }
  for (const name of names) {
    const path = join(tmpdir(), name);
    try { if (now - statSync(path).mtimeMs > DAY) rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* still held; the next run tries again */ }
  }
}

/** Installs executable shell fixtures on POSIX. Windows workers use the browser server factory. */
export function installNativeCliStubs(): { dir: string; remove: () => void } | undefined {
  sweepStaleNativeCliStubs();
  if (process.platform === 'win32') return undefined;
  const dir = realpathSync(mkdtempSync(join(tmpdir(), PREFIX)));
  // A folder still held after the retries is swept by a later run once it is a day old.
  const remove = () => { try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* left for the next sweep */ } };
  for (const [name, body] of [['claude', CLAUDE], ['codex', CODEX]] as const) {
    writeFileSync(join(dir, name), body);
    chmodSync(join(dir, name), 0o755);
  }
  return { dir, remove };
}

/** Puts the stubs first on PATH for this process (and the workers it starts); returns the cleanup. The cleanup also runs when the
 * process exits without reaching the teardown (an interrupted run); what that misses, the next run's sweep removes. */
export function useNativeCliStubs(): () => void {
  const stubs = installNativeCliStubs();
  if (!stubs) return () => {};
  const originalPath = process.env.PATH;
  process.env.PATH = `${stubs.dir}${delimiter}${originalPath ?? ''}`;
  process.once('exit', stubs.remove);
  return () => {
    process.off('exit', stubs.remove);
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    stubs.remove();
  };
}
