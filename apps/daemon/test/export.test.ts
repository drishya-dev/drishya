import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundleSource } from '../../ui/src/api.ts';
import { App } from '../src/app.ts';

// Audit A03: a combined export must mask every workspace root in the selection, not only the
// first recording's, and its metadata must describe the whole selection.
const ALPHA = 'C:\\work\\alpha-repo';
const BETA = '/home/dev/beta-repo';
const GAMMA = '/srv/gamma-repo'; // beta's session changes directory part-way through

let dir: string;
let app: App;
let ids: string[];

function journal(path: string, title: string, records: { cwd: string; file: string }[]) {
  const lines = [
    { type: 'custom-title', customTitle: title, sessionId: 's' },
    ...records.flatMap((r, i) => [
      { type: 'assistant', uuid: `a${i}`, sessionId: 's', cwd: r.cwd, version: '2.1.0', timestamp: `2026-09-21T10:0${i}:00Z`, message: { content: [{ type: 'tool_use', id: `c${i}`, name: 'Read', input: { file_path: r.file } }] } },
      { type: 'user', uuid: `u${i}`, sessionId: 's', cwd: r.cwd, version: '2.1.0', timestamp: `2026-09-21T10:0${i}:30Z`, message: { content: [{ type: 'tool_result', tool_use_id: `c${i}`, content: `     1\t// lives in ${r.file}` }] } },
    ]),
  ];
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-export-'));
  app = new App(join(dir, 'data'));
  journal(join(dir, 'alpha.jsonl'), 'Alpha work', [{ cwd: ALPHA, file: `${ALPHA}\\src\\a.ts` }]);
  journal(join(dir, 'beta.jsonl'), 'Beta work', [
    { cwd: BETA, file: `${BETA}/src/b.ts` },
    { cwd: GAMMA, file: `${GAMMA}/lib/c.ts` },
  ]);
  ids = [(await app.ingest.importSource('claude-code', join(dir, 'alpha.jsonl'))).recordingId, (await app.ingest.importSource('claude-code', join(dir, 'beta.jsonl'))).recordingId];
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('combined export', () => {
  it('preserves single-recording stats but never labels a joined selection with its first stats', async () => {
    const recordingId = ids[0]!;
    const source = app.store.getSources(recordingId)[0]!;
    app.store.appendObservations(recordingId, source.id, source.cursor, [{
      id: 'synthetic-export-cost', recordingId, kind: 'usage', agentId: 'agent:main',
      source: { adapterId: 'claude-code', adapterVersion: 'test', sourceId: source.id, generation: 0, byteOffset: 100000, part: 0 },
      payload: { source: 'claude-cost-state', cumulative: true, work: { durationMs: 500, linesAdded: 7, linesRemoved: 2 } },
      observedAt: '2026-10-29T00:00:00Z', privacyPolicyVersion: 'p3', redactions: [], availability: 'complete',
    }]);
    const expected = { source: 'claude-cost-state', durationMs: 500, linesAdded: 7, linesRemoved: 2 };
    expect((await app.exportBundle(recordingId)).recording.stats).toEqual(expected);
    expect((await app.exportBundle(ids.join('+'))).recording.stats).toBeUndefined();
    expect((await app.exportBundle([...ids].reverse().join('+'))).recording.stats).toBeUndefined();
    expect(app.store.getRecording(recordingId)!.stats).toEqual(expected);
  });
  it('keeps file identities and map nodes separate across captured worktrees', async () => {
    const p = app.projection(ids.join('+'));
    expect(p.workspaceRoot).toBeUndefined();
    const paths = p.files.map((f) => f.path);
    expect(paths).toHaveLength(3);
    expect(new Set(paths.map((path) => path.split('/')[0])).size).toBe(3);
    expect(paths.every((path) => path.startsWith('worktree-'))).toBe(true);
    const graph = await app.graph(ids.join('+'));
    expect(paths.every((path) => graph.nodes.some((node) => node.path === path))).toBe(true);
  });
  it('masks every workspace root in the selection, in both slash styles', async () => {
    const out = JSON.stringify(await app.exportBundle(ids.join('+')));
    for (const root of [ALPHA, BETA, GAMMA]) {
      expect(out).not.toContain(JSON.stringify(root).slice(1, -1));
      expect(out).not.toContain(root.replace(/\\/g, '/'));
    }
    expect(out).toContain('<workspace>');
  });

  it('masks nested captured keys, preserves colliding entries, and reopens the bundle', async () => {
    const recordingId = ids[0]!;
    const source = app.store.getSources(recordingId)[0]!;
    const forward = ALPHA.replace(/\\/g, '/');
    app.store.appendObservations(recordingId, source.id, source.cursor, [{
      id: 'synthetic-export-mcp', recordingId, kind: 'tool.call', agentId: 'agent:main',
      source: { adapterId: 'claude-code', adapterVersion: 'test', sourceId: source.id, generation: 0, byteOffset: 100001, part: 0 },
      payload: {
        callId: 'keys', tool: 'mcp__audit__inspect',
        input: { nested: {
          [ALPHA]: '/local/value-a', [forward]: '/local/value-b',
          '<workspace>': 'already masked', '<workspace> (2)': 'existing suffix',
        } },
      },
      observedAt: '2026-10-29T00:00:01Z', privacyPolicyVersion: 'p3', redactions: [], availability: 'complete',
    }]);
    const bundle = await app.exportBundle(recordingId);
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(JSON.stringify(ALPHA).slice(1, -1));
    expect(serialized).not.toContain(forward);

    const replay = bundleSource(JSON.parse(serialized));
    const operation = (await replay.projection(bundle.recording.id)).operations.find((op) => op.tool === 'mcp__audit__inspect');
    expect(operation?.detail).toMatchObject({ kind: 'other', input: { nested: {
      '<workspace>': 'already masked', '<workspace> (2)': 'existing suffix',
      '<workspace> (3)': '/local/value-a', '<workspace> (4)': '/local/value-b',
    } } });
  });

  it('describes the whole selection, not just the first recording', async () => {
    const b = await app.exportBundle(ids.join('+'));
    const counts = ids.map((id) => app.store.getRecording(id)!.observationCount);
    expect(b.recording.observationCount).toBe(counts[0]! + counts[1]!);
    expect(b.recording.title).toContain('Alpha work');
    expect(b.recording.title).toContain('Beta work');
  });
});
