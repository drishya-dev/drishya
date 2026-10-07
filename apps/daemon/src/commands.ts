// drishya CLI commands. Entry point is cli.ts, which installs the warning filter first.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildGraph } from '@drishya/indexer';
import { sanitize } from '@drishya/privacy';
import { App, dataDir, VERSION } from './app.ts';
import { startServer } from './server.ts';
import { storageUsage } from './storage.ts';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

const HELP = `drishya ${VERSION} — see what your coding agents did. Observe only.

  drishya serve [--port 7878] [--no-open] [--dev]   start the local app
  drishya sources [--json]                           list Claude Code and Codex sessions on this machine
  drishya import <path> [--workspace DIR] [--live]   import one session journal (auto-detects the harness)
  drishya import --latest [claude-code|codex]        import the most recent session
  drishya list                                       list imported recordings
  drishya export <recording[+recording]> --out F     write a sanitized replay bundle
  drishya demo-bundle --out F                        build the synthetic demo bundle from fixtures/
  drishya forget <recording>                         delete a recording from the local store
  drishya storage [--json]                          show local disk usage and the 10 GiB advisory budget

Data lives in ${dataDir()} (override with DRISHYA_HOME).
Model features are off unless NEBIUS_API_KEY is set, and each call is an explicit action.`;

