import {mapActivityCase} from './real-cases/map-activity.ts';
import { antigravityNativeCases } from './real-cases/antigravity-native.ts';
import { storageClearAcceptance } from './real-cases/storage-clear.ts';
import { liveBatches } from './real-cases/live-batches.ts';
import { personPrompts } from './real-cases/person-prompts.ts';
import { midTurnPrompts } from './real-cases/mid-turn-prompts.ts';
import { antigravity } from './real-cases/antigravity.ts';
import { antigravityMedia } from './real-cases/antigravity-media.ts';
import { antigravityLive } from './real-cases/antigravity-live.ts';
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
import { sourceIdFor } from '../packages/capture-core/src/index.ts';
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
import { sessionBranch } from './real-cases/session-branch.ts';
import { mainRootAliases } from './real-cases/main-root-aliases.ts';
import { toolsAvailable } from './real-cases/tools-available.ts';
import { workspaceFiles } from './real-cases/workspace-files.ts';
import { computerFrames } from './real-cases/computer-frames.ts';
import { compaction, resetCompactionScan } from './real-cases/compaction.ts';
import { contentParity } from './real-cases/content-parity.ts';
import { sessionLineage, resetSessionLineageScan } from './real-cases/session-lineage.ts';
import { midTurnInput } from './real-cases/mid-turn-input.ts';
import {multiImagePrompts} from './real-cases/multi-image-prompts.ts';
import {proseFileReferences} from './real-cases/prose-file-references.ts';
import type { RealCase } from './real-cases/types.ts';
import {desktopPrompts} from './real-cases/desktop-prompts.ts';
import {markdownTables} from './real-cases/markdown-tables.ts';
import { usageContext } from './real-cases/usage-context.ts';
import {fullProse} from './real-cases/full-prose.ts';
import {linkProse} from './real-cases/link-prose.ts';
import {blobDiffLines} from './real-cases/blob-diff-lines.ts';
import {longDiffLines} from './real-cases/long-diff-lines.ts';
import {widePassages} from './real-cases/wide-passages.ts';
import {redaction} from './real-cases/redaction.ts';
import { claudeCheckpoints } from './real-cases/claude-checkpoints.ts';



const cases: RealCase[] = [mapActivityCase,redaction, fullProse, liveBatches, personPrompts, midTurnPrompts, proseFileReferences, multiImagePrompts, questions, imageOnlyPrompt, completeJson, browserOps, literalCommit, injectedMessages, agentDeliveries, localBranches, worktreeRoots, planMaterial, readingDelimited, turnDetails, sessionBranch, workspaceFiles, computerFrames, toolsAvailable, contentParity, mainRootAliases, compaction, sessionLineage, midTurnInput, desktopPrompts, markdownTables, blobDiffLines, longDiffLines, widePassages, usageContext, linkProse, claudeCheckpoints];
const { values, positionals } = parseArgs({ args:process.argv.slice(2).filter((arg,index)=>index!==0||arg!=='--'), allowPositionals: true, options: { list: { type: 'boolean' }, harness: { type: 'string' }, 'max-mb': { type: 'string' }, pick: { type: 'string' } } });
cases.push(antigravity);
cases.push(antigravityLive);
cases.push(antigravityMedia);
cases.push(...antigravityNativeCases);
if (values.list || !positionals.length) {
  console.log('storage-clear      claude-code+codex  genuine Settings clear/preserve/reimport at 600 and 1440 px (build UI first)');
  for (const c of cases) console.log(`${c.name.padEnd(18)} ${c.harnesses.join('+').padEnd(18)} ${c.about}`);
  process.exit(values.list ? 0 : 2);
}
if (positionals[0] === 'storage-clear') { await storageClearAcceptance(); process.exit(0); }
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
    const files = harness === 'antigravity' ? (await app.ingest.discover('antigravity')).map(source => source.path) : walk(roots[harness]);
    for (const file of files) {
      const size = statSync(file).size;
      if (size > maxBytes) { skippedLarge++; continue; }
      chosen.reset?.();
      if (chosen === compaction) resetCompactionScan();
      if (chosen === sessionLineage) resetSessionLineageScan();
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
      if (harness === 'antigravity') {
        const observations = app.store.observations(imported.recordingId);
        const receipts = new Set(observations.filter(o => o.kind === 'checkpoint' && typeof (o.payload as { stepIndex?: unknown }).stepIndex === 'number').map(o => o.source.recordId));
        if (chosen.name === 'antigravity') {
          // A session Antigravity is still writing can grow between the scan and the import: more receipts than scanned is then correct.
          const grew = statSync(f.file).size > f.size;
          const ok = grew ? receipts.size >= f.hits : receipts.size === f.hits;
          console.log(`  ${ok ? 'PASS' : 'FAIL'} distinct step receipts: ${receipts.size}/${f.hits}${grew ? ' (journal grew while checking)' : ''}`);
          if (!ok) failed = true;
        }
        const finalResults = new Set(observations.filter(o => o.kind === 'tool.result' && (o.payload as { status?: string }).status !== 'running').map(o => o.operationId));
        const gaps = new Set(observations.filter(o => o.kind === 'capture.gap').map(o => o.operationId));
        const missing = observations.filter(o => o.kind === 'tool.call' && !finalResults.has(o.operationId) && !gaps.has(o.operationId)).length;
        const unknown = observations.filter(o => o.kind === 'unknown').length;
        console.log(`  ${missing || unknown ? 'FAIL' : 'PASS'} unaccounted calls: ${missing}; unknown records: ${unknown}`);
        if (missing || unknown) failed = true;
      }
      const projection = app.projection(imported.recordingId);
      console.log(`  ${imported.recordingId.slice(0, 12)} · ${Math.round(f.size / 1e5) / 10} MB · ${projection.operations.length} operations`);
      for (const line of chosen.verify?.(projection, { hits: f.hits, only: f.only, sourceId: sourceIdFor(resolve(f.file)) }) ?? []) { console.log(`    ${line}`); if (line.startsWith('FAIL')) failed = true; }
    }
  }
  await app.close();
} finally {
  if (resolve(scratch).startsWith(resolve(tmpdir()) + sep)) rmSync(scratch, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
