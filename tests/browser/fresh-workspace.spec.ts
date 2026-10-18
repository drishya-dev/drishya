import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Locator } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, app: App, server: RunningServer;
const ids: Record<string, string> = {};
async function pasteDraft(editor:Locator,text:string) {
  await editor.focus();await editor.press('Control+a');
  await editor.evaluate((node,text)=>{const data=new DataTransfer();data.setData('text/plain',text);node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},text);
}

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fresh-')); root = join(dir, 'shop');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), root, { recursive: true });
  writeFileSync(join(root,'src/cart/reading.ts'),Array.from({length:450},(_,i)=>`export const reviewLine${i+1} = ${i+1};`).join('\n'));
  writeFileSync(join(root,'src/cart/large.ts'),Array.from({length:10000},(_,i)=>`export const largeLine${i+1} = ${i+1};`).join('\n'));
  writeFileSync(join(root,'src/cart/comparison.ts'),Array.from({length:1500},(_,i)=>`export const baseLine${i+1} = ${i+1};`).join('\n'));
  writeFileSync(join(root,'src/cart/endings.ts'),'function run() {\r\n    return 42;\r\n}\r\n');
  writeFileSync(join(root,'src/cart/mixed.ts'),'const first = 1;\r\nconst second = 2;\n');
  writeFileSync(join(root,'src/cart/versions.ts'),'export const version = 1;\n');
  writeFileSync(join(root,'README.md'),'# Workspace guide\n\nA **readable** document.\n\n| Feature | State |\n| --- | --- |\n| Reading | Ready |\n\n> Current source, safely rendered.\n\n```ts\nexport const ready = true;\n```\n');
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
test.beforeEach(async({request})=>{await request.delete(`${server.url}/v1/working-locations`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'}});});

test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

test('opening stored history catches up its native journal and enables live observation',async({page})=>{
  const path=join(dir,'catch-up.jsonl'), timestamp='2026-10-16T12:00:00Z';
  const meta=JSON.stringify({timestamp,type:'session_meta',payload:{id:'catch-up',cwd:root}})+'\n';
  writeFileSync(path,meta);
  const {recordingId}=await app.ingest.importSource('codex',path);
  writeFileSync(path,meta+JSON.stringify({timestamp,type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'JOURNAL_CATCHUP_CONFIRMED'}]}})+'\n');
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
  await expect(page.locator('.history')).toContainText('JOURNAL_CATCHUP_CONFIRMED');
  expect(app.ingest.isLive(recordingId)).toBe(true);
});

test('Modern settings resets section reading, follows responsive tab orientation and retains native select semantics',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});
  const nav=settings.getByRole('tablist',{name:'Settings sections',exact:true});
  await expect(nav).toHaveAttribute('aria-orientation','vertical');
  await settings.getByRole('tab',{name:'Reading',exact:true}).click();
  const panel=settings.locator('.modern-settings-content');
  await panel.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await expect.poll(()=>panel.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
  await settings.getByRole('tab',{name:'Appearance',exact:true}).click();
  await expect.poll(()=>panel.evaluate(node=>node.scrollTop)).toBe(0);
  await settings.getByRole('tab',{name:'Reading',exact:true}).click();
  const select=settings.getByRole('combobox',{name:'Exposed reasoning detail',exact:true});
  await select.selectOption('collapsed');await select.focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');
  await expect(select).toBeFocused();await expect(select).toHaveValue('collapsed');await expect(settings).toBeVisible();
  await page.setViewportSize({width:390,height:844});await expect(nav).toHaveAttribute('aria-orientation','horizontal');
  await settings.getByRole('tab',{name:'Reading',exact:true}).focus();await page.keyboard.press('End');
  await expect(settings.getByRole('tab',{name:'UI versions',exact:true})).toBeFocused();
  await expect(settings.getByRole('tab',{name:'UI versions',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await panel.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve('.local/settings-phone-navigation-refined.png')});
  await page.keyboard.press('Escape');await expect(settings).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Workspace settings',exact:true})).toBeFocused();
});

test('Modern composer keeps its target and state visible, with direct Files and Workspace navigation',async({page})=>{
  const state={available:true,state:'idle',harness:'codex',tools:[],inventory:'unknown',approvals:[],output:''};
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt',exact:true});
  for(const width of [1440,600,390]) {
    await page.setViewportSize({width,height:900});
    await expect(composer.locator('.modern-composer-location')).toContainText('shop');
    await expect(composer.locator('.modern-composer-location code')).toHaveText(ids.codex!.slice(-8));
    await expect(composer.locator('.modern-composer-state')).toBeVisible();
    expect(await composer.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
    const promptBox=(await composer.boundingBox())!;
    for(const control of [page.getByRole('button',{name:'Tools',exact:true}),page.getByRole('switch',{name:'Automatically follow new work',exact:true})]) {
      if(!await control.isVisible())continue;
      await expect.poll(async()=>{const box=(await control.boundingBox())!;return Math.max(0,Math.min(box.x+box.width,promptBox.x+promptBox.width)-Math.max(box.x,promptBox.x))*Math.max(0,Math.min(box.y+box.height,promptBox.y+promptBox.height)-Math.max(box.y,promptBox.y));}).toBeLessThan(1);
    }
  }
  await page.screenshot({path:resolve('.local/composer-visible-target-phone.png')});
  await page.keyboard.press('Control+k');
  const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});
  await expect(nav).toBeVisible();
  await nav.getByRole('combobox').fill('Open developer workspace');await page.keyboard.press('Enter');
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await expect(desk).toBeVisible();
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await page.keyboard.press('Control+k');await nav.getByRole('combobox').fill('Browse workspace files');await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary',{name:'Repository files',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Find repository files',exact:true})).toBeFocused();
});

test('Home surfaces changed imported journals and keeps filter menus keyboard accessible',async({page})=>{
  const recording=app.store.getRecording(ids.codex!)!;
  await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[{adapterId:'codex',harness:'codex',path:'synthetic-current.jsonl',cwd:root,title:recording.title,modifiedAt:new Date().toISOString(),bytes:999999999,importedRecordingId:recording.id}],errors:[]}}));
  await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();
  await expect(page.getByText('Journal updated',{exact:true})).toBeVisible();
  const filter=page.getByRole('combobox',{name:'Harness',exact:true});
  await filter.selectOption('codex');await expect(filter).toHaveValue('codex');
  await filter.focus();await page.keyboard.press('Space');await page.keyboard.press('Escape');
  await expect(filter).toBeFocused();await expect(filter).toHaveValue('codex');
  await filter.click();await page.getByRole('heading',{name:'Your agents. In view.'}).click();
  await expect(filter).toHaveValue('codex');
  await page.screenshot({path:resolve('.local/home-refined-filters.png')});
});

