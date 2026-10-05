// B4: passive capture overhead. Does observing an agent slow the agent down?
//
// A synthetic "agent" runs in its own process: it does steady CPU work and appends Codex-format
// journal records, like a harness writing its rollout, and times itself. The same workload runs
// under each condition:
//   baseline          nothing observes the journal
//   observer          Drishya tails it live (passive polling, the shipped default)
//   observer+browser  as above, with a browser viewing the recording (opt-in: --browser)
// Conditions rotate order every run so machine drift does not favour one. Every observed run
// must capture exactly the observations a fresh import of the finished journal yields: no loss,
// no duplicates. The roadmap budget is under 5% median slowdown; the probe reports, not enforces.
//
// Run: node scripts/bench-overhead.ts [--runs 5] [--records 4000] [--work-ms 2] [--browser]
// --browser needs `pnpm ui:build` and Chromium (DRISHYA_BROWSER_CHANNEL=chrome for installed Chrome).
// Invented data only; every temp source and store is deleted.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { App } from '../apps/daemon/src/app.ts';
import { startServer } from '../apps/daemon/src/server.ts';

export type Condition = 'baseline' | 'observer' | 'observer+browser';

export interface OverheadOptions {
  runs: number;
  records: number;
  /** CPU work the agent does between records, in ms: the "thinking" a real agent does. */
  workMs: number;
  browser: boolean;
  /** Live poll interval for the observer; the shipped default is 750 ms. */
  intervalMs?: number;
  log?: (line: string) => void;
}

export interface RunResult {
  condition: Condition;
  run: number;
  agentMs: number;
  /** Observations Drishya captured live, and what a fresh import of the final journal yields. */
  captured?: number;
  expected?: number;
}

const self = fileURLToPath(import.meta.url);
const timestamp = '2026-10-05T10:00:00.000Z';

/** The agent: runs as its own process, prints its own elapsed wall time. */
function agent(journal: string, records: number, workMs: number) {
  const t0 = performance.now();
  let digest = Buffer.alloc(32);
  for (let i = 0; i < records; i += 2) {
    const until = performance.now() + workMs;
    while (performance.now() < until) digest = createHash('sha256').update(digest).digest(); // deterministic CPU work
    const id = `ovh-${i / 2}`;
    const lines = [
      JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'shell_command', call_id: id, arguments: JSON.stringify({ command: `echo step-${i}` }) } }),
      JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: id, output: `Exit code: 0\nWall time: 0.1 seconds\nOutput:\nstep-${i} ${digest.toString('hex', 0, 8)}` } }),
    ];
    if (i % 100 === 98) lines.push(JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `Progress after ${i + 2} records.` }] } }));
    appendFileSync(journal, lines.join('\n') + '\n');
  }
  process.stdout.write(JSON.stringify({ agentMs: performance.now() - t0 }));
}

