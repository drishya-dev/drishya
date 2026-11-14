// SEC-3: a scratch Drishya for the security suite.
//
// Everything here is isolated from the person's real Drishya: a temporary data directory, a temporary
// HOME (so harness discovery finds nothing), an ephemeral port and no source watching. It never
// reads the real home, and it never listens on 7878.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request, type IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { App } from '../../../apps/daemon/src/app.ts';
import { startServer, type RunningServer, type ServerOptions } from '../../../apps/daemon/src/server.ts';
import { HarnessController } from '../../../apps/daemon/src/controller.ts';

export interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  text: string;
  json: any;
}

export interface CallOptions {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: string | Buffer;
  /** Send this exact Host header (fetch cannot). Default: the server's own. */
  host?: string;
  timeoutMs?: number;
}

export interface Scratch {
  dir: string;
  home: string;
  dataDir: string;
  run: RunningServer;
  port: number;
  token: string;
  /** Console output the daemon wrote while this scratch ran. */
  logs: string[];
  /** Native programs the daemon tried to start (the default scratch has none installed, and refuses to start any). */
  launches: string[];
  bearer: Record<string, string>;
  call(path: string, opts?: CallOptions): Promise<Reply>;
  /** Exchanges the launch token for a session cookie, as the page does. */
  signIn(): Promise<string>;
  close(): Promise<void>;
}

const saved = new Map<string, string | undefined>();
const HOME_VARS = ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'DRISHYA_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM'];

/** Points every home-relative lookup at an empty directory for the life of one test file. */
export function isolateHome(home: string) {
  for (const key of HOME_VARS) if (!saved.has(key)) saved.set(key, process.env[key]);
  mkdirSync(home, { recursive: true });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.APPDATA = join(home, 'AppData', 'Roaming');
  process.env.LOCALAPPDATA = join(home, 'AppData', 'Local');
  process.env.CODEX_HOME = join(home, '.codex');
  process.env.CLAUDE_CONFIG_DIR = join(home, '.claude');
  process.env.XDG_CONFIG_HOME = join(home, '.config');
  process.env.DRISHYA_HOME = join(home, '.drishya-never-used');
  // No global or system Git configuration of the person's reaches a security test.
  process.env.GIT_CONFIG_GLOBAL = join(home, 'gitconfig');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
}

export function restoreHome() {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
}

/** A temporary directory that the test may delete, and nothing else. */
export function tempDir(prefix = 'drishya-sec-'): string {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

export function removeTemp(dir: string) {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to delete outside the temp directory');
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export function rawCall(port: number, path: string, opts: CallOptions = {}): Promise<Reply> {
  return new Promise((ok, fail) => {
    const headers: Record<string, string> = { host: opts.host ?? `127.0.0.1:${port}` };
    for (const [key, value] of Object.entries(opts.headers ?? {})) if (value !== undefined) headers[key] = value;
    if (opts.body !== undefined && headers['content-length'] === undefined) headers['content-length'] = String(Buffer.byteLength(opts.body));
    const req = request({ host: '127.0.0.1', port, path, method: opts.method ?? 'GET', headers, timeout: opts.timeoutMs ?? 20_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: unknown;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        ok({ status: res.statusCode ?? 0, headers: res.headers, text, json });
      });
      res.on('error', fail);
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', fail);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export interface ScratchOptions extends Partial<ServerOptions> {
  /** Keep the daemon's own console output (default: captured). */
  quiet?: boolean;
}

export async function startScratch(opts: ScratchOptions = {}): Promise<Scratch> {
  const dir = tempDir();
  const home = join(dir, 'home');
  isolateHome(home);
  const uiDir = join(dir, 'ui');
  mkdirSync(join(uiDir, 'assets'), { recursive: true });
  writeFileSync(join(uiDir, 'index.html'), '<!doctype html><title>Synthetic UI</title>');
  writeFileSync(join(uiDir, 'assets', 'index-abcd1234.js'), '/* synthetic */');
  const dataDir = join(dir, 'data');
  const logs: string[] = [];
  const realError = console.error, realLog = console.log, realWarn = console.warn;
  const capture = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
  console.error = capture; console.log = capture; console.warn = capture;
  const launches: string[] = [];
  const app = opts.app ?? new App(dataDir);
  // The person's own claude and codex are never started by a security test.
  const controllerFactory: ServerOptions['controllerFactory'] = (a, workspace) => new HarnessController(a, workspace, {
    resolveExecutable: () => undefined,
    launch: ((bin: string, args: string[]) => { launches.push(`${bin} ${args.join(' ')}`.slice(0, 200)); throw new Error('security tests never start a native harness'); }) as never,
  });
  const run = await startServer({ port: 0, uiDir, watchRoots: [], controllerFactory, ...opts, app });
  const port = Number(new URL(run.url).port);
  const scratch: Scratch = {
    dir, home, dataDir: app.store.dataDir, run, port, token: run.token, logs, launches,
    bearer: { authorization: `Bearer ${run.token}` },
    call: (path, o) => rawCall(port, path, o),
    async signIn() {
      const res = await rawCall(port, '/v1/session', { method: 'POST', headers: { authorization: `Bearer ${run.token}`, 'content-type': 'application/json' }, body: '{}' });
      const cookie = String(res.headers['set-cookie'] ?? '').split(';')[0] ?? '';
      if (res.status !== 200 || !cookie.startsWith('drishya_session=')) throw new Error(`sign-in failed (${res.status})`);
      return cookie;
    },
    async close() {
      await run.close();
      await run.app.close();
      console.error = realError; console.log = realLog; console.warn = realWarn;
      restoreHome();
      removeTemp(dir);
    },
  };
  return scratch;
}
