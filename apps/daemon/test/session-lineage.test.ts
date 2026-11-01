import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { claudeContinuation } from '../../../packages/adapter-claude/src/continuation.ts';
import { startServer } from '../src/server.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (n: number, content: unknown) => ({ type: 'user', uuid: uuid(n), timestamp: '2026-01-01T00:00:00Z', message: { content } });
const assistant = (n: number, content: unknown, input = 10) => ({ type: 'assistant', uuid: uuid(n), timestamp: '2026-01-01T00:00:01Z', message: { id: `message-${n}`, content, usage: { input_tokens: input, output_tokens: 1 } } });
const boundary = (n: number, parent: number) => ({ type: 'system', subtype: 'compact_boundary', uuid: uuid(n), logicalParentUuid: uuid(parent), timestamp: '2026-01-01T00:00:02Z', compactMetadata: { trigger: 'auto', preTokens: 20 } });
const dirs: string[] = [];
function files(rows: Record<string, unknown[]>) {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-lineage-')); dirs.push(dir);
  const paths = Object.fromEntries(Object.entries(rows).map(([name, values]) => { const path = join(dir, `${name}.jsonl`); writeFileSync(path, values.map(row => JSON.stringify(row)).join('\n') + '\n'); return [name, path]; }));
  return { dir, paths, all: Object.values(paths) };
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('native lineage metadata', () => {
  it('joins only an exact unique parent; copied owners and missing sources remain explicit', async () => {
    const f = files({ parent: [user(1, 'earlier')], child: [boundary(2, 1), user(3, 'later')], unrelated: [user(4, 'earlier')] });
    expect((await claudeContinuation(f.paths.child!, f.all))?.status).toBe('linked');
    expect(await claudeContinuation(f.paths.unrelated!, f.all)).toBeUndefined();
    expect((await claudeContinuation(f.paths.child!, [f.paths.child!]))?.status).toBe('parent-missing');
    const copy = join(f.dir, 'copy.jsonl'); writeFileSync(copy, JSON.stringify(user(1, 'earlier')) + '\n');
    expect((await claudeContinuation(f.paths.child!, [...f.all, copy]))?.status).toBe('ambiguous');
    expect((await claudeContinuation(f.paths.child!, [...f.all, join(f.dir, 'unavailable.jsonl')]))?.status).toBe('ambiguous');
  });

  it('retains exact duplicate parts once and preserves differing receipt and content variants', async () => {
    const shared = assistant(2, [{ type: 'text', text: 'same' }]);
    const f = files({ parent: [user(1, 'earlier'), shared], child: [boundary(3, 2), user(1, 'earlier'), assistant(2, [{ type: 'text', text: 'same' }], 12), user(4, 'later')] });
    const app = new App(join(f.dir, 'home'));
    try {
      const imported = await app.ingest.importSource('claude-code', f.paths.child!, { lineageSources: f.all });
      const view = app.projection(imported.recordingId);
      expect(view.recordingId).toBe(imported.recordingId);
      expect(view.lineage?.recordingIds).toHaveLength(2);
      expect(view.timeline.filter(item => item.type === 'turn')).toHaveLength(2);
      expect(view.prose.filter(item => item.text === 'same')).toHaveLength(1);
      expect(view.lineage!.duplicatePartsOmitted).toBeGreaterThan(0);
      expect(view.lineage!.differingReceiptPartsRetained).toBe(1);
      expect(app.store.listRecordings()).toHaveLength(2);
      const parent = view.lineage!.recordingIds[0]!;
      expect(app.ingest.projection(parent).timeline.filter(item => item.type === 'turn')).toHaveLength(1);
      const page = await app.history.page(app.readingId(imported.recordingId), { count: 1 });
      expect(page.projection.lineage?.duplicatePartsOmitted).toBe(view.lineage!.duplicatePartsOmitted);
      expect(page.projection.recordingId).toBe(imported.recordingId);
    } finally { await app.close(); }
  });

  it('correlates a cross-file tool result only through its exact call id', async () => {
    const f = files({ parent: [user(1, 'earlier'), assistant(2, [{ type: 'tool_use', id: 'cross-call', name: 'Read', input: { file_path: '/synthetic/a.ts' } }])], child: [boundary(3, 2), user(4, [{ type: 'tool_result', tool_use_id: 'cross-call', content: 'synthetic body' }])] });
    const app = new App(join(f.dir, 'home'));
    try {
      const { recordingId } = await app.ingest.importSource('claude-code', f.paths.child!, { lineageSources: f.all });
      const view = app.projection(recordingId);
      expect(view.operations).toHaveLength(1);
      expect(view.operations[0]!.status).toBe('ok');
      expect(view.operations[0]!.observationIds).toHaveLength(2);
      expect(view.operations[0]!.id.startsWith(view.lineage!.recordingIds[0]!)).toBe(true);
    } finally { await app.close(); }
  });

  it('rejects cycles and retains independent physical selection on missing and ambiguous links', async () => {
    const f = files({ first: [boundary(1, 2)], second: [boundary(2, 1)] });
    const app = new App(join(f.dir, 'home'));
    try {
      const { recordingId } = await app.ingest.importSource('claude-code', f.paths.first!, { lineageSources: f.all });
      expect(app.readingId(recordingId)).toBe(recordingId);
      expect(app.store.lineageView(recordingId)?.links[0]?.status).toBe('ambiguous');
    } finally { await app.close(); }
  });

  it('keeps differing native content, rebuilds after ancestor append and survives restart', async () => {
    const f = files({ parent: [user(1, 'original')], child: [boundary(2, 1), user(1, 'changed native variant'), user(3, 'later')] });
    let app = new App(join(f.dir, 'home'));
    const { recordingId } = await app.ingest.importSource('claude-code', f.paths.child!, { lineageSources: f.all });
    try {
      let projection = app.projection(recordingId);
      expect(projection.timeline.filter(item => item.type === 'turn')).toHaveLength(3);
      const parent = projection.lineage!.recordingIds[0]!;
      const initial = await app.history.page(app.readingId(recordingId), { count: 1 });
      appendFileSync(f.paths.parent!, JSON.stringify(user(4, 'new ancestor evidence')) + '\n');
      await app.ingest.sync(parent);
      const changed = await app.history.page(app.readingId(recordingId), { count: 1 });
      expect(changed.scene.total).toBeGreaterThan(initial.scene.total);
      expect(changed.projection.lineage?.recordingIds).toEqual(projection.lineage!.recordingIds);
      expect(changed.projection.recordingId).toBe(recordingId);
      await app.close();
      app = new App(join(f.dir, 'home'));
      projection = app.projection(recordingId);
      expect(projection.timeline.filter(item => item.type === 'turn')).toHaveLength(4);
      expect(projection.lineage!.recordingIds).toHaveLength(2);
    } finally { await app.close(); }
  });

  it('routes historical reads through lineage without widening Workspace, observations or native control', async () => {
    const f = files({ parent: [user(1, 'earlier needle')], child: [boundary(2, 1), user(1, 'earlier needle'), user(3, 'later')] });
    const app = new App(join(f.dir, 'home'));
    const { recordingId } = await app.ingest.importSource('claude-code', f.paths.child!, { lineageSources: f.all });
    const server = await startServer({ app, port: 0 });
    try {
      const get = async (suffix: string) => { const response = await fetch(`${server.url}/v1/recordings/${recordingId}/${suffix}`, { headers: { authorization: `Bearer ${server.token}` } }); return { status: response.status, body: await response.json() as any }; };
      expect((await get('lineage')).body.lineage.recordingIds).toHaveLength(2);
      expect((await get('projection')).body.timeline.filter((item: any) => item.type === 'turn')).toHaveLength(2);
      expect((await get('search?q=needle')).body.hits).toHaveLength(1);
      const observed = (await get('observations')).body.observations;
      expect(observed.every((item: any) => item.recordingId === recordingId)).toBe(true);
      const workspace = await get('workspace');
      expect(workspace.status).toBe(200);
      expect(JSON.stringify(workspace.body)).not.toContain(app.readingId(recordingId));
      const parent = app.store.lineageView(recordingId)!.recordingIds[0]!;
      await app.forget(parent);
      expect(app.readingId(recordingId)).toBe(recordingId);
      expect(app.store.lineageView(recordingId)?.links[0]?.status).toBe('parent-missing');
    } finally { await server.close(); await app.close(); }
  });
});
