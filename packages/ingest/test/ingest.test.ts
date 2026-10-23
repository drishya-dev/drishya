import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Store } from '@drishya/store';
import { reduce } from '@drishya/projection';
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

it('explicit rescan enriches an old recording with stable observation IDs and identical action chronology', async () => {
  const journal = join(dir, 'usage.jsonl');
  writeFileSync(journal, readFileSync(join(fixtures, 'usage/codex-rollout-usage.jsonl')));
  await ingest.close();
  const legacy = defaultAdapters().map(adapter => ({ ...adapter, createParser(context: Parameters<typeof adapter.createParser>[0]) {
    const parser = adapter.createParser(context);
    return { prime: (observations: Parameters<typeof parser.prime>[0]) => parser.prime(observations), parse: (record: unknown) => parser.parse(record).filter(o => o.kind !== 'usage') };
  } }));
  ingest = new Ingestor(store, legacy);
  const first = await ingest.importSource('codex', journal);
  const original = store.observations(first.recordingId);
  const timeline = ingest.projection(first.recordingId).timeline;
  await ingest.close(); ingest = new Ingestor(store);
  expect((await ingest.importSource('codex', journal)).added).toBe(0);
  expect((await ingest.rescan(first.recordingId)).added).toBe(7);
  expect(store.observations(first.recordingId).filter(o => o.kind !== 'usage')).toEqual(original);
  expect(ingest.projection(first.recordingId).timeline).toEqual(timeline);
  expect((await ingest.rescan(first.recordingId)).added).toBe(0);
  expect(allStoredBytes(join(dir, 'data'))).not.toContain('synthetic-limit-id');
});

function claudeLine(rec: Record<string, unknown>) {
  return JSON.stringify({ sessionId: 's', cwd: '/w', version: '2.1.0', timestamp: '2026-09-21T10:00:00Z', ...rec }) + '\n';
}

