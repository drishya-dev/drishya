import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';

let dir: string, id: string, app: App, server: RunningServer;
// A fresh app and server per test: workspace grants and the native run persist on the server and would change what the next test opens.
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-composer-type-'));
  const root = join(dir, 'session-repository'); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'actual.ts'), 'export const value = 42;\n');
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '55555555-5555-4555-8555-555555555555', cwd: root, timestamp: '2026-10-07T12:00:00Z', message: { role: 'user', content: 'Composer typography session' } }) + '\n');
  // A synthetic native harness: advertises one model with efforts, asks for one Edit approval, or asks a question.
  const transport = join(dir, 'synthetic-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{
  const v=JSON.parse(line);
  if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[{value:'synthetic-model',displayName:'Synthetic model',supportedEffortLevels:['low','high']}],commands:[]}}});
  if(v.type==='user') {
    if(v.message.content==='QUESTION') { send({type:'control_request',request_id:'ask-native',request:{subtype:'can_use_tool',tool_name:'AskUserQuestion',input:{questions:[{question:'Which checks?',header:'Checks',multiSelect:true,options:[{label:'Unit tests',description:'Fast focused checks'},{label:'Typecheck',description:'Validate types'}]}]}}}); return; }
    send({type:'system',subtype:'init',tools:['Read','Edit']});
    send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'src/actual.ts',new_string:'export const value = 43;'}}});
  }
  if(v.type==='control_response') send({type:'result',is_error:false,result:'done'});
});`);
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-composer-type', controllerFactory: (a, w) => new HarnessController(a, w, { resolveExecutable: () => process.execPath, launch: ((_bin: string, _args: string[], opts: any) => spawn(process.execPath, [transport], opts)) as typeof spawn }) });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-2: the Modern composer keeps metadata at 11 px and every control and control label at 12 px, in each state it can be
// put in with synthetic data. Surfaces measured: the composer, its attachment preview dialog and the workspace-reading grant that
// shares its wording. SVG glyphs are not text; icon-only buttons have no text to size.
const SCOPE = '[aria-label="Harness prompt"], .attachment-preview-dialog, .workspace-grant';
// Rules this slice raised: their text must also keep 4.5:1 on the composited background on every palette.
const RAISED = ['.modern-composer-state', '.modern-native-model', '.native-options > summary', '.native-options-menu small', '.composer-menu-trigger', '.composer-menu small', '.composer-setup', '.composer-setup label', '#prompt-size-status', '.send-confirmation small', '.attachment-chip button', '.tool-approval', '.tool-approval button', '.native-questions > header span', '.workspace-grant', '.workspace-grant small', '.send-prompt', '.stop-turn', '.modern-composer-input-tools select'].join(',');

async function failures(page: Page) {
  return page.evaluate(({ scope, raised }) => {
    const result: string[] = [];
    const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const over = (front: number[], back: number[]) => front.slice(0, 3).map((v, i) => v * front[3]! + back[i]! * (1 - front[3]!)).concat(1);
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i]!, 0);
    let measured = 0;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.closest(scope) || !el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches('svg *, option, input[type=checkbox], input[type=file]')) continue;
      const control = el.matches('button, summary, select, textarea, input');
      // A button or summary is sized by its own font even when its words sit in a child span; its nested captions keep the 11 px metadata floor.
      const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) || (control && !!((el as HTMLInputElement).placeholder || el.matches('select') || (el.matches('button, summary') && el.textContent?.trim())));
      if (!text) continue;
      const style = getComputedStyle(el), size = parseFloat(style.fontSize);
      const label = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 28)}"`;
      const floor = control ? 12 : 11;
      measured++;
      if (size < floor) result.push(`${label}: ${style.fontSize} < ${floor}px`);
      if (el.matches(raised) && !el.matches(':disabled')) {
        const parents: Element[] = []; for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
        let background = [255, 255, 255, 1]; for (const p of parents) background = over(rgba(getComputedStyle(p).backgroundColor), background);
        const a = luma(over(rgba(style.color), background)), b = luma(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (ratio < 4.5) result.push(`${label}: contrast ${ratio.toFixed(2)}`);
      }
    }
    if (!measured) result.push('nothing was measured');
    return result;
  }, { scope: SCOPE, raised: RAISED });
}
async function everyPalette(page: Page, state: string) {
  for (const palette of ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']) {
    await page.evaluate(value => { document.documentElement.dataset.palette = value; }, palette);
    // Colour transitions must settle before measuring, but a spinner never finishes: wait only for finite running animations, bounded.
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))), new Promise(done => setTimeout(done, 1500))]));
    expect(await failures(page), `${state} / ${palette}`).toEqual([]);
  }
}
// Keyboard, not a resting pointer: hover reading can move the cards under it.
async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const composer = page.getByRole('region', { name: 'Harness prompt' }); await expect(composer).toBeVisible();
  return composer;
}
async function expand(composer: Locator) {
  const pill = composer.getByRole('button', { name: 'Expand prompt', exact: true });
  if (await pill.count()) await pill.click();
  await expect(composer.getByRole('button', { name: 'Minimize prompt', exact: true })).toBeVisible();
}
async function send(page: Page, composer: Locator, prompt: string) {
  const input = composer.getByRole('textbox', { name: 'Prompt for selected harness session' });
  await input.fill(prompt); await input.press('Enter');
  // CONNECT-4a: the first native send asks; later sends in this connection proceed directly.
  const confirmation=composer.getByRole('checkbox', { name: 'This session is idle in other clients' });
  await expect.poll(async()=>await confirmation.isVisible()||await input.inputValue()==='').toBe(true);
  if(await confirmation.isVisible()) {
    await confirmation.check();
    await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click();
  }
}

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`the composer keeps metadata at 11 px, controls at 12 px and the raised text at 4.5:1 while drafting at ${width}px`, async ({ page }) => {
    const composer = await open(page, width, height);
    await everyPalette(page, `${width} idle pill`);
    await expand(composer);
    await everyPalette(page, `${width} expanded`);
    const input = composer.getByRole('textbox', { name: 'Prompt for selected harness session' });
    await input.fill('A draft with text');
    await everyPalette(page, `${width} draft`);
    // UI-28: the setup row before the workspace is enabled, then the product menus once it is and the model list is read.
    await expect(composer.getByRole('button', { name: 'Enable this workspace', exact: true })).toBeVisible();
    await everyPalette(page, `${width} setup row (workspace not enabled)`);
    await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
    await expect(composer.locator('.composer-setup')).toHaveCount(0);
    await composer.getByRole('button', { name: 'Model', exact: true }).click();
    await everyPalette(page, `${width} model menu (list not read)`);
    await composer.getByRole('menuitem', { name: /Load model list/ }).click();
    await expect(composer.getByRole('button', { name: 'Model', exact: true })).toBeEnabled();
    await composer.getByRole('button', { name: 'Model', exact: true }).click();
    await expect(composer.getByRole('menuitemradio', { name: 'Synthetic model' })).toBeVisible();
    await everyPalette(page, `${width} model menu`);
    await composer.getByRole('menuitemradio', { name: 'Synthetic model' }).click();
    await expect(composer.getByRole('button', { name: 'Reasoning effort', exact: true })).toBeVisible();
    await composer.getByRole('button', { name: 'Reasoning effort', exact: true }).click();
    await everyPalette(page, `${width} effort menu`);
    await page.keyboard.press('Escape');
    await composer.getByRole('button', { name: 'Attach', exact: true }).click();
    await everyPalette(page, `${width} attach menu`);
    await page.keyboard.press('Escape');
    // Attachments: a text file, a pasted image and a folder, then the preview dialog.
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    await composer.locator('input[aria-label="Choose prompt files"]').setInputFiles({ name: 'source.ts', mimeType: 'text/plain', buffer: Buffer.from('export const attached = true;') });
    await input.evaluate((el, image) => { const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob(image), char => char.charCodeAt(0))], 'screenshot.png', { type: 'image/png' })); el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })); }, png);
    await composer.locator('input[aria-label="Choose prompt folder"]').setInputFiles(join(dir, 'session-repository'));
    await expect(composer.locator('.attachment-chip')).toHaveCount(3);
    await everyPalette(page, `${width} attachments (file, pasted image, folder)`);
    await composer.getByRole('button', { name: 'Preview attachment source.ts', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.attachment-preview-dialog')).toBeVisible();
    await everyPalette(page, `${width} attachment preview`);
    await page.keyboard.press('Escape'); await expect(page.locator('.attachment-preview-dialog')).toHaveCount(0);
    // The field stops at 65,536 characters but the limit is 64 KiB of UTF-8, so multi-byte text is how a draft goes over it.
    await input.fill('é'.repeat(40_000));
    await expect(composer.getByRole('alert').filter({ hasText: 'Prompt exceeds 64 KiB' })).toBeVisible();
    await everyPalette(page, `${width} over-limit prompt`);
    // The session-access confirmation that stands between a prompt and the native harness.
    await input.fill('Review the attachments'); await input.press('Enter');
    await expect(composer.getByRole('group', { name: 'Confirm session access' })).toBeVisible();
    await everyPalette(page, `${width} send confirmation`);
  });

  test(`the composer keeps the type floor while a native turn runs, waits for approval, stops and asks a question at ${width}px`, async ({ page }) => {
    const composer = await open(page, width, height);
    await expand(composer);
    await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
    await expect(composer.locator('.composer-setup')).toHaveCount(0);
    await send(page, composer, 'Edit the file');
    await expect(composer.locator('.tool-approval')).toBeVisible();
    await everyPalette(page, `${width} running with an approval request`);
    await composer.getByRole('button', { name: 'Minimize prompt', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(composer.getByRole('button', { name: 'Expand prompt', exact: true })).toBeVisible();
    await everyPalette(page, `${width} minimized while an approval waits`);
    await composer.getByRole('button', { name: 'Expand prompt', exact: true }).focus(); await page.keyboard.press('Enter');
    await composer.getByRole('button', { name: 'Stop turn', exact: true }).first().focus(); await page.keyboard.press('Enter');
    await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
    await everyPalette(page, `${width} stopped`);
    await send(page, composer, 'QUESTION');
    await expect(page.getByRole('form', { name: 'Agent needs your input' })).toBeVisible();
    await everyPalette(page, `${width} agent question`);
  });

  test(`the composer keeps the type floor when a send fails at ${width}px`, async ({ page }) => {
    const composer = await open(page, width, height);
    await expand(composer);
    await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
    await expect(composer.locator('.composer-setup')).toHaveCount(0);
    await page.route('**/controller/prompt', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'synthetic', message: 'The synthetic harness refused this prompt.' } }) }));
    await send(page, composer, 'This send fails');
    await expect(composer.getByRole('alert')).toBeVisible();
    await everyPalette(page, `${width} send failed`);
  });

  test(`the composer keeps the type floor when the native connection cannot be reached at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.route('**/controller', route => route.abort());
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    const composer = page.getByRole('region', { name: 'Harness prompt' }); await expect(composer).toBeVisible();
    await expect(composer.getByRole('button', { name: 'Expand prompt', exact: true })).toBeVisible();
    await everyPalette(page, `${width} unreachable (pill)`);
    await expand(composer);
    await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toHaveAttribute('title', /Connection .* unavailable/);
    await everyPalette(page, `${width} unreachable (expanded)`);
  });
}
