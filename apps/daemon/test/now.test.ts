import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, type RunningServer } from '../src/server.ts';

// GET /v1/recordings/:id/now: the newest captured state, always from the tail of the recording.
let dir: string, app: App, id: string, server: RunningServer;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-now-'));
  app = new App(join(dir, 'store'));
  const journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
afterAll(async () => {
  await server.close(); await app.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary directory');
  rmSync(dir, { recursive: true, force: true });
});
const get = (path: string, token = true) => fetch(`${server.url}${path}`, { headers: token ? { authorization: `Bearer ${server.token}` } : {} });

it('returns bounded facts for the newest state of a recording', async () => {
  const response = await get(`/v1/recordings/${id}/now`);
  expect(response.status).toBe(200);
  const facts = await response.json() as { open: unknown[]; openCount: number; last?: { what: string }; turn: { operations: number }; agents: number };
  expect(facts.openCount).toBe(0);
  expect(facts.open).toEqual([]);
  expect(facts.last?.what).toBeTruthy();
  expect(facts.turn.operations).toBeGreaterThan(0);
  expect(facts.agents).toBeGreaterThan(0);
});

it('needs the launch credential and refuses an unknown recording', async () => {
  expect((await get(`/v1/recordings/${id}/now`, false)).status).toBe(401);
  expect((await get('/v1/recordings/rec_missing/now')).status).toBe(404);
});

it('returns one ledger per prompt for the whole recording, authenticated', async () => {
  const response = await get(`/v1/recordings/${id}/turns`);
  expect(response.status).toBe(200);
  const { turns } = await response.json() as { turns: { step: number; operations: number; edits: { files: number } }[] };
  expect(turns.length).toBeGreaterThan(0);
  expect(turns.map((turn) => turn.step)).toEqual([...turns.map((turn) => turn.step)].sort((a, b) => a - b));
  expect(turns.some((turn) => turn.edits.files > 0)).toBe(true);
  expect((await get(`/v1/recordings/${id}/turns`, false)).status).toBe(401);
  expect((await get('/v1/recordings/rec_missing/turns')).status).toBe(404);
});

it('returns the newest captured /context outputs of a recording, authenticated (USAGE-1)', async () => {
  // This fixture ran no /context, so the route answers with no candidates, never an invented report.
  const response = await get(`/v1/recordings/${id}/context-report`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ candidates: [] });
  expect((await get(`/v1/recordings/${id}/context-report`, false)).status).toBe(401);
  expect((await get('/v1/recordings/rec_missing/context-report')).status).toBe(404);
});
