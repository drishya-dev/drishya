import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Locator,type Page} from '@playwright/test';
import type {Observation} from '../../packages/contracts/src/index.ts';
import {PRIVACY_POLICY_VERSION} from '../../packages/privacy/src/index.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

// Synthetic dock regression guards. Genuine acceptance runs in a scratch home.
let dir:string,app:App,server:RunningServer;
const ids=new Map<string,string>();
const mcpName=(n:number)=>`mcp__synthetic__tool_${String(n).padStart(3,'0')}${n===299?'_'+ 'long_name_'.repeat(20):''}`;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-toolbox-window-'));app=new App(join(dir,'store'));
 for(const harness of ['claude-code','codex'] as const){
  const id=`synthetic-window-${harness}`,sourceId=`source-${harness}`,journal=join(dir,`${harness}.jsonl`);writeFileSync(journal,'');
  app.store.upsertRecording({id,adapterId:harness,harness,sourcePath:journal,title:`Synthetic Toolbox ${harness}`,workspaceRoot:dir});
  let sequence=0;const rows:Omit<Observation,'receivedSequence'>[]=[];
  const add=(kind:Observation['kind'],agentId:string,payload:Observation['payload'],operationId?:string)=>rows.push({id:`${id}-${sequence++}`,recordingId:id,source:{adapterId:harness,adapterVersion:'synthetic',sourceId,generation:0,byteOffset:sequence,part:0},observedAt:'2026-11-05T00:00:00Z',workspaceRoot:dir,agentId,operationId,kind,payload,privacyPolicyVersion:PRIVACY_POLICY_VERSION,redactions:[],availability:'complete'});
  add('session.meta','main',{harness});add('message.user','main',{text:'Synthetic Toolbox window regression'});
  add('tools.snapshot','main',{source:'prompt_snapshot',tools:['Read',...Array.from({length:300},(_,n)=>mcpName(n))].map(name=>({name}))});
  for(let n=0;n<3;n++){
   add('tool.call','main',{tool:'Read',input:{file_path:join(dir,`${n}.ts`)},intent:{kind:'read',path:join(dir,`${n}.ts`)}},`read-${n}`);
   add('tool.result','main',{output:`Synthetic source ${n}`,isError:false},`read-${n}`);
  }
  for(let n=0;n<300;n++){
   add('tool.call','main',{tool:mcpName(n),input:{n},intent:{kind:'mcp',server:'synthetic',tool:mcpName(n).slice('mcp__synthetic__'.length)}},`mcp-${n}`);
   add('tool.result','main',{output:'Synthetic MCP result',isError:false},`mcp-${n}`);
  }
  for(let n=1;n<=3;n++){
   add('session.meta',`worker-${n}`,{harness});
   add('tool.call','main',{tool:'Task',input:{description:`Worker ${n}`}},`spawn-${n}`);
   add('agent.spawn','main',{childAgentId:`worker-${n}`,agentType:`Worker ${n}`,basis:'source-id'},`spawn-${n}`);
   add('tool.result','main',{output:'Synthetic worker ready',isError:false},`spawn-${n}`);
  }
  app.store.appendObservations(id,sourceId,{offset:sequence,generation:0,fingerprint:'synthetic'},rows);ids.set(harness,id);
  // These normalized observations must exercise real MCP/read material, not the reducer's other-kind fallback.
  const projected=app.projection(id);
  expect(projected.operations.filter(op=>op.detail.kind==='mcp')).toHaveLength(300);
  expect(projected.operations.filter(op=>op.detail.kind==='read')).toHaveLength(3);
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());
 await page.route('**/controller',r=>r.fulfill({json:{harness:'codex',available:false,output:'',tools:Array.from({length:300},(_,n)=>`runtime_tool_${n}${n===299?'_'+ 'long_name_'.repeat(20):''}`),inventory:'runtime',approvals:[],state:'idle'}}));
});

async function open(page: Page, skin: string, harness: string, motion = false) {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(server.url + '/?experience=' + skin + '&motion=' + Number(motion) + '#/r/' + ids.get(harness));
  await expect(page.locator('.history')).toBeVisible();
  const dock = page.locator('.modern-tool-station');
  if (page.viewportSize()!.width === 600) await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(dock).toBeVisible();
  return dock;
}

async function assertDockBounds(dock: Locator) {
  await expect.poll(() => dock.evaluate(node => {
    const box = node.getBoundingClientRect();
    const rail = node.parentElement!.getBoundingClientRect();
    const stage = node.closest('.connected-workspace')!;
    const header = stage.querySelector('.workspace-header')!.getBoundingClientRect();
    const composer = stage.querySelector('.prompt-composer')?.getBoundingClientRect();
    return Math.max(
      Math.abs((box.top + box.bottom) / 2 - (rail.top + rail.bottom) / 2),
      header.bottom - box.top, box.bottom - (composer?.top ?? innerHeight),
      rail.top - box.top, box.bottom - rail.bottom,
    );
  })).toBeLessThanOrEqual(1);
}

