import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import {mkdir, lstat, open, readFile, readdir, rename, rm, chmod} from 'node:fs/promises';
import {rmSync} from 'node:fs';
import {Socket} from 'node:net';
import {dirname, join} from 'node:path';
import type {Readable} from 'node:stream';
import {App} from './app.ts';
import {EmbedCodes} from './embed-auth.ts';
import {EmbedError, embedFailure, openEmbed, safeDetail, selection, type EmbedLaunch, type EmbedSelection} from './embed-launch.ts';
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

const run = promisify(execFile);
const system32 = (exe: string) => join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', exe);
/** A short, content-free reason for a failed ACL step: the step and an exit code or error code only. */
function stepFailure(step: string, error: unknown): EmbedError {
  const e = error as {code?: unknown; killed?: unknown; signal?: unknown};
  const why = e?.killed || e?.signal === 'SIGTERM' ? 'timeout' : typeof e?.code === 'number' ? `exit ${e.code}` : typeof e?.code === 'string' ? e.code : 'failed';
  return new EmbedError('DISCOVERY_UNSAFE', `${step}: ${why}`);
}
/** SDDL's two-letter names for well-known accounts, as icacls needs a SID to remove one. */
const SDDL_ALIASES: Record<string, string> = {
  SY: 'S-1-5-18', BA: 'S-1-5-32-544', BU: 'S-1-5-32-545', BG: 'S-1-5-32-546', PU: 'S-1-5-32-547', AU: 'S-1-5-11', WD: 'S-1-1-0',
  CO: 'S-1-3-0', CG: 'S-1-3-1', OW: 'S-1-3-4', AN: 'S-1-5-7', IU: 'S-1-5-4', NU: 'S-1-5-2', SU: 'S-1-5-6', NS: 'S-1-5-20',
  LS: 'S-1-5-19', RC: 'S-1-5-12', AC: 'S-1-15-2-1', PS: 'S-1-5-10', ED: 'S-1-5-9', RD: 'S-1-5-32-555', RU: 'S-1-5-32-554',
  NO: 'S-1-5-32-556', MU: 'S-1-5-32-558', LU: 'S-1-5-32-559', IS: 'S-1-5-32-568', CY: 'S-1-5-32-569', ER: 'S-1-5-32-573',
  HA: 'S-1-5-32-578', AA: 'S-1-5-32-579', RM: 'S-1-5-32-580', SO: 'S-1-5-32-549', PO: 'S-1-5-32-550', BO: 'S-1-5-32-551',
  RE: 'S-1-5-32-552', AO: 'S-1-5-32-548', OI: 'S-1-5-32-575', ME: 'S-1-16-8192', HI: 'S-1-16-12288', SI: 'S-1-16-16384',
  LW: 'S-1-16-4096', WR: 'S-1-5-33', AS: 'S-1-18-1', SS: 'S-1-18-2',
};
/**
 * Aliases relative to an account domain, written instead of the full SID. `LA` is the built-in Administrator (RID 500):
 * when the process runs as that account (a hosted Windows runner does), SDDL names this very user `LA`. They are resolved
 * against the user's own domain; an account in another domain then simply does not match and is removed or refused.
 */
