import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, windowsNativeCliOptions, type RunningServer } from '../../../tests/browser/browser-server.ts';
import { useNativeCliStubs } from '../../../tests/browser/native-cli-stubs.ts';

it.skipIf(process.platform !== 'win32')('the browser server checks both native CLIs without a native install', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya browser readiness '));
  for (const name of ['PATH', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) vi.stubEnv(name, dir);
  const app = new App(join(dir, 'fixture store'));
  let server: RunningServer | undefined;
  try {
    server = await startServer({ app, port: 0, uiDir: dir });
    for (const harness of ['claude-code', 'codex']) {
      app.store.upsertRecording({ id: harness, adapterId: harness, harness, workspaceRoot: dir, sourcePath: join(dir, `${harness}.jsonl`) });
      const endpoint = `${server.url}/v1/recordings/${harness}/workspace/setup`;
      const response = await fetch(endpoint, { headers: { authorization: `Bearer ${server.token}` } });
      expect(response.status).toBe(200);
      expect(await response.json(), harness).toMatchObject({
        approved: false,
        native: { available: true, signedIn: true, supported: true, state: 'ready' },
      });
    }
  } finally {
    await server?.close();
    await app.close();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  }
  expect(existsSync(dir)).toBe(false);
});

it.skipIf(process.platform !== 'win32')('Windows global setup creates no temporary executables and leaves PATH unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya browser setup '));
  const originalPath = process.env.PATH;
  vi.stubEnv('TEMP', dir);
  try {
    const cleanup = useNativeCliStubs();
    try {
      expect(process.env.PATH).toBe(originalPath);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      cleanup();
    }
  } finally {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  }
});

it.each([
  { name: 'claude', args: ['auth', 'login'] },
  { name: 'codex', args: ['app-server', '--listen', 'stdio://'] },
])('the $name Windows launch fixture exits when it gets a non-metadata call', async ({ name, args }) => {
  const script = windowsNativeCliOptions.resolveExecutable(name);
  expect(script).toBeDefined();
  const child = windowsNativeCliOptions.launch(script!, args, { shell: false, windowsHide: true, stdio: 'ignore' });
  await expect(once(child, 'close')).resolves.toEqual([1, null]);
});
