// SHIP-16: the browser suite must not depend on which native CLIs the machine happens to have.
//
// With no `claude` or `codex` on PATH (every hosted runner, and any Linux or macOS machine that only observes), the composer shows its
// setup row, which is 176 px taller than the ready composer and reserves that much space for the Toolbox and the history. Most specs
// were written on a machine that has both installed, so 12 of them failed on the first Linux run for that reason alone.
//
// These stubs answer only the two metadata probes `nativeReadiness` makes (capability help and sign-in status) with a ready, signed-in
// reply. They run nothing else: any other invocation exits 1, so a spec that tried to start a turn would fail loudly, not pass on a fake.
// Windows: the daemon finds `claude.exe` and `codex.exe` by file name and a script cannot stand in for one, so the stand-ins there are one
// small real executable (compiled with the .NET Framework compiler every Windows install and hosted runner has) copied under both names.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

/** The Windows stand-in. Which CLI it plays is decided by its own file name, so one build serves both. */
const WINDOWS_STUB = `using System;
using System.IO;
static class Stub {
  static int Main(string[] args) {
    string name = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]).ToLowerInvariant();
    string a = args.Length > 0 ? args[0] : "";
    if (name == "claude" && a == "--help") { Console.WriteLine("Usage: claude --input-format --output-format --permission-prompt-tool --replay-user-messages"); return 0; }
    if (name == "claude" && a == "auth") { Console.WriteLine("{\\"loggedIn\\":true}"); return 0; }
    if (name == "codex" && a == "app-server") { Console.WriteLine("codex app-server --listen"); return 0; }
    if (name == "codex" && a == "login") { Console.WriteLine("Logged in using a test stub"); return 0; }
    Console.Error.WriteLine("drishya test stub: only metadata probes are answered");
    return 1;
  }
}
`;

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

/** Writes the stubs to a fresh temporary folder and returns it, or undefined where none can be made (Windows without the .NET Framework compiler). */
export function installNativeCliStubs(): { dir: string; remove: () => void } | undefined {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'drishya-native-cli-')));
  // Best effort: on Windows a virus scanner can briefly hold a freshly built .exe, and a leftover temp folder must not fail a run.
  const remove = () => { try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* left for the OS temp cleanup */ } };
  if (process.platform === 'win32') {
    const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    if (!existsSync(csc)) { remove(); return undefined; }
    const source = join(dir, 'stub.cs');
    writeFileSync(source, WINDOWS_STUB);
    try {
      execFileSync(csc, ['/nologo', '/target:exe', `/out:${join(dir, 'claude.exe')}`, source], { stdio: 'pipe', windowsHide: true });
      copyFileSync(join(dir, 'claude.exe'), join(dir, 'codex.exe'));
      // A machine's antivirus can refuse or delete a freshly built executable. Prove each one runs before putting it on PATH.
      if (!execFileSync(join(dir, 'claude.exe'), ['--help'], { stdio: 'pipe', windowsHide: true }).toString().includes('--input-format')) throw new Error('stub');
      if (!execFileSync(join(dir, 'codex.exe'), ['app-server'], { stdio: 'pipe', windowsHide: true }).toString().includes('--listen')) throw new Error('stub');
    } catch { remove(); return undefined; }
    return { dir, remove };
  }
  for (const [name, body] of [['claude', CLAUDE], ['codex', CODEX]] as const) {
    writeFileSync(join(dir, name), body);
    chmodSync(join(dir, name), 0o755);
  }
  return { dir, remove };
}

/** Puts the stubs first on PATH for this process (and the workers it starts); returns the cleanup. */
export function useNativeCliStubs(): () => void {
  const stubs = installNativeCliStubs();
  if (!stubs) return () => {};
  process.env.PATH = `${stubs.dir}${delimiter}${process.env.PATH ?? ''}`;
  return stubs.remove;
}