test('Home dense sessions remain reachable through virtualization and responsive resizing',async({page})=>{
  const base=app.store.getRecording(ids.codex!)!;
  const recordings=Array.from({length:160},(_,index)=>({...base,id:`density-${index}`,title:`Session ${String(index).padStart(3,'0')} · ${index%3===0?'Review a long workspace path and its complete captured verification — परीक्षण 🚀':'Read changes'}`,workspaceRoot:index%2===0?'/work/alpha':'/work/beta',lastSourceTime:new Date(Date.now()-index*3600000).toISOString()}));
  await page.route(/\/v1\/recordings$/,route=>route.fulfill({json:{recordings}}));
  await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[],errors:[]}}));
  await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);
  const list=page.locator('.mh-session-list'),rows=page.locator('.mh-session');
  await expect(rows.first()).toBeVisible();
  expect(await rows.first().evaluate(node=>node.getBoundingClientRect().height)).toBe(80);
  expect(await rows.first().locator('.mh-session-open>span').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
  await list.evaluate(node=>{node.scrollTop=1200;});
  await expect.poll(()=>list.evaluate(node=>node.scrollTop)).toBe(1200);
  await expect.poll(()=>list.evaluate(node=>{const edge=node.getBoundingClientRect().top;return [...node.querySelectorAll('.mh-session')].find(row=>row.getBoundingClientRect().bottom>edge+1)?.querySelector('strong')?.getAttribute('title');})).toMatch(/^Session /);
  const key=await list.evaluate(node=>{const edge=node.getBoundingClientRect().top;return [...node.querySelectorAll('.mh-session')].find(row=>row.getBoundingClientRect().bottom>edge+1)?.querySelector('strong')?.getAttribute('title');});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>rows.first().evaluate(node=>node.getBoundingClientRect().height)).toBe(104);
  await expect.poll(()=>list.evaluate(node=>{const edge=node.getBoundingClientRect().top;return [...node.querySelectorAll('.mh-session')].find(row=>row.getBoundingClientRect().bottom>edge+1)?.querySelector('strong')?.getAttribute('title');})).toBe(key);
  expect(await page.locator('.mh-home').evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
  await list.evaluate(node=>{node.scrollTop=0;});
  const seen=new Set<string>();
  for(let index=0;index<160&&seen.size<160;index++) {
    for(const title of await rows.locator('strong').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('title')!)))seen.add(title);
    await list.evaluate(node=>{node.scrollTop+=Math.max(100,node.clientHeight*.8);});
    await page.waitForTimeout(25);
  }
  expect(seen.size,'No session should be skipped when more virtual rows are loaded').toBe(160);
  await expect(rows.filter({hasText:'Session 159'})).toBeVisible();
  await page.setViewportSize({width:390,height:640});
  expect(await list.evaluate(node=>node.clientHeight)).toBeGreaterThan(120);
  await page.screenshot({path:resolve('.local/home-dense-phone-short.png')});
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
  await expect(settings.getByRole('button', { name:'Deep Ocean',exact:true })).toBeVisible();
  await settings.getByRole('button', { name:'Deep Ocean',exact:true }).click();
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
    const history=page.locator('.history');await expect(history).toBeVisible();
    await history.dispatchEvent('wheel',{deltaY:-1});
    await history.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
    await expect.poll(()=>history.evaluate(el=>el.scrollTop)).toBe(0);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    return page.evaluate(() => [...document.querySelectorAll('.history article.op')].slice(0,6).map(el => {
      const css=getComputedStyle(el); return { id:el.getAttribute('data-op-id'), text:el.textContent, background:css.backgroundColor, border:css.borderRadius, size:css.fontSize, width:Math.round(el.getBoundingClientRect().width) };
    }));
  };
  const legacy=await inspect('classic'), modern=await inspect('modern');
  // Palettes intentionally differ; shared captured content, allocation and type remain equal.
  expect(modern.map(({background:_,...material})=>material)).toEqual(legacy.map(({background:_,...material})=>material));
  expect(modern.every(material=>material.background==='rgb(18, 18, 18)')).toBe(true);
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

test('Modern header retains its title on hover and click, utilities center, and fresh folders start closed',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const title=page.locator('.modern-session-header h1');
  const original=await title.textContent(), before=await title.boundingBox();
  await title.hover();await title.click();
  await expect(title).toBeVisible();await expect(title).toHaveText(original!);
  expect(await title.boundingBox()).toEqual(before);
  expect(await page.locator('.modern-session-header').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
  for(const selector of ['.settings-open','.workspace-menu>summary','.search-open']) {
    const button=page.locator(`.modern-session-header ${selector}`),glyph=button.locator('svg');
    const outer=(await button.boundingBox())!,inner=(await glyph.boundingBox())!;
    expect(Math.abs(outer.x+outer.width/2-inner.x-inner.width/2)).toBeLessThan(1);
    expect(Math.abs(outer.y+outer.height/2-inner.y-inner.height/2)).toBeLessThan(1);
  }
  const folders=page.locator('.folder-tree .folder-row');await expect(folders.first()).toBeVisible();
  for(const folder of await folders.all())await expect(folder).toHaveAttribute('aria-expanded','false');
  const composer=page.getByRole('region',{name:'Harness prompt'}),minimize=composer.getByRole('button',{name:'Minimize prompt',exact:true});
  const capsule=(await composer.boundingBox())!,control=(await minimize.boundingBox())!;
  expect(control.y).toBeGreaterThanOrEqual(capsule.y);expect(control.y+control.height).toBeLessThanOrEqual(capsule.y+capsule.height);
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

test('Modern colour and UI versions remain separate; scoped Modern chrome does not affect Legacy', async ({ page }) => {
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings'});
  await settings.getByRole('button',{name:'Porcelain',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette','paper');
  await settings.getByRole('tab',{name:'UI versions',exact:true}).click();
  await expect(settings.getByRole('button',{name:/^Modern/})).toHaveAttribute('aria-pressed','true');
  await settings.getByRole('button',{name:/^Legacy/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-ui-version','classic');
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('.modern-session-header,.modern-native-composer,.modern-toolbox')).toHaveCount(0);
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

test('long captured at-sign scripts retain real syntax colors and exact command copy',async({page})=>{
  const bundle=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
  const op=bundle.projection.operations.find((item:any)=>item.kind==='shell');
  const script="@'\nfrom pathlib import Path\n"+'project description '.repeat(180)+"\n'@ | python -";
  const command=`text(await tools.exec_command({cmd:${JSON.stringify(script)},max_output_tokens:500}));`;
  op.detail.command=command;
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedCommand:string}).copiedCommand=text;}}}));
  await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  const card=page.locator(`article[data-op-id="${op.id}"]`);
  await card.scrollIntoViewIfNeeded();
  const material=card.locator('.command-material');
  await expect(material.locator('.tk-str').first()).toHaveText("@'");
  expect(await material.locator('.tk-str').first().evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el.parentElement!).color)).toBe(true);
  await material.getByRole('button',{name:'Copy command',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {copiedCommand:string}).copiedCommand)).toBe(script);
  await card.getByRole('button',{name:'Show raw request',exact:true}).click();
  await expect(material.locator('.tk-num')).toHaveText('500');
  await material.getByRole('button',{name:'Copy captured request',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {copiedCommand:string}).copiedCommand)).toBe(command);
});