const DOMAIN_ALIASES: Record<string, number> = {
  LA: 500, LG: 501, DA: 512, DU: 513, DG: 514, DC: 515, DD: 516, CA: 517, SA: 518, EA: 519, PA: 520, RS: 553, CN: 522, AP: 525, KA: 526, EK: 527, RO: 498,
};
/** The full SID an SDDL trustee names, or undefined for an alias we do not know (then the caller fails closed). */
function trusteeSid(trustee: string, sid: string): string | undefined {
  if (/^S-1-[0-9-]+$/.test(trustee)) return trustee;
  if (SDDL_ALIASES[trustee]) return SDDL_ALIASES[trustee];
  const rid = DOMAIN_ALIASES[trustee];
  const domain = /^(S-1-5-21-\d+-\d+-\d+)-\d+$/.exec(sid)?.[1];
  return rid !== undefined && domain ? `${domain}-${rid}` : undefined;
}
const sddlAces = (sddl: string) => {
  const dacl = /D:([A-Z]*)((?:\([^)]*\))*)/.exec(sddl);
  return dacl ? {flags: dacl[1]!, aces: [...dacl[2]!.matchAll(/\(([^)]*)\)/g)].map(m => m[1]!.split(';'))} : undefined;
};
/**
 * Whether an SDDL string's DACL is protected (no inheritance) and holds only allow entries for `sid`. Pure, for tests.
 * Returns a printable reason when it is not.
 */
export function privateDacl(sddl: string, sid: string): string | undefined {
  const dacl = sddlAces(sddl);
  if (!dacl) return 'verify: no DACL';
  if (!dacl.flags.includes('P')) return 'verify: inheritance not removed';
  const unknown = dacl.aces.map(ace => ace[5] ?? '').find(trustee => !trusteeSid(trustee, sid));
  if (unknown !== undefined) return `verify: unknown account alias ${/^[A-Z]{2}$/.test(unknown) ? unknown : '(other)'}`;
  if (!dacl.aces.length || dacl.aces.some(ace => ace[0] !== 'A' || trusteeSid(ace[5]!, sid) !== sid)) return `verify: ${dacl.aces.length} entries not only this user`;
  return undefined;
}
/**
 * The full SIDs other than `sid` named in a DACL. An unknown alias is returned as is (two capital letters), so the caller
 * refuses it rather than guess.
 */
export function otherSids(sddl: string, sid: string): string[] {
  return [...new Set((sddlAces(sddl)?.aces ?? []).map(ace => ace[5] ?? '').map(trustee => trusteeSid(trustee, sid) ?? trustee).filter(who => who !== sid))];
}
/**
 * Windows: the discovery folder is readable by the current user only. Built-in `whoami` and `icacls`, by absolute System32
 * path (a bare name would let Windows search the current folder first), with arguments as a list and no shell.
 *
 * Inheritance is removed and every entry but this user's is removed by SID. Removing inheritance alone is not enough: a
 * folder made under a parent with no inheritable entries (a hosted CI runner's temp folder) gets the process token's
 * default DACL, SYSTEM and Administrators, as explicit entries. (`icacls /restore` would replace the DACL in one step but
 * needs the restore privilege.) The result is read back as SDDL, which is not localized, and anything but one protected
 * allow entry for this user fails closed. #497 did this through PowerShell, which can take seconds to start cold and
 * whose failure reason was lost; every step here reports which one failed.
 */
async function restrictWindowsDirectory(directory: string): Promise<void> {
  const options = {windowsHide: true, timeout: 30_000, maxBuffer: 64 * 1024};
  const who = await run(system32('whoami.exe'), ['/user', '/fo', 'csv', '/nh'], options).catch(e => {throw stepFailure('whoami', e);});
  const sid = /"(S-1-[0-9-]+)"\s*$/.exec(who.stdout.trim())?.[1];
  if (!sid) throw new EmbedError('DISCOVERY_UNSAFE', 'whoami: no user SID');
  const icacls = system32('icacls.exe');
  const read = async (step: string) => {
    // icacls' /save writes the folder's SDDL in UTF-16LE. The file sits beside the folder, never inside it.
    const saved = join(dirname(directory), `.drishya-acl-${randomBytes(6).toString('hex')}.tmp`);
    try {
      await run(icacls, [directory, '/save', saved, '/q'], options).catch(e => {throw stepFailure(step, e);});
      return (await readFile(saved)).toString('utf16le');
    } finally {await rm(saved, {force: true});}
  };
  // No `/reset` first: a change propagates to existing entry files, and a reset would briefly widen them.
  await run(icacls, [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '/q'], options).catch(e => {throw stepFailure('icacls grant', e);});
  const others = otherSids(await read('icacls save'), sid);
  const unknown = others.find(other => !/^S-1-[0-9-]+$/.test(other));
  if (unknown !== undefined) throw new EmbedError('DISCOVERY_UNSAFE', `verify: unknown account alias ${/^[A-Z]{2}$/.test(unknown) ? unknown : '(other)'}`);
  if (others.length) await run(icacls, [directory, '/remove', ...others.map(other => `*${other}`), '/q'], options).catch(e => {throw stepFailure('icacls remove', e);});
  const reason = privateDacl(await read('icacls verify'), sid);
  if (reason) throw new EmbedError('DISCOVERY_UNSAFE', reason);
}
const processAlive = (pid: number) => {
  try {process.kill(pid, 0); return true;} catch (e) {return (e as {code?: string}).code === 'EPERM';}
};
/**
 * The worker entries whose process is still running. An entry whose process is gone (a worker killed without time to
 * clean up, which on Windows is every kill) is skipped and its file removed. A hint only: a live entry grants nothing.
 */
