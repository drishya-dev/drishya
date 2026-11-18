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
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

/** The Windows stand-in. Which CLI it plays is decided by its own file name, so one build serves both. */
const WINDOWS_STUB = `using System;
using System.IO;
using System.Reflection;
// Says what it is in the file's properties, for anyone (or any scanner) who finds it in the temp folder.
[assembly: AssemblyTitle("Drishya test stub")]
[assembly: AssemblyDescription("Drishya test stub: stands in for claude.exe and codex.exe in Drishya's browser tests. Answers the readiness probes only (claude --help and auth, codex app-server and login); runs nothing else.")]
[assembly: AssemblyProduct("Drishya test stub")]
[assembly: AssemblyVersion("1.0.0.0")]
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

/** Writes the stubs to a fresh temporary folder and returns it, or undefined where none can be made (Windows without the .NET Framework compiler). */
export function installNativeCliStubs(): { dir: string; remove: () => void } | undefined {
  sweepStaleNativeCliStubs();
  const dir = realpathSync(mkdtempSync(join(tmpdir(), PREFIX)));
  // Best effort: on Windows a virus scanner can briefly hold a freshly built .exe, and a leftover temp folder must not fail a run.
  // A folder still held after the retries is swept by a later run once it is a day old.
  const remove = () => { try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* left for the next sweep */ } };
  if (process.platform === 'win32') {
    const csc = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    if (!existsSync(csc)) { remove(); return undefined; }
    const source = join(dir, 'stub.cs');
    writeFileSync(source, WINDOWS_STUB);
    try {
      execFileSync(csc, ['/nologo', '/target:exe', '/win32manifest:' + manifest(dir), `/out:${join(dir, 'claude.exe')}`, source], { stdio: 'pipe', windowsHide: true });
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

/** An application manifest that runs the stub as the invoking user (asInvoker) and names it, so it never asks for elevation. */
function manifest(dir: string) {
  const path = join(dir, 'stub.manifest');
  writeFileSync(path, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="1.0.0.0" name="Drishya.TestStub"/>
  <description>Drishya test stub</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo>
</assembly>
`);
  return path;
}

/** Puts the stubs first on PATH for this process (and the workers it starts); returns the cleanup. The cleanup also runs when the
 * process exits without reaching the teardown (an interrupted run); what that misses, the next run's sweep removes. */
export function useNativeCliStubs(): () => void {
  const stubs = installNativeCliStubs();
  if (!stubs) return () => {};
  process.env.PATH = `${stubs.dir}${delimiter}${process.env.PATH ?? ''}`;
  process.once('exit', stubs.remove);
  return () => { process.off('exit', stubs.remove); stubs.remove(); };
}