test('tool cards retain visible results for short and long input/output combinations',async({page})=>{
  const original=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
  let bundle=original;
  await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));
  for(const kind of ['shell','mcp','other']) for(const longInput of [false,true]) for(const longOutput of [false,true]) {
    bundle=structuredClone(original);
    const op=bundle.projection.operations.find((item:any)=>item.kind==='shell');
    const input=longInput?Array.from({length:200},(_,i)=>`request line ${i}`).join('\n'):'small request';
    const output='OUTCOME_VISIBLE\n'+(longOutput?'result line\n'.repeat(200):'done');
    op.kind=kind;op.status='ok';op.detail=kind==='shell'?{kind,command:input,outputPreview:output,exitCode:0}:kind==='mcp'?{kind,server:'review',tool:'check',input:{query:input},resultPreview:output}:{kind,input:{query:input},resultPreview:output};
    await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
    const card=page.locator(`article[data-op-id="${op.id}"]`);
    await card.scrollIntoViewIfNeeded();
    const result=card.locator('.result-content');
    await expect(result).toContainText('OUTCOME_VISIBLE');
    // Read related geometry in one frame: Follow can move the viewport between
    // independent protocol calls without changing the card's internal allocation.
    const bounds=await card.evaluate(el=>{const card=el.getBoundingClientRect(),result=el.querySelector('.result-content')!.getBoundingClientRect();return {bottom:card.bottom,outcome:result.top+Math.min(30,result.height)};});
    expect(bounds.outcome,`${kind}/${longInput}/${longOutput}`).toBeLessThan(bounds.bottom);
    const request=card.locator(kind==='shell'?'.command-request':'.tool-input');
    expect(await request.evaluate(el=>parseFloat(getComputedStyle(el).maxHeight))).toBe(88);
    expect(await result.evaluate(el=>parseFloat(getComputedStyle(el).maxHeight))).toBe(142);
    if(longInput) expect(await request.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
    if(longOutput) expect(await result.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
    if(kind==='shell'&&longInput&&longOutput) {
      await card.locator('.op-title').hover();
      await expect(card).toHaveAttribute('data-hover-reading','focused');
      const allocation=await card.evaluate(el=>{
        const request=el.querySelector('.command-request')!,result=el.querySelector('.result-content')!,area=el.querySelector('.result-area')!;
        return {input:parseFloat(getComputedStyle(request).maxHeight),output:parseFloat(getComputedStyle(result).maxHeight),height:parseFloat((el as HTMLElement).style.getPropertyValue('--hover-height')),rule:getComputedStyle(area).borderTopWidth,padding:getComputedStyle(area).paddingTop};
      });
      expect(allocation.input).toBeCloseTo(Math.min((await page.viewportSize())!.height*.24,180),0);
      expect(allocation.output).toBeCloseTo(Math.max(142,allocation.height-280),0);
      expect(allocation.rule).toBe('1px');expect(allocation.padding).toBe('6px');
      await page.keyboard.press('Escape');
    }
  }
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
  const resize=git.getByRole('separator',{name:'Resize Git reading space',exact:true});
  await resize.focus();await page.keyboard.press('End');
  await expect.poll(()=>git.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(1200);
  await page.keyboard.press('ArrowRight');
  await expect(resize).toHaveAttribute('aria-valuenow','1168');
  const grip=(await resize.boundingBox())!,edge=(await git.boundingBox())!;
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
  await page.mouse.move(edge.x+edge.width-1000,grip.y+grip.height/2,{steps:5});await page.mouse.up();
  await expect.poll(()=>git.evaluate(node=>Math.abs(node.getBoundingClientRect().width-1000))).toBeLessThanOrEqual(1);
  const draggedWidth=Math.round((await git.boundingBox())!.width);
  const patchWidth=(await git.locator('.git-patch').boundingBox())!.width;
  await git.getByRole('button',{name:/^Hide files/}).click();
  await expect(git.getByRole('complementary',{name:'Git changed files'})).toBeHidden();
  expect((await git.locator('.git-patch').boundingBox())!.width).toBeGreaterThan(patchWidth+100);
  await expect(git.locator('.git-patch-reader')).toContainText('42');
  await page.screenshot({path:resolve('.local/modern-compact-git-test.png')});
  await git.getByRole('button',{name:'Close Git review'}).click();
  await expect(git).toHaveCount(0);
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  await expect.poll(()=>git.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(draggedWidth);
  await expect(git.getByRole('button',{name:/^Show files/})).toHaveAttribute('aria-expanded','false');
  await git.getByRole('button',{name:/^Show files/}).click();
  await expect(git.getByRole('complementary',{name:'Git changed files'})).toBeVisible();
  await git.getByRole('button',{name:'Close Git review'}).click();
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
  await expect(git.getByRole('separator',{name:'Resize Git reading space',exact:true})).toBeHidden();
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
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');
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
  await expect(folder).toHaveAttribute('aria-expanded','false');
  await folder.focus(); await page.keyboard.press('ArrowRight');
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
  await files.setInputFiles({name:'valid-after-rejection.txt',mimeType:'text/plain',buffer:Buffer.from('Keep the earlier rejected batch retryable')});
  await expect(composer.getByRole('button',{name:'Retry rejected files'})).toBeVisible();
  await expect(composer.locator('.attachment-chip')).toHaveCount(3);
  await expect(composer.getByRole('button',{name:'Retry rejected files'})).toBeVisible();
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
  for(const width of [390,320,1440]) {
    await page.setViewportSize({width,height:900});
    const pages=review.getByRole('navigation',{name:'Recorded review pages'});
    expect((await pages.boundingBox())!.height).toBeLessThanOrEqual(90);
    expect(await pages.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await expect(review.getByRole('button',{name:'Previous review page',exact:true})).toBeDisabled();
  }
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


test('developer Workspace reads two files, preserves drafts and only prepares native edit/run requests',async({page})=>{
  let submitted=0;
  await page.route('**/controller/prompt',route=>{submitted++;return route.fulfill({status:500,json:{error:'Must not submit during workspace preparation'}});});
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace'}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  await expect(desk).toBeVisible();
  const approve=desk.getByRole('button',{name:'Approve workspace reading',exact:true});
  await expect(approve.or(desk.getByRole('tablist',{name:'Open workspace files'}))).toBeVisible();
  if(await approve.isVisible()) await approve.click();
  await expect(desk.getByRole('tablist',{name:'Open workspace files'})).toBeVisible();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');
  await expect(page.locator('[data-spine-path="src/cart/total.ts"]')).toBeVisible();
  await page.locator('[data-spine-path="src/cart/total.ts"]').click();
  const total=desk.getByRole('region',{name:'Workspace file src/cart/total.ts',exact:true});
  await expect(total.locator('.code')).toContainText('42');
  await total.locator('.desk-code').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await expect(desk).toBeVisible();
  await expect(page.locator('.workspace-secondary')).toBeHidden();
  await total.getByRole('button',{name:'Wrap',exact:true}).click();
  await total.getByRole('searchbox',{name:'Find in src/cart/total.ts'}).fill('total');
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/discount.ts');
  await page.locator('[data-spine-path="src/cart/discount.ts"]').click();
  await expect(desk.getByRole('tab')).toHaveCount(2);
  await desk.getByRole('tab',{name:'total.ts',exact:true}).click();
  await expect(total.getByRole('button',{name:'Wrap',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(total.getByRole('searchbox',{name:'Find in src/cart/total.ts'})).toHaveValue('total');
  await desk.getByRole('tab',{name:'discount.ts',exact:true}).click();
  await desk.getByRole('button',{name:'Split view',exact:true}).click();
  await expect(desk.locator('.desk-document')).toHaveCount(2);
  await expect(total).toBeVisible();
  await page.screenshot({path:resolve('.local/developer-workspace-desktop.png')});
  await total.getByRole('button',{name:'Edit file',exact:true}).click();
  const editor=total.getByRole('textbox',{name:'Local draft for src/cart/total.ts',exact:true});
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  await expect(total.getByRole('button',{name:'Read source',exact:true})).toHaveAttribute('title','Return to current source; your local draft is retained');
  await editor.fill('export const total = 43;\n');
  await expect(total).toContainText('lost on reload');
  await total.getByRole('button',{name:'Compare draft',exact:true}).click();
  const comparison=total.getByRole('region',{name:'Draft comparison for src/cart/total.ts'});
  await expect(comparison).toContainText('not applied to disk');
  await expect(comparison.locator('.diff-scroll')).toContainText('42');
  await expect(comparison.locator('.diff-scroll')).toContainText('43');
  await comparison.getByRole('button',{name:'Side by side',exact:true}).click();
  await expect(comparison.getByRole('region',{name:'Local draft side by side'})).toBeVisible();
  await expect(comparison).not.toContainText('Captured patch only');
  await comparison.getByRole('searchbox',{name:'Find in patch',exact:true}).fill('total');
  const other=desk.getByRole('region',{name:'Workspace file src/cart/discount.ts',exact:true});
  await other.getByRole('button',{name:'Edit file',exact:true}).click();
  await other.getByRole('textbox',{name:'Local draft for src/cart/discount.ts',exact:true}).fill('export const alternate = 7;\n');
  await expect(comparison.getByRole('button',{name:'Side by side',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(comparison.getByRole('searchbox',{name:'Find in patch',exact:true})).toHaveValue('total');
  await other.getByRole('button',{name:'Discard draft',exact:true}).click();
  await page.screenshot({path:resolve('.local/workspace-draft-patch.png')});
  await total.getByRole('button',{name:'Edit draft',exact:true}).click();
  await expect(editor).toHaveText('export const total = 43;\n');
  await expect(editor).toBeFocused();
  const downloadPromise=page.waitForEvent('download');
  await total.getByRole('button',{name:'Download draft',exact:true}).click();
  const download=await downloadPromise;
  expect(readFileSync((await download.path())!,'utf8')).toBe('export const total = 43;\n');
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(desk).toHaveCount(0);
  await page.getByRole('button',{name:'Open developer workspace'}).click();
  await expect(editor).toHaveText('export const total = 43;\n');
  await total.getByRole('button',{name:'Review edit with harness',exact:true}).click();
  await expect(desk).toHaveCount(0);
  const prompt=page.getByRole('textbox',{name:'Prompt for selected harness session',exact:true});
  await expect(prompt).toHaveValue(/Base SHA-256: [a-f0-9]{64}/);
  await page.getByRole('button',{name:'Preview attachment total.ts.drishya-draft.txt',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Attachment: total.ts.drishya-draft.txt',exact:true})).toContainText('total = 43');
  await page.getByRole('button',{name:'Close Attachment: total.ts.drishya-draft.txt',exact:true}).click();
  expect(readFileSync(join(root,'src/cart/total.ts'),'utf8')).toContain('42');
  expect(submitted).toBe(0);
  await page.getByRole('button',{name:'Open developer workspace'}).click();
  await desk.getByText('Ask harness to run a command',{exact:true}).click();
  await desk.getByRole('textbox',{name:'Command and arguments for native harness'}).fill('pnpm test -- --run');
  await desk.getByRole('combobox',{name:'Command working directory'}).selectOption('file');
  await desk.getByRole('button',{name:'Prepare request',exact:true}).click();
  await expect(prompt).toHaveValue(/pnpm test -- --run/);
  await expect(prompt).toHaveValue(/Working directory relative to the workspace: "src\/cart"/);
  await expect(prompt).toHaveValue(/Base SHA-256/);
  expect(submitted).toBe(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open developer workspace'}).click();
  await page.getByRole('button',{name:'Minimize files',exact:true}).click();
  const box=(await desk.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:resolve('.local/developer-workspace-phone.png')});
});

test('Workspace large draft comparison retains complete text, editing state and phone bounds',async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const approve=desk.getByRole('button',{name:'Approve workspace reading'});if(await approve.isVisible())await approve.click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/comparison.ts');
  await page.locator('[data-spine-path="src/cart/comparison.ts"]').click();
  const document=desk.getByRole('region',{name:'Workspace file src/cart/comparison.ts',exact:true});
  await document.getByRole('button',{name:'Edit file',exact:true}).click();
  const editor=document.getByRole('textbox',{name:'Local draft for src/cart/comparison.ts',exact:true});
  const draft=Array.from({length:1500},(_,i)=>`export const draftLine${i+1} = ${i+1};`).join('\n');
  await pasteDraft(editor,draft);
  await editor.press('Control+Home');await editor.press('Shift+End');
  const selection=await page.evaluate(()=>getSelection()?.toString());
  const scroller=document.locator('.cm-scroller');await scroller.evaluate(node=>node.scrollTop=250);
  await expect.poll(()=>scroller.evaluate(node=>node.scrollTop)).toBe(250);
  await document.getByRole('button',{name:'Compare draft',exact:true}).click();
  const comparison=document.getByRole('region',{name:'Draft comparison for src/cart/comparison.ts'});
  await expect(comparison).toContainText('Large comparison');
  await expect(comparison.getByRole('textbox',{name:'Compared draft for src/cart/comparison.ts',exact:true})).toHaveValue(draft);
  await expect(comparison.getByRole('textbox',{name:'Draft base for src/cart/comparison.ts',exact:true})).toHaveValue(readFileSync(join(root,'src/cart/comparison.ts'),'utf8'));
  await page.screenshot({path:resolve('.local/draft-comparison-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  expect(await comparison.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
  const last=await comparison.getByRole('textbox',{name:'Compared draft for src/cart/comparison.ts',exact:true}).boundingBox();
  expect(last!.height).toBeGreaterThan(40);expect(last!.y+last!.height).toBeLessThanOrEqual(844);
  await page.screenshot({path:resolve('.local/draft-comparison-phone.png')});
  await page.setViewportSize({width:1440,height:960});
  await document.getByRole('button',{name:'Edit draft',exact:true}).click();
  await expect(editor).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>getSelection()?.toString())).toBe(selection);
  await expect.poll(()=>scroller.evaluate(node=>node.scrollTop)).toBe(250);
  const downloaded=page.waitForEvent('download');await document.getByRole('button',{name:'Download draft',exact:true}).click();
  expect(readFileSync((await (await downloaded).path())!,'utf8')).toBe(draft);
  await editor.press('Control+z');
  const undone=page.waitForEvent('download');await document.getByRole('button',{name:'Download draft',exact:true}).click();
  expect(readFileSync((await (await undone).path())!,'utf8')).toBe(readFileSync(join(root,'src/cart/comparison.ts'),'utf8'));
  await editor.press('Control+y');
  const redone=page.waitForEvent('download');await document.getByRole('button',{name:'Download draft',exact:true}).click();
  expect(readFileSync((await (await redone).path())!,'utf8')).toBe(draft);
  expect(readFileSync(join(root,'src/cart/comparison.ts'),'utf8')).not.toContain('draftLine');
});

test('Workspace editor indents, undoes and preserves exact line endings without disk writes',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const grant=desk.getByRole('button',{name:'Approve workspace reading'});if(await grant.isVisible())await grant.click();
  for(const path of ['src/cart/endings.ts','src/cart/mixed.ts']) {
    const original=readFileSync(join(root,path),'utf8'),eol=path.endsWith('endings.ts')?'\r\n':'\n';
    await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);
    await page.locator(`[data-spine-path="${path}"]`).click();
    const file=desk.getByRole('region',{name:`Workspace file ${path}`,exact:true});
    await file.getByRole('button',{name:'Edit file',exact:true}).click();
    const editor=file.getByRole('textbox',{name:`Local draft for ${path}`,exact:true});
    await expect(editor).toBeFocused();await expect(file.locator('.cm-lineNumbers')).toBeVisible();
    await expect(file.getByRole('button',{name:'Review edit with harness',exact:true})).toBeDisabled();
    await editor.press('Control+End');await page.keyboard.insertText('// added');await editor.press('Enter');await page.keyboard.insertText('next');
    const download=async()=>{const pending=page.waitForEvent('download');await file.getByRole('button',{name:'Download draft',exact:true}).click();return readFileSync((await (await pending).path())!,'utf8');};
    expect(await download()).toBe(original+'// added'+eol+'next');
    await editor.press('Control+Home');await editor.press('Tab');
    expect(await download()).toBe((path.endsWith('endings.ts')?'    ':'  ')+original+'// added'+eol+'next');
    await editor.press('Control+z');expect(await download()).toBe(original+'// added'+eol+'next');
    await editor.fill('x'.repeat(256*1024+1));
    await expect(file.getByRole('alert')).toContainText('This change was not applied');
    expect(await download()).toBe(original+'// added'+eol+'next');
    await editor.focus();await editor.press('Escape');await editor.press('Tab');await expect(editor).not.toBeFocused();
    await file.getByRole('button',{name:'Wrap',exact:true}).click();await expect(file.getByRole('button',{name:'Wrap',exact:true})).toHaveAttribute('aria-pressed','true');
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:844});
      expect(await desk.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({path:resolve(`.local/editor-${path.endsWith('endings.ts')?'crlf':'mixed'}-${width}.png`)});
    }
    await page.setViewportSize({width:1440,height:960});
    expect(readFileSync(join(root,path),'utf8')).toBe(original);
    await file.getByRole('button',{name:'Discard draft',exact:true}).click();
  }
});

test('phone Workspace file chooser preserves its header, dismisses normally and focuses the chosen file',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true}), explorer=page.getByRole('complementary',{name:'Repository files'});
  const approve=explorer.getByRole('button',{name:/^Enable workspace reading/});
  await expect(approve.or(desk.getByRole('tablist',{name:'Open workspace files'}))).toBeVisible();
  if(await approve.isVisible())await approve.click();
  const trigger=desk.getByRole('button',{name:'Choose workspace file',exact:true});
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  const search=explorer.getByRole('textbox',{name:'Find repository files',exact:true});
  await expect(search).toBeFocused();
  expect(await search.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('none');
  expect(await explorer.locator('.ux-search').evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('solid');
  const header=await desk.locator(':scope>header').boundingBox(), panel=await explorer.boundingBox();
  expect(panel!.y).toBeGreaterThanOrEqual(header!.y+header!.height+7);
  await page.screenshot({path:resolve('.local/workspace-phone-files-chooser.png')});
  await explorer.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');
  await explorer.locator('[data-spine-path="src/cart/total.ts"]').click();
  await expect(explorer).toHaveCount(0);
  const document=desk.getByRole('region',{name:'Workspace file src/cart/total.ts',exact:true});
  await expect(document).toBeFocused();await expect(document.locator('.code')).toContainText('42');
  await trigger.click();await expect(explorer).toBeVisible();
  await page.keyboard.press('Escape');await expect(explorer).toHaveCount(0);await expect(desk).toBeVisible();await expect(trigger).toBeFocused();
  await trigger.click();await desk.getByRole('button',{name:'＋ New file',exact:true}).click();
  await expect(explorer).toHaveCount(0);await expect(desk.getByRole('textbox',{name:'New workspace file path'})).toBeVisible();
  await desk.getByRole('button',{name:'Cancel',exact:true}).click();
  await trigger.click();await desk.getByRole('button',{name:'Back to agent',exact:true}).focus();
  await expect(explorer).toHaveCount(0);await expect(desk).toBeVisible();
  await page.screenshot({path:resolve('.local/workspace-phone-files-selected.png')});
});

test('Files control tracks the responsive default without changing an explicit preference',async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const trigger=page.locator('.workspace-bar').getByRole('button',{name:'Show files',exact:true});
  await expect(trigger).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:390,height:844});
  await expect(trigger).toHaveAttribute('aria-pressed','false');await expect(page.locator('.folder-explorer')).toHaveCount(0);
  await page.setViewportSize({width:1440,height:960});
  await expect(trigger).toHaveAttribute('aria-pressed','true');
  await trigger.click();await expect(trigger).toHaveAttribute('aria-pressed','false');
  await page.setViewportSize({width:390,height:844});await page.setViewportSize({width:1440,height:960});
  await expect(trigger).toHaveAttribute('aria-pressed','false');await expect(page.locator('.folder-explorer')).toHaveCount(0);
});

test('touch file chooser keeps readable inputs and touch-sized dismissal without disabling zoom',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  try {
    await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
    expect(await page.getByRole('textbox',{name:'Find sessions',exact:true}).evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    const refresh=await page.getByRole('button',{name:'Refresh sessions',exact:true}).boundingBox();
    expect(refresh!.width).toBeGreaterThanOrEqual(44);expect(refresh!.height).toBeGreaterThanOrEqual(44);
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
    expect(await page.getByRole('textbox',{name:'Prompt for selected harness session',exact:true}).evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await page.getByRole('button',{name:'Open developer workspace',exact:true}).tap();
    const explorer=page.getByRole('complementary',{name:'Repository files'});
    await expect(explorer).toBeVisible();
    expect(await explorer.getByRole('textbox',{name:'Find repository files',exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    const close=explorer.getByRole('button',{name:'Minimize files',exact:true}), bounds=await close.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
    await close.tap();await expect(explorer).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Developer workspace',exact:true})).toBeVisible();
  } finally {await context.close();}
});

test('Files width is adjustable without covering Workspace or moving history on minimize',async({page})=>{
  await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const files=page.getByRole('complementary',{name:'Repository files',exact:true});
  const resize=files.getByRole('separator',{name:'Resize Files reading space',exact:true});
  await resize.focus();await page.keyboard.press('End');
  await expect.poll(()=>files.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(420);
  const history=page.locator('.history'), before=(await history.boundingBox())!;
  expect(before.x).toBeGreaterThan((await files.boundingBox())!.x+420);
  await files.getByRole('button',{name:'Minimize files',exact:true}).click();
  await expect(files).toHaveCount(0);expect((await history.boundingBox())!.x).toBe(before.x);
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await expect.poll(()=>files.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(420);
  const grip=(await resize.boundingBox())!,left=(await files.boundingBox())!.x;
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
  await page.mouse.move(left+330,grip.y+grip.height/2,{steps:5});await page.mouse.up();
  await expect.poll(()=>files.evaluate(node=>Math.abs(node.getBoundingClientRect().width-330))).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await expect(desk).toBeVisible();
  expect((await desk.boundingBox())!.x).toBeGreaterThan((await files.boundingBox())!.x+(await files.boundingBox())!.width);
  await files.getByRole('button',{name:'Minimize files',exact:true}).click();
  await expect.poll(()=>desk.evaluate(node=>Math.round(node.getBoundingClientRect().left))).toBe(18);
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await resize.focus();await page.keyboard.press('End');
  await page.setViewportSize({width:900,height:960});
  await expect.poll(()=>files.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(288);
  await page.setViewportSize({width:1440,height:960});
  await expect.poll(()=>files.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(420);
  await page.screenshot({path:resolve('.local/files-adjustable-width.png')});
});

test('Modern navigation keeps two actions at each edge, readable and outside the history viewport',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  for(const width of [1600,1280,1024,768,600,390]) {
    await page.setViewportSize({width,height:900});
    const buttons=['Show files','Explore repository map','Open developer workspace','Git review'];
    const boxes=[];
    for(const name of buttons) {const node=page.getByRole('button',{name,exact:true});await expect(node).toBeVisible();const box=(await node.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(38);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);boxes.push(box);}
    expect(boxes[0]!.x).toBeLessThan(30);expect(boxes[3]!.x+boxes[3]!.width).toBeGreaterThan(width-30);
    if(width===1280)await page.screenshot({path:resolve('.local/modern-navigation-edges.png')});
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i]!,b=boxes[j]!;expect(Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))).toBeLessThan(1);}
    const history=(await page.locator('.history').boundingBox())!;
    expect(history.y).toBeLessThan(boxes[0]!.y);
    if(width>=768)expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.workspace-leading,.workspace-secondary,.workspace-bar')!==null,{x:width/2,y:boxes[0]!.y+10})).toBe(false);
  }
});

test('Modern restores source tabs, reading page and Home resume after a hard reload without saving source or grants',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const approve=desk.getByRole('button',{name:'Approve workspace reading'});
  await expect(approve.or(desk.getByRole('tablist'))).toBeVisible();if(await approve.isVisible())await approve.click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/reading.ts');
  await page.locator('[data-spine-path="src/cart/reading.ts"]').click();
  const reader=desk.getByRole('region',{name:'Workspace file src/cart/reading.ts',exact:true});
  await reader.getByRole('textbox',{name:'Go to line in src/cart/reading.ts',exact:true}).fill('300');
  await reader.getByRole('button',{name:'Go',exact:true}).click();
  await expect(reader.locator('footer')).toContainText('450 lines');
  await reader.getByRole('button',{name:'Wrap',exact:true}).click();
  await expect.poll(async()=>{const response=await page.request.get(`${server.url}/v1/working-locations`);return JSON.stringify(await response.json());}).toContain('desk/document/0/src/cart/reading.ts');
  const saved=JSON.stringify(await (await page.request.get(`${server.url}/v1/working-locations`)).json());
  expect(saved).not.toContain('export const reviewLine');expect(saved).not.toContain('approved');expect(saved).not.toContain('prompt');
  await page.reload();await expect(desk).toBeVisible();await expect(reader.locator('footer')).toContainText('450 lines');
  await expect(reader.getByRole('button',{name:'Wrap',exact:true})).toHaveAttribute('aria-pressed','true');
  await reader.locator('.desk-code').focus();await page.keyboard.press('Alt+w');await expect(reader).toHaveCount(0);
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await page.getByRole('button',{name:'Drishya',exact:true}).click();await expect(page.locator('.mh-home')).toBeVisible();
  await expect(page.getByRole('button',{name:/Resume your last workspace/})).toBeVisible();
});

test('Modern Home keeps captured sessions on discovery failure and reaches deep matching sessions',async({page})=>{
  await page.route('**/v1/sources',route=>route.fulfill({status:500,json:{error:'Synthetic discovery failure'}}));
  await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();
  await expect(page.locator('.mh-session')).not.toHaveCount(0);await expect(page.getByRole('alert')).toContainText('Local discovery');
  await page.unroute('**/v1/sources');
  const base=app.recording(ids.codex!);
  await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:Array.from({length:132},(_,i)=>({...base,id:`synthetic-home-${i}`,workspaceRoot:root,title:`Synthetic session ${String(i).padStart(3,'0')}`,lastSourceTime:new Date(Date.now()-i*1000).toISOString()}))}}));
  await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[],errors:[]}}));
  await page.getByRole('button',{name:'Refresh sessions',exact:true}).click();
  await page.getByRole('textbox',{name:'Find sessions',exact:true}).fill('Synthetic session 131');
  await expect(page.getByText('Synthetic session 131',{exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Find sessions',exact:true}).fill('');
  const list=page.locator('.mh-session-list');
  for(let i=0;i<4;i++){await list.evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(80);}
  await expect(page.getByText('Synthetic session 131',{exact:true})).toBeVisible();
  await page.screenshot({path:resolve('.local/modern-home-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:resolve('.local/modern-home-phone.png')});
});

test('Workspace Markdown opens as a readable document with an explicit exact-source view',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedCode:string}).copiedCode=text;}}}));
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const grant=desk.getByRole('button',{name:'Approve workspace reading'});if(await grant.isVisible())await grant.click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('README.md');
  await page.locator('[data-spine-path="README.md"]').click();
  const document=desk.getByRole('region',{name:'Workspace file README.md',exact:true});
  await expect(document.getByRole('heading',{name:'Workspace guide'})).toBeVisible();
  await expect(document.getByRole('cell',{name:'Ready',exact:true})).toBeVisible();
  await expect(document.locator('.desk-markdown strong')).toHaveText('readable');
  const code=document.locator('.fenced-material');await code.getByRole('button',{name:'Copy',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {copiedCode:string}).copiedCode)).toBe('export const ready = true;');
  await code.getByRole('button',{name:'Wrap',exact:true}).click();await expect(code.locator('pre')).toHaveClass(/code-wrap/);
  await document.getByRole('button',{name:'Source',exact:true}).click();
  await expect(document.locator('.desk-code')).toContainText('# Workspace guide');
  await document.getByRole('button',{name:'Document',exact:true}).click();
  await expect(document.getByRole('heading',{name:'Workspace guide'})).toBeVisible();
});