for (const skin of ['modern', 'clarity']) for (const width of [600, 1440]) {
  test(skin + ' Toolbox expands in place, stays centred and scrolls at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const dock = await open(page, skin, width === 600 ? 'claude-code' : 'codex');
    const recorded = dock.locator('.tool-list');
    await expect(recorded.locator('summary')).toContainText('Available tools · recorded');
    await recorded.locator('summary').press('Enter');
    await expect(recorded).not.toHaveAttribute('open', '');
    await assertDockBounds(dock);
    for (const [summary, selector, count] of [
      ['summary[data-mcp-server="synthetic"]', 'button[data-mcp-tool]', 300],
      ['.md-agents>summary', '.station-agents [role=switch]', 4],
      ['summary:has-text("Run tools")', '.md-runtime-tool', 300],
      ['.tool-heading', '.tool-row', 302],
    ] as const) {
      const trigger = dock.locator(summary);
      await trigger.press('Enter');
      const group = trigger.locator('..');
      await expect(group).toHaveAttribute('open', '');
      if (count === 4) await group.locator('.station-subagents>summary').press('Enter');
      await expect(group.locator(selector)).toHaveCount(count);
      const last = group.locator(selector).last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      await expect(page.locator('[data-toolbox-window]')).toHaveCount(0);
      await assertDockBounds(dock);
      if (count !== 302) await trigger.press('Escape');
    }
    const search = recorded.getByRole('searchbox', { name: 'Search tools' });
    await search.fill('Read');
    await recorded.locator('.tool-row').click();
    const trail = dock.locator('.tool-trail');
    for (const [button, index] of [['First use', 1], ['Next use', 2], ['Last use', 3], ['Previous use', 2]] as const) {
      await trail.getByRole('button', { name: button, exact: true }).click();
      await expect(trail.locator('.trail-count')).toHaveText(index + ' of 3');
    }
    await search.press('Escape');
    await expect(recorded).not.toHaveAttribute('open', '');
    await expect(recorded.locator('summary')).toBeFocused();
    await recorded.locator('summary').press('Enter');
    await expect(search).toHaveValue('Read');
    await expect(recorded.locator('.tool-row')).toHaveAttribute('aria-pressed', 'true');
  });
}

test('pointer disclosure recentres the same dock and reduced motion settles immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dock = await open(page, 'clarity', 'codex', true);
  await dock.locator('.tool-heading').press('Enter');
  await expect(dock.locator('.tool-list')).not.toHaveAttribute('open', '');
  await dock.evaluate(node => {
    (window as unknown as { originalDock: Element }).originalDock = node;
    const animate = node.animate.bind(node);
    node.animate = (...args: Parameters<Element['animate']>) => {
      const animation = animate(...args);
      animation.pause();
      return animation;
    };
  });
  const group = dock.locator('.md-agents');
  await group.locator('summary').first().click();
  await expect(group).toHaveAttribute('open', '');
  await expect.poll(() => dock.evaluate(node => node.getAnimations().length)).toBe(1);
  await dock.evaluate(node => {
    const animation = node.getAnimations()[0];
    animation.currentTime = 70;
  });
  await group.locator('summary').first().click();
  await expect(group).not.toHaveAttribute('open', '');
  await expect.poll(() => dock.evaluate(node => node.getAnimations().length)).toBe(1);
  expect(await dock.evaluate(node => (window as unknown as { originalDock: Element }).originalDock === node)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => dock.evaluate(node => node.getAnimations().length)).toBe(0);
  await group.locator('summary').first().click();
  await expect(group).toHaveAttribute('open', '');
  await assertDockBounds(dock);
  expect(await dock.evaluate(node => node.getAnimations().length)).toBe(0);
});

test('tall Toolbox scrolls within the available height when the composer rises', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 640 });
  const dock = await open(page, 'modern', 'claude-code');
  for (const selector of ['.md-agents>summary', 'summary[data-mcp-server="synthetic"]', 'summary:has-text("Run tools")']) {
    await dock.locator(selector).press('Enter');
  }
  await expect.poll(() => dock.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  const expand = page.getByRole('button', { name: 'Expand prompt', exact: true });
  if (await expand.isVisible()) await expand.click();
  await assertDockBounds(dock);
  const last = dock.locator('.tool-row').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await dock.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});
