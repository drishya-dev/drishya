import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { defaultAdapters, Ingestor } from '../src/index.ts';

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

  // Audit A01–A02: secrets in object keys, beside a dropped base64 payload, or in envelope metadata.
  it('never persists secrets hidden in keys, base64 siblings or the branch name', async () => {
    const inKey = 'gh' + 'p_' + rnd(36);
    const inSibling = `sk-${'ant-'}${rnd(40)}`;
    const inBranch = `nv${'api-'}${rnd(40)}`;
    const file = join(dir, 'hidden.jsonl');
    writeFileSync(
      file,
      claudeLine({ type: 'assistant', uuid: 'h1', gitBranch: `feat/${inBranch}`, message: { content: [{ type: 'tool_use', id: 'c1', name: 'mcp__api__call', input: { headers: { [inKey]: 'yes' } } }] } }) +
        claudeLine({ type: 'user', uuid: 'h2', gitBranch: `feat/${inBranch}`, toolUseResult: { base64: 'iVBORw0KGgo', caption: `signed ${inSibling}` }, message: { content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok' }] } }),
    );
    const r = await ingest.importSource('claude-code', file);
    ingest.projection(r.recordingId);
    store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const bytes = allStoredBytes(join(dir, 'data'));
    for (const secret of [inKey, inSibling, inBranch]) expect(bytes).not.toContain(secret);
  });

  // Audit A02: envelope ids, versions, titles and parser error text are captured text too.
  it('never persists secrets in envelope fields, titles or parse-error text', async () => {
    const inVersion = 'gh' + 'p_' + rnd(36);
    const inCallId = `sk-${'ant-'}${rnd(40)}`;
    const inTitle = `nv${'api-'}${rnd(40)}`;
    const inBrokenLine = `sk-${'ant-'}${rnd(24)}Q${rnd(15)}`;
    const file = join(dir, 'envelope.jsonl');
    writeFileSync(
      file,
      claudeLine({ type: 'assistant', uuid: 'e1', version: inVersion, message: { content: [{ type: 'tool_use', id: inCallId, name: 'Bash', input: { command: 'ls' } }] } }) +
        claudeLine({ type: 'user', uuid: 'e2', message: { content: [{ type: 'tool_result', tool_use_id: inCallId, content: 'ok' }] } }) +
        `{"type": "user", "broken": ${inBrokenLine}}\n`,
    );
    const r = await ingest.importSource('claude-code', file, { title: `deploy with ${inTitle}` });
    const p = ingest.projection(r.recordingId);
    expect(p.operations.find((o) => o.kind === 'shell')?.status).toBe('ok'); // call and result still correlate
    expect(r.gaps).toBe(1);
    store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const bytes = allStoredBytes(join(dir, 'data'));
    for (const secret of [inVersion, inCallId, inTitle, inBrokenLine.slice(0, 10)]) expect(bytes).not.toContain(secret);
    expect(store.getRecording(r.recordingId)!.title).toContain('[REDACTED:nvidia-key]');
  });

  // B0 leftover: protected files reached through a shell or a patch, not just a Read tool.
  it('never persists protected-file content read through a shell or written by a patch', async () => {
    const plain = 'hunter3hunter3plain'; // matches no token rule: only the protected-path policy can stop it
    const claude = join(dir, 'shell-env.jsonl');
    writeFileSync(
      claude,
      claudeLine({ type: 'assistant', uuid: 'p1', message: { content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'grep DB config/.env.production' } }] } }) +
        claudeLine({ type: 'user', uuid: 'p2', toolUseResult: { stdout: `DB_PASS=${plain}`, stderr: '' }, message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: `DB_PASS=${plain}` }] } }),
    );
    const codex = join(dir, 'rollout-env.jsonl');
    const cx = (type: string, payload: Record<string, unknown>) => JSON.stringify({ timestamp: '2026-09-21T10:20:00.000Z', type, payload }) + '\n';
    writeFileSync(
      codex,
      cx('session_meta', { id: 'x', timestamp: '2026-09-21T10:20:00.000Z', cwd: '/w', originator: 'codex_cli_rs', cli_version: '0.50.0' }) +
        cx('response_item', { type: 'function_call', name: 'shell_command', arguments: JSON.stringify({ command: 'cat .env' }), call_id: 'k1' }) +
        cx('response_item', { type: 'function_call_output', call_id: 'k1', output: `Exit code: 0\nWall time: 0.1 seconds\nOutput:\nAPI=${plain}` }) +
        cx('response_item', { type: 'custom_tool_call', name: 'apply_patch', input: `*** Begin Patch\n*** Add File: .env.local\n+API=${plain}\n*** End Patch`, call_id: 'k2' }) +
        cx('response_item', { type: 'custom_tool_call_output', call_id: 'k2', output: 'Success. Updated the following files:\nA .env.local' }),
    );
    const a = await ingest.importSource('claude-code', claude);
    const b = await ingest.importSource('codex', codex);
    expect(ingest.projection(a.recordingId).operations).toHaveLength(1); // still visible, content omitted
    ingest.projection(b.recordingId);
    store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    expect(allStoredBytes(join(dir, 'data'))).not.toContain(plain);
  });

  it('sanitizes titles in the discovered-session list', async () => {
    const inTitle = 'gh' + 'p_' + rnd(36);
    const adapter = { ...defaultAdapters()[0]!, discover: async () => [{ adapterId: 'claude-code', harness: 'claude-code', path: join(dir, 'x.jsonl'), bytes: 1, modifiedAt: '2026-10-02T00:00:00Z', title: `fix ${inTitle}`, cwd: `/w/${inTitle}`, companions: [] }] };
    const listed = await new Ingestor(store, [adapter]).discover();
    expect(JSON.stringify(listed)).not.toContain(inTitle);
    expect(listed[0]!.path).toBe(join(dir, 'x.jsonl')); // the path is the import key, kept exact
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

// B0 leftover (audit A08): forgetting a recording must not race its ingest, and must reclaim the
// blobs only it referenced while keeping blobs another recording still uses.
describe('forget', () => {
  const big = (tag: string) => `${tag}\n` + 'line of captured output\n'.repeat(1200); // over the inline limit
  const journal = (name: string, outputs: string[]) => {
    const file = join(dir, name);
    writeFileSync(
      file,
      outputs
        .map((out, i) =>
          claudeLine({ type: 'assistant', uuid: `${name}-c${i}`, message: { content: [{ type: 'tool_use', id: `${name}-t${i}`, name: 'Bash', input: { command: `step ${i}` } }] } }) +
          claudeLine({ type: 'user', uuid: `${name}-r${i}`, toolUseResult: { stdout: out, stderr: '' }, message: { content: [{ type: 'tool_result', tool_use_id: `${name}-t${i}`, content: out }] } }),
        )
        .join(''),
    );
    return file;
  };
  const blobCount = () => (readdirSync(join(dir, 'data', 'blobs'), { recursive: true, withFileTypes: true }) as { isFile(): boolean }[]).filter((e) => e.isFile()).length;

  it('removes every row and reclaims only the blobs no other recording uses', async () => {
    const shared = big('shared');
    const a = await ingest.importSource('claude-code', journal('a.jsonl', [shared, big('only-a')]));
    const b = await ingest.importSource('claude-code', journal('b.jsonl', [shared]));
    ingest.projection(a.recordingId);
    ingest.projection(b.recordingId);
    const before = blobCount();
    await ingest.forget(a.recordingId);
    expect(store.getRecording(a.recordingId)).toBeUndefined();
    expect(store.countObservations(a.recordingId)).toBe(0);
    expect(store.getSources(a.recordingId)).toHaveLength(0);
    expect(store.search(a.recordingId, 'step')).toHaveLength(0);
    expect(blobCount()).toBeLessThan(before);
    expect(allStoredBytes(join(dir, 'data', 'blobs'))).not.toContain('only-a');
    expect(allStoredBytes(join(dir, 'data', 'blobs'))).toContain('shared'); // still referenced by b
    expect(ingest.projection(b.recordingId).operations).toHaveLength(1);
  });

  it('waits for an ingest in flight instead of racing it', async () => {
    const file = journal('race.jsonl', ['first']);
    const r = await ingest.importSource('claude-code', file);
    appendFileSync(file, readFileSync(journal('more.jsonl', [big('late')]), 'utf8').replaceAll('more.jsonl', 'race.jsonl'));
    const syncing = ingest.sync(r.recordingId).catch(() => undefined);
    await ingest.forget(r.recordingId);
    await syncing;
    expect(store.getRecording(r.recordingId)).toBeUndefined();
    expect(store.countObservations(r.recordingId)).toBe(0);
    expect(allStoredBytes(join(dir, 'data', 'blobs'))).not.toContain('late');
  });
});

// B0 leftover: recordings stored under an older privacy policy are flagged, not silently trusted.
describe('privacy policy of stored data', () => {
  it('flags a recording whose observations predate the current policy', async () => {
    const r = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
    expect(ingest.privacyOutdated(r.recordingId)).toBe(false);
    store.db.prepare(`UPDATE observations SET body = json_set(body, '$.privacyPolicyVersion', 'p1') WHERE recording_id = ? AND seq = 0`).run(r.recordingId);
    expect(ingest.privacyOutdated(r.recordingId)).toBe(true);
  });
});

async function waitFor(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((ok) => setTimeout(ok, 20));
  }
}