describe('import', () => {
  it('serves an event-loop turn between committed slices without splitting records', async () => {
    const path = join(dir, 'rollout-sliced.jsonl');
    const rows = [JSON.stringify({ type: 'session_meta', payload: { id: 'sliced', cwd: '/synthetic' } })];
    for (let i = 0; i < 10; i++) {
      rows.push(JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'shell_command', call_id: `slice-${i}`, arguments: '{"command":"echo invented"}' } }));
      rows.push(JSON.stringify({ type: 'response_item', payload: { type: 'function_call_output', call_id: `slice-${i}`, output: `Invented ${i} ` + 'line\n'.repeat(i === 4 ? 240000 : 16000) } }));
    }
    writeFileSync(path, rows.join('\n') + '\n');
    const through = new Set<number>(); let offset = 0;
    for (const row of rows) { offset += Buffer.byteLength(row) + 1; through.add(offset); }
    const commit = store.appendObservations.bind(store), yielded: number[] = [], cursors: number[] = [];
    const spy = vi.spyOn(store, 'appendObservations').mockImplementation((recordingId, sourceId, cursor, observations) => {
      const result = commit(recordingId, sourceId, cursor, observations);
      cursors.push(cursor.offset);
      setImmediate(() => yielded.push(store.getSources(recordingId)[0]!.cursor.offset));
      return result;
    });
    const imported = await ingest.importSource('codex', path);
    await new Promise(resolve => setImmediate(resolve));
    expect(imported).toMatchObject({ added: 21, gaps: 0, more: false });
    expect(cursors.every(cursor => through.has(cursor))).toBe(true);
    expect(yielded.some(cursor => cursor > 0 && cursor < offset)).toBe(true);
    const ids = store.observations(imported.recordingId).map(o => o.id);
    spy.mockRestore();
    expect((await ingest.rescan(imported.recordingId)).added).toBe(0);
    expect(store.observations(imported.recordingId).map(o => o.id)).toEqual(ids);
  });
  it('yields inside a slice while readers see only atomic committed records and offsets', async () => {
    const path=join(dir,'record-yield.jsonl');
    const rows=Array.from({length:12},(_,i)=>JSON.stringify({type:'response_item',timestamp:'2026-01-01T00:00:00Z',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'invented '+i}]}}));
    writeFileSync(path,rows.join('\n')+'\n');
    let logicalTime=0,parsed=0;
    const turns:{parsed:number;count:number;offset:number}[]=[];
    const adapters=defaultAdapters().map(adapter=>({...adapter,createParser(context:Parameters<typeof adapter.createParser>[0]) {
      const parser=adapter.createParser(context);
      return {prime:(observations:Parameters<typeof parser.prime>[0])=>parser.prime(observations),parse:(record:unknown)=>{
        const result=parser.parse(record);parsed++;logicalTime+=20;
        setImmediate(()=>turns.push({parsed,count:store.countObservations(context.recordingId),offset:store.getSources(context.recordingId)[0]!.cursor.offset}));
        return result;
      }};
    }}));
    await ingest.close();ingest=new Ingestor(store,adapters,{now:()=>new Date('2026-01-02T00:00:00Z')});
    const clock=vi.spyOn(performance,'now').mockImplementation(()=>logicalTime);
    const append=vi.spyOn(store,'appendObservations');
    try {
      const imported=await ingest.importSource('codex',path);
      await new Promise(ok=>setImmediate(ok));
      expect(imported).toMatchObject({added:12,gaps:0,more:false});
      expect(append).toHaveBeenCalledTimes(1); // no extra SQLite commits to buy responsiveness
      expect(turns.some(t=>t.parsed>1&&t.parsed<12&&t.count===0&&t.offset===0)).toBe(true);
      expect(turns.every(t=>t.count===0||t.count===12)).toBe(true);
      expect(store.getSources(imported.recordingId)[0]!.cursor.offset).toBe(statSync(path).size);
      const observations=store.observations(imported.recordingId);
      expect((await ingest.rescan(imported.recordingId)).added).toBe(0);
      expect(store.observations(imported.recordingId)).toEqual(observations);
      const freshStore=new Store(join(dir,'fresh-yield-data'));
      const fresh=new Ingestor(freshStore,defaultAdapters(),{now:()=>new Date('2026-01-02T00:00:00Z')});
      try {await fresh.importSource('codex',path);expect(freshStore.observations(imported.recordingId)).toEqual(observations);}
      finally {await fresh.close();freshStore.close();}
    } finally {clock.mockRestore();append.mockRestore();}
  });
  it('preserves unreported process exits and does not classify quoted runner mentions as tests',async()=>{
    const path=join(dir,'wrapper-outcomes.jsonl');
    const command='text(await tools.exec_command({cmd:"rg -n \'palette|mocha|tokyo\' themes.css"}));';
    writeFileSync(path,[
      {type:'session_meta',payload:{id:'wrappers',cwd:'/w'}},
      {type:'response_item',payload:{type:'function_call',name:'exec',call_id:'wrapper',arguments:JSON.stringify({code:command})}},
      {type:'response_item',payload:{type:'function_call_output',call_id:'wrapper',output:'Script completed\nOutput:\nCaptured nested command failed'}},
    ].map(row=>JSON.stringify(row)).join('\n')+'\n');
    const {recordingId}=await ingest.importSource('codex',path);
    const op=ingest.projection(recordingId).operations[0]!;
    expect(op.kind).toBe('shell');expect(op.status).toBe('ok');
    expect(op.detail).toMatchObject({kind:'shell',exitCode:null});
  });
  it('recovers an older missing workspace on the first sync without new journal content',async()=>{
    const imported=await ingest.importSource('claude-code',join(fixtures,'claude/checkout-fix.jsonl'));
    expect(store.getRecording(imported.recordingId)?.workspaceRoot).toBe('/home/dev/shop');
    store.db.prepare('UPDATE recordings SET workspace_root=NULL WHERE id=?').run(imported.recordingId);
    await ingest.close();ingest=new Ingestor(store);
    const result=await ingest.sync(imported.recordingId);
    expect(result.added).toBe(0);
    expect(store.getRecording(imported.recordingId)?.workspaceRoot).toBe('/home/dev/shop');
  });
  it('catches up stopped journals without sealing an unfinished append or starting a watch',async()=>{
    const path=join(dir,'catchup.jsonl');
    writeFileSync(path,JSON.stringify({type:'session_meta',payload:{id:'catchup',cwd:'/w'}})+'\n');
    const {recordingId}=await ingest.importSource('codex',path);
    const text=JSON.stringify({type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'complete after newline'}]}});
    appendFileSync(path,text);
    expect((await ingest.sync(recordingId,{turnBytes:16*1024*1024,acceptUnterminated:false})).added).toBe(0);
    appendFileSync(path,'\n');
    expect((await ingest.sync(recordingId,{turnBytes:16*1024*1024,acceptUnterminated:false})).added).toBeGreaterThan(0);
    expect(ingest.isLive(recordingId)).toBe(false);
    expect(ingest.projection(recordingId).prose.some(p=>p.text==='complete after newline')).toBe(true);
  });
  it('projects wrapped Codex creations and edits, including previously stored shell-shaped calls', async () => {
    const patch = '*** Begin Patch\n*** Add File: new.ts\n+export const n = 1;\n*** Update File: old.ts\n@@\n-old\n+new\n*** End Patch';
    const source = `text(await tools.apply_patch(${JSON.stringify(patch)}));`;
    const journal = join(dir, 'wrapped.jsonl');
    writeFileSync(journal, [
      { type: 'session_meta', payload: { id: 'wrapped', cwd: '/w' } },
      { type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', call_id: 'patch1', input: source } },
      { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'patch1', output: '{}' } },
    ].map(r => JSON.stringify(r)).join('\n') + '\n');
    const { recordingId } = await ingest.importSource('codex', journal);
    const observations = store.observations(recordingId);
    const projection = ingest.projection(recordingId);
    expect(projection.operations.map(o => [o.kind, o.title])).toEqual([['write', 'Create new.ts'], ['edit', 'Edit old.ts']]);
    expect(projection.operations.every(o => o.status === 'unknown' && o.classification.kind === 'derived')).toBe(true);
    const legacy = observations.map(o => o.kind === 'tool.call' ? { ...o, payload: { ...o.payload, intent: { kind: 'shell', command: source } } } : o);
    const rebuilt = reduce(recordingId, legacy, store.blobs, { adapters: ingest.descriptors });
    expect(rebuilt.operations.map(o => [o.kind, o.title])).toEqual(projection.operations.map(o => [o.kind, o.title]));
    expect(store.blobs.get(rebuilt.artifacts.find(a => a.kind === 'patch')!.blob!)).toBe(patch);
    expect(store.observations(recordingId)).toEqual(observations);
  });
  it('keeps a combined view across worktrees without claiming one map root', async () => {
    const a = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
    const b = await ingest.importSource('codex', join(fixtures, 'codex/rollout-checkout-review.jsonl'));
    expect(ingest.combinedProjection([a.recordingId, b.recordingId]).operations.length).toBeGreaterThan(0);
    store.updateRecordingMeta(b.recordingId, { workspaceRoot: '/home/dev/other-worktree' });
    const mixed = ingest.combinedProjection([a.recordingId, b.recordingId]);
    expect(mixed.workspaceRoot).toBeUndefined();
    expect(mixed.operations.length).toBeGreaterThan(0);
  });

  it('never reconstructs one recording from another recording’s captured file', async () => {
    const imported = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
    const observations = store.observations(imported.recordingId);
    const base = observations.filter((o) => o.kind === 'session.meta' || (o.operationId === 'toolu_synthetic0001' && (o.kind === 'tool.call' || o.kind === 'tool.result')));
    const edit = observations.filter((o) => o.operationId === 'toolu_synthetic0010' && (o.kind === 'tool.call' || o.kind === 'tool.result')).map((o) => structuredClone(o));
    expect(edit).toHaveLength(2);
    const result = edit.find((o) => o.kind === 'tool.result')!;
    (result.payload as Record<string, any>).outcome.originalFile = null;
    const descriptors = Object.fromEntries(defaultAdapters().map((a) => [a.descriptor.id, a.descriptor]));
    const same = reduce('same', [...base, ...edit], store.blobs, { adapters: descriptors });
    expect(same.operations.find((o) => o.detail.kind === 'edit')?.detail).toMatchObject({ reconstruction: 'complete' });
    const split = reduce('split', [...base, ...edit.map((o) => ({ ...o, recordingId: 'another-recording' }))], store.blobs, { adapters: descriptors });
    expect(split.operations.find((o) => o.detail.kind === 'edit')?.detail).toMatchObject({ reconstruction: 'unavailable' });
  });
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
    // Observations are never rewritten, so an older-policy body only exists from an earlier run: reopen the store.
    store.db.prepare(`UPDATE observations SET body = json_set(body, '$.privacyPolicyVersion', 'p1') WHERE recording_id = ? AND seq = 0`).run(r.recordingId);
    await ingest.close(); store.close();
    store = new Store(join(dir, 'data')); ingest = new Ingestor(store);
    expect(ingest.privacyOutdated(r.recordingId)).toBe(true);

  });
});