export async function liveEmbedWorkers(home: string): Promise<{pid: number; port: number; instanceId: string}[]> {
  const directory = join(home, 'embed-discovery');
  const live: {pid: number; port: number; instanceId: string}[] = [];
  for (const name of await readdir(directory).catch(() => [] as string[])) {
    if (!/^[a-f0-9]{32}\.json(\.tmp)?$/.test(name)) continue;
    const path = join(directory, name);
    try {
      const v = JSON.parse(await readFile(path, 'utf8')) as {pid?: unknown; port?: unknown; instanceId?: unknown};
      if (name.endsWith('.tmp') || !Number.isInteger(v.pid) || !Number.isInteger(v.port) || typeof v.instanceId !== 'string') throw new Error('stale');
      if (processAlive(v.pid as number)) live.push({pid: v.pid as number, port: v.port as number, instanceId: v.instanceId});
      else await rm(path, {force: true});
    } catch {
      // Unreadable or half-written: only an old one is a leftover; a fresh .tmp may be a worker mid-write.
      const old = await lstat(path).then(i => Date.now() - i.mtimeMs > 60_000, () => false);
      if (old) await rm(path, {force: true});
    }
  }
  return live;
}
export async function discoveryEntry(home: string, port: number): Promise<() => Promise<void>> {
  const directory = join(home, 'embed-discovery');
  await mkdir(directory, {recursive: true, mode: 0o700});
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new EmbedError('DISCOVERY_UNSAFE');
  if (process.platform === 'win32') {
    await restrictWindowsDirectory(directory);
  } else {
    if (info.uid !== process.getuid?.()) throw new EmbedError('DISCOVERY_UNSAFE');
    await chmod(directory, 0o700);
  }
  await liveEmbedWorkers(home);
  const instanceId = randomBytes(16).toString('hex');
  const path = join(directory, instanceId + '.json'), temporary = path + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try {await handle.writeFile(JSON.stringify({version: 1, pid: process.pid, port, instanceId}) + '\n');}
  finally {await handle.close();}
  try {await rename(temporary, path);} catch (e) {await rm(temporary, {force: true}); throw e;}
  // Every way out removes the entry: an orderly stop, a failed start, and a crash that still runs 'exit' handlers.
  // A kill that runs nothing leaves it behind; the next start or launch prunes it, as its process is gone.
  process.once('exit', () => {try {rmSync(path, {force: true});} catch { /* nothing more to do while exiting */ }});
  return async () => {await rm(path, {force: true});};
}

