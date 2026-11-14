import {spawn, execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir, lstat, open, rename, rm, chmod} from 'node:fs/promises';
import {Socket} from 'node:net';
import {join} from 'node:path';
import type {Readable} from 'node:stream';
import {App} from './app.ts';
import {EmbedCodes} from './embed-auth.ts';
import {EmbedError, embedFailure, openEmbed, selection, type EmbedLaunch, type EmbedSelection} from './embed-launch.ts';
import {startServer, type RunningServer} from './server.ts';

/** Bounded newline transport. Never includes untrusted bytes in an error. */
export function jsonLines(input: Readable, limit: number, line: (value: unknown) => void, invalid: () => void): void {
  let pending = Buffer.alloc(0), failed = false;
  const reject = () => {if (!failed) {failed = true; invalid();}};
  input.on('data', (chunk: Buffer | string) => {
    if (failed) return;
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    let start = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 10) continue;
      if (pending.length + i - start > limit) return reject();
      const full = Buffer.concat([pending, bytes.subarray(start, i)]);
      pending = Buffer.alloc(0); start = i + 1;
      try {line(JSON.parse(full.toString('utf8')));} catch {return reject();}
      if (failed) return;
    }
    if (pending.length + bytes.length - start > limit) return reject();
    pending = Buffer.concat([pending, bytes.subarray(start)]);
  });
  input.on('end', () => {if (pending.length) reject();});
}

// Data enters a fixed script through an environment value, never through shell interpolation.
const windowsAcl = `
$ErrorActionPreference = 'Stop'
$p = $env:DRISHYA_EMBED_DIRECTORY
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.AddAccessRule($rule)
[System.IO.Directory]::SetAccessControl($p, $acl)
$actual = [System.IO.Directory]::GetAccessControl($p)
if (-not $actual.AreAccessRulesProtected) { throw 'ACL not protected' }
foreach ($r in $actual.Access) {
 if ($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'ACL too broad' }
}
`;
export async function discoveryEntry(home: string, port: number): Promise<() => Promise<void>> {
  const directory = join(home, 'embed-discovery');
  await mkdir(directory, {recursive: true, mode: 0o700});
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new EmbedError('DISCOVERY_UNSAFE');
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(windowsAcl, 'utf16le').toString('base64')],
      {env: {...process.env, DRISHYA_EMBED_DIRECTORY: directory}, windowsHide: true, stdio: 'ignore', timeout: 10_000});
  } else {
    if (info.uid !== process.getuid?.()) throw new EmbedError('DISCOVERY_UNSAFE');
    await chmod(directory, 0o700);
  }
  const instanceId = randomBytes(16).toString('hex');
  const path = join(directory, instanceId + '.json'), temporary = path + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try {await handle.writeFile(JSON.stringify({version: 1, pid: process.pid, port, instanceId}) + '\n');}
  finally {await handle.close();}
  try {await rename(temporary, path);} catch (e) {await rm(temporary, {force: true}); throw e;}
  return async () => {await rm(path, {force: true});};
}

