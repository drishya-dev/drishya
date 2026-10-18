import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { pointAtHistory, beginReadingSamples, finishReadingSamples } from './history-gestures.ts';
import { expect,test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer,type RunningServer } from '../../apps/daemon/src/server.ts';

// Explicit opt-in to an existing local redacted store. No new journal import or native turn.
const store=process.env.DRISHYA_REVIEW_STORE;
const ids=(process.env.DRISHYA_REVIEW_IDS ?? '').split(',').filter(Boolean);
let app:App,server:RunningServer;
test.skip(!store || !ids.length,'Opt in with a local redacted store and explicit recording IDs.');
test.beforeAll(async()=>{if(!store || !ids.length)return;app=new App(store);server=await startServer({app,port:0});});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();});
test('actual product surfaces keep evidence, current source, review and map navigation bounded',async({page})=>{
  test.setTimeout(90000);
  // Audit surfaces from a known starting location; recovery is covered separately.
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  const id=ids[0]!, graph=await app.graph(id);
  const path=graph.nodes.find(node=>node.path==='README.md')?.path??graph.nodes.find(node=>!node.path.startsWith('.local/')&&node.path.endsWith('.ts'))?.path;
  test.skip(!path,'This opted-in recording has no suitable local reading path.');
  const frame=async(name:string)=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${name}: document overflow`).toBeLessThanOrEqual(1);
    for(const dialog of await page.locator('dialog[open]').all()) {
      const box=(await dialog.boundingBox())!;
      expect(box.x,`${name}: dialog left`).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width,`${name}: dialog right`).toBeLessThanOrEqual((await page.viewportSize())!.width+1);
      expect(box.y,`${name}: dialog top`).toBeGreaterThanOrEqual(0);
      expect(box.y+box.height,`${name}: dialog bottom`).toBeLessThanOrEqual((await page.viewportSize())!.height+1);
    }
    await page.screenshot({path:resolve(`.local/surface-${name}.png`),animations:'disabled'});
  };
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:960});
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(id)}`);
    const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
    if(await desk.isVisible())await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
    const back=page.getByRole('button',{name:'Back to work',exact:true});if(await back.isVisible())await back.click();
    const current=page.locator('.current-file-reader');if(await current.isVisible())await current.locator(':scope>header button').click();
    await expect(page.locator('.history')).toBeVisible();
    await page.getByLabel('More workspace options',{exact:true}).click();
    await page.locator('.workspace-menu[open]').getByRole('button',{name:'Review work',exact:true}).click();
    const review=page.getByRole('dialog',{name:'Review work',exact:true});await expect(review.locator('.review-counts')).toBeVisible();
    await frame(`review-${width}`);
    const changes=review.getByRole('region',{name:'Files with captured changes',exact:true}).getByRole('button');
    if(await changes.count()) {
      await changes.first().click();const evidence=page.locator('dialog.file-workspace');await expect(evidence).toBeVisible();
      await expect(evidence.getByText('Loading captured actions…',{exact:true})).toHaveCount(0);
      await frame(`captured-file-${width}`);await evidence.locator(':scope>header button').click();
    } else await review.getByRole('button',{name:'Close Review work',exact:true}).click();
    await page.getByLabel('More workspace options',{exact:true}).click();
    await page.locator('.workspace-menu[open]').getByRole('button',{name:/^Review questions/}).click();
    const questions=page.getByRole('dialog',{name:'Review questions',exact:true});await expect(questions).toBeVisible();await frame(`questions-${width}`);
    await questions.getByRole('button',{name:'Close Review questions',exact:true}).click();
    await page.getByLabel('More workspace options',{exact:true}).click();
    await page.locator('.workspace-menu[open] .usage-peek>summary').click();await frame(`usage-${width}`);
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
    const grant=desk.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(grant.or(desk.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();await expect(desk.getByRole('tablist')).toBeVisible();
    await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
    await page.keyboard.press('Control+k');const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});await nav.getByRole('combobox').fill(path!);
    await nav.getByRole('option').filter({has:page.getByText(path!,{exact:true})}).first().click();await expect(current).toBeVisible();await expect(current.locator('.current-file-code')).toBeVisible();
    await frame(`current-file-${width}`);await current.locator(':scope>header button').click();
    await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
    await page.getByRole('textbox',{name:'Find a file on the map',exact:true}).fill(path!);
    await page.locator('.map-matches').getByRole('button',{name:path!,exact:true}).click();
    const imports=page.getByRole('switch',{name:'Import paths',exact:true});if(await imports.getAttribute('aria-checked')!=='true')await imports.click();
    await expect(page.getByRole('region',{name:'Direct import connections',exact:true})).toBeVisible();await frame(`map-imports-${width}`);
    await page.getByRole('button',{name:'Back to work',exact:true}).click();
    expect(await page.locator('.history').isVisible()).toBe(true);
  }
});
test('actual session palette and settings survey keeps readable controls at desktop and phone sizes',async({page})=>{
  await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(ids[0]!)}`);
  await expect(page.locator('.history')).toBeVisible();
  const metrics=[];
  for(const label of ['Jet Black','Deep Ocean','Porcelain','Orchid','Blueprint','Evergreen','Copper']) {
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});
    await settings.getByRole('button',{name:label,exact:true}).click();
    await page.screenshot({path:resolve(`.local/palette-${label.replaceAll(' ','-')}-settings.png`),animations:'disabled'});
    await settings.getByRole('tab',{name:'Reading',exact:true}).click();
    await expect(settings.getByRole('combobox',{name:'Exposed reasoning detail',exact:true})).toBeVisible();
    metrics.push(await settings.evaluate((dialog,label)=>{
      const read=(element:Element)=>{const style=getComputedStyle(element);return {color:style.color,background:style.backgroundColor,font:style.fontSize};};
      const root=getComputedStyle(document.documentElement);
      return {label,tokens:Object.fromEntries(['--bg','--s1','--s2','--s3','--t1','--t2','--t3','--t4','--focus','--pass','--fail','--syntax-keyword','--syntax-string','--syntax-function','--syntax-number'].map(key=>[key,root.getPropertyValue(key).trim()])),body:read(dialog),select:read(dialog.querySelector('select')!),secondary:read(dialog.querySelector('.setting-row small')!)};
    },label));
    await settings.getByRole('button',{name:'Close Workspace settings',exact:true}).click();
    expect(await page.locator('.history').evaluate(node=>node.scrollWidth-node.clientWidth),`${label} history should not gain horizontal overflow`).toBeLessThanOrEqual(1);
    await page.screenshot({path:resolve(`.local/palette-${label.replaceAll(' ','-')}-history.png`),animations:'disabled'});
    await page.locator('.history').evaluate(node=>node.scrollTop=0);
    await expect(page.locator('.history .op').first()).toBeVisible();
    await page.locator('.history .op').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:resolve(`.local/palette-${label.replaceAll(' ','-')}-material.png`),animations:'disabled'});
  }
  writeFileSync(resolve('.local/palette-survey.json'),JSON.stringify(metrics,null,2));
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});
  for(const name of ['Appearance','Reading','Playback','Privacy','Keyboard','UI versions']) {
    await settings.getByRole('tab',{name,exact:true}).click();
    const panel=settings.locator('.modern-settings-content');
    expect(await panel.evaluate(node=>node.scrollWidth-node.clientWidth),`${name} must fit its narrow reading space`).toBeLessThanOrEqual(1);
    await page.screenshot({path:resolve(`.local/settings-phone-${name.replaceAll(' ','-')}.png`)});
  }
});
test('actual current Git review supports expanded patch reading without repository writes',async({page})=>{
  const id=ids[0]!;test.skip(!app.recording(id).workspaceRoot,'This recording has no current local workspace.');
  await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${encodeURIComponent(id)}`);
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'Git review',exact:true});
  const workspace=reader.getByRole('button',{name:'Approve current workspace',exact:true});
  await expect(workspace.or(reader.getByRole('button',{name:'Approve read-only Git',exact:true})).or(reader.getByRole('button',{name:'Refresh changes',exact:true}))).toBeVisible();
  if(await workspace.isVisible())await workspace.click();
  const consent=reader.getByRole('button',{name:'Approve read-only Git',exact:true});
  await expect(consent.or(reader.getByRole('button',{name:'Refresh changes',exact:true}))).toBeVisible();
  if(await consent.isVisible())await consent.click();
  await expect(reader.getByRole('complementary',{name:'Git changed files',exact:true})).toBeVisible();
  const resize=reader.getByRole('separator',{name:'Resize Git reading space',exact:true});await resize.focus();await page.keyboard.press('End');
  await expect.poll(()=>reader.evaluate(node=>Math.round(node.getBoundingClientRect().width))).toBe(1200);
  await reader.getByRole('button',{name:/^Hide files/}).click();
  await expect(reader.getByRole('complementary',{name:'Git changed files',exact:true})).toBeHidden();
  await page.screenshot({path:resolve('.local/review-actual-git-expanded.png')});
  await reader.getByRole('button',{name:'Close Git review',exact:true}).click();await expect(page.locator('.history')).toBeVisible();
});
test('actual library Home keeps sessions readable at desktop, phone and short-window sizes',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.mh-home')).toBeVisible();
  await expect(page.locator('.mh-session').first()).toBeVisible();
  await expect(page.locator('.mh-results>header')).not.toContainText('discovering local sessions',{timeout:30000});
  for(const [name,width,height] of [['desktop',1440,960],['phone',390,844],['short',1440,640]] as const) {
    await page.setViewportSize({width,height});
    const list=page.locator('.mh-session-list');
    await expect.poll(()=>list.evaluate(node=>node.clientHeight)).toBeGreaterThan(160);
    expect(await page.locator('.mh-home').evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
    const rows=page.locator('.mh-session');
    expect(await rows.first().evaluate(node=>node.getBoundingClientRect().height)).toBe(width<=650?104:80);
    await page.screenshot({path:resolve(`.local/review-actual-home-density-${name}.png`)});
  }
});
test('actual imported evidence is searchable across the local library without a native turn',async({page})=>{
  const result=await app.history.searchLibrary({q:'test',count:5});test.skip(!result.items.length,'This opted-in store has no indexed test text.');
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.getByRole('button',{name:'Search evidence',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Search session evidence'});await dialog.getByRole('searchbox').fill('test');await expect(dialog.locator('.library-search-results>button').first()).toBeVisible();
  await dialog.locator('.library-search-results>button').first().click();await expect(dialog).toHaveCount(0);await expect(page.locator('.history')).toBeVisible();
  await page.screenshot({path:resolve('.local/review-actual-library-search.png')});
});
for(const [index,id] of ids.entries()) test(`actual recording ${index+1}: history and multi-file workspace`,async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('.mh-session').first()).toBeVisible();
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-home.png`)});
  await page.goto(`${server.url}/?experience=modern#/r/${encodeURIComponent(id)}`);
  await expect(page.locator('.viewer')).toBeVisible();
  const recoveredDesk=page.getByRole('region',{name:'Developer workspace',exact:true});
  if(await recoveredDesk.isVisible())await recoveredDesk.getByRole('button',{name:'Back to agent',exact:true}).click();
  const currentReader=page.locator('.current-file-reader');if(await currentReader.isVisible())await currentReader.locator('header button').first().click();
  const mapBack=page.getByRole('button',{name:'Back to work',exact:true});if(await mapBack.isVisible())await mapBack.click();
  await expect(page.locator('.history')).toBeVisible();
  await expect.poll(()=>page.locator('.history .op,.history .prose,.history .turn').evaluateAll(nodes=>nodes.some(el=>{const r=el.getBoundingClientRect();return r.height>0&&r.bottom>100&&r.top<innerHeight-180;})),{timeout:20000}).toBe(true);
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-history.png`)});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const history=page.locator('.history');
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(let n=0;n<12;n++) {
    await pointAtHistory(page,history);await page.mouse.wheel(0,-220);
    await history.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    await expect(history).toBeVisible();expect(errors).toEqual([]);
    const stability=await history.evaluate(async el=>{
      const viewport=el.getBoundingClientRect();
      const node=[...el.querySelectorAll<HTMLElement>('[data-op-id],[data-prose-id]')].find(node=>{const r=node.getBoundingClientRect();return r.bottom>viewport.top+80&&r.top<viewport.bottom-140;});
      if(!node)return 0;
      const top=node.getBoundingClientRect().top;await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
      return node.isConnected?Math.abs(node.getBoundingClientRect().top-top):0;
    });
    expect(stability,'Captured material should not snap into a whole-card position after manual scrolling').toBeLessThan(3);
  }
  const latest=page.getByRole('button',{name:/Back to latest/});if(await latest.isVisible())await latest.click();
  await expect.poll(()=>history.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  await page.waitForTimeout(400);
  await pointAtHistory(page,history);
  await beginReadingSamples(page);
  for(let n=0;n<95;n++) {
    await page.mouse.wheel(0,-145);
    await page.waitForTimeout(n%7===0?240:35);
  }
  await page.waitForTimeout(300);
  const reading=await finishReadingSamples(page);
  expect(reading.frames).toBeGreaterThan(100);
  expect(reading.jumps,'Actual captured material must not jump out and back while older pages mount').toEqual([]);
  if(await latest.isVisible())await latest.click();
  await expect.poll(()=>history.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  const textBlocks=page.locator('.prose .md-code-text');
  for(const block of await textBlocks.all())expect(await block.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
  await expect(desk).toBeVisible();
  const recording=app.recording(id);
  if(!recording.workspaceRoot) {
    await expect(desk).toContainText('no captured workspace root');
    await expect(desk.getByRole('button',{name:'Approve workspace reading'})).toBeDisabled();
    await page.screenshot({path:resolve(`.local/review-actual-${index+1}-workspace-unavailable.png`)});
    await desk.getByRole('button',{name:'Read captured files',exact:true}).click();
    await expect(desk).toHaveCount(0);
    await expect(page.locator('.history')).toBeVisible();
    return;
  }
  const grant=desk.getByRole('button',{name:'Approve workspace reading'});
  await expect(grant.or(desk.getByRole('tablist'))).toBeVisible();
  if(await grant.isVisible())await grant.click();
  await expect(desk.getByRole('tablist')).toBeVisible();
  const split=desk.getByRole('button',{name:'Split view',exact:true});if(await split.getAttribute('aria-pressed')==='true')await split.click();
  const graph=await app.graph(id);
  const paths=graph.nodes.map(node=>node.path).filter(path=>!path.startsWith('.local/')&&/\.(ts|tsx|md|css)$/.test(path));
  const preferred=['apps/ui/src/components/Viewer.tsx','apps/ui/src/modern/recovered-surfaces.css'];
  const selected=[...preferred.filter(path=>paths.includes(path)),...paths].filter((path,n,all)=>all.indexOf(path)===n).slice(0,2);
  expect(selected.length).toBe(2);
  for(const path of selected){await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);await page.locator('[data-spine-path]').filter({has:page.getByText(path,{exact:true})}).click();}
  await desk.getByRole('button',{name:'Split view',exact:true}).click();
  await desk.locator('.desk-pane').nth(0).click({position:{x:8,y:8}});
  await desk.getByRole('tab',{name:selected[0]!.split('/').at(-1),exact:true}).click();
  await desk.locator('.desk-pane').nth(1).click({position:{x:8,y:8}});
  await desk.getByRole('tab',{name:selected[1]!.split('/').at(-1),exact:true}).click();
  await expect(desk.locator('.desk-code,.desk-markdown')).toHaveCount(2);
  await expect(desk.locator('.desk-markdown>p[role=status]')).toHaveCount(0);
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-workspace.png`)});
  const reader=desk.getByRole('region',{name:`Workspace file ${selected[0]}`,exact:true});
  const meta=await reader.locator('footer').innerText();
  const total=Number(meta.match(/(\d+) lines/)?.[1]);
  if(total>400) {
    await reader.getByRole('textbox',{name:`Go to line in ${selected[0]}`,exact:true}).fill('300');
    await reader.getByRole('button',{name:'Go',exact:true}).click();
    await expect(reader.locator('footer')).toContainText(`${total} lines`);
    await reader.locator('.desk-code').evaluate(node=>{node.scrollTop=120;node.dispatchEvent(new Event('scroll',{bubbles:true}));});
    await desk.getByRole('tab',{name:selected[1]!.split('/').at(-1),exact:true}).click();
    await desk.getByRole('tab',{name:selected[0]!.split('/').at(-1),exact:true}).click();
    await expect(reader.locator('footer')).toContainText(`${total} lines`);
    await expect.poll(()=>reader.locator('.desk-code').evaluate(node=>node.scrollTop)).toBe(120);
  }
  await reader.getByRole('button',{name:'Edit file',exact:true}).click();
  const editor=reader.getByRole('textbox',{name:`Local draft for ${selected[0]}`,exact:true});
  await expect(editor).toBeFocused();
  await expect(reader.getByRole('button',{name:'Review edit with harness',exact:true})).toBeDisabled();
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-editor.png`)});
  await reader.getByRole('button',{name:'Discard draft',exact:true}).click();
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(page.locator('.history')).toBeVisible();
});


test('actual command review uses whole-session worker pages with bounded desktop and phone reading',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  for(const id of ids) {
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(id)}`);await expect(page.locator('.history')).toBeVisible();
    await page.keyboard.press('Control+k');const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});await nav.getByRole('combobox').fill('captured commands');await nav.getByRole('option').filter({hasText:'Find captured commands'}).click();
    const dialog=page.getByRole('dialog',{name:'Captured commands',exact:true});await expect(dialog.locator('.commands-caption')).toContainText('matching commands');
    expect(await dialog.locator('.captured-command').count()).toBeLessThanOrEqual(25);await expect(dialog.getByRole('alert')).toHaveCount(0);
    for(const width of [1440,390]) {await page.setViewportSize({width,height:900});expect(await dialog.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/commands-actual-${id}-${width}.png`)});}
    if(await dialog.getByRole('button',{name:'Older',exact:true}).isEnabled()){await dialog.getByRole('button',{name:'Older',exact:true}).click();await expect(dialog.getByRole('button',{name:'Newer',exact:true})).toBeEnabled();}
    await dialog.getByRole('button',{name:'Close Captured commands',exact:true}).click();
  }
});


test('actual Review findings, prompt overview and packet stay bounded in both harness histories',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  for(const id of [ids[0]!,ids.at(-1)!]){
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(id)}`);await expect(page.locator('.history')).toBeVisible();
    for(const [query,title] of [['Review findings','Review findings'],['Prompt overview','Prompt overview'],['Prepare review packet','Review packet']] as const){
      await page.keyboard.press('Control+k');const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});await nav.getByRole('combobox').fill(query);await nav.getByRole('option').filter({hasText:query}).click();const dialog=page.getByRole('dialog',{name:title,exact:true});await expect(dialog.locator('.insights-intro')).toContainText('through observation');await expect(dialog.getByRole('alert')).toHaveCount(0);
      if(title==='Review packet'){await dialog.getByRole('button',{name:'Prepare packet preview',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'Review packet preview',exact:true})).toContainText('Through observation');}
      for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await dialog.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/insights-${query.replaceAll(' ','-')}-${id}-${width}.png`)});}
      await dialog.getByRole('button',{name:`Close ${title}`,exact:true}).click();
    }
  }
});


test('actual captured changes open import neighborhoods and current source without crowded phone controls',async({page})=>{
  test.setTimeout(90000);
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  for(const id of [ids[0]!,ids.at(-1)!]){
    await page.setViewportSize({width:1440,height:960});
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('.history')).toBeVisible();
    await page.getByLabel('More workspace options',{exact:true}).click();await page.locator('.workspace-menu[open]').getByRole('button',{name:'Review work',exact:true}).click();
    const review=page.getByRole('dialog',{name:'Review work',exact:true}),map=review.locator('.review-file-map').first();await expect(map).toBeVisible();const path=(await map.getAttribute('aria-label'))!.replace('Show map connections for ','');await map.click();
    const consent=page.getByRole('button',{name:'Map the whole repository',exact:true});if(await consent.isVisible())await consent.click();
    const drawer=page.getByRole('region',{name:'Direct import connections',exact:true});
    const missing=page.locator('.map-focus-notice');await expect(drawer.locator('.map-connection-root').or(missing)).toBeVisible();
    if(await missing.isVisible()){await missing.getByRole('button',{name:'Open captured work',exact:true}).click();await expect(page.locator('dialog.file-workspace')).toBeVisible();continue;}
    await expect(drawer.locator('.map-connection-root')).toHaveText(path);await expect(drawer).toContainText('static relationships');
    const read=drawer.getByRole('button',{name:/^(Read current file|Approve reading & open file)$/});await expect(read).toBeVisible();await read.click();
    const current=page.locator('.current-file-reader');await expect(current).toBeVisible();await expect(current.locator('.current-file-code')).toBeVisible();await current.locator(':scope>header button').click();
    for(const width of [1440,390]){await page.setViewportSize({width,height:960});const tools=(await page.locator('.map-tools').boundingBox())!,box=(await drawer.boundingBox())!,zoom=(await page.locator('.map-zoom').boundingBox())!;if(width===390){expect(box.y).toBeGreaterThanOrEqual(tools.y+tools.height);expect(box.y+box.height).toBeLessThanOrEqual(zoom.y);}expect(box.x+box.width).toBeLessThanOrEqual(width+1);await page.screenshot({path:resolve(`.local/map-task-${id}-${width}.png`)});}
  }
});