function runAgent(journal: string, records: number, workMs: number): Promise<number> {
  return new Promise((ok, fail) => {
    const child = spawn(process.execPath, [self, '--agent', journal, String(records), String(workMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', fail);
    child.on('exit', (code) => (code === 0 ? ok((JSON.parse(out) as { agentMs: number }).agentMs) : fail(new Error(`agent exited ${code}`))));
  });
}

function journalHeader(): string {
  return JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'overhead', timestamp, cwd: '/home/dev/overhead', originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n';
}

async function runOnce(condition: Condition, run: number, opts: OverheadOptions): Promise<RunResult> {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-overhead-'));
  const journal = join(dir, 'rollout-overhead.jsonl');
  writeFileSync(journal, journalHeader());
  let app: App | undefined;
  let close: (() => Promise<void>) | undefined;
  try {
    let recordingId: string | undefined;
    if (condition !== 'baseline') {
      app = new App(join(dir, 'observer'));
      recordingId = (await app.ingest.importSource('codex', journal)).recordingId;
      app.ingest.startLive(recordingId, opts.intervalMs ?? 750);
      if (condition === 'observer+browser') {
        const { chromium } = await import('@playwright/test');
        const server = await startServer({ app, port: 0, token: 'overhead-probe' });
        const browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto(server.launchUrl);
        await page.locator('.row-main.link').first().click();
        close = async () => {
          await browser.close();
          await server.close();
        };
      }
    }
    const agentMs = await runAgent(journal, opts.records, opts.workMs);
    if (!app || !recordingId) return { condition, run, agentMs };
    await app.ingest.stopLive(recordingId); // reads the final bytes
    const captured = app.store.countObservations(recordingId);
    // What capture should have produced: a fresh import of the finished journal.
    const check = new App(join(dir, 'check'));
    try {
      const expected = check.store.countObservations((await check.ingest.importSource('codex', journal)).recordingId);
      return { condition, run, agentMs, captured, expected };
    } finally {
      await check.close();
    }
  } finally {
    if (close) await close();
    if (app) await app.close();
    const target = resolve(dir);
    if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside the temp root');
    rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface Summary {
  condition: Condition;
  medianMs: number;
  minMs: number;
  maxMs: number;
  /** Median slowdown against baseline, in percent. */
  slowdownPct: number;
  lost: number;
}

export async function measureOverhead(opts: OverheadOptions): Promise<{ results: RunResult[]; summary: Summary[] }> {
  const conditions: Condition[] = opts.browser ? ['baseline', 'observer', 'observer+browser'] : ['baseline', 'observer'];
  const results: RunResult[] = [];
  for (let run = 0; run < opts.runs; run++) {
    // Rotate the order each run so drift (thermal, caches) does not systematically favour one.
    const order = conditions.map((_, i) => conditions[(i + run) % conditions.length]!);
    for (const c of order) {
      const r = await runOnce(c, run, opts);
      results.push(r);
      opts.log?.(`run ${run + 1} ${c}: agent ${r.agentMs.toFixed(0)} ms${r.captured === undefined ? '' : `, captured ${r.captured}/${r.expected}`}`);
    }
  }
  const base = median(results.filter((r) => r.condition === 'baseline').map((r) => r.agentMs));
  const summary = conditions.map((condition) => {
    const rs = results.filter((r) => r.condition === condition);
    const ms = rs.map((r) => r.agentMs);
    return {
      condition,
      medianMs: median(ms),
      minMs: Math.min(...ms),
      maxMs: Math.max(...ms),
      slowdownPct: ((median(ms) - base) / base) * 100,
      lost: rs.reduce((n, r) => n + Math.abs((r.expected ?? 0) - (r.captured ?? 0)), 0),
    };
  });
  return { results, summary };
}

async function main() {
  const arg = (name: string, fallback: number) => {
    const at = process.argv.indexOf(`--${name}`);
    return at < 0 ? fallback : Number(process.argv[at + 1]);
  };
  const opts: OverheadOptions = { runs: arg('runs', 5), records: arg('records', 4000), workMs: arg('work-ms', 2), browser: process.argv.includes('--browser'), log: (l) => console.log(l) };
  if (![opts.runs, opts.records].every((n) => Number.isSafeInteger(n) && n > 0) || !(opts.workMs >= 0)) throw new Error('invalid workload');
  console.log(`Passive capture overhead: ${opts.runs} runs × ${opts.records} records, ${opts.workMs} ms agent work per record pair${opts.browser ? ', browser condition on' : ''}`);
  const { summary } = await measureOverhead(opts);
  console.log('\ncondition         median    min      max      slowdown  lost/dup');
  for (const s of summary) console.log(`${s.condition.padEnd(17)} ${s.medianMs.toFixed(0).padStart(6)} ms ${s.minMs.toFixed(0).padStart(6)} ${s.maxMs.toFixed(0).padStart(8)}  ${s.condition === 'baseline' ? '      —' : `${s.slowdownPct >= 0 ? '+' : ''}${s.slowdownPct.toFixed(1)}%`.padStart(7)}  ${s.condition === 'baseline' ? '—' : s.lost}`);
  const worst = Math.max(...summary.filter((s) => s.condition !== 'baseline').map((s) => s.slowdownPct));
  const lost = summary.reduce((n, s) => n + s.lost, 0);
  console.log(`\nBudget (<5% median slowdown, no lost events): ${worst < 5 && lost === 0 ? 'within budget' : 'RED'} — worst ${worst.toFixed(1)}%, ${lost} lost/duplicate`);
  if (lost) process.exitCode = 1;
}

if (process.argv[2] === '--agent') agent(process.argv[3]!, Number(process.argv[4]), Number(process.argv[5]));
else if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
