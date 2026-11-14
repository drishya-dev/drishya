// SEC-3 item 1: network exposure. The daemon listens on loopback only, on one port.
import { spawn } from 'node:child_process';
import { connect, Server } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../../apps/daemon/src/server.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startScratch, tempDir, removeTemp, type Scratch } from './lib/scratch.ts';

let s: Scratch;
beforeAll(async () => { s = await startScratch(); });
afterAll(async () => { await s.close(); });

/** Resolves 'accepted' if a TCP connection opens, otherwise the error code. */
const tryConnect = (host: string, port: number): Promise<string> => new Promise((done) => {
  const socket = connect({ host, port, timeout: 3000 });
  socket.once('connect', () => { socket.destroy(); done('accepted'); });
  socket.once('timeout', () => { socket.destroy(); done('timeout'); });
  socket.once('error', (error: NodeJS.ErrnoException) => done(error.code ?? 'error'));
});

describe('listening address', () => {
  it('is bound to 127.0.0.1 only', () => {
    const address = s.run.server.address();
    expect(address).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  });

  it('is the only listening socket this process opened', () => {
    // Node exposes its active handles; a second `net.Server` would be a second open port.
    const handles = (process as unknown as { _getActiveHandles(): unknown[] })._getActiveHandles();
    const listening = handles.filter((h): h is Server => h instanceof Server && h.listening);
    expect(listening).toHaveLength(1);
    expect(listening[0]).toBe(s.run.server);
  });

  it('does not answer on another loopback address, IPv6, or any LAN address', async () => {
    expect(await tryConnect('127.0.0.1', s.port)).toBe('accepted');
    // Bound to one address, not the wildcard: neither the rest of 127/8 nor ::1 reaches it.
    expect(await tryConnect('::1', s.port)).not.toBe('accepted');
    expect(await tryConnect('127.0.0.2', s.port)).not.toBe('accepted');
    const lan = Object.values(networkInterfaces()).flat().filter((i) => i && !i.internal && i.family === 'IPv4').map((i) => i!.address);
    for (const address of lan) expect(await tryConnect(address, s.port), `LAN address ${address.replace(/\d+$/, 'x')}`).not.toBe('accepted');
    if (!lan.length) console.info('no LAN address on this machine: LAN refusal not exercised');
  });
});

describe('--host and the bind address', () => {
  const quiet = () => new App(join(tempDir(), 'data'));
  for (const host of ['0.0.0.0', '::', '192.168.1.10', '10.0.0.1', 'example.com', '127.0.0.2', '*', '']) {
    it(`startServer refuses host ${JSON.stringify(host)}`, async () => {
      const app = quiet();
      try { await expect(startServer({ app, port: 0, host, watchRoots: [] })).rejects.toThrow(/loopback/i); }
      finally { await app.close(); }
    });
  }

  it('the command line has no way to choose another host: --host is rejected and nothing listens', async () => {
    const dir = tempDir();
    const cli = fileURLToPath(new URL('../../apps/daemon/src/cli.ts', import.meta.url));
    const child = spawn(process.execPath, [cli, 'serve', '--host', '0.0.0.0', '--port', '0', '--no-open'], {
      env: { ...process.env, DRISHYA_HOME: join(dir, 'home'), HOME: dir, USERPROFILE: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    const code = await new Promise<number | null>((done) => { child.once('exit', done); setTimeout(() => { child.kill(); done(null); }, 20_000).unref(); });
    removeTemp(dir);
    expect(code).not.toBe(0);
    expect(code).not.toBeNull();
    expect(out).not.toContain('Open:');
  });
});
