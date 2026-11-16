// LIVE-7: how long from the harness writing a journal record to Drishya painting it, per step.
// Local only, no telemetry: a scratch Drishya home, the product on its own port, a real browser with
// the page's developer probe switched on (localStorage 'drishya.liveProbe'), and an independent
// tailer that stamps every journal line the moment it is appended.
//
//   node scripts/bench-live-latency.ts --mode live  --harness claude|codex --scenario tools|plan|subagent
//   node scripts/bench-live-latency.ts --mode synthetic [--mb 150] [--steps 60] [--interval-ms 300]
//
// Needs `pnpm ui:build` first. Results go to .local/live7/ (timings, step kinds and counts only; never
// journal text). `--label before|after` names the output file. Never uses port 7878 (the person's own
// Drishya) or the person's Drishya home.
import { randomUUID } from 'node:crypto';
import { readFileSync, appendFileSync, copyFileSync, existsSync, fstatSync, mkdirSync, mkdtempSync, openSync, closeSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import type { Observation } from '@drishya/contracts';
import { App } from '../apps/daemon/src/app.ts';
import { startServer } from '../apps/daemon/src/server.ts';
import { generateLargeJournal } from './make-large-journal.ts';
import { firstReach, groupByPaint, liveLatencyResultPath, stepKind, summarizeSteps, type StepLatency } from './lib/live-latency.ts';

const arg = (name: string, fallback?: string) => { const at = process.argv.indexOf(`--${name}`); return at < 0 ? fallback : process.argv[at + 1]; };
const mode = arg('mode', 'live')!;
const harness = arg('harness', 'claude')!;
const scenario = arg('scenario', 'tools')!;
const label = arg('label', 'run')!;
const out = liveLatencyResultPath({
  label, mode, harness, scenario, source: arg('source'), mb: arg('mb'),
  stale: process.argv.includes('--stale'), resume: process.argv.includes('--resume'),
});
const headed = process.argv.includes('--headed');
const hidden = process.argv.includes('--hidden-tab');
const epoch = () => performance.timeOrigin + performance.now();
const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms));

// ── the independent journal tailer ───────────────────────────────────────────────────────────
interface Line { path: string; offset: number; appendAt: number; journalTime?: string }
class Tail {
  readonly lines: Line[] = [];
  private files = new Map<string, { fd: number; read: number; partial: Buffer }>();
  private timer: NodeJS.Timeout;
  private discover: () => string[];
  private discovered = 0;
  private existing: Set<string>;
  constructor(discover: () => string[], fromEnd = false) { this.discover = discover; this.existing = fromEnd ? new Set(discover()) : new Set(); this.timer = setInterval(() => this.poll(), 2); }
  private poll() {
    // Finding new journals walks directories, so it runs rarely; known journals are checked every 2 ms.
    if (performance.now() - this.discovered > 30) {
      this.discovered = performance.now();
      for (const path of this.discover()) if (!this.files.has(path)) { try { const fd = openSync(path, 'r'); this.files.set(path, { fd, read: this.existing.has(path) ? fstatSync(fd).size : 0, partial: Buffer.alloc(0) }); } catch { /* not readable yet */ } }
    }
    for (const [path, f] of this.files) {
      let size: number;
      try { size = fstatSync(f.fd).size; } catch { continue; }
      if (size <= f.read) continue;
      const at = epoch();
      const buf = Buffer.alloc(size - f.read);
      const got = readSync(f.fd, buf, 0, buf.length, f.read);
      const data = Buffer.concat([f.partial, buf.subarray(0, got)]);
      let start = 0;
      const base = f.read - f.partial.length;
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== 10) continue;
        let journalTime: string | undefined;
        try { const t = (JSON.parse(data.subarray(start, i).toString('utf8')) as { timestamp?: string }).timestamp; if (typeof t === 'string') journalTime = t; } catch { /* a cut line is read again whole */ }
        this.lines.push({ path, offset: base + start, appendAt: at, journalTime });
        start = i + 1;
      }
      f.partial = data.subarray(start);
      f.read += got;
    }
  }
  stop() { clearInterval(this.timer); for (const f of this.files.values()) closeSync(f.fd); }
}