// B1 (audit A05): capture health is explicit. A missing or unreadable source, or a failing adapter,
// is a visible state with a reason, never an empty list or a swallowed error.
describe('capture health', () => {
  const tiny = () => {
    const file = join(dir, `h-${Math.random().toString(36).slice(2)}.jsonl`);
    writeFileSync(file, claudeLine({ type: 'user', uuid: 'h1', message: { role: 'user', content: 'go' } }));
    return file;
  };

  it('reports stopped after an import and following while live', async () => {
    const r = await ingest.importSource('claude-code', tiny());
    expect(ingest.health(r.recordingId)).toMatchObject({ state: 'stopped', live: false, error: undefined });
    ingest.startLive(r.recordingId, 1000);
    expect(ingest.health(r.recordingId).state).toBe('following');
    await ingest.stopLive(r.recordingId);
    expect(ingest.health(r.recordingId).state).toBe('stopped');
  });

  it('turns a deleted source into missing-source, with a reason, without throwing', async () => {
    const file = tiny();
    const r = await ingest.importSource('claude-code', file);
    const events: string[] = [];
    ingest.on('health', (e) => events.push(e.health.state));
    rmSync(file);
    await ingest.sync(r.recordingId);
    const h = ingest.health(r.recordingId);
    expect(h.state).toBe('missing-source');
    expect(h.error?.code).toBe('missing-source');
    expect(h.sources[0]).toMatchObject({ role: 'main', state: 'missing' });
    expect(events).toContain('missing-source');
  });

  it('turns an unreadable source into failed with a code, and recovers when it is readable again', async () => {
    const file = tiny();
    const r = await ingest.importSource('claude-code', file);
    const saved = readFileSync(file);
    rmSync(file);
    mkdirSync(file); // a directory where the journal was: reading it fails
    await expect(ingest.sync(r.recordingId)).rejects.toThrow();
    expect(ingest.health(r.recordingId)).toMatchObject({ state: 'failed', error: { code: expect.any(String) } });
    rmSync(file, { recursive: true });
    writeFileSync(file, saved);
    await ingest.sync(r.recordingId);
    expect(ingest.health(r.recordingId)).toMatchObject({ state: 'stopped', error: undefined });
  });

  it('marks following as idle once nothing new has arrived for a while', async () => {
    let now = Date.parse('2026-10-02T10:00:00Z');
    const ing = new Ingestor(store, undefined, { now: () => new Date(now), idleMs: 60_000 });
    const r = await ing.importSource('claude-code', tiny());
    ing.startLive(r.recordingId, 60_000);
    expect(ing.health(r.recordingId).state).toBe('following');
    now += 61_000;
    expect(ing.health(r.recordingId).state).toBe('idle');
    await ing.close();
  });

  it('reports discovery failures per adapter instead of an empty list', async () => {
    const [claude, codex] = defaultAdapters();
    const failing = { ...codex!, discover: async () => Promise.reject(Object.assign(new Error(`EACCES: permission denied, scandir '/home/me/.codex/sessions' gh${'p_'}${rnd(36)}`), { code: 'EACCES' })) };
    const ok = { ...claude!, discover: async () => [{ adapterId: 'claude-code', harness: 'claude-code', path: join(dir, 'ok.jsonl'), bytes: 1, modifiedAt: '2026-10-02T00:00:00Z', companions: [] }] };
    const report = await new Ingestor(store, [ok, failing]).discoverReport();
    expect(report.sources).toHaveLength(1);
    expect(report.errors).toEqual([{ adapterId: 'codex', code: 'permission-denied', message: expect.stringContaining('permission denied') }]);
    expect(JSON.stringify(report.errors)).not.toContain(`gh${'p_'}`);
  });
});

