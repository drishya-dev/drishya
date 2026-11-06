// User-run preparation only: session content is never printed or written outside .local.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { App } from '../apps/daemon/src/app.ts';

async function main() {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, out: { type: 'string' } } });
  function privatePath(value: string | undefined) {
    if (!value) throw new Error('Supply --seed and --out under .local');
    const path = resolve(value);
    if (!path.startsWith(resolve('.local') + sep)) throw new Error('Inputs must stay private under .local');
    return path;
  }
  const seed = privatePath(values.seed), out = privatePath(values.out);
  if (existsSync(out) || existsSync(out + '.review.json')) throw new Error('Prepared inputs already exist; never overwrite frozen inputs');
  const cases = JSON.parse(readFileSync(seed, 'utf8')).cases as { id: string; harness: string; genuine: boolean; journal: string; workspace: string; file: string }[];
  if (cases.length !== 2 || !cases.some(c => c.id === 'claude' && c.harness === 'claude-code') || !cases.some(c => c.id === 'codex' && c.harness === 'codex')) throw new Error('Require both genuine harness cases');
  const scratch = resolve('.local', 'ui26-input-preparation-' + Date.now()); mkdirSync(scratch, { recursive: true });
  process.env.DRISHYA_CLAUDE_HOME = resolve(scratch, 'empty-claude'); process.env.DRISHYA_CODEX_HOME = resolve(scratch, 'empty-codex');
  mkdirSync(process.env.DRISHYA_CLAUDE_HOME); mkdirSync(process.env.DRISHYA_CODEX_HOME);
  const app = new App(resolve(scratch, 'scratch-home'));
  try {
    const prepared = [], review = [];
    for (const c of cases) {
      if (!c.genuine || !isAbsolute(c.journal) || !isAbsolute(c.workspace) || !c.file) throw new Error('Provide genuine stopped native captures and frozen local workspaces');
      const imported = await app.ingest.importSource(c.harness, c.journal), p = app.projection(imported.recordingId);
      if (typeof p.workspaceRoot !== 'string' || !p.workspaceRoot || resolve(p.workspaceRoot) !== resolve(c.workspace)) throw new Error('Captured workspace is absent or differs from the seed');
      const candidates = p.operations.filter(op => {
        const d = op.detail;
        return d.kind === 'edit' && d.hunks.length > 0 || (d.kind === 'shell' || d.kind === 'test') && !!d.outputPreview || d.kind === 'read' && !!d.excerptArtifactId;
      }).slice(-12);
      const operation = candidates.at(-1)?.id;
      if (!operation) throw new Error('Capture has no meaningful expandable operation; record the missing case');
      prepared.push({ ...c, sha256: createHash('sha256').update(readFileSync(c.journal)).digest('hex'), operation });
      review.push({ id: c.id, prefix: imported.recordingId.slice(0, 12), bytes: statSync(c.journal).size, observations: p.observationCount, operations: p.operations.length, candidates: candidates.map(op => ({ id: op.id, kind: op.detail.kind })) });
      console.log(`UI26 input ${c.id}: ${imported.recordingId.slice(0, 12)}; ${statSync(c.journal).size} bytes; ${p.operations.length} operations.`);
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ cases: prepared }, null, 2), { flag: 'wx' });
    writeFileSync(out + '.review.json', JSON.stringify(review, null, 2), { flag: 'wx' });
  } finally { await app.close(); }
}
main().catch(() => { console.error('UI26 input preparation failed; check private seed paths and required cases locally. No acceptance result.'); process.exitCode = 1; });