function listJsonl(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listJsonl(p, out); else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// ── driving a real harness ───────────────────────────────────────────────────────────────────
const PROMPTS: Record<string, string> = {
  tools: 'In this repository: read math.ts and README.md, then add a multiply(a, b) function to math.ts, then run `git diff --stat` and tell me in one sentence what changed.',
  plan: 'Use your update_plan tool to record a three-step plan for adding subtract and divide functions to math.ts, then reply with the single word planned. Do not edit anything.',
  subagent: 'Use a sub-agent (the Task or Agent tool) to read math.ts and report its exports, then answer in one sentence.',
};

function runHarness(cwd: string, token: string, resume = false): Promise<number> {
  const prompt = resume ? `${token}: Now also add a subtract(a, b) function to math.ts, run \`git diff --stat\`, and say in one sentence what changed.` : `${token}: ${PROMPTS[scenario] ?? PROMPTS.tools}`;
  const claudeArgs = ['-p', '--model', 'haiku', '--allowedTools', 'Read', 'Edit', 'Write', 'Bash(git diff:*)', 'Task', '--permission-mode', scenario === 'plan' ? 'plan' : 'acceptEdits'];
  const codex = join(process.env.APPDATA ?? '', 'npm', 'codex.cmd');
  const child = harness === 'codex'
    ? spawn(`"${codex}"`, resume ? ['exec', 'resume', '--last', '--skip-git-repo-check', '-'] : ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-'], { cwd, shell: true, stdio: ['pipe', 'ignore', 'ignore'] })
    : spawn('claude', claudeArgs, { cwd, shell: true, stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin!.end(prompt);
  return new Promise(ok => child.on('close', code => ok(code ?? -1)));
}

// ── the run ──────────────────────────────────────────────────────────────────────────────────
mkdirSync(dirname(out), { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'drishya-live7-'));
const app = new App(join(dir, 'data'));
const server = await startServer({ app, port: 0, token: 'live7-bench', ...(arg('ui-dir') ? { uiDir: resolve(arg('ui-dir')!) } : {}) });
const browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined, headless: !headed });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await context.addInitScript(() => { localStorage.setItem('drishya.liveProbe', '1'); localStorage.setItem('drishya.mapVisible', '0'); });
const page = await context.newPage();
if (process.env.BENCH_REQUESTS) {
  // Developer aid: how long each API request the page makes takes (start to last byte), by path, so the slow neighbour of a live update shows.
  const started = new Map<unknown, number>();
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/v1/')) started.set(r, epoch()); });
  page.on('requestfinished', r => { const t = started.get(r); if (t !== undefined) console.error('REQ', Math.round(epoch() - t), new URL(r.url()).pathname.replace(/rec_[0-9a-f]+/, 'REC')); });
}
const commits: { count: number; at: number }[] = [];
app.ingest.on('change', (e: { recordingId: string; observationCount: number }) => commits.push({ count: e.observationCount, at: epoch() }));

/** Opens a recording the way Home does for a click: through its address, then waits for the viewer. Home's own list changes shape with the machine's sessions, so the bench does not depend on it. */
async function openRecordingInPage(id: string) {
  await page.evaluate((rid) => { location.hash = `#/r/${rid}`; }, id);
  await page.reload();
}

const result: Record<string, unknown> = { label, mode, harness: arg('source') ?? harness, scenario, ...(process.argv.includes('--resume') ? { resume: true } : {}) };
try {
  await page.goto(server.launchUrl);
  await page.waitForSelector('.mh-session-list, .mh-results', { timeout: 20000 });

  let journals: string[] = [];
  let token = `LIVE7${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  let tail: Tail;
  let createdAt = 0;
  let journalPath = '';
  let exit = 0;
  const wrote: { done: Promise<void> } = { done: Promise.resolve() };

  if (mode === 'live') {
    const repo = join(dir, `repo-${token.toLowerCase()}`);
    mkdirSync(repo);
    writeFileSync(join(repo, 'math.ts'), 'export function add(a: number, b: number) {\n  return a + b;\n}\n');
    writeFileSync(join(repo, 'README.md'), '# live7 throwaway\n');
    const run = (c: string[]) => new Promise<void>(ok => spawn('git', c, { cwd: repo, stdio: 'ignore' }).on('close', () => ok()));
    await run(['init', '-q']); await run(['add', '-A']); await run(['-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-qm', 'init']);
    const roots = harness === 'codex' ? [join(process.env.DRISHYA_CODEX_HOME ?? process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions')] : [join(process.env.DRISHYA_CLAUDE_HOME ?? join(homedir(), '.claude'), 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'))];
    const adapterId = harness === 'codex' ? 'codex' : 'claude-code';
    const staleMode = process.argv.includes('--stale');
    const resumeMode = process.argv.includes('--resume') || staleMode;
    let before = new Set(roots.flatMap(r => listJsonl(r)));
    let running: Promise<number>;
    if (resumeMode) {
      // A session that already exists and is open in Drishya, then the agent works in it again.
      await runHarness(repo, token);
      const made = roots.flatMap(r => listJsonl(r)).filter(p => !before.has(p));
      journalPath = made[0] ?? '';
      if (!journalPath) throw new Error('the prelude run wrote no journal');
      await app.ingest.importSource(adapterId, journalPath);
      result.preludeBytes = statSync(journalPath).size;
      if (staleMode) {
        // Imported earlier, not followed since: the agent works on while Drishya looks elsewhere, then the person opens it.
        await runHarness(repo, token, true);
        await sleep(1500);
        const finalBytes = statSync(journalPath).size;
        await page.reload();
        await page.waitForSelector('.mh-session-open');
        await sleep(1500);
        const clickAt = epoch();
        await openRecordingInPage(app.store.listRecordings()[0]!.id);
        await page.waitForSelector('.viewer', { timeout: 60_000 });
        const viewerAt = epoch();
        await sleep(6000);
        const full = app.store.countObservations([...app.store.listRecordings()][0]!.id);
        const marks = (await page.evaluate(() => window.__drishyaLiveProbe ?? [])).filter(m => m.kind === 'paint' && m.at >= clickAt);
        const firstPaint = marks[0], currentPaint = marks.find(m => (m.observationCount ?? 0) >= full);
        Object.assign(result, { stale: true, journalGrewBytes: finalBytes - (result.preludeBytes as number), observationsFinal: full, clickToViewerMs: Math.round(viewerAt - clickAt), clickToFirstPaintMs: firstPaint && Math.round(firstPaint.at - clickAt), firstPaintObservations: firstPaint?.observationCount, clickToCurrentPaintMs: currentPaint && Math.round(currentPaint.at - clickAt), paintsAfterClick: marks.map(m => ({ t: Math.round(m.at - clickAt), n: m.observationCount })) });
        throw Object.assign(new Error('stale-done'), { staleDone: true });
      }
      await page.reload();
      await openRecordingInPage(app.store.listRecordings()[0]!.id);
      await page.waitForSelector('.viewer', { timeout: 60_000 });
      await sleep(3000);
      before = new Set(roots.flatMap(r => listJsonl(r)));
      tail = new Tail(() => roots.flatMap(r => listJsonl(r)).filter(p => !before.has(p) || p === journalPath), true);
      await sleep(50);
      createdAt = epoch();
      if (process.argv.includes('--controller')) {
        // Drishya's own composer path: the daemon's controller resumes the session; the steps then arrive as journal records.
        const recId = app.store.listRecordings()[0]!.id;
        const call = (path: string, body: unknown, method = 'POST') => fetch(`${server.url}/v1/recordings/${recId}${path}`, { method, headers: { authorization: 'Bearer live7-bench', 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) });
        result.approve = (await call('/workspace/approve', {})).status;
        const sentAt = epoch();
        const started = await call('/controller/prompt', { prompt: process.argv.includes('--question') ? `${token}: Call your request_user_input tool (Codex) or AskUserQuestion tool (Claude Code) now, not plain text, to ask me exactly one question: which function should be added to math.ts, subtract or divide (two options). When I answer, add that function to math.ts and say in one sentence what you added.` : `${token}: Read math.ts and README.md, then run git log --oneline -1 and tell me in one sentence what this repository is.`, exclusive: true });
        result.controllerPostMs = Math.round(epoch() - sentAt); result.controllerStatus = started.status;
        running = (async () => { for (let i = 0; i < 240; i++) { await sleep(500); const st = await (await call('/controller', {}, 'GET')).json() as { state?: string; runId?: string; error?: unknown; approvals?: unknown[]; inputRequests?: { id: string; questions: { id: string; options: { id: string }[] }[] }[] };
          const ask = st.inputRequests?.[0];
          if (ask && result.questionAnswered === undefined) {
            // SHIP-5's end-to-end check: answer a genuine question the harness asked, from Drishya's own answer route.
            const askedAt = epoch();
            const answers = Object.fromEntries(ask.questions.map((q) => [q.id, { options: q.options.length ? [q.options[0]!.id] : [], ...(q.options.length ? {} : { text: 'subtract' }) }]));
            const res = await call('/controller/answer', { runId: st.runId, requestId: ask.id, answers });
            result.questionAnswered = res.status; result.questionCount = ask.questions.length; result.questionOptions = ask.questions.map((q) => q.options.length);
            result.questionAnswerMs = Math.round(epoch() - askedAt);
            if (res.status !== 200) result.questionAnswerError = (await res.text()).slice(0, 200);
          } if (!['connecting', 'running', 'approval'].includes(st.state ?? 'running')) { result.controllerFinal = `${st.state}${st.error ? ' ' + JSON.stringify(st.error).slice(0, 160) : ''}`; return st.state === 'failed' ? 1 : 0; } } return 2; })();
      } else running = runHarness(repo, token, true);
    } else {
      tail = new Tail(() => roots.flatMap(r => listJsonl(r)).filter(p => !before.has(p)));
      // Home must show the new session by its own polling; the scratch repo path is unique.
      // Home's own list changes shape with the machine's sessions, so this measures when discovery lists the journal (what Home's refresh asks for).
      const listed = async (path: string) => { for (let n = 0; n < 600; n++) { const found = await page.evaluate(async (want) => { const r = await fetch('/v1/sources'); const norm = (v: string) => v.split(String.fromCharCode(92)).join('/').toLowerCase(); return ((await r.json()) as { sources: { path: string }[] }).sources.some((x) => norm(x.path) === norm(want)); }, path); if (found) return epoch(); await sleep(50); } return undefined; };
      const started = epoch();
      running = runHarness(repo, token);
      // The first journal line is the moment the session exists on disk.
      while (!tail.lines.length && epoch() - started < 60_000) await sleep(5);
      createdAt = tail.lines[0]?.appendAt ?? 0;
      journalPath = tail.lines[0]?.path ?? '';
      if (process.env.BENCH_REQUESTS) console.error('PROGRESS first line', journalPath.slice(-30));
      const rowAt = await listed(journalPath);
      result.homeAppearAfterFirstWriteMs = rowAt === undefined ? null : Math.round(rowAt - createdAt);
      if (process.env.BENCH_REQUESTS) console.error('PROGRESS listed', result.homeAppearAfterFirstWriteMs);
      if (rowAt !== undefined) {
        const clickAt = epoch();
        // Opening a session Home listed: the same import request its click makes (live), then the viewer.
        const importedId = await page.evaluate(async (body) => (await (await fetch('/v1/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json() as { recordingId: string }).recordingId, { path: journalPath, adapterId, live: true });
        await openRecordingInPage(importedId);
        await page.waitForSelector('.viewer', { timeout: 60_000 }).catch(async (e) => { console.error('OPEN FAILED', (await page.locator('[role=alert], .notice, .mh-error, .error').allInnerTexts()).join(' | ').slice(0, 300)); throw e; });
        result.clickToViewerMs = Math.round(epoch() - clickAt);
      }
    }
    exit = await running;
    result.harnessExit = exit;
    await sleep(2500);
    tail.stop();
    journals = [...new Set(tail.lines.map(l => l.path))];
  } else {
    // A journal of the requested size (invented, or a copy of one real local journal chosen by its id
    // suffix), imported and opened, then appended to at a steady pace with records shaped like it.
    const mb = Number(arg('mb', '0'));
    const sourceId = arg('source');
    let adapterId = 'codex';
    let appendLines: string[] | undefined;
    if (sourceId) {
      const found = (await app.ingest.discover()).find(s => s.path.endsWith(`${sourceId}.jsonl`) || new RegExp(`${sourceId}[0-9a-f-]*[.]jsonl$`).test(s.path));
      if (!found) throw new Error(`no local journal ends with ${sourceId}`);
      adapterId = found.adapterId;
      journalPath = join(dir, found.path.split(/[\\/]/).pop()!);
      copyFileSync(found.path, journalPath);
      // The records to append: a window from the journal's last 8 MB, ids rewritten so they are new operations.
      const size = statSync(journalPath).size;
      const fd = openSync(journalPath, 'r');
      const chunk = Buffer.alloc(Math.min(size, 8 * 1024 * 1024));
      readSync(fd, chunk, 0, chunk.length, size - chunk.length); closeSync(fd);
      // Conversation records only (what an agent's steps are made of), whole lines, in their order.
      const keep = (l: string) => found.harness === 'claude-code' ? /"type":"(assistant|user)"/.test(l.slice(0, 600)) : true;
      const all = chunk.toString('utf8').split(String.fromCharCode(10)).slice(1).filter(l => l && keep(l));
      appendLines = all.slice(0, Math.max(40, Number(arg('steps', '60')) * 2));
      if (arg('pick')) {
        // Windows around the real plan / question / sub-agent calls in the whole journal, so those step kinds get samples.
        const wanted = arg('pick')!.split(',').map(k => ({ plan: '"name":"ExitPlanMode"', ask: '"name":"AskUserQuestion"', task: '"name":"Agent"' })[k]!).filter(Boolean);
        const isTurn = (l: string) => { if (!l) return false; try { const t = (JSON.parse(l) as { type?: string }).type; return t === 'assistant' || t === 'user'; } catch { return false; } };
        const whole = readFileSync(journalPath, 'utf8').split(String.fromCharCode(10)).filter(isTurn);
        const picked: string[] = [];
        for (const needle of wanted) {
          let n = 0;
          for (let i = 1; i < whole.length - 3 && n < 5; i++) if (whole[i]!.includes(needle) && whole[i]!.includes('"type":"assistant"')) { picked.push(...whole.slice(i - 1, i + 3)); n++; i += 40; }
        }
        appendLines = picked;
      }
    } else {
      journalPath = join(dir, mb ? 'rollout-large.jsonl' : 'rollout-small.jsonl');
      if (mb) generateLargeJournal(journalPath, mb);
      else writeFileSync(journalPath, JSON.stringify({ timestamp: new Date().toISOString(), type: 'session_meta', payload: { id: 'live7-small', cwd: join(dir, 'ws'), originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + String.fromCharCode(10));
    }
    const t0 = Date.now();
    const imported = await app.ingest.importSource(adapterId, journalPath);
    result.importMs = Date.now() - t0; result.journalBytes = statSync(journalPath).size; result.importedObservations = app.store.countObservations(imported.recordingId);
    app.ingest.startLive(imported.recordingId);
    await page.reload();
    const openAt = epoch();
    await openRecordingInPage(imported.recordingId);
    await page.waitForSelector('.viewer', { timeout: 180_000 });
    result.clickToViewerMs = Math.round(epoch() - openAt);
    await sleep(Number(arg('settle-ms', '6000')));
    tail = new Tail(() => [journalPath], true);
    await sleep(50);
    const cdp = process.argv.includes('--profile') ? await context.newCDPSession(page) : undefined;
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    const steps = Number(arg('steps', '60')), every = Number(arg('interval-ms', '400'));
    if (appendLines) {
      const ids = new Map<string, string>();
      const fresh = (m: string) => { let v = ids.get(m); if (!v) { v = /^[0-9a-f]{8}-/.test(m) ? randomUUID() : `${m.slice(0, Math.max(4, m.length - 6))}${Math.random().toString(36).slice(2, 8)}`; ids.set(m, v); } return v; };
      for (let i = 0; i < Math.min(steps, appendLines.length); i++) {
        const line = appendLines[i]!.replace(/toolu_[A-Za-z0-9]+|call_[A-Za-z0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, fresh).replace(/"timestamp":"[^"]+"/, `"timestamp":"${new Date().toISOString()}"`);
        appendFileSync(journalPath, line + String.fromCharCode(10));
        await sleep(i % 3 === 0 ? every : 5);
      }
    } else for (let i = 0; i < steps; i++) {
      const ts = new Date().toISOString();
      const call = `live7-${i}`;
      const lines = [
        { timestamp: ts, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: call, arguments: JSON.stringify({ cmd: `echo step-${i}` }) } },
        { timestamp: ts, type: 'response_item', payload: { type: 'function_call_output', call_id: call, output: `step-${i}` } },
        ...(i % 5 === 4 ? [{ timestamp: ts, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: `Progress note ${i}.` }] } }] : []),
      ];
      for (const l of lines) { appendFileSync(journalPath, JSON.stringify(l) + String.fromCharCode(10)); await sleep(i % 3 === 0 ? 0 : 5); }
      await sleep(every);
    }
    await sleep(4000);
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop') as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[]; samples: number[]; timeDeltas: number[] } };
      const self = new Map<number, number>();
      profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
      const byName = new Map<string, number>();
      for (const n of profile.nodes) { const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber}`; byName.set(key, (byName.get(key) ?? 0) + (self.get(n.id) ?? 0)); }
      result.profileTop = [...byName].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${Math.round(v / 1000)}ms ${k}`);
    }
    tail.stop();
    journals = [journalPath];
    createdAt = tail.lines[0]?.appendAt ?? 0;
  }

  // ── join: journal lines → observations → page marks ───────────────────────────────────────
  const recordings = app.store.listRecordings().filter(r => r.sourcePath && journals.some(j => resolve(j) === resolve(r.sourcePath!)));
  const rec = recordings[0] ?? app.store.listRecordings()[0];
  if (!rec) { console.error('NOTHING', JSON.stringify(result), 'journals', journals.length, 'lines', tail!.lines.length); throw new Error('nothing was recorded'); }
  const sourcePaths = new Map(app.store.getSources(rec.id).map(s => [s.id, s.path]));
  const lineAt = new Map(tail!.lines.map(l => [`${resolve(l.path)}#${l.offset}`, l]));
  const observations = [...app.store.orderedObservations(rec.id)] as Observation[];
  const marks = await page.evaluate(() => window.__drishyaLiveProbe ?? []);
  const forId = marks.filter(m => !m.recordingId || m.recordingId === rec.id || m.recordingId.split('+').includes(rec.id));
  const reach = (kind: string) => firstReach(forId.filter(m => m.kind === kind && m.observationCount !== undefined).map(m => ({ count: m.observationCount!, at: m.at })), observations.length);
  const committed = firstReach(commits.filter(c => true).map(c => ({ count: c.count, at: c.at })), observations.length);
  const noticeAt = reach('notice'), dataAt = reach('data'), paintAt = reach('paint');
  const steps: StepLatency[] = [];
  observations.forEach((o, i) => {
    const sourcePath = sourcePaths.get(o.source.sourceId);
    const line = sourcePath ? lineAt.get(`${resolve(sourcePath)}#${o.source.byteOffset}`) : undefined;
    if (!line) return; // not part of the live part of this run (an earlier import, a synthetic bulk)
    steps.push({ rank: i + 1, kind: stepKind({ rank: i + 1, kind: o.kind, tool: (o.payload as { tool?: string }).tool }), appendAt: line.appendAt, committedAt: committed[i], noticeAt: noticeAt[i], dataAt: dataAt[i], paintAt: paintAt[i] });
  });
  const live = steps.filter(s => s.kind !== 'other');
  {
    // Where a page reload spends its time: start to recordings answered, recordings to projection answered.
    const ordered = marks.filter(m => m.kind === 'refresh-start' || m.kind === 'recordings-done' || m.kind === 'projection-done').sort((a, b) => a.at - b.at);
    const gaps: Record<string, number[]> = { recordings: [], projection: [] };
    for (let i = 0; i + 2 < ordered.length; i++) if (ordered[i]!.kind === 'refresh-start' && ordered[i + 1]!.kind === 'recordings-done' && ordered[i + 2]!.kind === 'projection-done') { gaps.recordings!.push(ordered[i + 1]!.at - ordered[i]!.at); gaps.projection!.push(ordered[i + 2]!.at - ordered[i + 1]!.at); }
    const med = (xs: number[]) => xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!) : null;
    result.reloadStages = { n: gaps.recordings!.length, recordingsMs: med(gaps.recordings!), projectionMs: med(gaps.projection!) };
  }
  result.recording = rec.id.slice(0, 12);
  result.foldStats = (app.ingest as unknown as { foldStats?: unknown }).foldStats ?? null;
  result.journalBytes = result.journalBytes ?? statSync(journalPath).size;
  result.observations = observations.length;
  result.steps = live.length;
  result.unpainted = live.filter(s => s.paintAt === undefined).length;
  result.summary = summarizeSteps(live);
  const groups = groupByPaint(live);
  result.paintGroups = { count: groups.length, largest: Math.max(0, ...groups.map(g => g.length)), sizes: groups.map(g => g.length) };
  result.profileTop && console.log((result.profileTop as string[]).join(String.fromCharCode(10)));
  result.slowest = [...live].filter(s => s.paintAt !== undefined).sort((a, b) => (b.paintAt! - b.appendAt) - (a.paintAt! - a.appendAt)).slice(0, 8).map(s => ({ rank: s.rank, kind: s.kind, ms: Math.round(s.paintAt! - s.appendAt) }));
  if (createdAt) result.sessionFirstWriteToFirstPaintMs = live[0]?.paintAt ? Math.round(live[0].paintAt - createdAt) : null;
  result.timeline = live.map(s => ({ rank: s.rank, kind: s.kind, t: Math.round(s.appendAt - (createdAt || live[0]!.appendAt)), commit: s.committedAt && Math.round(s.committedAt - s.appendAt), notice: s.noticeAt && Math.round(s.noticeAt - s.appendAt), data: s.dataAt && Math.round(s.dataAt - s.appendAt), paint: s.paintAt && Math.round(s.paintAt - s.appendAt) }));
} catch (error) {
  if (!(error as { staleDone?: boolean }).staleDone) throw error;
} finally {
  await browser.close().catch(() => undefined);
  await server.close().catch(() => undefined);
  await app.close().catch(() => undefined);
  const target = resolve(dir);
  if (target.startsWith(resolve(tmpdir()) + sep)) rmSync(target, { recursive: true, force: true });
}
// Replace the named result without writing through an existing directory entry.
const staged = join(dirname(out), `.live7-${randomUUID()}.tmp`);
const output = openSync(staged, 'wx', 0o600);
try {
  try { writeFileSync(output, JSON.stringify(result, null, 1)); }
  finally { closeSync(output); }
  renameSync(staged, out);
} finally {
  rmSync(staged, { force: true });
}
const all = (result.summary as Record<string, Record<string, { n: number; p50?: number; p95?: number; max?: number }>>)?.all;
if (result.stale) { console.log(JSON.stringify({ out, ...result }, null, 1)); process.exit(0); }
console.log(JSON.stringify({ out, harness, scenario, steps: result.steps, unpainted: result.unpainted, homeAppearAfterFirstWriteMs: result.homeAppearAfterFirstWriteMs, clickToViewerMs: result.clickToViewerMs, paintGroups: (result.paintGroups as { count: number; largest: number }), all }, null, 1));
