import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor, defaultAdapters } from '../src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';

// A dummy value that no pattern rule recognises: short, low entropy, no known prefix. Only a field name can mark it.
const DUMMY = 'hunter2-dummy';
let dir: string, store: Store, ingest: Ingestor;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-structured-')); store = new Store(join(dir, 'data')); });
afterEach(async () => { await ingest?.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });

const lines = (...rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const bytes = (root: string): string => readdirSync(root, { withFileTypes: true }).map((e) => (e.isDirectory() ? bytes(join(root, e.name)) : readFileSync(join(root, e.name)).toString('latin1'))).join('');
const stored = (id: string) => JSON.stringify(store.observations(id, -1, 1000));

/** Nothing of the dummy remains in the stored observations, the search index, the projection or any file under the data directory. */
function expectGone(id: string) {
  expect(stored(id)).not.toContain(DUMMY);
  expect(store.search(id, 'hunter2')).toHaveLength(0);
  expect(JSON.stringify(ingest.projection(id))).not.toContain(DUMMY);
  expect(bytes(join(dir, 'data'))).not.toContain(DUMMY);
  expect(stored(id)).toContain('[REDACTED:secret-field]');
}

describe('structured tool inputs with a secret-named field', () => {
  it('Claude Code: a tool_use input is redacted by field name, at any depth', async () => {
    ingest = new Ingestor(store, defaultAdapters());
    const file = join(dir, 'claude.jsonl');
    const base = { cwd: dir, sessionId: 'c0ffee00-5ec3-4000-8000-0000000000a1', version: '2.1.0', userType: 'external', isSidechain: false };
    writeFileSync(file, lines(
      { ...base, type: 'user', uuid: 'u1', timestamp: '2026-11-17T10:00:00.000Z', message: { role: 'user', content: 'call the service' } },
      { ...base, type: 'assistant', uuid: 'u2', parentUuid: 'u1', timestamp: '2026-11-17T10:00:01.000Z', message: { id: 'm1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_s1', name: 'mcp__svc__login', input: { user: 'alice', password: DUMMY, headers: { 'X-API-Key': DUMMY, accept: 'json' }, accounts: [{ clientSecret: DUMMY }, { name: 'b' }] } }] } },
      { ...base, type: 'user', uuid: 'u3', parentUuid: 'u2', timestamp: '2026-11-17T10:00:02.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_s1', content: 'ok' }] } },
    ));
    const r = await ingest.importSource('claude-code', file);
    expectGone(r.recordingId);
    expect(stored(r.recordingId)).toContain('"user":"alice"');
    expect(stored(r.recordingId)).toContain('"accept":"json"');
  });

  it('Codex: a function_call arguments string is redacted by field name, and ordinary arguments are kept', async () => {
    ingest = new Ingestor(store, defaultAdapters());
    const file = join(dir, 'rollout.jsonl');
    const item = (n: number, payload: unknown) => ({ timestamp: `2026-11-17T10:00:0${n}.000Z`, type: 'response_item', payload });
    writeFileSync(file, lines(
      { timestamp: '2026-11-17T10:00:00.000Z', type: 'session_meta', payload: { id: '0199c0de-5ec3-7000-8000-0000000000a2', timestamp: '2026-11-17T10:00:00.000Z', cwd: dir, originator: 'codex_cli_rs', cli_version: '0.50.0' } },
      item(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'sign in' }] }),
      item(2, { type: 'function_call', name: 'svc__login', arguments: JSON.stringify({ username: 'alice', password: DUMMY, options: { api_key: DUMMY, retries: 3 }, tokens: [DUMMY] }), call_id: 'call_s1' }),
      item(3, { type: 'function_call_output', call_id: 'call_s1', output: JSON.stringify({ ok: true, access_token: DUMMY }) }),
    ));
    const r = await ingest.importSource('codex', file);
    expectGone(r.recordingId);
    expect(stored(r.recordingId)).toContain('"username":"alice"');
    expect(stored(r.recordingId)).toContain('"retries":3');
  });

  it('Antigravity: a call argument and the JSON text of an MCP call are redacted by field name', async () => {
    const root = join(dir, 'ag');
    const journal = join(root, 'brain', 'conversation', '.system_generated', 'logs', 'transcript.jsonl');
    mkdirSync(join(journal, '..'), { recursive: true });
    mkdirSync(join(root, 'conversations')); writeFileSync(join(root, 'conversations', 'conversation.db'), 'Synthetic filename, never opened');
    const row = (n: number, type: string, source: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index: n, source, type, status: 'DONE', created_at: `2026-11-17T10:00:0${n}Z`, content, tool_calls: [], ...extra });
    const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, JSON.stringify(v)])) });
    writeFileSync(journal, lines(
      row(0, 'USER_INPUT', 'USER_EXPLICIT', 'sign in'),
      row(1, 'PLANNER_RESPONSE', 'MODEL', '', { tool_calls: [call('call_mcp_tool', { ServerName: 'svc', ToolName: 'login', Arguments: JSON.stringify({ username: 'alice', password: DUMMY, nested: { Authorization: DUMMY } }) })] }),
      row(2, 'GENERIC', 'MODEL', 'done'),
      row(3, 'PLANNER_RESPONSE', 'MODEL', '', { tool_calls: [call('run_command', { CommandLine: 'echo hi', Cwd: dir, ApiKey: DUMMY, Env: { DB_PASSWORD: DUMMY } })] }),
      row(4, 'RUN_COMMAND', 'MODEL', 'hi'),
    ));
    ingest = new Ingestor(store, [createAntigravityAdapter([root])]);
    const r = await ingest.importSource('antigravity', journal);
    expectGone(r.recordingId);
    expect(stored(r.recordingId)).toContain('alice');
  });
});

