// SEC-5 part 5: preloaded into the BUILT package (`node --import <this file> cli.mjs serve`) to record every
// place the process, its worker threads and anything they load try to reach: TCP connects (which http, https,
// tls and fetch all use), DNS lookups, UDP sends and started programs. One JSON line per attempt is appended to
// the file named by DRISHYA_NET_LOG. It records destinations only, never data. A test harness reads the file
// afterwards; nothing here changes what the program does.
import { appendFileSync } from 'node:fs';
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const log = process.env.DRISHYA_NET_LOG;
if (log) {
  const note = (kind, target) => {
    try { appendFileSync(log, JSON.stringify({ kind, target: String(target), thread: process.pid }) + '\n'); } catch { /* never break the program */ }
  };

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    // net.connect() hands over the already-normalised pair [options, callback]; socket.connect() the raw arguments.
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (first && typeof first === 'object') {
      note('tcp', first.path ? `ipc:${first.path}` : `${first.host ?? 'localhost'}:${first.port ?? ''}`);
    } else if (typeof first === 'number') {
      note('tcp', `${typeof args[1] === 'string' ? args[1] : 'localhost'}:${first}`);
    } else if (typeof first === 'string') {
      note('tcp', `ipc:${first}`);
    }
    return connect.apply(this, args);
  };

  const lookup = dns.lookup;
  dns.lookup = function (hostname, ...rest) { note('dns', hostname); return lookup.call(this, hostname, ...rest); };
  const promiseLookup = dns.promises.lookup;
  dns.promises.lookup = function (hostname, ...rest) { note('dns', hostname); return promiseLookup.call(this, hostname, ...rest); };
  for (const name of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'reverse']) {
    const original = dns[name];
    if (typeof original === 'function') dns[name] = function (value, ...rest) { note('dns', value); return original.call(this, value, ...rest); };
  }

  const send = dgram.Socket.prototype.send;
  dgram.Socket.prototype.send = function (...args) {
    const strings = args.filter((a) => typeof a === 'string');
    const port = args.find((a) => typeof a === 'number' && a > 0 && a < 65536);
    note('udp', `${strings.at(-1) ?? ''}:${port ?? ''}`);
    return send.apply(this, args);
  };

  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
    const original = childProcess[name];
    childProcess[name] = function (file, ...rest) { note('program', typeof file === 'string' ? file.replace(/^.*[\\/]/, '') : 'unknown'); return original.call(this, file, ...rest); };
  }
  // Named imports (`import { execFile } from 'node:child_process'`) see the patched functions only after this.
  syncBuiltinESMExports();
}