test('whole-file Workspace search and line navigation reach distant source with bounded mounted rows',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const grant=desk.getByRole('button',{name:'Approve workspace reading'});await expect(grant.or(desk.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/large.ts');
  await page.locator('[data-spine-path="src/cart/large.ts"]').click();
  const reader=desk.getByRole('region',{name:'Workspace file src/cart/large.ts',exact:true});
  await expect(reader.locator('footer')).toContainText('10000 lines');
  await reader.getByRole('searchbox',{name:'Find in src/cart/large.ts',exact:true}).fill('largeLine9000');
  await expect(reader.locator('.source-find')).toContainText('1 matching line in this file');
  await reader.getByRole('button',{name:'Next match',exact:true}).click();
  await expect(reader.locator('[data-source-line="9000"]')).toHaveAttribute('aria-current','location');
  expect(await reader.locator('[data-source-line]').count()).toBeLessThan(150);
  await reader.getByRole('textbox',{name:'Go to line in src/cart/large.ts',exact:true}).fill('10000');
  await reader.getByRole('button',{name:'Go',exact:true}).click();
  await expect(reader.locator('[data-source-line="10000"]')).toBeVisible();
  await expect(reader.getByRole('button',{name:'Previous',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open developer workspace',exact:true})).toBeHidden();
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open developer workspace',exact:true})).toBeVisible();
});

test('Workspace creates an unsent file draft and forwards large contents as a native attachment',async({page})=>{
  const state={available:true,state:'idle',harness:'codex',tools:[],inventory:'unknown',approvals:[],output:''};let payload:any;
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/controller/prompt',route=>{payload=route.request().postDataJSON();return route.fulfill({json:{...state,state:'completed'}});});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  const grant=desk.getByRole('button',{name:'Approve workspace reading'});await expect(grant.or(desk.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();
  await desk.getByRole('button',{name:'＋ New file',exact:true}).click();
  await desk.getByRole('textbox',{name:'New workspace file path',exact:true}).fill('src/created.ts');
  await desk.getByRole('button',{name:'Create draft',exact:true}).click();
  const document=desk.getByRole('region',{name:'Workspace file src/created.ts',exact:true});
  await expect(document.getByRole('textbox',{name:'Local draft for src/created.ts',exact:true})).toBeFocused();
  const text='// complete new file\n'+'export const requested = 42;\n'.repeat(3000);
  await pasteDraft(document.getByRole('textbox',{name:'Local draft for src/created.ts',exact:true}),text);
  expect(payload).toBeUndefined();expect(()=>readFileSync(join(root,'src/created.ts'))).toThrow();
  await document.getByRole('button',{name:'Review creation with harness',exact:true}).click();
  const composer=page.getByRole('region',{name:'Harness prompt',exact:true});
  await expect(composer.getByRole('textbox',{name:'Prompt for selected harness session'})).toHaveValue(/does not already exist/);
  await expect(composer.getByRole('button',{name:'Preview attachment created.ts.drishya-draft.txt'})).toBeVisible();
  expect(payload).toBeUndefined();
  await composer.getByRole('button',{name:'Send prompt',exact:true}).click();
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();
  await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();
  await expect.poll(()=>payload).toBeDefined();
  expect(payload.attachments).toEqual([{name:'created.ts.drishya-draft.txt',type:'text',data:text}]);
  await page.getByLabel('More workspace options').click();
  await page.getByRole('button',{name:'Back to reading',exact:true}).click();
  await expect(desk).toBeVisible();await expect(document.getByRole('textbox',{name:'Local draft for src/created.ts',exact:true})).toBeFocused();
  const backDownload=page.waitForEvent('download');await document.getByRole('button',{name:'Download draft',exact:true}).click();
  expect(readFileSync((await (await backDownload).path())!,'utf8')).toBe(text);
  expect(payload.prompt.length).toBeLessThan(2000);
  expect(()=>readFileSync(join(root,'src/created.ts'))).toThrow();
});

test('an unexpected rendering failure has a usable recovery surface instead of a black screen',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.route(`**/v1/recordings/${ids.codex}/projection`,route=>route.fulfill({json:{...app.projection(ids.codex!),operations:null}}));
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await expect(page.getByRole('heading',{name:'This view could not be displayed'})).toBeVisible();
  await page.getByRole('button',{name:'All sessions',exact:true}).click();
  await expect(page.locator('.mh-home')).toBeVisible();
});

test('Modern seven palettes cover Home and session surfaces, and HUD controls retain the prompt draft',async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('.mh-header').getByRole('button',{name:'Demo',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Star on GitHub'})).toHaveAttribute('href','https://github.com/drishya-dev/drishya');
  for(const [name,palette] of [['Jet Black','jet'],['Porcelain','paper'],['Deep Ocean','midnight'],['Orchid','mocha'],['Blueprint','tokyo'],['Evergreen','nord'],['Copper','gruvbox']]) {
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
    await page.getByRole('button',{name:name!,exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-palette',palette!);
    const expectedBase:Record<string,string>={jet:'#0a0a0a',paper:'#f4f2ee',midnight:'#0b1216',mocha:'#141116',tokyo:'#0c1019',nord:'#14191b',gruvbox:'#181310'};
    expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg').trim())).toBe(expectedBase[palette!]);
    const expectedFocus:Record<string,string>={jet:'#8b92ec',paper:'#315e73',midnight:'#74d9cf',mocha:'#e4b1c2',tokyo:'#95b9ff',nord:'#b7d3bc',gruvbox:'#ecb58a'};
    expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--focus').trim())).toBe(expectedFocus[palette!]);
    await page.getByRole('button',{name:'Close Workspace settings',exact:true}).click();
    await page.screenshot({path:resolve(`.local/palette-${palette}-home.png`)});
  }
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const prompt=page.getByRole('region',{name:'Harness prompt'}),input=prompt.getByRole('textbox',{name:'Prompt for selected harness session'});
  await input.fill('Retain this local draft while minimizing.');
  await prompt.getByRole('button',{name:'Minimize prompt',exact:true}).click();
  await expect(input).toBeHidden();await prompt.getByRole('button',{name:'Expand prompt',exact:true}).click();await expect(input).toHaveValue('Retain this local draft while minimizing.');
  await page.getByRole('button',{name:'Minimize toolbox',exact:true}).click();await expect(page.locator('.modern-toolbox')).toBeHidden();
  await page.getByRole('button',{name:'Expand toolbox',exact:true}).click();await expect(page.locator('.modern-toolbox')).toBeVisible();
  await input.fill('');
  for(const [name,palette] of [['Jet Black','jet'],['Porcelain','paper'],['Deep Ocean','midnight'],['Orchid','mocha'],['Blueprint','tokyo'],['Evergreen','nord'],['Copper','gruvbox']]) {
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('button',{name:name!,exact:true}).click();await page.getByRole('button',{name:'Close Workspace settings',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:resolve(`.local/palette-${palette}-session.png`)});
  }
});


test('minimized Modern composer keeps Stop and failure feedback available',async({page})=>{
  let state:any={available:true,state:'running',runId:'synthetic-mini',harness:'codex',tools:[],inventory:'unknown',approvals:[],output:''};
  let stopped=false;
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.route('**/controller/stop',route=>{stopped=true;state={...state,state:'failed',error:'Synthetic failed turn'};return route.fulfill({json:state});});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer.getByRole('button',{name:'Stop turn',exact:true})).toBeVisible();
  await composer.getByRole('button',{name:'Minimize prompt',exact:true}).click();
  await expect(composer.getByRole('button',{name:'Expand prompt',exact:true})).toHaveText('Agent working…');
  await composer.getByRole('button',{name:'Stop turn',exact:true}).click();
  await expect.poll(()=>stopped).toBe(true);
  await expect(composer.getByRole('button',{name:'Expand prompt',exact:true})).toHaveText('Needs attention');
  await composer.getByRole('button',{name:'Expand prompt',exact:true}).click();
  await expect(composer.getByRole('alert')).toContainText('Synthetic failed turn');
});
test('source refresh retains reading, compares versions and blocks a stale native edit handoff',async({page})=>{
  const path='src/cart/versions.ts',original=readFileSync(join(root,path),'utf8');
  let prompts=0;await page.route('**/controller/prompt',route=>{prompts++;return route.abort();});
  try {
    await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
    const grant=page.getByRole('button',{name:/^Enable workspace reading/});
    await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();if(await grant.isVisible())await grant.click();
    await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);
    await page.locator(`[data-spine-path="${path}"]`).click();
    const reader=page.getByRole('dialog',{name:path,exact:true});await expect(reader.locator('.current-file-code')).toContainText('version = 1');
    writeFileSync(join(root,path),'export const version = 2;\n');
    await reader.getByRole('button',{name:'Refresh',exact:true}).click();
    await expect(reader.getByRole('region',{name:'Source version status'})).toContainText('Source changed on disk');
    await expect(reader.locator('.current-file-code')).toContainText('version = 1');
    await reader.getByRole('button',{name:'Keep reading',exact:true}).click();
    await reader.getByRole('button',{name:'Compare versions',exact:true}).click();
    const comparison=page.getByRole('dialog',{name:`Source versions · ${path}`,exact:true});
    await expect(comparison.locator('.diff-scroll')).toContainText('version = 1');await expect(comparison.locator('.diff-scroll')).toContainText('version = 2');
    await page.setViewportSize({width:390,height:844});expect(await comparison.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
    await comparison.getByRole('button',{name:`Close Source versions · ${path}`,exact:true}).click();
    await reader.getByRole('button',{name:'Use latest',exact:true}).click();await expect(reader.locator('.current-file-code')).toContainText('version = 2');
    await expect(reader).toContainText('Previous reading retained');
    await page.setViewportSize({width:1440,height:960});
    await reader.getByRole('button',{name:'Open in Workspace',exact:true}).click();
    const file=page.getByRole('region',{name:`Workspace file ${path}`,exact:true});
    await file.getByRole('button',{name:'Edit file',exact:true}).click();
    const editor=file.getByRole('textbox',{name:`Local draft for ${path}`,exact:true});await editor.fill('export const version = 3;\n');
    writeFileSync(join(root,path),'export const version = 4;\n');
    await file.getByRole('button',{name:'Review edit with harness',exact:true}).click();
    await expect(file.getByRole('region',{name:'Draft source conflict'})).toContainText('Disk differs');
    await expect(file.getByRole('button',{name:'Review edit with harness',exact:true})).toBeDisabled();
    await expect(editor).toHaveText('export const version = 3;');expect(prompts).toBe(0);
    await file.getByRole('button',{name:'Compare draft to disk',exact:true}).click();
    await expect(file.getByRole('region',{name:`Draft comparison for ${path}`})).toContainText('Latest checked disk snapshot');
    await expect(file.locator('.diff-scroll')).toContainText('version = 4');await expect(file.locator('.diff-scroll')).toContainText('version = 3');
    await file.getByRole('button',{name:'Edit draft',exact:true}).click();
    await page.screenshot({path:resolve('.local/source-conflict-retained.png')});
    await file.getByRole('button',{name:'Discard draft',exact:true}).click();
  } finally {writeFileSync(join(root,path),original);}
});

test('Modern scroll thumbs hide after activity and resize edges retain cursor and keyboard behavior',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const follow=page.getByRole('switch',{name:'Automatically follow new work'});if(await follow.getAttribute('aria-checked')==='true')await follow.click();
  const history=page.locator('.history'),width=await history.evaluate(n=>n.clientWidth);
  await history.evaluate(n=>n.scrollTop=n.scrollTop>10?n.scrollTop-10:10);
  await expect(history).toHaveAttribute('data-scroll-active','');await page.mouse.move(500,25);
  await expect(history).not.toHaveAttribute('data-scroll-active','');expect(await history.evaluate(n=>n.clientWidth)).toBe(width);
  const resize=page.getByRole('separator',{name:'Resize Files reading space'});
  expect(await resize.evaluate(n=>getComputedStyle(n,'::after').content)).toBe('none');
  expect(await resize.evaluate(n=>getComputedStyle(n).cursor)).toContain('resize');
  await resize.focus();await page.keyboard.press('End');await expect(resize).toHaveAttribute('aria-valuenow',await resize.getAttribute('aria-valuemax')??'');
  await page.emulateMedia({forcedColors:'active'});expect(await history.evaluate(n=>getComputedStyle(n).scrollbarColor)).toBe('auto');
});

test('both local harness sessions start observing by default and update with Follow off',async({page})=>{
  for(const harness of ['codex','claude-code']) {
    const journal=join(dir,`default-live-${harness}.jsonl`),timestamp='2026-10-18T00:00:00Z',session=`default-live-${harness}`;
    const seed=harness==='codex'?{timestamp,type:'session_meta',payload:{id:session,cwd:root}}:{timestamp,type:'user',uuid:`${session}-user`,sessionId:session,cwd:root,message:{role:'user',content:`Default live ${harness}`}};
    writeFileSync(journal,JSON.stringify(seed)+'\n');const {recordingId}=await app.ingest.importSource(harness,journal);
    await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
    await expect.poll(()=>app.recording(recordingId).live).toBe(true);
    const follow=page.getByRole('switch',{name:'Automatically follow new work'});await expect(follow).toHaveAttribute('aria-checked','true');await follow.click();
    const top=await page.locator('.history').evaluate(n=>n.scrollTop),command=`echo default-live-${harness}`;
    const rows=harness==='codex'?[{timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'default-live-call',arguments:JSON.stringify({cmd:command})}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id:'default-live-call',output:'live result'}}]:[{timestamp,type:'assistant',uuid:'default-live-tool',sessionId:session,cwd:root,message:{role:'assistant',content:[{type:'tool_use',id:'default-live-call',name:'Bash',input:{command}}]}},{timestamp,type:'user',uuid:'default-live-result',sessionId:session,cwd:root,message:{role:'user',content:[{type:'tool_result',tool_use_id:'default-live-call',content:'live result'}]}}];
    appendFileSync(journal,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    // No explicit sync call: the watcher started by opening the session owns ingestion.
    await expect(page.locator('.history .op')).toContainText(command);
    await expect(page.locator('.history .op')).toContainText('live result');
    expect(await page.locator('.history').evaluate(n=>n.scrollTop)).toBe(top);expect(app.recording(recordingId).live).toBe(true);
    await expect(follow).toHaveAttribute('aria-checked','false');
  }
});
test('a real pending-input shape expands the composer and replies to that request without sending a prompt',async({page})=>{
  let state:any={available:true,harness:'codex',state:'running',runId:'input-run',output:'',tools:[],inventory:'runtime',approvals:[],inputRequests:[]};
  const question={id:'q0',header:'Approach',question:'Which approach?',multiple:false,allowText:true,options:[{id:'o0',label:'Small patch',description:'Focused change'},{id:'o1',label:'Refactor',description:'Wider change'}]};
  let answer:any,prompts=0;
  await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root,scope:'current-workspace'}}));
  await page.route('**/controller',route=>route.fulfill({json:state}));
  await page.route('**/controller/prompt',route=>{prompts++;return route.abort();});
  await page.route('**/controller/answer',route=>{answer=route.request().postDataJSON();state={...state,state:'completed',inputRequests:[]};return route.fulfill({json:state});});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const composer=page.getByRole('region',{name:'Harness prompt',exact:true});
  await composer.getByRole('button',{name:'Minimize prompt',exact:true}).click();
  state={...state,state:'approval',inputRequests:[{id:'input-request',questions:[question]}]};
  const form=page.getByRole('form',{name:'Agent needs your input'});await expect(form).toBeVisible();
  await expect(composer.locator('.modern-composer-state')).toHaveText('Answer requested');
  await expect(form.getByRole('button',{name:'Send answer',exact:true})).toBeDisabled();
  await form.getByRole('radio',{name:/Small patch/}).check();
  await form.getByRole('textbox',{name:'Answer: Which approach?',exact:true}).fill('Keep scope tiny');
  await expect(form.getByRole('radio',{name:/Small patch/})).not.toBeChecked();
  for(const width of [1440,390]) {await page.setViewportSize({width,height:900});expect(await composer.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/native-input-${width}.png`)});}
  await form.getByRole('button',{name:'Send answer',exact:true}).click();
  await expect.poll(()=>answer).toEqual({runId:'input-run',requestId:'input-request',answers:{q0:{options:[],text:'Keep scope tiny'}}});
  expect(prompts).toBe(0);await expect(form).toHaveCount(0);
});

test('completed native turns open chronological captured review without implying attribution',async({page})=>{
  const status={available:true,state:'completed',runId:'finished-input',afterSequence:0,harness:'codex',output:'',tools:[],inventory:'runtime',approvals:[]};
  let after:string|null=null;
  await page.route('**/controller',route=>route.fulfill({json:status}));
  await page.route('**/since?*',route=>{after=new URL(route.request().url()).searchParams.get('after');return route.continue();});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  await page.getByLabel('More workspace options').click();
  await page.getByRole('button',{name:'Review new captured activity',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review work',exact:true});await expect(review).toContainText('Captured after this turn began');
  await expect(review.locator('.review-counts')).toBeVisible();expect(after).toBe('0');
  await expect(review).toContainText('order, not attribution or coverage');
});


test('Home keeps workspace scope on empty filters and navigates all virtual sessions with the keyboard',async({page})=>{
  const base=app.store.getRecording(ids.codex!)!;
  const recordings=Array.from({length:180},(_,i)=>({...base,id:`keyboard-${i}`,title:`Keyboard session ${String(i).padStart(3,'0')}`,workspaceRoot:i%2?'/work/beta':'/work/alpha',lastSourceTime:new Date(Date.now()-i*3600000).toISOString()}));
  await page.route(/\/v1\/recordings$/,route=>route.fulfill({json:{recordings}}));
  await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[],errors:[]}}));
  await page.goto(server.launchUrl);await expect(page.locator('.mh-session').first()).toBeVisible();
  const list=page.locator('.mh-session-list');await list.focus();await page.keyboard.press('End');
  await expect(page.locator('[data-session-index="179"] .mh-session-open')).toBeFocused();
  expect(await page.locator('.mh-session').count()).toBeLessThan(35);
  await page.keyboard.press('Home');await expect(page.locator('[data-session-index="0"] .mh-session-open')).toBeFocused();
  await page.getByRole('button',{name:/alpha.*90/}).click();
  const search=page.getByRole('textbox',{name:'Find sessions',exact:true});await search.fill('Keyboard session 001');
  await expect(page.locator('.mh-empty h2')).toHaveText('No matching sessions');
  await expect(page.locator('.mh-results>header h2')).toHaveText('alpha');await expect(page.locator('.mh-session')).toHaveCount(0);
  await search.press('Escape');await expect(search).toHaveValue('');await expect(page.locator('.mh-session').first()).toContainText('Keyboard session 000');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.mh-results>header h2')).toHaveText('All sessions');
  await page.setViewportSize({width:390,height:844});await search.fill('Keyboard session 17');
  await page.getByRole('button',{name:'Clear session search',exact:true}).click();await expect(search).toHaveValue('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve('.local/home-polish-phone.png')});
});

test('workspace utilities have grouped keyboard navigation without hiding expanded usage or trapping focus',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.codex}`);
  const trigger=page.getByLabel('More workspace options',{exact:true});await trigger.focus();await page.keyboard.press('Enter');
  const menu=page.locator('.workspace-menu[open]');await expect(menu.getByText('Session tools',{exact:true})).toBeVisible();
  await page.keyboard.press('ArrowDown');await expect(menu.getByRole('button',{name:'Review work',exact:true})).toBeFocused();
  await menu.locator('.usage-peek>summary').focus();await page.keyboard.press('Enter');await expect(menu.getByText('Input tokens',{exact:true})).toBeVisible();
  await page.keyboard.press('End');await expect(menu.locator('.prompt-menu>summary')).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();await expect(menu).toHaveCount(0);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:844});await trigger.click();await page.locator('.workspace-menu .usage-peek>summary').click();
    const box=(await page.locator('.workspace-menu>div').boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    await page.screenshot({path:resolve(`.local/utilities-polish-${width}.png`)});await page.mouse.click(10,400);await expect(menu).toHaveCount(0);
  }
});