// B1 (audit A06): live ticks coalesce — at most one read in flight plus one pending wake-up per
// recording — and each live turn does bounded work, so a slow store cannot build a backlog.
describe('live pacing', () => {
  it('uses a bounded half-second poll by default without changing explicit intervals', async () => {
    const file=join(dir,'poll-default.jsonl');
    writeFileSync(file,claudeLine({type:'user',uuid:'poll0',message:{role:'user',content:'synthetic poll check'}}));
    const {recordingId}=await ingest.importSource('claude-code',file);
    const timer=vi.spyOn(globalThis,'setInterval');
    try {
      ingest.startLive(recordingId);expect(timer).toHaveBeenLastCalledWith(expect.any(Function),500);
      await ingest.stopLive(recordingId);
      ingest.startLive(recordingId,1200);expect(timer).toHaveBeenLastCalledWith(expect.any(Function),1200);
      await ingest.stopLive(recordingId);
    } finally {timer.mockRestore();}
  });
  it('never runs two syncs of one recording at once, and coalesces ticks while one is slow', async () => {
    const file = join(dir, 'slow.jsonl');
    writeFileSync(file, claudeLine({ type: 'user', uuid: 's0', message: { role: 'user', content: 'go' } }));
    const r = await ingest.importSource('claude-code', file);
    const real = ingest.sync.bind(ingest);
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    ingest.sync = async (id, opts) => {
      active++;
      maxActive = Math.max(maxActive, active);
      calls++;
      await new Promise((ok) => setTimeout(ok, 120));
      try {
        return await real(id, opts);
      } finally {
        active--;
      }
    };
    ingest.startLive(r.recordingId, 10);
    for (let i = 1; i <= 20; i++) {
      appendFileSync(file, claudeLine({ type: 'user', uuid: `s${i}`, message: { role: 'user', content: `more ${i}` } }));
      await new Promise((ok) => setTimeout(ok, 20));
    }
    await waitFor(() => store.countObservations(r.recordingId) >= 21, 5000);
    await ingest.stopLive(r.recordingId);
    expect(maxActive).toBe(1);
    expect(calls).toBeLessThan(15); // ~40 ticks fired; a coalesced loop runs far fewer syncs
  });

  it('bounds one turn of work and reports when more remains', async () => {
    const file = join(dir, 'bounded.jsonl');
    writeFileSync(file, Array.from({ length: 40 }, (_, i) => claudeLine({ type: 'user', uuid: `b${i}`, message: { role: 'user', content: `line ${i} `.repeat(20) } })).join(''));
    const r = await ingest.importSource('claude-code', file, { turnBytes: 4096 });
    expect(r.more).toBe(true);
    expect(store.countObservations(r.recordingId)).toBeLessThan(40);
    let turns = 1;
    while ((await ingest.sync(r.recordingId, { turnBytes: 4096 })).more) turns++;
    expect(turns).toBeGreaterThan(2);
    // Same result as one unbounded import of an identical copy.
    writeFileSync(join(dir, 'bounded-copy.jsonl'), readFileSync(file));
    const whole = await ingest.importSource('claude-code', join(dir, 'bounded-copy.jsonl'));
    expect(whole.more).toBe(false);
    expect(store.countObservations(r.recordingId)).toBe(store.countObservations(whole.recordingId));
  });
});

async function waitFor(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((ok) => setTimeout(ok, 20));
  }
}
