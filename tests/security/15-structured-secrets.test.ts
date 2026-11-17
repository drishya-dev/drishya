// SEC-4b: a secret in a structured field. A tool input is an object, not text: `{ "password": "…" }` carries its secret in a
// value that no pattern rule recognises, and only the field name says what it is. One dummy value is placed under secret-named
// keys of every shape (nested, in arrays, in JSON text) in a journal for each adapter, imported and synced live, and then
// searched for in the store directory, every API response, the export and the offline bundle. The value is invented.
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractRoutes } from './lib/routes.ts';
import { startScratch, type Scratch } from './lib/scratch.ts';

const DUMMY = 'hunter2-structured-dummy';
const enc = encodeURIComponent;
const at = (n: number) => `2026-09-21T10:00:${String(n).padStart(2, '0')}.000Z`;
const lines = (rows: unknown[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const leaks = (haystack: string | Buffer, label: string) => {
  const text = typeof haystack === 'string' ? haystack : haystack.toString('latin1');
  return text.includes(DUMMY) || text.includes(JSON.stringify(DUMMY).slice(1, -1)) ? [`${label}: …${text.slice(Math.max(0, text.indexOf(DUMMY) - 40), text.indexOf(DUMMY) + 40).replace(/\s+/g, ' ')}`] : [];
};

const structured = () => ({
  username: 'alice',
  password: DUMMY,
  headers: { 'X-API-Key': DUMMY, Accept: 'application/json' },
  accounts: [{ clientSecret: DUMMY }, { name: 'second' }],
  options: { retries: 3, db: { passwd: DUMMY } },
  tokens: [DUMMY],
});

const claudeJournal = (cwd: string) => {
  const base = (n: number, parent: number | null, type: 'user' | 'assistant', message: unknown) => ({ cwd, sessionId: 'c0ffee00-5ec3-4000-8000-0000000000b1', version: '2.1.0', userType: 'external', isSidechain: false, parentUuid: parent === null ? null : `u${parent}`, type, message, uuid: `u${n}`, timestamp: at(n) });
  const tool = (n: number, id: string, name: string, input: unknown) => base(n, n - 1, 'assistant', { id: `msg_${n}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
  const result = (n: number, id: string, content: string) => base(n, n - 1, 'user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] });
  return [
    base(1, null, 'user', { role: 'user', content: 'sign in to the service' }),
    tool(2, 'toolu_s1', 'mcp__svc__login', structured()),
    result(3, 'toolu_s1', JSON.stringify({ ok: true, access_token: DUMMY, user: 'alice' })),
    tool(4, 'toolu_s2', 'mcp__svc__call', { body: JSON.stringify(structured()) }),
    result(5, 'toolu_s2', 'ok'),
    base(6, 5, 'assistant', { id: 'msg_6', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' }),
  ];
};

const codexJournal = (cwd: string) => {
  const item = (n: number, payload: unknown) => ({ timestamp: at(n), type: 'response_item', payload });
  return [
    { timestamp: at(0), type: 'session_meta', payload: { id: '0199c0de-5ec3-7000-8000-0000000000b2', timestamp: at(0), cwd, originator: 'codex_cli_rs', cli_version: '0.50.0' } },
    { timestamp: at(0), type: 'event_msg', payload: { type: 'task_started', turn_id: 'turn-1' } },
    item(1, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'sign in to the service' }] }),
    item(2, { type: 'function_call', name: 'svc__login', arguments: JSON.stringify(structured()), call_id: 'call_s1' }),
    item(3, { type: 'function_call_output', call_id: 'call_s1', output: JSON.stringify({ ok: true, access_token: DUMMY, user: 'alice' }) }),
    item(4, { type: 'function_call', name: 'svc__call', arguments: JSON.stringify({ body: JSON.stringify(structured()) }), call_id: 'call_s2' }),
    item(5, { type: 'function_call_output', call_id: 'call_s2', output: 'ok' }),
    item(6, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done.' }] }),
    { timestamp: at(7), type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-1' } },
  ];
};

const antigravityJournal = (cwd: string) => {
  const row = (n: number, type: string, source: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index: n, source, type, status: 'DONE', created_at: at(n), content, tool_calls: [], thinking: '', ...extra });
  const call = (name: string, args: Record<string, unknown>) => ({ name, args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, JSON.stringify(v)])) });
  return [
    row(0, 'USER_INPUT', 'USER_EXPLICIT', 'sign in to the service'),
    row(1, 'PLANNER_RESPONSE', 'MODEL', '', { tool_calls: [call('call_mcp_tool', { ServerName: 'svc', ToolName: 'login', Arguments: JSON.stringify(structured()) })] }),
    row(2, 'GENERIC', 'MODEL', JSON.stringify({ ok: true, access_token: DUMMY })),
    row(3, 'PLANNER_RESPONSE', 'MODEL', '', { tool_calls: [call('run_command', { CommandLine: 'echo hi', Cwd: cwd, ...structured() })] }),
    row(4, 'RUN_COMMAND', 'MODEL', 'hi'),
    row(5, 'PLANNER_RESPONSE', 'MODEL', 'Done.'),
  ];
};

let s: Scratch;
const recordings: string[] = [];
const sources: string[] = [];

beforeAll(async () => {
  s = await startScratch();
  const place = (rel: string, rows: unknown[]) => { const file = join(s.dir, 'journals', rel); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, lines(rows)); return file; };
  const cwd = join(s.dir, 'repo');
  mkdirSync(cwd, { recursive: true });
  const files: [string, string][] = [
    ['claude-code', place('claude/structured.jsonl', claudeJournal(cwd))],
    ['codex', place('codex/rollout-structured.jsonl', codexJournal(cwd))],
    ['antigravity', place('antigravity/brain/structured/.system_generated/logs/transcript.jsonl', antigravityJournal(cwd))],
  ];
  for (const [adapter, file] of files) { recordings.push((await s.run.app.ingest.importSource(adapter, file)).recordingId); sources.push(file); }
  // The live path: a record appended after the import is captured through sync.
  const [claudeFile, codexFile] = [files[0]![1], files[1]![1]];
  appendFileSync(claudeFile, lines([{ ...claudeJournal(cwd)[1], uuid: 'u99', parentUuid: 'u6', timestamp: at(30) }]));
  appendFileSync(codexFile, lines([{ timestamp: at(31), type: 'response_item', payload: { type: 'function_call', name: 'svc__again', arguments: JSON.stringify(structured()), call_id: 'call_s3' } }]));
  await s.run.app.ingest.sync(recordings[0]!);
  await s.run.app.ingest.sync(recordings[1]!);
});
afterAll(async () => { await s.close(); });

describe('a secret-named field is redacted whatever its value, in every adapter', () => {
  it('every adapter imported the journal, and the dummy value was in each source', () => {
    expect(recordings).toHaveLength(3);
    for (const file of sources) expect(readFileSync(file, 'utf8')).toContain(DUMMY);
    for (const id of recordings) expect(s.run.app.store.observations(id, -1, 100).length).toBeGreaterThan(3);
  });

  it('the observations hold the marker where the value was, and keep the ordinary fields', () => {
    for (const id of recordings) {
      const text = JSON.stringify(s.run.app.store.observations(id, -1, 1000));
      expect(text, id).toContain('[REDACTED:secret-field]');
      expect(text, id).toContain('alice');
      expect(text, id).not.toContain(DUMMY);
    }
  });

  it('the store directory: database, write-ahead log, blobs and search index', () => {
    const found: string[] = [];
    for (const file of walk(s.dataDir)) found.push(...leaks(readFileSync(file), file.slice(s.dataDir.length)));
    expect(found).toEqual([]);
    for (const id of recordings) expect(s.run.app.store.search(id, 'hunter2')).toHaveLength(0);
  });

  it('every API response for every recording, and the search route', async () => {
    const found: string[] = [];
    for (const id of recordings) {
      for (const route of extractRoutes().filter((r) => r.method === 'GET' && !['/v1/changes', '/v1/health'].includes(r.template))) {
        const reply = await s.call(route.path(id) + '?q=hunter2&path=.env', { headers: s.bearer, timeoutMs: 30_000 });
        found.push(...leaks(reply.text, `${route.template} ${reply.status}`));
      }
      const page = await s.call(`/v1/recordings/${enc(id)}/history`, { method: 'POST', headers: { ...s.bearer, 'content-type': 'application/json' }, body: JSON.stringify({ tailFirst: true }) });
      found.push(...leaks(page.text, 'history'));
    }
    expect(found).toEqual([]);
  });

  it('the export and the offline bundle, through the API', async () => {
    const found: string[] = [];
    for (const id of recordings) {
      const exported = await s.call(`/v1/recordings/${enc(id)}/export`, { headers: s.bearer });
      expect(exported.status).toBe(200);
      found.push(...leaks(exported.text, 'export'));
    }
    found.push(...leaks(JSON.stringify(await s.run.app.exportBundle(recordings.join('+'))), 'combined bundle'));
    expect(found).toEqual([]);
  });
});
