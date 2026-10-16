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
  const reviewJournal=join(dir,'review-pages.jsonl'), timestamp='2026-10-16T00:00:00Z';
  const reviewRows=[JSON.stringify({timestamp,type:'session_meta',payload:{id:'review-pages',cwd:root.replaceAll('\\','/')}})];
  for(let index=0;index<70;index++) {
    reviewRows.push(JSON.stringify({timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:`review-${index}`,arguments:JSON.stringify({cmd:`npm test -- review-case-${index}`})}}));
    reviewRows.push(JSON.stringify({timestamp,type:'response_item',payload:{type:'function_call_output',call_id:`review-${index}`,output:'1 passed'}}));
  }
  writeFileSync(reviewJournal,reviewRows.join('\n')+'\n');
  ids.review=(await app.ingest.importSource('codex',reviewJournal)).recordingId;
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

test('Modern preserves Legacy action materials, layout and native graph controls', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  const inspect = async (version:string) => {
    await page.goto(`${server.url}/?demo&experience=${version}&motion=0`);
    await expect(page.locator('.history article.op').first()).toBeAttached();
    return page.locator('.history article.op').evaluateAll(elements => elements.slice(0,6).map(el => {
      const css=getComputedStyle(el); return { id:el.getAttribute('data-op-id'), text:el.textContent, background:css.backgroundColor, border:css.borderRadius, size:css.fontSize, width:Math.round(el.getBoundingClientRect().width) };
    }));
  };
  const legacy=await inspect('classic'), modern=await inspect('modern');
  expect(modern).toEqual(legacy);
  await page.getByRole('button',{name:'Explore repository map'}).click();
  await expect(page.getByRole('button',{name:'Back to work',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings'});
  await settings.getByRole('tab',{name:'Reading',exact:true}).click();
  await expect(settings.getByRole('checkbox',{name:/3D repository map/})).toBeVisible();
  await expect(settings.getByRole('checkbox',{name:/Slow background orbit/})).toBeVisible();
});

test('Modern chrome fits wide, laptop and phone viewports; panels and settings remain reachable', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  for (const [width,height] of [[1920,1080],[1280,720],[900,600],[390,844]]) {
    await page.setViewportSize({width,height});
    await expect(page.locator('.history')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const header=(await page.locator('.modern-session-header').boundingBox())!;
    const title=(await page.locator('.modern-session-header h1').boundingBox())!;
    const actions=(await page.locator('.modern-session-header .studio-actions').boundingBox())!;
    expect(header.height).toBeLessThanOrEqual(64);
    expect(title.y).toBeGreaterThanOrEqual(header.y);
    expect(title.y+title.height).toBeLessThanOrEqual(header.y+header.height);
    expect(title.x+title.width).toBeLessThanOrEqual(actions.x);
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
  await expect(composer.getByRole('button',{name:'Attach text or image files',exact:true})).toBeVisible();
  await expect(composer.getByRole('button',{name:'Attach folder',exact:true})).toBeVisible();
  await composer.locator('.native-options>summary').click();
  await expect(composer.getByRole('button',{name:'Enable this workspace',exact:true})).toBeVisible();
  await page.getByRole('heading',{level:1}).click();
  await expect(composer.getByRole('button',{name:'Enable this workspace',exact:true})).toBeHidden();
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

test('Modern settings have allocated spacing, keyboard navigation and reachable controls', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Workspace settings'});
  const content=dialog.locator('.modern-settings-content');
  const panel=await content.boundingBox();
  const heading=await content.getByRole('heading',{name:'Appearance',exact:true}).boundingBox();
  expect(heading!.x-panel!.x).toBeGreaterThanOrEqual(20);
  expect(await dialog.evaluate(el=>getComputedStyle(el).fontFamily)).not.toContain('Outfit');
  await dialog.getByRole('tab',{name:'Appearance',exact:true}).focus();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('tab',{name:'Reading',exact:true})).toBeFocused();
  await expect(dialog.getByRole('combobox',{name:'Exposed reasoning detail'})).toBeVisible();
  await dialog.getByRole('combobox',{name:'Exposed reasoning detail'}).selectOption('collapsed');
  await expect(dialog.getByRole('combobox',{name:'Exposed reasoning detail'})).toHaveValue('collapsed');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Modern home has one sessions list and no duplicate imported local session', async ({ page }) => {
  await page.route('**/v1/sources',async route=>{
    const response=await route.fetch(); const body=await response.json();
    body.sources=[{adapterId:'codex',harness:'codex',path:'synthetic-source.jsonl',bytes:100,modifiedAt:new Date().toISOString(),title:'Duplicate imported session',importedRecordingId:ids.codex,companions:[]},{adapterId:'codex',harness:'codex',path:'synthetic-new.jsonl',bytes:100,modifiedAt:new Date().toISOString(),title:'Available local session',companions:[]}];
    await route.fulfill({json:body});
  });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern`);
  await expect(page.getByRole('heading',{name:'Recordings',exact:true})).toHaveCount(0);
  await expect(page.locator('#local-session-import')).toHaveCount(0);
  await expect(page.getByText('Available local session',{exact:true})).toBeVisible();
  await expect(page.getByText('Duplicate imported session',{exact:true})).toHaveCount(0);
});

test('Modern compact composer keeps connection consent accessible and has no needless scrollbar', async ({ page }) => {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  const input=composer.getByRole('textbox',{name:'Prompt for selected harness session'});
  await input.fill('A short prompt');
  expect((await composer.boundingBox())!.height).toBeLessThan(170);
  expect(await input.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
  await composer.locator('.native-options>summary').click();
  await expect(composer.getByRole('button',{name:'Enable this workspace',exact:true})).toBeVisible();
  await page.getByRole('heading',{level:1}).click();
  await expect(composer.getByRole('button',{name:'Enable this workspace',exact:true})).toBeHidden();
});

test('structured shell output renders decoded newlines and retains the exact raw envelope', async ({ page }) => {
  const bundle=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
  const op=[...bundle.projection.operations].reverse().find((o:any)=>o.kind==='shell');
  const raw=JSON.stringify({chunk_id:'synthetic',exit_code:0,output:'first line\nsecond line\nconst pattern = "\\n";'});
  op.detail.outputPreview=raw;
  await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  const card=page.locator(`article[data-op-id="${op.id}"]`);
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.structured-tool-output .output')).toContainText('first line\nsecond line');
  await expect(card.locator('.structured-tool-output .output')).toContainText('const pattern = "\\n";');
  await card.getByRole('button',{name:'Show raw',exact:true}).click();
  await expect(card.locator('.structured-tool-output .output')).toContainText(raw);
});

test('recovered Modern toolbox preserves actual instrument origins, filters and MCP drawers', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  const toolbox=page.getByRole('complementary',{name:'Tools and agents'});
  await expect(toolbox.getByText('Toolbox',{exact:true})).toBeVisible();
  const read=toolbox.locator('.instrument.k-read');
  await expect(read).toBeVisible();
  await read.click(); await expect(read).toHaveAttribute('aria-pressed','true');
  await toolbox.getByRole('button',{name:'Clear focus ×',exact:true}).click();
  const mcpServer=toolbox.locator('.md-server').filter({has:page.locator('[data-mcp-server]')}).first();
  await expect(mcpServer).toBeVisible();
  {
    await mcpServer.locator('summary').click();
    const tool=mcpServer.locator('button[data-mcp-tool]').first();
    await expect(tool).toBeVisible(); await tool.click();
    await expect(tool).toHaveAttribute('aria-pressed','true');
    await toolbox.getByRole('button',{name:'Clear focus ×',exact:true}).click();
  }
  await expect(page.getByRole('button',{name:'Show files',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Explore repository map',exact:true})).toHaveText('Repository');
  await expect(page.locator('.modern-session-header')).toBeVisible();
  await expect(page.locator('.modern-session-header .studio-session')).toContainText(/checkout|orders/);
});

test('Modern Git review opens on the right and reads actual staged/worktree patches', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  const git=page.getByRole('dialog',{name:'Git review',exact:true});
  await expect(git).toBeVisible();
  const bounds=(await git.boundingBox())!;
  expect(bounds.x).toBeGreaterThan(700); expect(bounds.x+bounds.width).toBeGreaterThan(1400);
  expect(bounds.width).toBeLessThanOrEqual(680);
  expect((await git.locator(':scope > header').boundingBox())!.height).toBeLessThanOrEqual(48);
  await expect(git.locator(':scope > header .git-branch-glyph')).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Tools and agents'}).getByRole('button',{name:'Git review',exact:true})).toHaveCount(0);
  if(await git.getByRole('button',{name:'Approve current workspace'}).isVisible()) await git.getByRole('button',{name:'Approve current workspace'}).click();
  await expect(git.getByRole('button',{name:'Approve read-only Git'}).or(git.getByRole('button',{name:'Refresh changes'}))).toBeVisible();
  if(await git.getByRole('button',{name:'Approve read-only Git'}).isVisible()) await git.getByRole('button',{name:'Approve read-only Git'}).click();
  await expect(git.getByRole('complementary',{name:'Git changed files'})).toBeVisible();
  await expect(git.locator('.git-review-layout')).toContainText('src/cart/total.ts');
  await expect(git.locator('.git-patch-reader')).toContainText('42');
  await page.screenshot({path:resolve('.local/modern-compact-git-test.png')});
  await git.getByRole('button',{name:'Close Git review'}).click();
  await expect(git).toHaveCount(0);
  await page.getByLabel('More workspace options',{exact:true}).click();
  const utilities=page.locator('.workspace-menu[open]');
  await expect(utilities.getByRole('button',{name:'Review work',exact:true})).toBeVisible();
  await expect(utilities.getByRole('button',{name:'Review questions',exact:true})).toBeVisible();
  await utilities.getByRole('button',{name:'Review work',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Review work',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close Review work',exact:true}).click();
  await page.getByLabel('More workspace options',{exact:true}).click();
  await utilities.getByRole('button',{name:'Review questions',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Review questions',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close Review questions',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  await expect(git).toBeVisible();
  const mobileBounds=(await git.boundingBox())!;
  expect(mobileBounds.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds.x+mobileBounds.width).toBeLessThanOrEqual(390);
  await git.getByRole('button',{name:'Close Git review'}).click();
});

for(const harness of ['codex','claude-code']) test(`recovered Modern ${harness} composer forwards text, attachments and native options with explicit consent`, async ({ page }) => {
  const state={available:true,state:'idle',harness,tools:[],inventory:'unknown',approvals:[],output:'',settings:{scope:'workspace',model:'native-one',permission:'Native policy',models:[{id:'native-one',name:'Native One',efforts:['low','high']} ]}};
  let payload:any;
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.route('**/controller/prompt',async route=>{payload=route.request().postDataJSON();await route.fulfill({json:{...state,state:'completed',runId:'synthetic-modern'}});});
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[harness]}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).fill('Review the selected source');
  await composer.getByLabel('Choose prompt files').setInputFiles({name:'context.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic context')});
  await composer.getByRole('combobox',{name:'Native model',exact:true}).selectOption('native-one');
  await composer.getByRole('combobox',{name:'Reasoning effort',exact:true}).selectOption('high');
  await composer.getByRole('button',{name:'Send prompt',exact:true}).click();
  expect(payload).toBeUndefined();
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();
  await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();
  await expect.poll(()=>payload).toBeDefined();
  expect(payload.prompt).toBe('Review the selected source');expect(payload.exclusive).toBe(true);
  expect(payload.attachments).toEqual([{name:'context.txt',type:'text',data:'Synthetic context'}]);
  expect(payload.options).toEqual({model:'native-one',effort:'high'});
});

test('Modern keeps file evidence, search controls and reading position across session detours', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['claude-code']}`);
  const history=page.locator('.history');
  await history.dispatchEvent('keydown',{key:'Home'});
  await history.evaluate(el => { el.scrollTop = 160; });
  await expect.poll(()=>history.evaluate(el=>el.scrollTop)).toBe(160);
  const anchor=await history.evaluate(el=>{const node=[...el.querySelectorAll<HTMLElement>('.passage-slot')].find(node=>node.getBoundingClientRect().bottom>el.getBoundingClientRect().top+1)!;return {id:node.dataset.passageId,offset:node.getBoundingClientRect().top-el.getBoundingClientRect().top};});
  const row = page.locator('[data-spine-path="src/cart/total.ts"]').first();
  await row.click();
  // Approved workspace state can differ between isolated journeys; follow its explicit captured destination.
  const disk = page.getByRole('dialog', {name:'src/cart/total.ts',exact:true});
  if(await disk.isVisible()) await disk.getByRole('button',{name:'Recorded work on this file'}).click();
  const reader=page.getByRole('dialog',{name:'Work on src/cart/total.ts',exact:true});
  await expect(reader).toBeVisible();
  await reader.getByLabel('Filter actions on this file').fill('Read');
  await page.evaluate(id => { location.hash=`#/r/${id}`; }, ids.codex);
  await expect(reader).toHaveCount(0);
  await expect(page.locator('.history')).toBeVisible();
  await page.evaluate(id => { location.hash=`#/r/${id}`; }, ids['claude-code']);
  await expect(reader).toBeVisible();
  await expect(reader.getByLabel('Filter actions on this file')).toHaveValue('Read');
  await reader.getByRole('button',{name:'Close Work on src/cart/total.ts'}).click();
  await expect.poll(()=>history.evaluate((el,anchor)=>{const node=[...el.querySelectorAll<HTMLElement>('.passage-slot')].find(node=>node.dataset.passageId===anchor.id);return node?Math.abs(node.getBoundingClientRect().top-el.getBoundingClientRect().top-anchor.offset):Infinity;},anchor)).toBeLessThan(3);
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  await page.getByRole('button',{name:'Close Workspace settings'}).click();
  await expect(page.locator('.history')).toBeVisible();
});


test('Modern retains Git scope and find controls after closing and reopening a reader', async ({page}) => {
  const snapshot={root,branch:'synthetic',head:'abc123',fingerprint:'page1',sampledAt:'2026-10-16T00:00:00Z',omitted:0,limit:50,pageStart:0,totalAllowed:1,protectedCount:0,files:[{path:'sample.ts',status:' M',fingerprint:'exact-patch',patch:'Working tree changes\ndiff --git a/sample.ts b/sample.ts\n--- a/sample.ts\n+++ b/sample.ts\n@@ -1 +1 @@\n-old\n+new',staged:false}]};
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.route('**/git',route=>route.fulfill({json:{approved:true,scope:'current-git'}}));
  await page.route('**/git/snapshot**',route=>route.fulfill({json:snapshot}));
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'Git review',exact:true});
  await expect(reader.getByRole('searchbox',{name:'Find in patch'})).toBeVisible();
  await reader.getByRole('searchbox',{name:'Find in patch'}).fill('new');
  await reader.getByRole('button',{name:'Side by side',exact:true}).click();
  await reader.getByRole('button',{name:'Close Git review'}).click();
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  await expect(reader.getByRole('searchbox',{name:'Find in patch'})).toHaveValue('new');
  await expect(reader.getByRole('button',{name:'Side by side',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('Modern map camera and folder keyboard state survive a session detour', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['claude-code']}`);
  const folder=page.getByRole('treeitem',{name:'src',exact:true});
  await expect(folder).toHaveAttribute('aria-expanded','true');
  await folder.focus(); await page.keyboard.press('ArrowLeft');
  await expect(folder).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Explore repository map'}).click();
  await page.getByRole('button',{name:'Zoom into repository',exact:true}).click();
  const zoom=await page.locator('.map').getAttribute('data-map-zoom');
  await page.evaluate(id=>{location.hash=`#/r/${id}`;},ids.codex);
  await expect(page.locator('.map-tools')).toHaveCount(0);
  await page.evaluate(id=>{location.hash=`#/r/${id}`;},ids['claude-code']);
  await expect(page.locator('.map-tools')).toBeVisible();
  await expect(page.locator('.map')).toHaveAttribute('data-map-zoom',zoom!);
  await page.getByRole('button',{name:'Back to work',exact:true}).click();
  await expect(folder).toHaveAttribute('aria-expanded','false');
  await folder.focus(); await page.keyboard.press('ArrowRight');
  await expect(folder).toHaveAttribute('aria-expanded','true');
});

test('Modern queues overlapping file preparation, previews text and retains rejected prompt drafts', async ({page}) => {
  const state={available:true,state:'idle',harness:'codex',tools:[],inventory:'unknown',approvals:[],output:''};
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.route('**/controller/prompt',route=>route.fulfill({status:409,json:{error:'Synthetic rejected turn; retry after checking the target'}}));
  // A delayed browser File read exposes the concurrent-selection path deterministically.
  await page.addInitScript(() => { const read=File.prototype.arrayBuffer; File.prototype.arrayBuffer=async function(){await new Promise(resolve=>setTimeout(resolve,250));return read.call(this);}; });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt'}), files=composer.getByLabel('Choose prompt files');
  await files.setInputFiles({name:'one.txt',mimeType:'text/plain',buffer:Buffer.from('First prepared text')});
  await files.setInputFiles({name:'two.txt',mimeType:'text/plain',buffer:Buffer.from('Second prepared text')});
  await expect(composer.locator('.attachment-chip')).toHaveCount(2);
  await composer.getByRole('button',{name:'Preview attachment two.txt',exact:true}).click();
  const preview=page.getByRole('dialog',{name:'Attachment: two.txt',exact:true});
  await expect(preview).toContainText('Second prepared text');
  await preview.getByRole('button',{name:'Close Attachment: two.txt'}).click();
  const input=composer.getByRole('textbox',{name:'Prompt for selected harness session'});
  await input.fill('🙂'.repeat(16_385));
  await expect(input).toHaveAttribute('aria-invalid','true');
  await expect(composer.getByRole('button',{name:'Send prompt',exact:true})).toBeDisabled();
  await input.fill('Retain this draft if the server rejects it');
  await expect(composer.getByRole('button',{name:'Send prompt',exact:true})).toBeEnabled();
  await composer.getByRole('button',{name:'Send prompt',exact:true}).click();
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();
  await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();
  await expect(composer.getByRole('alert')).toContainText('Synthetic rejected turn');
  await expect(input).toHaveValue('Retain this draft if the server rejects it');
  await expect(composer.locator('.attachment-chip')).toHaveCount(2);
  await files.setInputFiles({name:'invalid.bin',mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2])});
  await expect(composer.getByRole('button',{name:'Retry rejected files'})).toBeVisible();
  await expect(composer.locator('.attachment-chip')).toHaveCount(2);
});

test('Modern server restart authentication preserves cached reading and disables sending', async ({page}) => {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await expect(page.locator('.history')).toBeVisible();
  await page.locator('.history').evaluate(el => el.setAttribute('data-cached-reading-test','retained'));
  const actions=await page.locator('.history article.op').evaluateAll(nodes => nodes.map(node=>node.getAttribute('data-op-id')));
  await page.context().clearCookies();
  await page.context().setOffline(true);
  const notice=page.getByRole('status',{name:'Local server connection'});
  await expect(notice).toContainText('Disconnected');
  await expect(page.locator('.history')).toHaveAttribute('data-cached-reading-test','retained');
  expect(await page.locator('.history article.op').evaluateAll(nodes => nodes.map(node=>node.getAttribute('data-op-id')))).toEqual(actions);
  await page.context().setOffline(false);
  await notice.getByRole('button',{name:'Retry connection'}).click();
  await expect(notice).toContainText('Server sign-in required');
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.getByRole('button',{name:'Send prompt',exact:true})).toBeDisabled();
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
});

