import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { WorkspaceAccess } from '../src/workspace.ts';
import { HarnessController } from '../src/controller.ts';

let dir: string, root: string, app: App, access: WorkspaceAccess, claudeId: string, codexId: string;
let controller: HarnessController;
const launches: { args: string[]; cwd: string | undefined; shell: unknown }[] = [];
const frames: any[] = [];
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-controller-')); root = join(dir, 'repo'); mkdirSync(root);
  writeFileSync(join(root, 'a.ts'), 'export const a = 1;');
  const uuid = '44444444-4444-4444-8444-444444444444';
  const cj = join(dir, 'claude.jsonl'); const xj = join(dir, 'codex.jsonl');
  writeFileSync(cj, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: uuid, cwd: root, message: { role: 'user', content: 'Synthetic fixture' } }) + '\n');
  writeFileSync(xj, JSON.stringify({ type: 'session_meta', payload: { id: uuid, cwd: root } }) + '\n');
  app = new App(join(dir, 'store')); access = new WorkspaceAccess(app);
  claudeId = (await app.ingest.importSource('claude-code', cj)).recordingId;
  codexId = (await app.ingest.importSource('codex', xj)).recordingId;
  const fake = join(dir, 'fake-harness.mjs');
  writeFileSync(fake, `import { createInterface } from 'node:readline';
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
let prompt = '';
createInterface({ input: process.stdin }).on('line', line => {
  const v = JSON.parse(line);
  if (v.type === 'control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{}}});
  else if (v.type === 'user') {
    prompt = v.message.content;
    if (prompt === 'STREAM') {
      send({type:'stream_event',event:{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}}});
      send({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Inspect source sk-proj-abcdefghij'}}});
      setTimeout(() => {
        send({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'klmnopqrstuvw0123456789 then verify.'}}});
        send({type:'stream_event',event:{type:'content_block_stop',index:0}});
      }, 500);
      return;
    }
    if (prompt === 'BACKGROUND') {
      send({type:'system',subtype:'session_state_changed',state:'running'});
      send({type:'system',subtype:'task_started',task_id:'agent1',task_type:'local_agent'});
      send({type:'result',is_error:false,result:'first turn'});
      setTimeout(() => {
        send({type:'system',subtype:'task_notification',task_id:'agent1'});
        send({type:'assistant',message:{content:[{type:'text',text:'background finished'}]}});
        send({type:'result',is_error:false,result:'final turn'});
        send({type:'system',subtype:'session_state_changed',state:'idle'});
      }, 250);
      return;
    }
    send({type:'system',subtype:'init',tools:['Read','Edit','mcp__docs__lookup']});
    send({type:'control_request',request_id:'permission1',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'a.ts',new_string:'const a = 2;'}}});
  } else if (v.type === 'control_response') send({type:'result',is_error:false,result:v.response.response.behavior + ' ' + prompt,usage:{input_tokens:120,output_tokens:30,cache_read_input_tokens:50},total_cost_usd:0.012});
  else if (v.method === 'initialize') send({id:v.id,result:{}});
  else if (v.method === 'thread/resume') send({id:v.id,result:{thread:{status:{type:'idle'}}}});
  else if (v.method === 'mcpServerStatus/list') send({id:v.id,result:{data:[{name:'docs',tools:{lookup:{}}}],nextCursor:null}});
  else if (v.method === 'turn/start') {
    prompt = v.params.input[0].text;
    send({id:v.id,result:{turn:{id:'turn1'}}});
    if (prompt === 'STREAM') {
      send({method:'item/reasoning/summaryTextDelta',params:{threadId:'wrong-thread',itemId:'wrong',delta:'Never show this'}});
      send({method:'item/reasoning/summaryTextDelta',params:{threadId:v.params.threadId,turnId:'turn1',itemId:'r1',delta:'Inspect source sk-proj-abcdefghij',summaryIndex:0}});
      setTimeout(() => {
        send({method:'item/reasoning/summaryTextDelta',params:{threadId:v.params.threadId,turnId:'turn1',itemId:'r1',delta:'klmnopqrstuvw0123456789 then verify.',summaryIndex:0}});
        send({method:'item/completed',params:{threadId:v.params.threadId,turnId:'turn1',item:{id:'r1',type:'reasoning',summary:[]}}});
      },500);
      return;
    }
    send({id:99,method:'item/commandExecution/requestApproval',params:{threadId:v.params.threadId,command:'echo synthetic',cwd:process.cwd()}});
  } else if (v.method === 'turn/interrupt') {
    send({id:v.id,result:{}});
    send({method:'turn/completed',params:{turn:{status:'interrupted'}}});
  } else if (v.id === 99) {
    send({method:'thread/tokenUsage/updated',params:{tokenUsage:{last:{inputTokens:210,outputTokens:35,cachedInputTokens:80}}}});
    send({method:'item/completed',params:{item:{type:'agentMessage',text:v.result.decision + ' ' + prompt}}});
    send({method:'turn/completed',params:{turn:{status:'completed'}}});
  }
});`);
  controller = new HarnessController(app, access, { resolveExecutable: () => process.execPath,
    launch: ((_bin: string, args: string[], opts: any) => { launches.push({ args, cwd: opts.cwd, shell: opts.shell }); const child = spawn(process.execPath, [fake], opts); const write = child.stdin!.write.bind(child.stdin!); child.stdin!.write = ((chunk: string, ...rest: any[]) => { frames.push(JSON.parse(String(chunk))); return (write as any)(chunk, ...rest); }) as any; return child; }) as typeof spawn, timeoutMs: 5000 });
});
afterAll(async () => { await controller.close(); await app.close(); rmSync(dir, { recursive: true, force: true }); });
const wait = async (id: string, state: string) => {
  await expect.poll(() => controller.status(id).state, { timeout: 4000 }).toBe(state);
  return controller.status(id);
};