export interface EmbedSupervisor {
  open(value: EmbedSelection): Promise<EmbedLaunch>;
  close(): Promise<void>;
  /**
   * EMBED refined: let a detached worker outlive this launcher. Its private channel closes, so nothing can mint
   * another code on it; the code already returned stays single-use and short-lived, and the worker stops on its own
   * once no pane has been looking at it for the idle period.
   */
  release(): void;
  readonly pid: number | undefined;
}
/** Each host owns its worker; discovery files never authorize reuse of an unrelated server. */
export function embedSupervisor(entry = process.argv[1]!, env = process.env,
  options: {detached?: boolean; requestIdleMs?: number; requestMaxMs?: number} = {}): EmbedSupervisor {
  // A first import of a large journal takes minutes. The worker says it is still working every few seconds; a request is
  // abandoned only when it goes quiet for the idle period, or after the ceiling, with an error that says what happened.
  const idleMs = options.requestIdleMs ?? 60_000, maxMs = options.requestMaxMs ?? 15 * 60_000;
  const child = spawn(process.execPath, [entry, 'embed-worker', ...(options.detached ? ['--detached'] : [])],
    {stdio: ['ignore', 'ignore', 'ignore', 'overlapped'], windowsHide: true, env, detached: !!options.detached});
  const channel = child.stdio[3] as Socket;
  let nextId = 0, ended = false;
  const pending = new Map<string, {resolve: (v: EmbedLaunch) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; ceiling: ReturnType<typeof setTimeout>}>();
  const fail = () => {
    ended = true;
    for (const p of pending.values()) {clearTimeout(p.timer); clearTimeout(p.ceiling); p.reject(new EmbedError('EMBED_UNAVAILABLE'));}
    pending.clear();
  };
  const stop = () => {fail(); channel.destroy(); if (child.exitCode === null) child.kill();};
  child.on('error', fail); child.on('exit', fail); channel.on('error', fail); channel.on('close', fail);
  jsonLines(channel, 8192, value => {
    const r = value as {version?: unknown; requestId?: unknown; progress?: unknown; result?: EmbedLaunch; error?: {code?: unknown; detail?: unknown}};
    if (!r || r.version !== 1 || typeof r.requestId !== 'string') return stop();
    const p = pending.get(r.requestId); if (!p) return;
    if (r.progress === true) {clearTimeout(p.timer); p.timer = setTimeout(stop, idleMs); return;}
    pending.delete(r.requestId); clearTimeout(p.timer); clearTimeout(p.ceiling);
    if (r.error) p.reject(new EmbedError(typeof r.error.code === 'string' && /^[A-Z_]{1,64}$/.test(r.error.code) ? r.error.code : 'EMBED_UNAVAILABLE', safeDetail((r.error as {detail?: unknown}).detail)));
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
        const timer = setTimeout(stop, idleMs);
        const ceiling = setTimeout(() => {
          // Still working, only slowly: say so, and let the next try continue from what is already imported.
          const p = pending.get(requestId); if (!p) return;
          pending.delete(requestId); clearTimeout(p.timer); p.reject(new EmbedError('IMPORT_IN_PROGRESS')); stop();
        }, maxMs);
        pending.set(requestId, {resolve, reject, timer, ceiling});
        channel.write(JSON.stringify({version: 1, requestId, action: 'open', ...value}) + '\n', error => {if (error) stop();});
      });
    },
    release() {
      if (!options.detached) throw new Error('only a detached worker can be released');
      ended = true;
      for (const p of pending.values()) {clearTimeout(p.timer); clearTimeout(p.ceiling); p.reject(new EmbedError('EMBED_UNAVAILABLE'));}
      pending.clear();
      child.removeAllListeners(); channel.removeAllListeners(); channel.on('error', () => undefined);
      channel.destroy(); child.unref();
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

/** How long a detached worker waits with no pane connected before it stops (default 10 minutes). */
export function embedIdleMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.DRISHYA_EMBED_IDLE_MS);
  return Number.isInteger(n) && n >= 1000 && n <= 24 * 60 * 60 * 1000 ? n : 10 * 60 * 1000;
}

