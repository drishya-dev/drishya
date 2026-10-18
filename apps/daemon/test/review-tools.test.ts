import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, type RunningServer } from '../src/server.ts';
import { reviewJournal } from '../../../fixtures/synthetic/review-tools.ts';
import type { CommandRow, ReviewFinding } from '../../../packages/scene/src/review-tools.ts';
let dir: string, app: App, server: RunningServer, id: string;
beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-review-tools-')); app = new App(join(dir, 'store')); const path = join(dir, 'source.jsonl'); writeFileSync(path, reviewJournal(dir)); id = (await app.ingest.importSource('codex', path)).recordingId; server = await startServer({ app, port: 0, token: 'synthetic-review-tools' }); });
afterAll(async () => { if (server)
    await server.close(); if (app)
    await app.close(); if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
        throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
} });
it('pages whole-recording commands, retains exact long text and qualifies cwd/duration/outcomes', async () => {
    const page = await app.history.review(id, { section: 'commands', count: 2, status: 'failed' });
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ cwd: dir, cwdBasis: 'captured', durationMs: 250, durationBasis: 'captured' });
    const long = (await app.history.review(id, { section: 'commands', q: 'COMPLETE_END' })).items[0] as CommandRow;
    expect(long).toBeDefined();
    expect(long.preview).not.toContain('COMPLETE_END');
    expect(long.complete).toBe(true);
    const detail = await app.history.reviewCommand(id, long.id);
    expect(detail!.text).toHaveLength(5018);
    expect(detail!.text.endsWith('COMPLETE_END')).toBe(true);
    const copied = await app.history.reviewScript(id, [long.id]);
    expect(copied.text).toBe(detail!.text);
    const unknown = (await app.history.review(id, { section: 'commands', status: 'unknown' })).items[0] as CommandRow;
    expect(unknown.exitCode).toBeUndefined();
    expect((await app.history.reviewScript(id, [unknown.id])).warnings).toContain('Some outcomes are unknown.');
});
it('provides versioned findings, exact occurrences, local rules and prompt counts from one revision', async () => {
    const findings = await app.history.review(id, { section: 'findings' });
    expect((findings.items as ReviewFinding[]).map(row => row.rule)).toEqual(['force-push', 'lockfile']);
    const repeats = await app.history.review(id, { section: 'repeats' });
    expect(repeats.items).toHaveLength(1);
    expect(repeats.items[0]).toMatchObject({ count: 4 });
    const turns = await app.history.review(id, { section: 'turns' });
    expect(turns.items[0]).toMatchObject({ operations: 8, tests: 4, failures: 5, findings: 2, repeats: 1 });
    expect((await app.history.review(id, { section: 'findings', rules: [{ id: 'case', target: 'command', mode: 'literal', pattern: 'repeated-case' }] })).total).toBe(6);
});
it('authenticates and rejects invalid pages, rules and script selections', async () => {
    const url = `${server.url}/v1/recordings/${id}`, headers = { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' };
    expect((await fetch(`${url}/review-tools`, { method: 'POST', body: '{"section":"commands"}', headers: { 'content-type': 'application/json' } })).status).toBe(401);
    for (const body of [{ section: 'unknown' }, { section: 'commands', count: 41 }, { section: 'commands', start: -1 }, { section: 'commands', status: 'safe' }, { section: 'commands', rules: [{ id: 'bad', mode: 'regex', target: 'command', pattern: '.*' }] }])
        expect((await fetch(`${url}/review-tools`, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400);
    expect((await fetch(`${url}/review-script`, { method: 'POST', headers, body: JSON.stringify({ operationIds: Array(33).fill('x') }) })).status).toBe(400);
});

it('does not turn Claude session roots into command cwd or joined argv into an exportable script',async()=>{
  const claude=join(dir,'claude.jsonl');writeFileSync(claude,[
    {type:'assistant',sessionId:'claude-context',cwd:dir,timestamp:'2026-10-18T00:00:00Z',message:{role:'assistant',content:[{type:'tool_use',id:'cmd',name:'Bash',input:{command:'echo context'}}]}},
    {type:'user',sessionId:'claude-context',cwd:dir,timestamp:'2026-10-18T00:00:01Z',message:{role:'user',content:[{type:'tool_result',tool_use_id:'cmd',content:'context'}]}},
  ].map(row=>JSON.stringify(row)).join('\n')+'\n');
  const native=(await app.ingest.importSource('claude-code',claude)).recordingId;
  const row=(await app.history.review(native,{section:'commands'})).items[0] as CommandRow;
  expect(row).toMatchObject({cwd:dir,cwdBasis:'session root'});
  expect((await app.history.reviewScript(native,[row.id])).warnings.join(' ')).toContain('not a captured command directory');
  const path=join(dir,'argv.jsonl'),timestamp='2026-10-18T00:00:00Z';
  writeFileSync(path,[{timestamp,type:'session_meta',payload:{id:'argv',cwd:dir}},...[
    ['argv',{command:['echo','two words']}],['large',{cmd:'echo '+'x'.repeat(300000)}]
  ].flatMap(([call_id,args])=>[{timestamp,type:'response_item',payload:{type:'function_call',name:'shell',call_id,arguments:JSON.stringify(args)}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id,output:'Exit code: 0\nOutput:\nsynthetic'}}])].map(row=>JSON.stringify(row)).join('\n')+'\n');
  const recording=(await app.ingest.importSource('codex',path)).recordingId;
  const commands=(await app.history.review(recording,{section:'commands'})).items as CommandRow[];
  expect(commands).toHaveLength(2);expect(commands.every(command=>!command.complete)).toBe(true);
  await expect(app.history.reviewScript(recording,[commands[0]!.id])).rejects.toThrow('complete');
});

it('bounds command and occurrence responses independently of a thousand-operation recording',async()=>{
  const path=join(dir,'large-review.jsonl'),timestamp='2026-10-18T00:00:00Z';
  const rows:unknown[]=[{timestamp,type:'session_meta',payload:{id:'large-review',cwd:dir}}];
  for(let i=0;i<1000;i++)rows.push({timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:`large-${i}`,arguments:JSON.stringify({cmd:'pnpm test -- repeated-large',workdir:dir})}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id:`large-${i}`,output:'Exit code: 1\nOutput:\nFAIL synthetic'}});
  writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const recording=(await app.ingest.importSource('codex',path)).recordingId;
  const page=await app.history.review(recording,{section:'commands',count:20});expect(page.total).toBe(1000);expect(page.items).toHaveLength(20);expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(32000);
  const repeated=await app.history.review(recording,{section:'repeats'}),repeat=repeated.items[0] as {id:string;operationIds:string[]};expect(repeat.operationIds).toEqual([]);
  const first=await app.history.review(recording,{section:'repeats',repeatId:repeat.id,start:0,count:20});const last=await app.history.review(recording,{section:'repeats',repeatId:repeat.id,start:980,count:20});
  expect(first.total).toBe(1000);expect(first.occurrences).toHaveLength(20);expect(last.occurrences).toHaveLength(20);expect(last.occurrences![0]!.operationId).not.toBe(first.occurrences![0]!.operationId);
});
