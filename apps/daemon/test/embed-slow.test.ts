import {mkdtemp, mkdir, readdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect, it} from 'vitest';
import {embedSupervisor, liveEmbedWorkers} from '../src/embed-runtime.ts';

// A stand-in worker on fd 3: says "still working" every `beat` ms for `work` ms, then answers (or never does).
const worker = (beat: number, work: number, answer: boolean) => String.raw`
import {Socket} from 'node:net';
const channel = new Socket({fd: 3, readable: true, writable: true});
let buffer = '';
channel.on('data', chunk => {
  buffer += chunk;
  if (!buffer.includes('\n')) return;
  const {requestId} = JSON.parse(buffer.split('\n')[0]);
  const timer = setInterval(() => channel.write(JSON.stringify({version: 1, requestId, progress: true}) + '\n'), ${beat});
  setTimeout(() => {
    ${answer ? String.raw`clearInterval(timer); channel.write(JSON.stringify({version: 1, requestId, result: {url: 'http://127.0.0.1:4000/?embed=1&recording=rec_aaaaaaaa#launch=' + 'a'.repeat(43), port: 4000, recordingId: 'rec_aaaaaaaa', mode: 'top-level'}}) + '\n');` : ''}
  }, ${work});
});
channel.on('error', () => process.exit(0)); channel.on('close', () => process.exit(0));
setInterval(() => undefined, 1000);
`;
async function withWorker<T>(source: string, run: (entry: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'drishya-embed-slow-'));
  try {const entry = join(dir, 'worker.mjs'); await writeFile(entry, source); return await run(entry);}
  finally {await rm(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});}
}

it('a slow first import completes while the worker keeps saying it is working', async () => {
  await withWorker(worker(100, 1500, true), async entry => {
    // The quiet period is 600 ms and the import takes 1500 ms: only the progress lines keep the request alive.
    const supervisor = embedSupervisor(entry, process.env, {requestIdleMs: 600});
    try {expect(await supervisor.open({sessionId: 'rec_aaaaaaaa'})).toMatchObject({port: 4000, recordingId: 'rec_aaaaaaaa'});}
    finally {await supervisor.close();}
  });
}, 15_000);

it('a worker that goes quiet is abandoned after the quiet period', async () => {
  await withWorker(worker(10_000, 10_000, false), async entry => {
    const supervisor = embedSupervisor(entry, process.env, {requestIdleMs: 400});
    try {await expect(supervisor.open({sessionId: 'rec_aaaaaaaa'})).rejects.toMatchObject({code: 'EMBED_UNAVAILABLE'});}
    finally {await supervisor.close();}
  });
}, 15_000);

it('an import still running at the ceiling says so, so the caller can try again', async () => {
  await withWorker(worker(100, 60_000, false), async entry => {
    const supervisor = embedSupervisor(entry, process.env, {requestIdleMs: 600, requestMaxMs: 1200});
    try {await expect(supervisor.open({sessionId: 'rec_aaaaaaaa'})).rejects.toMatchObject({code: 'IMPORT_IN_PROGRESS'});}
    finally {await supervisor.close();}
  });
}, 15_000);

it('discovery skips and prunes entries whose process is gone, and keeps live ones', async () => {
  const home = await mkdtemp(join(tmpdir(), 'drishya-embed-prune-'));
  try {
    const directory = join(home, 'embed-discovery'); await mkdir(directory);
    const entry = (id: string, pid: number) => writeFile(join(directory, `${id}.json`), JSON.stringify({version: 1, pid, port: 4000, instanceId: id}));
    const dead = 'a'.repeat(32), live = 'b'.repeat(32), junk = 'c'.repeat(32);
    await entry(dead, 2 ** 22 + 12345); // far beyond any pid in use
    await entry(live, process.pid);
    await writeFile(join(directory, `${junk}.json`), 'not json');
    await writeFile(join(directory, 'unrelated.txt'), 'x');
    const found = await liveEmbedWorkers(home);
    expect(found.map(f => f.instanceId)).toEqual([live]);
    expect((await readdir(directory)).sort()).toEqual([`${live}.json`, `${junk}.json`, 'unrelated.txt'].sort()); // fresh junk is kept a minute, other files are never touched
  } finally {await rm(home, {recursive: true, force: true});}
});
