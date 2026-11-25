import { spawn, type SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HarnessController } from '../../apps/daemon/src/controller.ts';
import { startServer as startDaemon, type ServerOptions } from '../../apps/daemon/src/server.ts';

export type { RunningServer } from '../../apps/daemon/src/server.ts';

const nativeStubPaths = {
  claude: fileURLToPath(new URL('./fixtures/native-claude.mjs', import.meta.url)),
  codex: fileURLToPath(new URL('./fixtures/native-codex.mjs', import.meta.url)),
};

export const windowsNativeCliOptions = {
  resolveExecutable(name: string) {
    if (name !== 'claude' && name !== 'codex') return undefined;
    const script = nativeStubPaths[name];
    return existsSync(script) ? script : undefined;
  },
  // Keep the real controller and readiness checks. The existing Node executable
  // runs the static fixture directly, with the original cwd, stdio and CLI arguments.
  launch: ((script: string, args: string[], options: SpawnOptions) =>
    spawn(process.execPath, [script, ...args], options)) as typeof spawn,
};

export function startServer(options: ServerOptions = {}) {
  if (process.platform !== 'win32' || options.controllerFactory) return startDaemon(options);
  return startDaemon({
    ...options,
    controllerFactory: (app, workspace) => new HarnessController(app, workspace, windowsNativeCliOptions),
  });
}
