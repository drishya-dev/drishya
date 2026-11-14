// SEC-3 item 10: sending prompts (the opt-in controller). A prompt, an interrupt and an approval can
// only follow a person's action in Drishya's own page, and an approval answers one exact request once.
// The harness here is a synthetic stand-in: a node script behind the controller's real `launch` seam.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HarnessController } from '../../apps/daemon/src/controller.ts';
import { grantAccess, importHostile, makeRepo } from './lib/seed.ts';
import { hostileScenario } from './lib/corpus.ts';
import { startScratch, tempDir, type Scratch } from './lib/scratch.ts';

const enc = encodeURIComponent;
const FAKE = `
import { createInterface } from 'node:readline';
const send = (v) => process.stdout.write(JSON.stringify(v) + '\\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const v = JSON.parse(line);
  if (v.type === 'control_request') {
    send({ type: 'control_response', response: { subtype: 'success', request_id: v.request_id, response: { models: [], commands: [] } } });
  } else if (v.type === 'user') {
    send({ type: 'system', subtype: 'init', tools: ['Edit'] });
    send({ type: 'control_request', request_id: 'permission1', request: { subtype: 'can_use_tool', tool_name: 'Edit', input: { file_path: 'a.ts', new_string: 'x' } } });
  } else if (v.type === 'control_response') {
    send({ type: 'result', is_error: false, result: 'answered ' + v.response.response.behavior });
  }
});
`;

let s: Scratch, repo: string, rec: string, strange: string;
const launches: { bin: string; args: string[]; cwd?: string; shell?: unknown }[] = [];
let sentToHarness = '';
const json = () => ({ ...s.bearer, 'content-type': 'application/json' });
const prompt = (id: string, body: unknown, headers: Record<string, string | undefined> = {}) => s.call(`/v1/recordings/${enc(id)}/controller/prompt`, { method: 'POST', headers: { ...json(), ...headers }, body: JSON.stringify(body) });
const state = async (id: string) => (await s.call(`/v1/recordings/${enc(id)}/controller`, { headers: s.bearer })).json;

beforeAll(async () => {
  const dir = tempDir();
  const fake = join(dir, 'fake-harness.mjs');
  writeFileSync(fake, FAKE);
  s = await startScratch({
    controllerFactory: (app, workspace) => new HarnessController(app, workspace, {
      resolveExecutable: () => 'claude',
      launch: ((bin: string, args: string[], opts: { cwd?: string; shell?: unknown }) => {
        launches.push({ bin, args, cwd: opts.cwd, shell: opts.shell });
        const child = spawn(process.execPath, [fake], { cwd: opts.cwd, stdio: 'pipe', windowsHide: true });
        child.stdin.on('data', () => undefined);
        const write = child.stdin.write.bind(child.stdin);
        child.stdin.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => { sentToHarness += String(chunk); return (write as (...a: unknown[]) => boolean)(chunk, ...rest); }) as typeof child.stdin.write;
        return child;
      }) as never,
    }),
  });
  repo = makeRepo(join(s.dir, 'repo'));
  rec = await importHostile(s, 'claude-code', repo);
  // A second session whose journal names a session id that is not a UUID.
  strange = await importHostile(s, 'claude-code', repo, { ...hostileScenario(repo), prompt: 'strange' }, 'strange');
});
afterAll(async () => { await s.close(); });

