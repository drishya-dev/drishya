// TEST-3: check a feature's case on real local sessions, read-only, in one command.
//   node scripts/check-real.ts --list
//   node scripts/check-real.ts <case> [--harness claude-code|codex] [--max-mb 90] [--pick 1]
// Scans ~/.claude/projects and ~/.codex/sessions for journals containing the case, imports the best one per harness into a scratch
// Drishya home (never the real one), prints counts and 12-character recording prefixes only, then deletes the scratch home.
// Journal content is never printed. Exit status is 1 if a case reports a FAIL line.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { App } from '../apps/daemon/src/app.ts';
import {readingDelimited} from './real-cases/reading-delimited.ts';
import {questions} from './real-cases/questions.ts';
import { browserOps } from './real-cases/browser-ops.ts';
import { completeJson } from './real-cases/complete-json.ts';
import { imageOnlyPrompt } from './real-cases/image-only-prompt.ts';
import { injectedMessages } from './real-cases/injected-messages.ts';
import {worktreeRoots} from './real-cases/worktree-roots.ts';
import { literalCommit } from './real-cases/literal-commit.ts';
import { agentDeliveries } from './real-cases/agent-delivery.ts';
import { localBranches } from './real-cases/local-branches.ts';
import { planMaterial } from './real-cases/plan-material.ts';
import { turnDetails } from './real-cases/turn-details.ts';
<<<<<<< HEAD
import { sessionBranch } from './real-cases/session-branch.ts';
=======
import { toolsAvailable } from './real-cases/tools-available.ts';
>>>>>>> origin/main
import { workspaceFiles } from './real-cases/workspace-files.ts';
import { computerFrames } from './real-cases/computer-frames.ts';
import type { RealCase } from './real-cases/types.ts';

const cases: RealCase[] = [questions, imageOnlyPrompt, completeJson, browserOps, literalCommit, injectedMessages, agentDeliveries, localBranches, worktreeRoots, planMaterial, readingDelimited, turnDetails, sessionBranch, workspaceFiles, computerFrames, toolsAvailable];
const { values, positionals } = parseArgs({ args:process.argv.slice(2).filter((arg,index)=>index!==0||arg!=='--'), allowPositionals: true, options: { list: { type: 'boolean' }, harness: { type: 'string' }, 'max-mb': { type: 'string' }, pick: { type: 'string' } } });
if (values.list || !positionals.length) {
  for (const c of cases) console.log(`${c.name.padEnd(18)} ${c.harnesses.join('+').padEnd(18)} ${c.about}`);
  process.exit(values.list ? 0 : 2);
}
const chosen = cases.find((c) => c.name === positionals[0]);
if (!chosen) { console.error(`unknown case "${positionals[0]}"; try --list`); process.exit(2); }

const maxBytes = Number(values['max-mb'] ?? 90) * 1e6, pick = Number(values.pick ?? 1);
const roots = { 'claude-code': join(homedir(), '.claude', 'projects'), codex: join(homedir(), '.codex', 'sessions') } as const;
const walk = (dir: string, out: string[] = []): string[] => {
  try { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'subagents') walk(p, out); } else if (p.endsWith('.jsonl')) out.push(p); } } catch { /* a missing root is an empty one */ }
  return out;
};

const scratch = mkdtempSync(join(tmpdir(), 'drishya-real-check-'));
let failed = false;
try {
  const app = new App(scratch);
  for (const harness of chosen.harnesses) {
    if (values.harness && values.harness !== harness) continue;
    const found: { file: string; hits: number; only: number; size: number }[] = [];
    let skippedLarge = 0;
    for (const file of walk(roots[harness])) {
      const size = statSync(file).size;
      if (size > maxBytes) { skippedLarge++; continue; }
      let hits = 0, only = 0;
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.includes(typeof chosen.prefilter === 'string' ? chosen.prefilter : chosen.prefilter[harness] ?? '')) continue;
        let row: Record<string, unknown>; try { row = JSON.parse(line); } catch { continue; }
        const r = chosen.scan(row, harness);
        if (r) { hits += r.hits; only += r.only ?? 0; }
      }
      if (hits) found.push({ file, hits, only, size });
    }
    found.sort((a, b) => b.only - a.only || b.hits - a.hits || a.size - b.size);
    console.log(`${harness}: ${found.length} sessions contain "${chosen.name}" (${found.reduce((n, f) => n + f.hits, 0)} hits${found.some((f) => f.only) ? `, ${found.reduce((n, f) => n + f.only, 0)} strict` : ''}); ${skippedLarge} journals over ${values['max-mb'] ?? 90} MB skipped`);
    if (!found.length) { console.log(`  no real ${harness} session has this case. Record one (AGENTS.md, Definition of done) and rerun.`); continue; }
    for (const f of found.slice(0, pick)) {
      const imported = await app.ingest.importSource(harness, f.file);
      const projection = app.projection(imported.recordingId);
      console.log(`  ${imported.recordingId.slice(0, 12)} · ${Math.round(f.size / 1e5) / 10} MB · ${projection.operations.length} operations`);
      for (const line of chosen.verify?.(projection, { hits: f.hits, only: f.only }) ?? []) { console.log(`    ${line}`); if (line.startsWith('FAIL')) failed = true; }
    }
  }
  await app.close();
} finally {
  if (resolve(scratch).startsWith(resolve(tmpdir()) + sep)) rmSync(scratch, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