it('requires workspace consent and an idle-session acknowledgement', async () => {
  await expect(controller.start(claudeId, 'test', false)).rejects.toMatchObject({ status: 400 });
  await expect(controller.start(claudeId, 'test', true)).rejects.toMatchObject({ status: 403 });
  await access.approve(claudeId); await access.approve(codexId);
});
it('resumes Claude over structured stdin, exposes real tool inventory and applies one exact approval', async () => {
  const prompt = 'literal $(echo nope) `echo nope`\nsecond line';
  const started = await controller.start(claudeId, prompt, true);
  const waiting = await wait(claudeId, 'approval');
  expect(waiting.tools).toContain('mcp__docs__lookup'); expect(waiting.inventory).toBe('runtime');
  await expect(controller.start(claudeId, 'duplicate', true)).rejects.toMatchObject({ status: 409 });
  controller.decide(claudeId, started.runId, waiting.approvals[0]!.id, true);
  const completed = await wait(claudeId, 'completed'); expect(completed.output).toBe('allow ' + prompt);
  expect(completed.usage).toEqual({ input: 120, output: 30, cached: 50, costUsd: 0.012 });
  expect(launches[0]!.args).toContain('--resume'); expect(launches[0]!.args).not.toContain(prompt);
  expect(launches[0]!.cwd).toBe(root); expect(launches[0]!.shell).toBe(false);
  expect(() => controller.decide(claudeId, started.runId, 'permission1', true)).toThrow('already answered');
});
it('resumes Codex using RPC and returns an actual decline under conservative session permissions', async () => {
  const started = await controller.start(codexId, 'hello', true);
  const waiting = await wait(codexId, 'approval'); expect(waiting.tools).toEqual(['docs / lookup']);
  controller.decide(codexId, started.runId, waiting.approvals[0]!.id, false);
  const completed = await wait(codexId, 'completed');
  expect(completed.output).toContain('decline hello');
  expect(completed.usage).toEqual({ input: 210, output: 35, cached: 80 });
  expect(completed.usage).not.toHaveProperty('costUsd');
});
it('redacts outgoing prompts and safely cancels only its owned process', async () => {
  const started = await controller.start(claudeId, 'sk-proj-abcdefghijklmnopqrstuvw0123456789', true);
  await wait(claudeId, 'approval');
  expect(started.promptRedacted).toBe(true);
  await expect(controller.stop(claudeId, 'stale-run')).rejects.toThrow('no longer current');
  await controller.stop(claudeId, started.runId); expect(controller.status(claudeId).state).toBe('stopped');
});
it('serializes concurrent submissions before the asynchronous root check', async () => {
  const pending = controller.start(claudeId, 'test', true);
  await expect(controller.start(claudeId, 'racing duplicate', true)).rejects.toMatchObject({ status: 409 });
  const run = await pending; await controller.stop(claudeId, run.runId);
});
it('refuses empty/oversized prompts and combined session targets', async () => {
  await expect(controller.start(claudeId, '', true)).rejects.toMatchObject({ status: 400 });
  await expect(controller.start(claudeId, 'x'.repeat(65537), true)).rejects.toMatchObject({ status: 400 });
  await expect(controller.start(`${claudeId}+${codexId}`, 'test', true)).rejects.toMatchObject({ status: 400 });
});

