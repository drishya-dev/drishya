// Exercise the actual tarball away from the workspace. Only invented fixture data enters it.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { checkPackage, foreignImports, localIdentity } from './lib/package-contents.ts';

const root = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'drishya-package-'));
const installed = join(scratch, 'installed');
const entry = join(installed, 'node_modules', '@drishya-dev', 'cli', 'apps', 'daemon', 'src', 'cli.mjs');
const env = { ...process.env, DRISHYA_HOME: join(scratch, 'data') };
const nodeDir = dirname(process.execPath);
const npmCli = [
  join(nodeDir, 'node_modules/npm/bin/npm-cli.js'),
  join(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js'),
].find(existsSync);
assert.ok(npmCli, 'npm bundled with Node is required for packed-install verification');
function command(executable: string, args: string[], cwd = root): string {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 90_000 });
  if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

let server: ReturnType<typeof spawn> | undefined;
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const stopping = server;
  await new Promise<void>((done) => {
    stopping.once('close', () => done());
    stopping.kill();
    setTimeout(done, 5_000).unref();
  });
  server = undefined;
}

async function launchServer(): Promise<{ base: string; cookie: string }> {
  server = spawn(process.execPath, [entry, 'serve', '--port', '0', '--no-open'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  server.stderr!.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  const deadline = Date.now() + 10_000;
  while (!output.includes('Open:') && Date.now() < deadline && server.exitCode === null) await new Promise((r) => setTimeout(r, 50));
  const launch = /Open:\s+(http:\/\/127\.0\.0\.1:\d+\/#token=([a-f0-9]+))/.exec(output);
  assert.ok(launch, `packed server did not start: ${output}`);
  const base = launch[1]!.split('/#')[0]!;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
  const session = await fetch(`${base}/v1/session`, { method: 'POST', headers: { authorization: `Bearer ${launch[2]}` } });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return { base, cookie };
}

async function verifyRecordings(base: string, cookie: string) {
  const recordings = await fetch(`${base}/v1/recordings`, { headers: { cookie } });
  assert.equal(recordings.status, 200);
  const body = await recordings.text();
  assert.match(body, /claude-code/);
  assert.match(body, /codex/);
  const id = JSON.parse(body).recordings[0].id;
  const history = await fetch(`${base}/v1/recordings/${id}/history`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ count: 1 }) });
  assert.equal(history.status, 200, await history.clone().text());
  assert.equal((await history.json()).loadedPassageIds.length, 1);
}

try {
  // SEC-5: what `npm pack` would publish is compared with the allowlist before anything is installed.
  const dry = JSON.parse(command(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], join(root, 'dist/package'))) as { files: { path: string }[] }[];
  const packedPaths = dry[0]!.files.map((file) => file.path);
  const contents = checkPackage(join(root, 'dist/package'), packedPaths, localIdentity(root));
  assert.deepEqual(contents, [], `package contents:\n${contents.join('\n')}`);
  for (const path of packedPaths.filter((name) => /^apps\/daemon\/src\/.+\.mjs$/.test(name))) {
    assert.deepEqual(foreignImports(readFileSync(join(root, 'dist/package', path), 'utf8')), [], `${path}: the bundled daemon imports only node: built-ins`);
  }
  const packed = JSON.parse(command(process.execPath, [npmCli, 'pack', '--json', '--pack-destination', scratch], join(root, 'dist/package'))) as { filename: string }[];
  const tarball = join(scratch, packed[0]!.filename);
  command(process.execPath, [npmCli, 'install', '--prefix', installed, tarball, '--ignore-scripts', '--offline', '--no-audit', '--no-fund']);
  const packageRoot = join(installed, 'node_modules/@drishya-dev/cli');
  for (const line of readFileSync(join(packageRoot, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
    const [, hash, name] = /^([0-9a-f]{64})  (.+)$/.exec(line)!;
    assert.equal(createHash('sha256').update(readFileSync(join(packageRoot, name!))).digest('hex'), hash, `installed checksum: ${name}`);
  }
  const help = command(process.execPath, [entry]);
  assert.match(help, /drishya serve/);
  const fixture = join(installed, 'node_modules', '@drishya-dev', 'cli', 'fixtures', 'synthetic');
  const claude = command(process.execPath, [entry, 'import', join(fixture, 'claude/checkout-fix.jsonl')]);
  const codex = command(process.execPath, [entry, 'import', join(fixture, 'codex/rollout-checkout-review.jsonl')]);
  // The fixture also retains its three captured assistant end_turn boundaries.
  assert.match(claude, /\+37 observations, 0 capture gaps/);
  // 18 records plus the one `turn.detail` DATA-3 keeps for the fixture's recorded turn.
  assert.match(codex, /\+19 observations, 0 capture gaps/);
  assert.match(command(process.execPath, [entry, 'list']), /claude-code[\s\S]*codex|codex[\s\S]*claude-code/);
  const demo = join(scratch, 'demo.json');
  command(process.execPath, [entry, 'demo-bundle', '--out', demo]);
  assert.equal(JSON.parse(readFileSync(demo, 'utf8')).recording.title, 'Free orders reach checkout');
  const first = await launchServer();
  await verifyRecordings(first.base, first.cookie);
  await stopServer();
  const second = await launchServer();
  await verifyRecordings(second.base, second.cookie);
  console.log('Packed CLI: isolated offline install, Claude/Codex import, demo bundle, authenticated API and persisted restart passed.');
} finally {
  await stopServer();
  if (!resolve(scratch).startsWith(resolve(tmpdir()) + sep)) throw new Error('test directory escaped system temp');
  rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