test('Modern offline bundle keeps keyboard review destinations and bounded phone reading', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  await expect(page.locator('.history')).toBeVisible();
  await page.keyboard.press('Control+k');
  const command=page.getByRole('dialog',{name:'Navigate workspace'});
  await command.getByRole('combobox').fill('Review questions');
  await command.getByRole('option',{name:/Review questions/}).click();
  await expect(page.getByRole('dialog',{name:'Review questions',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.context().setOffline(true);
  await page.getByRole('button',{name:'Explore repository map'}).click();
  await expect(page.locator('.map-tools')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('region',{name:'Harness prompt'})).toHaveCount(0);
});


test('Modern review pages reach every captured check beyond the first twenty without changing global counts', async ({page}) => {
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.review}`);
  await expect(page.locator('.history')).toBeVisible();
  await page.keyboard.press('Control+k');
  const commands=page.getByRole('dialog',{name:'Navigate workspace'});
  await commands.getByRole('combobox').fill('Review recorded changes');
  await commands.getByRole('option',{name:/Review recorded changes and checks/}).click();
  const review=page.getByRole('dialog',{name:'Review work',exact:true});
  const checks=review.getByRole('region',{name:'Recorded checks',exact:true});
  await expect(checks.locator('.review-item')).toHaveCount(20);
  await expect(review.locator('.review-counts')).toContainText('70 test runs');
  await expect(review.getByRole('navigation',{name:'Recorded review pages'})).toContainText('Page 1 of 4');
  await review.getByRole('button',{name:'Next review page',exact:true}).click();
  await expect(checks).toContainText('review-case-20');
  await expect(checks).not.toContainText('review-case-0 ');
  await review.getByRole('button',{name:'Next review page',exact:true}).click();
  await expect(checks).toContainText('review-case-40');
  await review.getByRole('button',{name:'Next review page',exact:true}).click();
  await expect(checks.locator('.review-item')).toHaveCount(10);
  await expect(checks).toContainText('review-case-69');
  await expect(review.locator('.review-counts')).toContainText('70 test runs');
  await expect(review.getByRole('button',{name:'Next review page',exact:true})).toBeDisabled();
  await checks.getByRole('button',{name:/review-case-69/}).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('complementary',{name:'Operation detail'})).toContainText('review-case-69');
});


test('Modern qualifies cached native receipts instead of claiming a current agent phase while disconnected', async ({page}) => {
  await page.route('**/controller',route=>route.fulfill({json:{available:true,state:'running',runId:'synthetic-receipt',harness:'codex',tools:[],inventory:'unknown',approvals:[],output:'',phase:'thinking',afterSequence:100000,preview:{id:'synthetic-preview',role:'response',text:'Synthetic native receipt already received',exposure:'full'}}}));
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const receipt=page.getByRole('region',{name:'Native turn progress'});
  await expect(receipt).toContainText('Live from harness');
  await page.context().setOffline(true);
  await expect(receipt).toContainText('Last received from harness');
  await expect(receipt).toContainText('native turn state may have changed');
  await expect(receipt).not.toContainText('Thinking…');
  await expect(receipt).toContainText('Synthetic native receipt already received');
});