describe('a prompt follows only a person’s action in Drishya’s page', () => {
  it('is refused with no session, from another origin, with a foreign Host and as a form', async () => {
    const body = JSON.stringify({ prompt: 'hello', exclusive: true });
    const url = `/v1/recordings/${enc(rec)}/controller/prompt`;
    expect((await s.call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body })).status).toBe(401);
    expect((await s.call(url, { method: 'POST', headers: { ...json(), origin: 'http://evil.example' }, body })).status).toBe(403);
    expect((await s.call(url, { method: 'POST', headers: { ...json(), origin: 'null' }, body })).status).toBe(403);
    expect((await s.call(url, { method: 'POST', host: 'evil.example', headers: json(), body })).status).toBe(421);
    expect((await s.call(url, { method: 'POST', headers: { ...s.bearer, 'content-type': 'application/x-www-form-urlencoded' }, body: 'prompt=hello&exclusive=true' })).status).toBe(415);
    expect((await s.call(url, { method: 'POST', headers: { ...s.bearer, 'content-type': 'text/plain' }, body })).status).toBe(415);
    expect((await s.call(url, { headers: s.bearer })).status).toBe(404); // no GET form of the route
    expect(launches).toHaveLength(0);
  });

  it('is refused without the workspace consent, without the idle-clients acknowledgement and with a hostile body', async () => {
    expect((await prompt(rec, { prompt: 'hello', exclusive: true })).status).toBe(403); // not yet granted
    await grantAccess(s, rec);
    expect((await prompt(rec, { prompt: 'hello' })).status).toBe(400);
    expect((await prompt(rec, { prompt: 'hello', exclusive: 'true' })).status).toBe(400);
    expect((await prompt(rec, { prompt: '', exclusive: true })).status).toBe(400);
    expect((await prompt(rec, { prompt: 5, exclusive: true })).status).toBe(400);
    expect((await prompt(rec, { prompt: 'x'.repeat(70_000), exclusive: true })).status).toBe(400);
    for (const options of [{ model: '--dangerously-skip-permissions' }, { model: 'a b' }, { effort: 'ultra; rm -rf' }, { permission: 'unheard-of-mode' }, { permission: '--allow-all' }, { permission: ':danger-full-access' }, { model: ['x'] }]) {
      const reply = await prompt(rec, { prompt: 'hello', exclusive: true, options });
      expect(reply.status, JSON.stringify(options)).toBeGreaterThanOrEqual(400);
    }
    expect((await prompt(`${rec}+${rec}`, { prompt: 'hello', exclusive: true })).status).toBeGreaterThanOrEqual(400);
    expect(launches).toHaveLength(0);
  });

  it('is refused for a journal whose session id is not a UUID, and never resumes an arbitrary one', async () => {
    await grantAccess(s, strange);
    const journal = s.run.app.recording(strange).sourcePath!;
    expect(journal).toBeTruthy();
    // The recording above is a valid one; make the journal's id hostile and re-read it.
    const original = (await import('node:fs')).readFileSync(journal, 'utf8');
    (await import('node:fs')).writeFileSync(journal, original.replaceAll('c0ffee00-5ec3-4000-8000-000000000003', '--dangerously-skip-permissions'));
    const reply = await prompt(strange, { prompt: 'hello', exclusive: true });
    expect(reply.status).toBe(409);
    expect(launches).toHaveLength(0);
  });
});