/** How often a worker with a request in flight tells its launcher it is still working. */
const embedBeatMs = () => {const n = Number(process.env.DRISHYA_EMBED_BEAT_MS); return Number.isInteger(n) && n >= 50 && n <= 30_000 ? n : 5000;};

/** Internal worker entry: only inherited fd 3 accepts commands. No HTTP mint endpoint. */
export async function embedWorker(detached = false): Promise<void> {
  const channel = new Socket({fd: 3, readable: true, writable: true});
  let app: App | undefined, running: RunningServer | undefined, cleanup: (() => Promise<void>) | undefined;
  const codes = new EmbedCodes();
  let work = Promise.resolve(), queued = 0, closing = false, channelOpen = true;
  // Windows may terminate the supervisor without delivering a pipe EOF promptly.
  // Only observe our captured parent PID; never signal or attach to another process.
  // A detached worker is meant to outlive its launcher, so it watches its viewers instead.
  const parentPid = process.ppid;
  const idleMs = embedIdleMs();
  let lastSeen = Date.now();
  const watch = setInterval(() => {
    if (!detached) {
      try {process.kill(parentPid, 0);} catch {void close();}
      return;
    }
    const activity = running?.activity();
    if (!activity) {if (!channelOpen) void close(); return;}
    if (activity.viewers > 0) lastSeen = Date.now();
    if (activity.viewers === 0 && Date.now() - Math.max(lastSeen, activity.lastRequestAt) > idleMs) void close();
  }, detached ? Math.min(15_000, Math.max(250, idleMs / 4)) : 1000);
  watch.unref();
  const close = async () => {
    if (closing) return;
    closing = true; clearInterval(watch); codes.clear();
    await work.catch(() => undefined);
    codes.clear();
    await running?.close(); await app?.close(); await cleanup?.(); channel.destroy();
    // A live tail or stray handle must not keep a stopped worker resident.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  // Losing the channel ends minting. An attached worker stops with it; a detached one keeps serving the pane it launched.
  const channelLost = () => {channelOpen = false; if (!detached) void close();};
  channel.on('error', channelLost); channel.on('end', channelLost); channel.on('close', channelLost);
  process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
  jsonLines(channel, 8192, value => {
    const v = value as Record<string, unknown>;
    if (!v || Array.isArray(v) || v.version !== 1 || typeof v.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v.requestId)
      || v.action !== 'open' || Object.keys(v).some(k => !['version','requestId','action','sessionId','nativeSessionId','latest','cwd','harness'].includes(k)) || queued >= 32) {
      channel.destroy(); if (!detached || !running) void close(); return;
    }
    queued++;
    work = work.then(async () => {
      if (closing) return;
      // Tell the launcher the import is alive, so a large first import is not mistaken for a hang.
      const beat = setInterval(() => {if (!closing && channelOpen) channel.write(JSON.stringify({version: 1, requestId: v.requestId, progress: true}) + '\n');}, embedBeatMs());
      try {
        const input = selection(Object.fromEntries(['sessionId','nativeSessionId','latest','cwd','harness'].filter(k => v[k] !== undefined).map(k => [k,v[k]])));
        app ??= new App();
        if (!running) {
          running = await startServer({app, port: 0, embedCodes: codes});
          try {cleanup = await discoveryEntry(app.store.dataDir, Number(new URL(running.url).port));}
          catch (error) {await running.close(); running = undefined; throw error;}
        }
        const result = await openEmbed(app, running.url, codes, input);
        lastSeen = Date.now();
        if (!closing && channelOpen) channel.write(JSON.stringify({version:1,requestId:v.requestId,result}) + '\n');
      } catch (error) {
        if (!closing && channelOpen) channel.write(JSON.stringify({version:1,requestId:v.requestId,error:embedFailure(error)}) + '\n');
      } finally {clearInterval(beat); queued--;}
    });
  }, () => {channel.destroy(); if (!detached || !running) void close();});
}
