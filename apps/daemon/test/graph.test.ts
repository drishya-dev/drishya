import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';

// B2: the repository map scans a folder only once it is approved, says when it is out of date
// instead of silently redrawing, and only rebuilds when asked.
let dir: string;
let ws: string;
let app: App;
let recId: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-graphapp-'));
  ws = join(dir, 'repo');
  mkdirSync(join(ws, 'src'), { recursive: true });
  writeFileSync(join(ws, 'src', 'a.ts'), "import { b } from './b';\nexport const a = b;\n");
  writeFileSync(join(ws, 'src', 'b.ts'), 'export const b = 1;\n');
  writeFileSync(join(ws, 'src', 'c.ts'), 'export const c = 3;\n');
  const journal = join(dir, 'session.jsonl');
  const rec = (uuid: string, extra: Record<string, unknown>) => JSON.stringify({ uuid, sessionId: 's', cwd: ws, version: '2.1.0', timestamp: '2026-10-04T10:00:00Z', ...extra });
  writeFileSync(
    journal,
    [
      rec('u1', { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: join(ws, 'src', 'a.ts') } }] } }),
      rec('u2', { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: '     1\timport { b } from "./b";' }] } }),
    ].join('\n') + '\n',
  );
  app = new App(join(dir, 'data'), { graphProbeMs: 0 });
  recId = (await app.ingest.importSource('claude-code', journal)).recordingId;
});
afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('repository map approval and freshness', () => {
  it('shows only touched files until the captured root is approved, and offers the approval', async () => {
    const g = await app.graph(recId);
    expect(g.temporal).toBe('recording-files-only');
    expect(g.approvalNeeded?.root).toBe(ws);
    expect(g.nodes.map((n) => n.path)).not.toContain('src/c.ts'); // never scanned
  });

  it('scans the root once approved', async () => {
    const g = await app.approveGraphRoot(recId);
    expect(g.temporal).toBe('current');
    expect(g.nodes.map((n) => n.path).sort()).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(g.stale).toBe(false);
  });

  it('marks the map stale after the workspace changes, without redrawing it', async () => {
    const before = await app.graph(recId);
    writeFileSync(join(ws, 'src', 'd.ts'), "import { c } from './c';\n");
    utimesSync(join(ws, 'src'), new Date(), new Date(Date.now() + 5000));
    const after = await app.graph(recId);
    expect(after.stale).toBe(true);
    expect(after.generation).toBe(before.generation); // the same layout stays put while reading
    expect(after.nodes.map((n) => n.path)).not.toContain('src/d.ts');
    const fresh = await app.graph(recId, true);
    expect(fresh.stale).toBe(false);
    expect(fresh.nodes.map((n) => n.path)).toContain('src/d.ts');
  });

  it('refuses to approve a root that is not the captured one, or a whole drive', async () => {
    await expect(app.approveGraphRoot(recId, dir)).rejects.toThrow(/captured/);
    const rootOfDrive = parse(ws).root;
    app.store.updateRecordingMeta(recId, { workspaceRoot: rootOfDrive, graphRoot: '' });
    await expect(app.approveGraphRoot(recId)).rejects.toThrow(/too broad/);
  });
});