describe('an accepted prompt starts one harness, with a fixed argument list and no shell', () => {
  let runId: string;
  it('launches once in the checkout, the prompt travels on stdin and never in the argument list', async () => {
    const secretText = 'PROMPT-BODY-' + '--model evil $(touch pwned) `id` & | > ; ' + 'z'.repeat(50);
    const reply = await prompt(rec, { prompt: secretText, exclusive: true });
    expect(reply.status, reply.text.slice(0, 200)).toBe(200);
    runId = reply.json.runId;
    expect(launches).toHaveLength(1);
    const launch = launches[0]!;
    expect(launch.bin).toBe('claude');
    expect(launch.shell).toBe(false);
    expect(launch.cwd?.replace(/\\/g, '/').toLowerCase()).toBe(repo.replace(/\\/g, '/').toLowerCase());
    expect(launch.args.join(' ')).not.toContain('PROMPT-BODY');
    expect(launch.args.join(' ')).not.toMatch(/touch pwned/);
    // The argument list is the fixed set this code builds, plus a validated session id.
    const allowed = new Set(['-p', '--resume', '--input-format', 'stream-json', '--output-format', '--verbose', '--include-partial-messages', '--permission-mode', 'manual', '--permission-prompts', 'host', '--permission-prompt-tool', 'stdio']);
    const unknown = launch.args.filter((a) => !allowed.has(a) && !/^[0-9a-f-]{36}$/i.test(a));
    expect(unknown).toEqual([]);
    for (let i = 0; i < 100 && !sentToHarness.includes('PROMPT-BODY'); i++) await new Promise((r) => setTimeout(r, 50));
    expect(sentToHarness).toContain('PROMPT-BODY');
  });

  it('a second prompt while a turn is running is refused', async () => {
    expect((await prompt(rec, { prompt: 'again', exclusive: true })).status).toBe(409);
    expect(launches).toHaveLength(1);
  });

  it('an approval answers one exact request once, and only from this page', async () => {
    let approval: { id: string } | undefined;
    for (let i = 0; i < 100 && !approval; i++) { approval = (await state(rec)).approvals?.[0]; if (!approval) await new Promise((r) => setTimeout(r, 100)); }
    expect(approval, 'the harness asked for approval').toBeTruthy();
    const url = `/v1/recordings/${enc(rec)}/controller/approval`;
    const answer = (extra: Record<string, unknown>, headers: Record<string, string | undefined> = {}) => s.call(url, { method: 'POST', headers: { ...json(), ...headers }, body: JSON.stringify({ runId, approvalId: approval!.id, allow: true, ...extra }) });
    // From another origin, without a session, as a form, with a wrong run or request id, with a non-boolean: refused.
    expect((await s.call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
    expect((await answer({}, { origin: 'http://evil.example' })).status).toBe(403);
    expect((await s.call(url, { method: 'POST', headers: { ...s.bearer, 'content-type': 'text/plain' }, body: JSON.stringify({ runId, approvalId: approval!.id, allow: true }) })).status).toBe(415);
    expect((await answer({ runId: 'someone-elses-run' })).status).toBe(409);
    expect((await answer({ approvalId: '00000000-0000-4000-8000-000000000000' })).status).toBe(409);
    expect((await answer({ allow: 'yes' })).status).toBe(409);
    expect((await answer({ allow: 1 })).status).toBe(409);
    expect((await state(rec)).approvals).toHaveLength(1); // none of those consumed it
    // The real answer works once.
    expect((await answer({})).status).toBe(200);
    expect((await answer({})).status).toBe(409); // replay
    expect((await answer({ allow: false })).status).toBe(409);
  });

  it('an interrupt names its own run, from this page only', async () => {
    const url = `/v1/recordings/${enc(rec)}/controller/stop`;
    expect((await s.call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId }) })).status).toBe(401);
    expect((await s.call(url, { method: 'POST', headers: { ...json(), origin: 'http://evil.example' }, body: JSON.stringify({ runId }) })).status).toBe(403);
    expect((await s.call(url, { method: 'POST', headers: json(), body: JSON.stringify({ runId: 'another-run' }) })).status).toBe(409);
    expect((await s.call(url, { method: 'POST', headers: json(), body: '{}' })).status).toBe(409);
    expect((await s.call(`/v1/recordings/${enc(strange)}/controller/stop`, { method: 'POST', headers: json(), body: JSON.stringify({ runId }) })).status).toBe(409); // another session's id cannot stop this run
    expect((await s.call(url, { method: 'POST', headers: json(), body: JSON.stringify({ runId }) })).status).toBe(200);
  });
});

describe('what the source says', () => {
  it('every start of a native harness uses an argument list and shell:false', async () => {
    const { readFileSync } = await import('node:fs');
    for (const file of ['controller.ts', 'native-readiness.ts', 'native-settings.ts']) {
      const source = readFileSync(join(process.cwd(), 'apps', 'daemon', 'src', file), 'utf8');
      expect(source, file).not.toMatch(/shell\s*:\s*true/);
      expect(source, file).not.toMatch(/(?<![.\w])exec(?:Sync)?\s*\(/);
    }
  });
});
