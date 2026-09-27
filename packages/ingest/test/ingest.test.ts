import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let ingest: Ingestor;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ingest-'));
  store = new Store(join(dir, 'data'));
  ingest = new Ingestor(store);
});
afterEach(async () => {
  await ingest.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const rnd = (n: number) => Array.from({ length: n }, (_, i) => 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY'[(i * 11 + 5) % 32]).join('');

function allStoredBytes(root: string): string {
  let s = '';
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) s += allStoredBytes(p);
    else s += readFileSync(p).toString('latin1');
  }
  return s;
}

function claudeLine(rec: Record<string, unknown>) {
  return JSON.stringify({ sessionId: 's', cwd: '/w', version: '2.1.0', timestamp: '2026-09-21T10:00:00Z', ...rec }) + '\n';
}

describe('import', () => {
  it('imports the synthetic Claude session with its subagent', async () => {
    const r = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
    const p = ingest.projection(r.recordingId);
    expect(r.gaps).toBe(0);
    expect(p.agents.map((a) => a.label)).toEqual(['Claude Code', 'Explore']);
    expect(p.agents[1]!.parentId).toBe(p.agents[0]!.id);
    expect(p.operations.filter((o) => o.kind === 'test').map((o) => o.status)).toEqual(['error', 'ok']);
    expect(p.links.some((l) => l.relation === 'test-outcome-change')).toBe(true);
    expect(store.getRecording(r.recordingId)!.title).toBe('Free orders reach checkout');
  });

  it('is idempotent: importing the same source again adds nothing', async () => {
    const path = join(fixtures, 'codex/rollout-checkout-review.jsonl');
    const a = await ingest.importSource('codex', path);
    const n = store.countObservations(a.recordingId);
    const fresh = new Ingestor(store); // a restarted process
    const b = await fresh.importSource('codex', path);
    expect(b.recordingId).toBe(a.recordingId);
    expect(b.added).toBe(0);
    expect(store.countObservations(a.recordingId)).toBe(n);
  });

  it('never persists a secret: not in SQLite, not in blobs, not in search', async () => {
    const gh = 'gh' + 'p_' + rnd(36);
    const pw = rnd(28);
    const big = 'x'.repeat(20_000) + ` sk-${'ant-'}${rnd(40)}`; // large enough to be externalised to a blob
    const file = join(dir, 'secret.jsonl');
    writeFileSync(
      file,
      claudeLine({ type: 'user', uuid: 'u1', message: { role: 'user', content: `use token ${gh} please` } }) +
        claudeLine({ type: 'assistant', uuid: 'u2', message: { content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: `DB_PASSWORD="${pw}" psql` } }] } }) +
        claudeLine({ type: 'user', uuid: 'u3', toolUseResult: { stdout: big, stderr: '' }, message: { content: [{ type: 'tool_result', tool_use_id: 'c1', content: big }] } }) +
        claudeLine({ type: 'assistant', uuid: 'u4', message: { content: [{ type: 'tool_use', id: 'c2', name: 'Read', input: { file_path: '/w/.env' } }] } }) +
        claudeLine({ type: 'user', uuid: 'u5', toolUseResult: { type: 'text', file: { filePath: '/w/.env', content: 'PLAIN_VALUE_IN_ENV=hunter2hunter2', numLines: 1, startLine: 1, totalLines: 1 } }, message: { content: [{ type: 'tool_result', tool_use_id: 'c2', content: '     1\tPLAIN_VALUE_IN_ENV=hunter2hunter2' }] } }),
    );
    const r = await ingest.importSource('claude-code', file);
    ingest.projection(r.recordingId); // projections and artifacts are persisted too
    store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const bytes = allStoredBytes(join(dir, 'data'));
    for (const secret of [gh, pw, big.slice(-40), 'hunter2hunter2']) expect(bytes).not.toContain(secret);
    expect(bytes).toContain('[REDACTED:github-token]');
    expect(store.search(r.recordingId, 'token').length).toBeGreaterThan(0);
    expect(JSON.stringify(store.search(r.recordingId, 'token'))).not.toContain(gh);
  });

  it('surfaces malformed lines as capture gaps and keeps going', async () => {
    const file = join(dir, 'bad.jsonl');
    writeFileSync(file, claudeLine({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'hi' } }) + '{broken\n' + claudeLine({ type: 'assistant', uuid: 'u2', message: { content: [{ type: 'text', text: 'hello' }] } }));
    const r = await ingest.importSource('claude-code', file);
    expect(r.gaps).toBe(1);
    const p = ingest.projection(r.recordingId);
    expect(p.gaps.map((g) => g.reason)).toContain('malformed-record');
    expect(p.prose.map((x) => x.text)).toEqual(['hello']);
  });
});

describe('live tailing', () => {
  it('picks up appended records, including a line completed across writes', async () => {
    const file = join(dir, 'live.jsonl');
    writeFileSync(file, claudeLine({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'go' } }));
    const r = await ingest.importSource('claude-code', file);
    ingest.startLive(r.recordingId, 30);
    const changes: number[] = [];
    ingest.on('change', (e) => changes.push(e.added));
    const line = claudeLine({ type: 'assistant', uuid: 'u2', message: { content: [{ type: 'text', text: 'working' }] } });
    appendFileSync(file, line.slice(0, 20));
    await new Promise((ok) => setTimeout(ok, 150));
    expect(ingest.projection(r.recordingId).prose).toHaveLength(0); // half a line is not a record
    appendFileSync(file, line.slice(20));
    await waitFor(() => ingest.projection(r.recordingId).prose.length === 1);
    expect(changes.some((n) => n > 0)).toBe(true);
    await ingest.stopLive(r.recordingId);
    expect(store.getRecording(r.recordingId)!.live).toBe(false);
    expect(statSync(file).size).toBeGreaterThan(0); // the harness file is untouched
  });
});

async function waitFor(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((ok) => setTimeout(ok, 20));
  }
}