export interface EmbedSupervisor {
  open(value: EmbedSelection): Promise<EmbedLaunch>;
  close(): Promise<void>;
  readonly pid: number | undefined;
}
/** Each host owns its worker; discovery files never authorize reuse of an unrelated server. */
export function embedSupervisor(entry = process.argv[1]!, env = process.env): EmbedSupervisor {
  const child = spawn(process.execPath, [entry, 'embed-worker'], {stdio: ['ignore', 'ignore', 'ignore', 'overlapped'], windowsHide: true, env});
  const channel = child.stdio[3] as Socket;
  let nextId = 0, ended = false;
  const pending = new Map<string, {resolve: (v: EmbedLaunch) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  const fail = () => {
    ended = true;
    for (const p of pending.values()) {clearTimeout(p.timer); p.reject(new EmbedError('EMBED_UNAVAILABLE'));}
    pending.clear();
  };
  const stop = () => {fail(); channel.destroy(); if (child.exitCode === null) child.kill();};
  child.on('error', fail); child.on('exit', fail); channel.on('error', fail); channel.on('close', fail);
  jsonLines(channel, 8192, value => {
    const r = value as {version?: unknown; requestId?: unknown; result?: EmbedLaunch; error?: {code?: unknown}};
    if (!r || r.version !== 1 || typeof r.requestId !== 'string') return stop();
    const p = pending.get(r.requestId); if (!p) return;
    pending.delete(r.requestId); clearTimeout(p.timer);
    if (r.error) p.reject(new EmbedError(typeof r.error.code === 'string' && /^[A-Z_]{1,64}$/.test(r.error.code) ? r.error.code : 'EMBED_UNAVAILABLE'));
    else if (validLaunch(r.result)) p.resolve(r.result!);
    else {p.reject(new EmbedError('EMBED_UNAVAILABLE')); stop();}
  }, stop);
  return {
    get pid() {return child.pid;},
    open(value) {
      selection(value);
      if (ended || pending.size >= 32) return Promise.reject(new EmbedError('EMBED_UNAVAILABLE'));
      const requestId = String(++nextId);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(stop, 60_000);
        pending.set(requestId, {resolve, reject, timer});
        channel.write(JSON.stringify({version: 1, requestId, action: 'open', ...value}) + '\n', error => {if (error) stop();});
      });
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {fail(); return;}
      const exit = new Promise<void>(resolve => child.once('exit', () => resolve()));
      channel.end();
      const timer = setTimeout(() => child.kill(), 5000);
      await exit; clearTimeout(timer); fail();
    },
  };
}
function validLaunch(value: unknown): value is EmbedLaunch {
  const v = value as EmbedLaunch | undefined;
  if (!v || v.mode !== 'top-level' || !Number.isInteger(v.port) || v.port < 1 || v.port > 65535 || typeof v.recordingId !== 'string') return false;
  try {const u = new URL(v.url); return u.origin === `http://127.0.0.1:${v.port}` && u.searchParams.get('recording') === v.recordingId && /^#launch=[A-Za-z0-9_-]{43}$/.test(u.hash);} catch {return false;}
}

/** Internal worker entry: only inherited fd 3 accepts commands. No HTTP mint endpoint. */
export async function embedWorker(): Promise<void> {
  const channel = new Socket({fd: 3, readable: true, writable: true});
  let app: App | undefined, running: RunningServer | undefined, cleanup: (() => Promise<void>) | undefined;
  const codes = new EmbedCodes();
  let work = Promise.resolve(), queued = 0, closing = false;
  const close = async () => {
    if (closing) return;
    closing = true; codes.clear();
    await work.catch(() => undefined);
    codes.clear();
    await running?.close(); await app?.close(); await cleanup?.(); channel.destroy();
  };
  channel.on('error', () => {void close();}); channel.on('end', () => {void close();}); channel.on('close', () => {void close();});
  process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
  jsonLines(channel, 8192, value => {
    const v = value as Record<string, unknown>;
    if (!v || Array.isArray(v) || v.version !== 1 || typeof v.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v.requestId)
      || v.action !== 'open' || Object.keys(v).some(k => !['version','requestId','action','sessionId','latest','cwd'].includes(k)) || queued >= 32) {
      channel.destroy(); void close(); return;
    }
    queued++;
    work = work.then(async () => {
      if (closing) return;
      try {
        const input = selection(Object.fromEntries(['sessionId','latest','cwd'].filter(k => v[k] !== undefined).map(k => [k,v[k]])));
        app ??= new App();
        if (!running) {
          running = await startServer({app, port: 0, embedCodes: codes});
          try {cleanup = await discoveryEntry(app.store.dataDir, Number(new URL(running.url).port));}
          catch (error) {await running.close(); running = undefined; throw error;}
        }
        const result = await openEmbed(app, running.url, codes, input);
        if (!closing) channel.write(JSON.stringify({version:1,requestId:v.requestId,result}) + '\n');
      } catch (error) {
        if (!closing) channel.write(JSON.stringify({version:1,requestId:v.requestId,error:embedFailure(error)}) + '\n');
      } finally {queued--;}
    });
  }, () => {channel.destroy(); void close();});
}