it('keeps Claude background agent work alive until the final result and idle state', async () => {
  await controller.start(claudeId, 'BACKGROUND', true);
  await expect.poll(() => controller.status(claudeId).output).toBe('first turn');
  expect(controller.status(claudeId).state).toBe('running');
  expect((await wait(claudeId, 'completed')).output).toBe('final turn');
});
it('requests a native Codex turn interrupt before closing its owned connection', async () => {
  const run = await controller.start(codexId, 'stop this', true);
  await wait(codexId, 'approval');
  const before = Date.now();
  expect((await controller.stop(codexId, run.runId)).state).toBe('stopped');
  expect(Date.now() - before).toBeLessThan(1000);
});
for (const harness of ['claude', 'codex'] as const) it(`${harness} exposes genuine thinking state before text and redacts a credential split across native deltas`, async () => {
  const id = harness === 'claude' ? claudeId : codexId;
  const run = await controller.start(id, 'STREAM', true);
  await expect.poll(() => controller.status(id).phase).toBe('thinking');
  expect(controller.status(id).preview).toBeUndefined();
  await expect.poll(() => controller.status(id).preview?.text).toContain('then verify.');
  const preview = controller.status(id).preview!;
  expect(preview.text).toContain('[REDACTED:');
  expect(preview.text).not.toContain('abcdefghij');
  expect(preview.text).not.toContain('Never show');
  expect(preview.role).toBe('reasoning');
  expect(preview.exposure).toBe(harness === 'claude' ? 'full' : 'summary');
  if (harness === 'claude') expect(launches.at(-1)!.args).toContain('--include-partial-messages');
  await controller.stop(id, run.runId);
});

for (const harness of ['claude', 'codex']) it(`${harness} receives redacted text attachments and real inline image content`, async () => {
  const id = harness === 'claude' ? claudeId : codexId;
  await access.approve(id);
  const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const first = frames.length;
  const state = await controller.start(id, 'Review attached source', true, [
    { name: 'src/example.ts', type: 'text', data: 'const token = "sk-proj-abcdefghijklmnopqrstuvw0123456789";' },
    { name: 'screenshot.png', type: 'image', mime: 'image/png', data: image }
  ]);
  await wait(id, 'approval');
  const sent = frames.slice(first).find(v => harness === 'claude' ? v.type === 'user' : v.method === 'turn/start');
  const content = harness === 'claude' ? sent.message.content : sent.params.input;
  expect(content[0].text).toContain('[Attached file: src/example.ts]');
  expect(content[0].text).not.toContain('sk-proj-');
  expect(content[1]).toEqual(harness === 'claude' ? { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } } : { type: 'image', url: `data:image/png;base64,${image}` });
  expect(state.promptRedacted).toBe(true);
  expect(JSON.stringify(controller.status(id))).not.toContain(image);
  await controller.stop(id, state.runId);
});

it('rejects protected, binary, oversized and disguised image attachments before launching', async () => {
  const before = launches.length;
  for (const attachment of [
    { name: '../secret.txt', type: 'text', data: 'secret' },
    { name: '.env', type: 'text', data: 'secret' },
    { name: 'file.bin', type: 'text', data: 'binary\0content' },
    { name: 'large.txt', type: 'text', data: 'x'.repeat(512 * 1024 + 1) },
    { name: 'fake.png', type: 'image', mime: 'image/png', data: Buffer.from('not an image').toString('base64') }
  ]) await expect(controller.start(claudeId, 'Review', true, [attachment])).rejects.toMatchObject({ status: 400 });
  expect(launches.length).toBe(before);
});
