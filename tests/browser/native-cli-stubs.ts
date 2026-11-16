// SHIP-16: the browser suite must not depend on which native CLIs the machine happens to have.
//
// With no `claude` or `codex` on PATH (every hosted runner, and any Linux or macOS machine that only observes), the composer shows its
// setup row, which is 176 px taller than the ready composer and reserves that much space for the Toolbox and the history. Most specs
// were written on a machine that has both installed, so 12 of them failed on the first Linux run for that reason alone.
//
// These stubs answer only the two metadata probes `nativeReadiness` makes (capability help and sign-in status) with a ready, signed-in
// reply. They run nothing else: any other invocation exits 1, so a spec that tried to start a turn would fail loudly, not pass on a fake.
// On Windows the test helper compiles small executables because scripts do not satisfy native resolution.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const CLAUDE = `#!/bin/sh
case "$#:$*" in
  "1:--help") echo "Usage: claude --input-format --output-format --permission-prompt-tool --replay-user-messages" ;;
  "3:auth status --json") echo '{"loggedIn":true}' ;;
  *) echo "drishya test stub: only metadata probes are answered" >&2; exit 1 ;;
esac
`;
const CODEX = `#!/bin/sh
case "$#:$*" in
  "2:app-server --help") echo "codex app-server --listen" ;;
  "2:login status") echo "Logged in using a test stub" ;;
  *) echo "drishya test stub: only metadata probes are answered" >&2; exit 1 ;;
esac
`;

const WINDOWS_STUB = String.raw`
using System;
using System.IO;
using System.Linq;

class NativeMetadataStub {
    static int Main(string[] args) {
        var name = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
        if (name == "claude" && args.SequenceEqual(new [] {"--help"}))
            Console.WriteLine("Usage: claude --input-format --output-format --permission-prompt-tool --replay-user-messages");
        else if (name == "claude" && args.SequenceEqual(new [] {"auth", "status", "--json"}))
            Console.WriteLine("{\"loggedIn\":true}");
        else if (name == "codex" && args.SequenceEqual(new [] {"app-server", "--help"}))
            Console.WriteLine("codex app-server --listen");
        else if (name == "codex" && args.SequenceEqual(new [] {"login", "status"}))
            Console.WriteLine("Logged in using a test stub");
        else {
            Console.Error.WriteLine("drishya test stub: only metadata probes are answered");
            return 1;
        }
        return 0;
    }
}
`;

function installWindowsStubs(dir: string): void {
  const source = join(dir, 'native-metadata-stub.cs');
  const systemRoot = process.env.SystemRoot;
  const compiler = systemRoot && ['Framework64', 'Framework'].map(framework =>
    join(systemRoot, 'Microsoft.NET', framework, 'v4.0.30319', 'csc.exe')).find(existsSync);
  if (!compiler) throw Error('The Windows browser fixtures require the .NET Framework C# compiler.');
  writeFileSync(source, WINDOWS_STUB);
  const claude = join(dir, 'claude.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/out:' + claude, source], { timeout: 30_000, windowsHide: true });
  copyFileSync(claude, join(dir, 'codex.exe'));
}

/** Writes test-only metadata executables to a fresh temporary folder. */
export function installNativeCliStubs(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(realpathSync.native(tmpdir()), 'drishya-native-cli-'));
  const remove = () => rmSync(dir, { recursive: true, force: true });
  try {
    if (process.platform === 'win32') installWindowsStubs(dir);
    else for (const [name, body] of [['claude', CLAUDE], ['codex', CODEX]] as const) {
      writeFileSync(join(dir, name), body);
      chmodSync(join(dir, name), 0o755);
    }
  } catch (error) {
    remove();
    throw error;
  }
  return { dir, remove };
}

/** Puts the stubs first on PATH for this process (and the workers it starts); returns the cleanup. */
export function useNativeCliStubs(): () => void {
  const stubs = installNativeCliStubs();
  const path = process.env.PATH;
  process.env.PATH = `${stubs.dir}${delimiter}${path ?? ''}`;
  return () => {
    if (path === undefined) delete process.env.PATH;
    else process.env.PATH = path;
    stubs.remove();
  };
}