export async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      'no-open': { type: 'boolean' },
      dev: { type: 'boolean' },
      json: { type: 'boolean' },
      latest: { type: 'boolean' },
      live: { type: 'boolean' },
      workspace: { type: 'string' },
      out: { type: 'string' },
      adapter: { type: 'string' },
    },
  });

  switch (cmd) {
    case 'serve': {
      const running = await startServer({
        port: values.port ? Number(values.port) : undefined,
        // For scripted runs (tests, previews). Normal launches get a fresh random token.
        token: process.env.DRISHYA_TOKEN || undefined,
        devOrigins: values.dev ? ['http://127.0.0.1:5173', 'http://localhost:5173'] : [],
      });
      console.log(`\n  Drishya ${VERSION} — observing, never steering.\n`);
      console.log(`  Open:  ${running.launchUrl}`);
      if (values.dev) console.log(`  Dev UI: http://127.0.0.1:5173/#token=${running.token}  (run \`pnpm ui:dev\`)`);
      console.log(`  Data:  ${running.app.store.dataDir}\n  Model: ${process.env.NEBIUS_API_KEY ? 'Nebius Token Factory configured (explicit calls only)' : 'off (set NEBIUS_API_KEY to enable explanations)'}\n`);
      if (!values['no-open'] && !values.dev) openBrowser(running.launchUrl);
      const stop = async () => {
        await running.close();
        await running.app.close();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    }
    case 'sources': {
      const app = new App();
      const sources = await app.ingest.discover();
      if (values.json) console.log(JSON.stringify(sources, null, 2));
      else for (const s of sources.slice(0, 40)) console.log(`${s.modifiedAt.slice(0, 16).replace('T', ' ')}  ${s.harness.padEnd(11)} ${(s.bytes / 1024).toFixed(0).padStart(7)} KB  ${s.importedRecordingId ? '●' : ' '} ${s.title?.replace(/\s+/g, ' ').slice(0, 70) ?? ''}\n${' '.repeat(40)}${s.path}`);
      await app.close();
      return;
    }
    case 'import': {
      const app = new App();
      let path = positionals[0];
      let adapterId = values.adapter;
      if (values.latest) {
        const want = positionals[0];
        const src = (await app.ingest.discover()).find((s) => !want || s.adapterId === want);
        if (!src) throw new Error('no sessions found');
        path = src.path;
        adapterId = src.adapterId;
      }
      if (!path) throw new Error('usage: drishya import <path>');
      if (!adapterId) {
        const a = await app.ingest.sniff(resolve(path));
        if (!a) throw new Error('not a recognised Claude Code or Codex session journal');
        adapterId = a.descriptor.id;
      }
      const r = await app.ingest.importSource(adapterId, path);
      if (values.workspace) app.store.updateRecordingMeta(r.recordingId, { graphRoot: resolve(values.workspace) });
      const p = app.ingest.projection(r.recordingId);
      console.log(`Imported ${r.recordingId} (${adapterId}): +${r.added} observations, ${r.gaps} capture gaps.`);
      console.log(`  ${p.operations.length} operations, ${p.prose.length} prose, ${p.agents.length} agents, ${p.files.length} files — "${p.title ?? ''}"`);
      if (!values.live) {
        await app.close();
        return;
      }
      // --live keeps tailing until interrupted (audit A09: the flag used to be ignored).
      app.ingest.on('change', (e: { recordingId: string; added: number; observationCount: number }) => {
        if (e.recordingId === r.recordingId && e.added) console.log(`  +${e.added} observations (${e.observationCount} total)`);
      });
      app.ingest.on('health', (e: { recordingId: string; health: { state: string; error?: { message: string } } }) => {
        if (e.recordingId === r.recordingId) console.log(`  capture: ${e.health.state}${e.health.error ? ` — ${e.health.error.message}` : ''}`);
      });
      app.ingest.startLive(r.recordingId);
      console.log('Following. Press Ctrl+C to stop.');
      // The poll timer is unref'd so a server can exit cleanly; a bare CLI needs its own anchor.
      const keepAlive = setInterval(() => undefined, 60_000);
      const stop = async () => {
        clearInterval(keepAlive);
        await app.ingest.stopLive(r.recordingId);
        await app.close();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    }
    case 'list': {
      const app = new App();
      for (const r of app.store.listRecordings()) console.log(`${r.id}  ${r.harness.padEnd(11)} ${String(r.observationCount).padStart(6)} obs  ${r.title.slice(0, 70)}`);
      await app.close();
      return;
    }
    case 'export': {
      const id = positionals[0];
      if (!id || !values.out) throw new Error('usage: drishya export <recording> --out file.json');
      const app = new App();
      const bundle = await app.exportBundle(id);
      writeOut(values.out, bundle);
      await app.close();
      return;
    }
    case 'storage': {
      const usage = await storageUsage(dataDir());
      console.log(values.json ? JSON.stringify(usage) : `${(usage.bytes / 1024 ** 3).toFixed(2)} GiB / 10 GiB advisory budget · ${usage.files} files${usage.overBudget ? ' · budget exceeded' : ''}. Nothing is deleted automatically. Use drishya forget <recording> to remove selected recordings; SQLite free pages are reused.`);
      return;
    }
    case 'forget': {
      const app = new App();
      const r = await app.forget(positionals[0] ?? '');
      console.log(`Forgot ${positionals[0] ?? ''}; removed ${r.blobsRemoved} unshared blob files.`);
      await app.close();
      return;
    }
    case 'demo-bundle': {
      const out = values.out ?? join(repoRoot, 'apps/ui/public/demo/bundle.json');
      const bundle = await buildDemoBundle();
      writeOut(out, bundle);
      return;
    }
    default:
      console.log(HELP);
  }
}

/**
 * The synthetic demo: a Claude Code session and a Codex review of the same small repository,
 * written in each harness's real journal format, imported through the real pipeline.
 */
export async function buildDemoBundle() {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-demo-'));
  const app = new App(dir);
  try {
    const fx = join(repoRoot, 'fixtures/synthetic');
    const claude = await app.ingest.importSource('claude-code', join(fx, 'claude/checkout-fix.jsonl'));
    const codex = await app.ingest.importSource('codex', join(fx, 'codex/rollout-checkout-review.jsonl'));
    for (const r of [claude, codex]) app.store.updateRecordingMeta(r.recordingId, { graphRoot: join(fx, 'workspace/shop') });
    const bundle = await app.exportBundle(`${claude.recordingId}+${codex.recordingId}`);
    // Combined exports can omit a workspace root. This demo has one known fixture
    // workspace: index its real imports rather than manufacturing graph connections.
    bundle.graph = { ...sanitize(await buildGraph(join(fx, 'workspace/shop'))).value, root: '' };
    bundle.recording.title = 'Free orders reach checkout';
    // Fixed export time keeps the committed bundle reproducible.
    bundle.exportedAt = '2026-09-22T00:00:00.000Z';
    if (bundle.graph) {
      bundle.graph.builtAt = bundle.exportedAt;
      bundle.graph.stats.ms = 0;
      // The generation hashes file mtimes, which every checkout changes.
      bundle.graph.generation = 'synthetic-demo';
    }
    bundle.recording.createdAt = bundle.recording.updatedAt = bundle.exportedAt;
    return bundle;
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeOut(path: string, value: unknown) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
  console.log(`Wrote ${path}`);
}

function openBrowser(url: string) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // printing the link is enough
  }
}
