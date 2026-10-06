// Golden scenes: the composer's output at key moments of the synthetic story, committed.
// A diff here is a deliberate change to what the viewer sees — review it like UI.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { asOfProjection, compose, markers, nextMarker } from '../src/index.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let p: Projection;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-golden-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  const a = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
  const b = await ingest.importSource('codex', join(fixtures, 'codex/rollout-checkout-review.jsonl'));
  p = ingest.combinedProjection([a.recordingId, b.recordingId]);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Ids derived from absolute source paths differ per machine; name them by first appearance. */
function stable(v: unknown): unknown {
  const names = new Map<string, string>();
  // No \b: these ids also appear after an underscore ("prose_obs_…", "e_rec_…").
  const s = JSON.stringify(v, null, 2).replace(/(?<![0-9A-Za-z])(rec|obs|src)_[0-9a-f]{16,24}(?![0-9a-f])/g, (m) => {
    if (!names.has(m)) names.set(m, `${m.slice(0, 3)}#${names.size + 1}`);
    return names.get(m)!;
  });
  return JSON.parse(s);
}

describe('scene composer', () => {
  it('withholds a late result and its bytes until the result step', () => {
    const op = p.operations.find((o) => o.detail.kind === 'read' && o.detail.excerptArtifactId)!;
    const call = p.timeline.findIndex((it) => it.type === 'op-start' && it.operationId === op.id);
    const result = p.timeline.findIndex((it) => it.type === 'op-end' && it.operationId === op.id);
    expect(result).toBeGreaterThan(call);
    const midway = asOfProjection(p, call + 1);
    const pending = midway.operations.find((o) => o.id === op.id)!;
    expect(pending.status).toBe('running');
    expect(pending.artifactIds).toEqual([]);
    expect(JSON.stringify(pending.detail)).not.toContain('excerptArtifactId');
    expect(compose(p, { step: call + 1 }).passages.flatMap((ps) => ps.ops).find((o) => o.id === op.id)?.state).toBe('running');
    expect(asOfProjection(p, result + 1).operations.find((o) => o.id === op.id)?.artifactIds).toContain((op.detail as { excerptArtifactId: string }).excerptArtifactId);
  });
  it('is empty before the first step', () => {
    const s = compose(p, { step: 0 });
    expect(s.passages).toEqual([]);
    expect(s.agents.every((a) => a.state === 'waiting')).toBe(true);
  });

  it('is a pure function of its input', () => {
    for (const step of [5, 24, p.timeline.length]) expect(compose(p, { step })).toEqual(compose(structuredClone(p), { step }));
  });

  it('marks the failure, the edit and the passing rerun', () => {
    const fail = nextMarker(p, 0, 'fail')!;
    const edit = nextMarker(p, fail, 'edit')!;
    const pass = nextMarker(p, edit, 'pass')!;
    expect(fail < edit && edit < pass).toBe(true);
    const atFail = compose(p, { step: fail });
    expect(atFail.heat.find((h) => h.path === 'test/checkout.test.ts')?.tone).toBe('fail');
    const atPass = compose(p, { step: pass });
    expect(atPass.heat.find((h) => h.path === 'src/checkout/guard.ts')?.edited).toBe(true);
    expect(atPass.heat.find((h) => h.path === 'test/checkout.test.ts')?.tone).not.toBe('fail');
  });

  it('emits MCP calls from their named server', () => {
    const s = compose(p, { step: p.timeline.length });
    const mcp = s.passages.flatMap((x) => x.ops).filter((o) => o.origin.type === 'mcp');
    expect(mcp.map((o) => o.origin.type === 'mcp' && o.origin.server)).toEqual(['context7', 'github']);
    expect(s.dock.mcp.map((d) => d.server)).toEqual(['context7', 'github']);
  });

  it('follows a filter without removing other work', () => {
    const codex = p.agents.find((a) => a.harness === 'codex')!;
    const s = compose(p, { step: p.timeline.length, filter: { agentId: codex.id } });
    expect(s.passages.length).toBe(compose(p, { step: p.timeline.length }).passages.length);
    expect(s.passages.filter((x) => x.matchesFilter).every((x) => x.agentId === codex.id)).toBe(true);
  });

  it('filters native kinds and one MCP tool while keeping chronology', () => {
    const all = compose(p, { step: p.timeline.length });
    const reads = compose(p, { step: p.timeline.length, filter: { kind: 'read' } });
    expect(reads.passages.length).toBe(all.passages.length);
    expect(reads.passages.flatMap((ps) => ps.ops).filter((op) => op.matchesFilter).every((op) => op.kind === 'read')).toBe(true);
    const mcp = all.passages.flatMap((ps) => ps.ops).find((op) => op.origin.type === 'mcp')!;
    if (mcp.origin.type !== 'mcp') throw Error('missing MCP fixture');
    const oneTool = compose(p, { step: p.timeline.length, filter: { server: mcp.origin.server, tool: mcp.origin.tool } });
    expect(oneTool.passages.flatMap((ps) => ps.ops).filter((op) => op.matchesFilter).map((op) => op.id)).toContain(mcp.id);
  });

  it.each(['fail', 'edit', 'pass', 'end'] as const)('matches the golden scene at %s', async (moment) => {
    const step = moment === 'end' ? p.timeline.length : nextMarker(p, 0, moment)!;
    await expect(JSON.stringify(stable(compose(p, { step })), null, 2) + '\n').toMatchFileSnapshot(`./__golden__/scene-${moment}.json`);
  });

  it('matches the golden marker strip', async () => {
    await expect(JSON.stringify(stable(markers(p)), null, 2) + '\n').toMatchFileSnapshot('./__golden__/markers.json');
  });
});
