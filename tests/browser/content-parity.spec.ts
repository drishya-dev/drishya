import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from './legacy-test.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {parityFixture,paritySurfaces} from './fixtures/content-parity.ts';
let dir:string,app:App,server:RunningServer;
test.setTimeout(25000);
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-content-parity-'));app=new App(dir);server=await startServer({app,port:0,token:'synthetic-parity'});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
for(const surface of paritySurfaces)test(`${surface} retains its captured material and bounded desktop reading`,async({page})=>{
 const {bundle,opId}=parityFixture(surface);await page.setViewportSize({width:600,height:900});let remote=0;await page.route('https://example.invalid/**',route=>{remote++;return route.abort();});await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));await page.goto(new URL(`/?demo&experience=modern&motion=0&at=${Math.max(bundle.projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===opId),bundle.projection.timeline.findIndex(item=>item.type==='op-start'&&item.operationId===opId))+1}`,server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();const history=page.locator('.history');await history.focus();await page.keyboard.press('Shift+C');const card=page.locator(`article[data-op-id="${opId}"]`);await card.scrollIntoViewIfNeeded();await expect(card).toBeVisible();
 const expand=card.locator('button.op-expand');await expand.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');const material=card.locator('.op-expanded');await expect(material).toBeVisible();
 switch(surface){
  case 'read':await expect(material.locator('[data-source-line="1"]')).toBeAttached();await expect(material.getByRole('button',{name:'Next lines',exact:true})).toBeEnabled();break;
  case 'edit':await expect(material).toContainText('after-state not verified');await expect(material.getByRole('button',{name:'Next change lines',exact:true})).toBeEnabled();break;
  case 'search':await expect(material).toContainText('123 recorded results');await expect(material.locator('.search-bead')).toHaveCount(50);await expect(material).toContainText('73 more recorded hits');break;
  case 'test':await expect(material).toContainText('literal captured failure');await expect(material).toContainText('fixture test');break;
  case 'plan':await expect(material.locator('.plan-list li')).toHaveCount(80);await expect(material).toContainText('Captured step 80');break;
  case 'delegation':await expect(material).toContainText('Captured delegated task');await expect(material).toContainText(/acknowledgement|returned/);break;
  case 'question':await expect(material.getByRole('group',{name:'Question to you'})).toContainText('No answer was captured');await expect(material.locator('.question-options li')).toHaveCount(2);break;
  case 'process':await expect(material).toContainText('Still waiting for a recorded outcome');await expect(material).toContainText('Exit not captured');await expect(material).toContainText('Running session: 731');await expect(card.locator('.state-returned')).toHaveCount(1);break;
  case 'unknown-mcp':await expect(material).toContainText('Captured mixed sibling');await expect(material.getByRole('button',{name:'Inspect resources · 1',exact:true})).toBeVisible();break;
  case 'orchestration':await expect(material).toContainText('Captured sibling failed');await expect(material.getByRole('button',{name:'Inspect data',exact:true})).toHaveCount(1);break;
  case 'truncated':await expect(material).toContainText('captured incomplete source');break;
  case 'missing':await expect(material).toContainText('No result content captured');break;
 }
 expect(await material.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);expect(remote).toBe(0);await page.screenshot({path:resolve(`.local/parity-fixture-${surface}-600.png`)});
});
