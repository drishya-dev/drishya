import { resolve } from 'node:path';
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
for(const [index,id] of ids.entries()) test(`actual recording ${index+1}: history and multi-file workspace`,async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await expect(page.locator('.mh-session').first()).toBeVisible();
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-home.png`)});
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(id)}`);
  await expect(page.locator('.history')).toBeVisible();
  await expect.poll(()=>page.locator('.history .op,.history .prose,.history .turn').evaluateAll(nodes=>nodes.some(el=>{const r=el.getBoundingClientRect();return r.height>0&&r.bottom>100&&r.top<innerHeight-180;})),{timeout:20000}).toBe(true);
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-history.png`)});
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
  const graph=await app.graph(id);
  const paths=graph.nodes.map(node=>node.path).filter(path=>!path.startsWith('.local/')&&/\.(ts|tsx|md|css)$/.test(path));
  const preferred=['apps/ui/src/components/Viewer.tsx','apps/ui/src/modern/recovered-surfaces.css'];
  const selected=[...preferred.filter(path=>paths.includes(path)),...paths].filter((path,n,all)=>all.indexOf(path)===n).slice(0,2);
  expect(selected.length).toBe(2);
  for(const path of selected){await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);await page.locator('[data-spine-path]').filter({has:page.getByText(path,{exact:true})}).click();}
  await desk.getByRole('button',{name:'Split view',exact:true}).click();
  await expect(desk.locator('.desk-code')).toHaveCount(2);
  await page.screenshot({path:resolve(`.local/review-actual-${index+1}-workspace.png`)});
  const reader=desk.getByRole('region',{name:`Workspace file ${selected[0]}`,exact:true});
  const meta=await reader.locator('footer').innerText();
  const total=Number(meta.match(/of (\d+)/)?.[1]);
  if(total>400) {
    await reader.getByRole('textbox',{name:`Go to line in ${selected[0]}`,exact:true}).fill('300');
    await reader.getByRole('button',{name:'Go',exact:true}).click();
    await expect(reader.locator('footer')).toContainText('Lines 201–400');
    await reader.locator('.desk-code').evaluate(node=>{node.scrollTop=120;node.dispatchEvent(new Event('scroll',{bubbles:true}));});
    await desk.getByRole('tab',{name:selected[1]!.split('/').at(-1),exact:true}).click();
    await desk.getByRole('tab',{name:selected[0]!.split('/').at(-1),exact:true}).click();
    await expect(reader.locator('footer')).toContainText('Lines 201–400');
    await expect.poll(()=>reader.locator('.desk-code').evaluate(node=>node.scrollTop)).toBe(120);
  }
  await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(page.locator('.history')).toBeVisible();
});
