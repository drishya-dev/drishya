import { resolve } from 'node:path';
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
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(page.locator('.history')).toBeVisible();
});
