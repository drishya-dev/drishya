import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';

// UI-43: the composer's model menu shows each model's version as the harness reports it, and a Permissions menu lists the
// modes the harness offers with the current one checked; bypass and full access read as dangerous; the chosen mode is what the
// harness is started with (Claude Code's --permission-mode, Codex's thread/resume sandbox), and nothing else is widened.
let dir: string, claudeId: string, codexId: string, app: App, server: RunningServer, launches: string[][], wire: string;
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-composer-model-menu-'));
  const root = join(dir, 'session-repository'); mkdirSync(root, { recursive: true });
  wire = join(dir, 'codex-wire.jsonl');
  const claudeJournal = join(dir, 'claude.jsonl'), codexJournal = join(dir, 'codex.jsonl');
  writeFileSync(claudeJournal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '66666666-6666-4666-8666-666666666666', cwd: root, timestamp: '2026-11-13T10:00:00Z', message: { role: 'user', content: 'Model menu session' } }) + '\n');
  writeFileSync(codexJournal, JSON.stringify({ type: 'session_meta', timestamp: '2026-11-13T10:00:00Z', payload: { id: '77777777-7777-4777-8777-777777777777', cwd: root } }) + '\n');
  // Synthetic transports with the shapes the real CLIs report (Claude Code 2.1: displayName plus a description that starts with the
  // version; Codex 0.165: a versioned displayName and permissionProfile/list). Names and versions are synthetic.
  const transport = join(dir, 'synthetic-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
import {appendFileSync} from 'node:fs';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
const mode=process.argv.includes('--permission-mode')?process.argv[process.argv.indexOf('--permission-mode')+1]:undefined;
createInterface({input:process.stdin}).on('line',line=>{
  const v=JSON.parse(line);
  if(v.method) appendFileSync(${JSON.stringify(wire)}, JSON.stringify({method:v.method,params:v.params})+'\\n');
  if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{current_permission_mode:'default',commands:[],models:[
    {value:'default',displayName:'Default (recommended)',description:'Synth 9.5 · Best for everyday, complex tasks',supportedEffortLevels:['low','high']},
    {value:'synth',displayName:'Synth',description:'Synth 9.5 · Best for everyday, complex tasks',supportedEffortLevels:['low','high']},
    {value:'quick',displayName:'Quick',description:'Quick 9.1 · Fastest for quick answers',supportedEffortLevels:['low']}]}}});
  if(v.type==='user') { send({type:'system',subtype:'init',tools:['Read'],model:'synth-9-5',permissionMode:mode==='manual'?'default':mode}); send({type:'result',is_error:false,result:'done'}); }
  if(v.method==='initialize') send({id:v.id,result:{}});
  if(v.method==='config/read') send({id:v.id,result:{config:{model:'synth-6.1',approval_policy:'on-request',sandbox_mode:'workspace-write'}}});
  if(v.method==='model/list') send({id:v.id,result:{data:[{model:'synth-6.1',displayName:'Synth-6.1',description:'Latest synthetic workhorse.',supportedReasoningEfforts:[{reasoningEffort:'low'}]},{model:'synth-6.1-mini',displayName:'Synth-6.1-Mini',description:'Fast synthetic model.',supportedReasoningEfforts:[]}],nextCursor:null}});
  if(v.method==='permissionProfile/list') send({id:v.id,result:{data:[{id:':read-only',description:null,allowed:true},{id:':workspace',description:null,allowed:true},{id:':danger-full-access',description:null,allowed:true}],nextCursor:null}});
  if(v.method==='thread/resume') send({id:v.id,result:{thread:{status:{type:'idle'}},approvalPolicy:'on-request',sandbox:{type:({'read-only':'readOnly','danger-full-access':'dangerFullAccess'})[v.params.sandbox]??'workspaceWrite'}}});
  if(v.method==='mcpServerStatus/list') send({id:v.id,result:{data:[],nextCursor:null}});
  if(v.method==='turn/start') { send({id:v.id,result:{turn:{id:'t1'}}}); send({method:'turn/completed',params:{turn:{status:'completed'}}}); }
});`);
  app = new App(join(dir, 'store'));
  claudeId = (await app.ingest.importSource('claude-code', claudeJournal)).recordingId;
  codexId = (await app.ingest.importSource('codex', codexJournal)).recordingId;
  launches = [];
  server = await startServer({ app, port: 0, token: 'synthetic-model-menu', controllerFactory: (a, w) => new HarnessController(a, w, { resolveExecutable: () => process.execPath, launch: ((_bin: string, args: string[], opts: any) => { launches.push(args); return spawn(process.execPath, [transport, ...args], opts); }) as typeof spawn }) });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

async function open(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const composer = page.getByRole('region', { name: 'Harness prompt' }); await expect(composer).toBeVisible();
  const pill = composer.getByRole('button', { name: 'Expand prompt', exact: true });
  if (await pill.count()) await pill.click();
  await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
  await expect(composer.locator('.composer-setup')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Model', exact: true }).click();
  await composer.getByRole('menuitem', { name: /Load model list/ }).click();
  await expect(composer.getByRole('button', { name: 'Permissions', exact: true })).toBeVisible();
  return composer;
}
/** Each row as the person reads it: its label, its quiet second line, whether it is checked, disabled and marked dangerous. */
const rows = (menu: Locator) => menu.locator(':scope>button').evaluateAll(buttons => buttons.map(b => ({ label: b.querySelector('span')!.childNodes[0]!.textContent, hint: b.querySelector('small')?.textContent ?? '', checked: b.getAttribute('aria-checked'), disabled: (b as HTMLButtonElement).disabled, danger: b.getAttribute('data-tone') === 'danger' })));
async function menuOf(composer: Locator, name: string) {
  await composer.getByRole('button', { name, exact: true }).click();
  const menu = composer.getByRole('menu', { name, exact: true }); await expect(menu).toBeVisible();
  // The menu stays inside the window and wraps its second lines instead of scrolling sideways.
  const box = await menu.evaluate(m => { const r = m.getBoundingClientRect(); return { left: r.left, right: r.right, sideways: m.scrollWidth > m.clientWidth, width: innerWidth }; });
  expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(box.width); expect(box.sideways).toBe(false);
  return menu;
}
async function send(composer: Locator, text: string) {
  const input = composer.getByRole('textbox', { name: 'Prompt for selected harness session' });
  await input.fill(text); await input.press('Enter');
  const confirmation = composer.getByRole('checkbox', { name: 'This session is idle in other clients' });
  await expect.poll(async () => await confirmation.isVisible() || await input.inputValue() === '').toBe(true);
  if (await confirmation.isVisible()) { await confirmation.check(); await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click(); }
  await expect(input).toHaveValue('');
}
const failColour = (page: Page) => page.evaluate(() => { const probe = document.createElement('i'); probe.style.color = 'var(--fail)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; });

for (const width of [1440, 600]) {
  test(`Claude Code: models with their versions, the four permission modes, and the chosen mode is what the next turn runs with at ${width}px`, async ({ page }) => {
    const composer = await open(page, claudeId, width);
    const models = await menuOf(composer, 'Model');
    // The harness's own "Default (recommended)" is the default; Drishya adds no second Default above it.
    expect(await rows(models)).toEqual([
      { label: 'Default (recommended)', hint: 'Synth 9.5 · Best for everyday, complex tasks', checked: 'true', disabled: false, danger: false },
      { label: 'Synth', hint: 'Synth 9.5 · Best for everyday, complex tasks', checked: 'false', disabled: false, danger: false },
      { label: 'Quick', hint: 'Quick 9.1 · Fastest for quick answers', checked: 'false', disabled: false, danger: false },
    ]);
    await page.keyboard.press('Escape');
    await expect(composer.getByRole('button', { name: 'Permissions', exact: true })).toHaveText('Default');
    const modes = await menuOf(composer, 'Permissions');
    expect(await rows(modes)).toEqual([
      { label: 'Default', hint: 'Asks before edits and commands', checked: 'true', disabled: false, danger: false },
      { label: 'Accept edits', hint: 'Edits files without asking; asks before commands', checked: 'false', disabled: false, danger: false },
      { label: 'Plan', hint: 'Reads and plans; changes nothing', checked: 'false', disabled: false, danger: false },
      { label: 'Bypass permissions', hint: 'Never asks · every edit and command runs', checked: 'false', disabled: false, danger: true },
    ]);
    const fail = await failColour(page);
    expect(await modes.locator('[data-tone=danger]').evaluate(b => getComputedStyle(b).color)).toBe(fail);
    await modes.getByRole('menuitemradio', { name: /^Bypass permissions/ }).click();
    // Chosen, bypass stays marked on the trigger at rest, in the error colour with its own icon and a title that says what it does.
    const trigger = composer.getByRole('button', { name: 'Permissions', exact: true });
    await expect(trigger).toHaveText('Bypass permissions'); await expect(trigger).toHaveClass(/is-bypass/);
    await expect(trigger).toHaveAttribute('title', /will not ask before edits or commands/);
    expect(await trigger.evaluate(b => getComputedStyle(b).color)).toBe(fail);
    // Choosing a model keeps the chosen mode.
    await (await menuOf(composer, 'Model')).getByRole('menuitemradio', { name: /^Quick/ }).click();
    await expect(trigger).toHaveText('Bypass permissions');
    await send(composer, 'Run with bypass');
    const flag = (args: string[]) => args[args.indexOf('--permission-mode') + 1];
    // The first launch is the explicit settings probe; turns are the launches that resume the session.
    const turns = () => launches.filter(args => args.includes('--resume'));
    await expect.poll(() => turns().length).toBe(1);
    expect(flag(turns()[0]!)).toBe('bypassPermissions');
    expect(turns()[0]!.slice(turns()[0]!.indexOf('--model'), turns()[0]!.indexOf('--model') + 2)).toEqual(['--model', 'quick']);
    expect(turns()[0]!.filter(a => /dangerously/.test(a))).toEqual([]);
    // Plan, then back to Default: the launch is exactly what it was before UI-43 (manual, every request asked in Drishya).
    for (const [label, expected] of [['Plan', 'plan'], ['Default', 'manual']] as const) {
      await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
      await (await menuOf(composer, 'Permissions')).getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click();
      await expect(trigger).toHaveText(label); await expect(trigger).not.toHaveClass(/is-bypass/);
      await send(composer, `Run in ${label}`);
      await expect.poll(() => turns().length).toBeGreaterThan(label === 'Plan' ? 1 : 2);
      expect(flag(turns().at(-1)!)).toBe(expected);
    }
  });

  test(`Codex: versioned models, its own permission profiles with the current one checked, full access passed as the sandbox at ${width}px`, async ({ page }) => {
    const composer = await open(page, codexId, width);
    const models = await menuOf(composer, 'Model');
    expect(await rows(models)).toEqual([
      { label: 'Default', hint: 'Synth-6.1', checked: 'true', disabled: false, danger: false },
      { label: 'Synth-6.1', hint: 'Latest synthetic workhorse.', checked: 'false', disabled: false, danger: false },
      { label: 'Synth-6.1-Mini', hint: 'Fast synthetic model.', checked: 'false', disabled: false, danger: false },
    ]);
    await page.keyboard.press('Escape');
    const trigger = composer.getByRole('button', { name: 'Permissions', exact: true });
    // Codex's configured sandbox is workspace-write, so Workspace is the current mode.
    await expect(trigger).toHaveText('Workspace');
    const modes = await menuOf(composer, 'Permissions');
    expect(await rows(modes)).toEqual([
      { label: 'Read only', hint: 'Reads files; asks before any change', checked: 'false', disabled: false, danger: false },
      { label: 'Workspace', hint: 'Edits in this workspace; asks beyond it', checked: 'true', disabled: false, danger: false },
      { label: 'Full access', hint: 'No sandbox · edits and runs anything', checked: 'false', disabled: false, danger: true },
    ]);
    // Without a choice, Drishya resumes under Codex's own settings and sends no sandbox at all.
    await page.keyboard.press('Escape');
    const frames = () => existsSync(wire) ? readFileSync(wire, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
    const resumes = () => frames().filter(f => f.method === 'thread/resume');
    await send(composer, 'Run as configured');
    await expect.poll(() => frames().filter(f => f.method === 'turn/start').length).toBe(1);
    expect(resumes()[0].params).not.toHaveProperty('sandbox');
    await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
    await (await menuOf(composer, 'Permissions')).getByRole('menuitemradio', { name: /^Full access/ }).click();
    await expect(trigger).toHaveText('Full access'); await expect(trigger).toHaveClass(/is-bypass/);
    await send(composer, 'Run with full access');
    await expect.poll(() => frames().filter(f => f.method === 'turn/start').length).toBe(2);
    expect(resumes()[1].params).toMatchObject({ sandbox: 'danger-full-access' });
    expect(resumes()[1].params).not.toHaveProperty('approvalPolicy');
    expect(Object.keys(frames().filter(f => f.method === 'turn/start')[1].params).sort()).toEqual(['input', 'threadId']);
    // An explicit step back is passed too, not left to whatever the last connected turn reported.
    await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
    await (await menuOf(composer, 'Permissions')).getByRole('menuitemradio', { name: /^Workspace/ }).click();
    await expect(trigger).toHaveText('Workspace'); await expect(trigger).not.toHaveClass(/is-bypass/);
    await send(composer, 'Back to workspace');
    await expect.poll(() => resumes().length).toBe(3);
    expect(resumes()[2].params).toMatchObject({ sandbox: 'workspace-write' });
  });
}