describe('data stored before the policy changed', () => {
  it('is scrubbed by field name when the store opens under the new policy', async () => {
    ingest = new Ingestor(store, defaultAdapters());
    const file = join(dir, 'claude.jsonl');
    writeFileSync(file, lines(
      { cwd: dir, sessionId: 'c0ffee00-5ec3-4000-8000-0000000000a3', version: '2.1.0', type: 'user', uuid: 'u1', timestamp: '2026-11-17T10:00:00.000Z', message: { role: 'user', content: 'go' } },
      { cwd: dir, sessionId: 'c0ffee00-5ec3-4000-8000-0000000000a3', version: '2.1.0', type: 'assistant', uuid: 'u2', parentUuid: 'u1', timestamp: '2026-11-17T10:00:01.000Z', message: { id: 'm1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_o1', name: 'mcp__svc__login', input: { note: 'x', password: 'placeholder-for-later' } }] } },
    ));
    const r = await ingest.importSource('claude-code', file);
    // Put an older-policy body back, as a store written before this policy would hold it.
    const row = store.db.prepare('SELECT rowid, body FROM observations WHERE recording_id = ?').all(r.recordingId) as { rowid: number; body: string }[];
    for (const o of row) store.db.prepare('UPDATE observations SET body = ? WHERE rowid = ?').run(o.body.replace('[REDACTED:secret-field]', DUMMY).replace('"privacyPolicyVersion":"p6"', '"privacyPolicyVersion":"p5"'), o.rowid);
    expect(stored(r.recordingId)).toContain(DUMMY);
    store.db.prepare("UPDATE meta SET value = 'p5' WHERE key = 'privacy_policy_version'").run();
    await ingest.close(); store.close();
    store = new Store(join(dir, 'data')); ingest = new Ingestor(store, defaultAdapters());
    expect(stored(r.recordingId)).not.toContain(DUMMY);
    expect(stored(r.recordingId)).toContain('[REDACTED:secret-field]');
    expect(store.search(r.recordingId, 'hunter2')).toHaveLength(0);
  });
});