test('captured commands page the whole session, filter outcomes and preserve complete large input',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedCommand:string}).copiedCommand=text;}}}));
  const journal=join(dir,'commands-review.jsonl'),timestamp='2026-10-18T00:00:00Z';
  const rows=[JSON.stringify({timestamp,type:'session_meta',payload:{id:'commands-review',cwd:root}})];
  for(let n=0;n<71;n++){
    const command=n===70?'echo '+('complete-input '.repeat(500))+'END_OF_CAPTURED_COMMAND':`echo ledger-command-${n}`;
    rows.push(JSON.stringify({timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:`ledger-${n}`,arguments:JSON.stringify({cmd:command})}}));
    rows.push(JSON.stringify({timestamp,type:'response_item',payload:{type:'function_call_output',call_id:`ledger-${n}`,output:JSON.stringify({output:`ledger output ${n}`,metadata:{exit_code:n%2}})}}));
  }
  writeFileSync(journal,rows.join('\n')+'\n');const {recordingId}=await app.ingest.importSource('codex',journal);
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
  await expect(page.locator('.history')).toBeVisible();
  await page.keyboard.press('Control+k');const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});await nav.getByRole('combobox').fill('captured commands');
  await nav.getByRole('option').filter({hasText:'Find captured commands'}).click();
  const dialog=page.getByRole('dialog',{name:'Captured commands',exact:true});await expect(dialog).toContainText('71 matching commands');
  const cards=dialog.locator('.captured-command');await expect(cards).toHaveCount(25);
  const first=cards.first();await expect(first.locator('.commands-limit')).toContainText('Preview');
  await expect(first.getByRole('button',{name:'Copy command',exact:true})).toHaveCount(0);
  await first.locator('.command-full-input>summary').click();await expect(first).toContainText('END_OF_CAPTURED_COMMAND');
  await dialog.getByRole('button',{name:'Older',exact:true}).click();await expect(cards.first()).toContainText('ledger-command-45');
  await cards.first().getByRole('button',{name:'Copy command',exact:true}).click();expect(await page.evaluate(()=>(window as unknown as {copiedCommand:string}).copiedCommand)).toBe('echo ledger-command-45');
  await dialog.getByRole('button',{name:'Older',exact:true}).click();await expect(cards).toHaveCount(21);await expect(cards.last()).toContainText('ledger-command-0');
  const newerResponse=page.waitForResponse(response=>response.url().includes('/commands?')&&response.url().includes('direction=newer'));
  await dialog.getByRole('button',{name:'Newer',exact:true}).click();expect((await (await newerResponse).json()).items[0].command).toBe('echo ledger-command-45');await expect(cards.first()).toContainText('ledger-command-45');
  await dialog.getByRole('searchbox',{name:'Filter captured command previews',exact:true}).fill('ledger-command-1');await expect(dialog).toContainText('11 matching commands');
  await dialog.getByRole('combobox',{name:'Command outcome',exact:true}).selectOption('error');await expect(dialog.locator('.command-outcome').first()).toHaveText('Failed');
  await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve('.local/captured-commands-phone.png')});
  await cards.first().getByRole('button',{name:'Open captured activity',exact:false}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.inspector')).toBeVisible();
  await page.keyboard.press('Escape');await page.getByLabel('More workspace options',{exact:true}).click();await page.locator('.workspace-menu[open]').getByRole('button',{name:'Review work',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Review work',exact:true});await review.getByRole('button',{name:'Captured commands',exact:true}).click();await expect(review).toHaveCount(0);await expect(dialog).toContainText('71 matching commands');

});
