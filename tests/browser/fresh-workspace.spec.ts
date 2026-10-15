import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, app: App, server: RunningServer;
const ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fresh-')); root = join(dir, 'shop');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), root, { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  git('add', '.'); git('commit', '-m', 'synthetic workspace');
  writeFileSync(join(root, 'src/cart/total.ts'), 'export const total = 42;\n');
  app = new App(join(dir, 'store'));
  for (const [adapter, fixture] of [['claude-code', 'claude/checkout-fix.jsonl'], ['codex', 'codex/rollout-checkout-review.jsonl']]) {
    const source = join(dir, `${adapter}.jsonl`);
    writeFileSync(source, readFileSync(resolve(`fixtures/synthetic/${fixture}`), 'utf8').replaceAll('/home/dev/shop', root.replaceAll('\\', '/')));
    ids[adapter!] = (await app.ingest.importSource(adapter!, source)).recordingId;
  }
  server = await startServer({ app, port: 0, token: 'synthetic-independent-design' });
});
test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

// The previous independent shell was retired by the builder. These tests protect
// the new contract: Modern shares Legacy behavior and only changes its surroundings.
for (const adapter of ['claude-code', 'codex']) test(`Modern ${adapter}: imported session, home, settings and reload`, async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[adapter]}`);
  await expect(page.locator('html')).toHaveAttribute('data-ui-version', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('.history')).toContainText(/checkout|discount|total/);
  await expect(page.locator('.fresh-app,.fr-action,.cv-workspace')).toHaveCount(0);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  await expect(settings.getByRole('button', { name:'Midnight',exact:true })).toBeVisible();
  await settings.getByRole('button', { name:'Midnight',exact:true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'midnight');
  await settings.getByRole('button', { name:'Close Workspace settings' }).click();
  await expect(settings).toHaveCount(0);
  await page.reload(); await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'midnight');
  await page.getByRole('button', { name:'Drishya',exact:true }).click();
  await expect(page.locator('.home')).toBeVisible();
  await page.goBack(); await expect(page.locator('.history')).toBeVisible();
});

test('Modern preserves Legacy action materials, typography, layout and native graph controls', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  const inspect = async (version:string) => {
    await page.goto(`${server.url}/?demo&experience=${version}&motion=0`);
    await expect(page.locator('.history article.op').first()).toBeAttached();
    return page.locator('.history article.op').evaluateAll(elements => elements.slice(0,6).map(el => {
      const css=getComputedStyle(el); return { id:el.getAttribute('data-op-id'), text:el.textContent, background:css.backgroundColor, border:css.borderRadius, font:css.fontFamily, size:css.fontSize, width:Math.round(el.getBoundingClientRect().width) };
    }));
  };
  const legacy=await inspect('classic'), modern=await inspect('modern');
  expect(modern).toEqual(legacy);
  await page.getByRole('button',{name:'Explore repository map'}).click();
  await expect(page.getByRole('button',{name:'Back to work',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings'});
  await expect(settings.getByRole('checkbox',{name:/3D repository map/})).toBeVisible();
  await expect(settings.getByRole('checkbox',{name:/Slow background orbit/})).toBeVisible();
});

test('Modern chrome fits wide, laptop and phone viewports; panels and settings remain reachable', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  for (const [width,height] of [[1920,1080],[1280,720],[900,600],[390,844]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator('.history')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Workspace settings'});
    await expect(dialog).toBeVisible();
    const box=(await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    await dialog.getByRole('button',{name:'Close Workspace settings'}).click();
    if(width<=820) await page.getByRole('button',{name:'Tools',exact:true}).click();
    await expect(page.locator('.workbench-station')).toBeVisible();
    const rail=(await page.locator('.workbench-station').boundingBox())!;
    expect(rail.x).toBeGreaterThanOrEqual(0); expect(rail.x+rail.width).toBeLessThanOrEqual(width+1);
  }
});

test('Modern native composer keeps attachments, outside dismissal and explicit consent', async ({ page }) => {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).fill('Inspect the checkout condition');
  await composer.getByRole('button',{name:'Add files or folders'}).click();
  await expect(composer.getByRole('button',{name:'Files or images',exact:true})).toBeVisible();
  await page.getByRole('heading',{level:1}).click();
  await expect(composer.getByRole('button',{name:'Files or images',exact:true})).toBeHidden();
  await expect(composer.getByRole('button',{name:'Send prompt',exact:true})).toBeDisabled();
  await composer.getByLabel('Choose prompt files').setInputFiles({name:'note.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic attachment for local testing')});
  await expect(composer.getByRole('button',{name:'Remove attachment note.txt'})).toBeVisible();
  await composer.getByRole('button',{name:'Remove attachment note.txt'}).click();
  await expect(composer.getByRole('button',{name:'Remove attachment note.txt'})).toHaveCount(0);
});

test('Modern colour and UI versions remain separate; Legacy does not load Modern chrome', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings'});
  await settings.getByRole('button',{name:'Paper',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette','paper');
  await settings.getByRole('tab',{name:'UI versions',exact:true}).click();
  await expect(settings.getByRole('button',{name:/^Modern/})).toHaveAttribute('aria-pressed','true');
  await settings.getByRole('button',{name:/^Legacy/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-version','classic');
  await expect(page.locator('.history')).toBeVisible();
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => { try { return [...sheet.cssRules].some(rule => rule.cssText.includes('data-ui-version="modern"')); } catch { return false; } }))).toBe(false);
});
