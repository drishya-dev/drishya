import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-prompt-rail-'));const path=join(dir,'timeline.jsonl');
  const rows=[JSON.stringify({type:'session_meta',payload:{id:'timeline',cwd:dir}})];
  for(let n=0;n<160;n++)for(const role of ['user','assistant'])rows.push(JSON.stringify({timestamp:`2026-10-17T01:${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}Z`,type:'response_item',payload:{type:'message',role,content:[{type:role==='user'?'input_text':'output_text',text:role==='user'?`Timeline prompt ${n}`:`Response ${n}\n\n${'Readable work. '.repeat(20)}`}]}}));
  writeFileSync(path,rows.join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('codex',path)).recordingId;
  server=await startServer({app,port:0,token:'synthetic-prompt-timeline'});
});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page,request})=>{
  await request.delete(`${server.url}/v1/working-locations`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'}});
  await page.route('**/segments',route=>route.fulfill({json:{items:[],partial:false}}));
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
});

test('bottom-anchored prompt timeline scrolls independently and the page scrollbar stays at the viewport edge',async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const rail=page.getByRole('navigation',{name:'Prompt positions in history'}),history=page.locator('.history');
  await expect(rail).toBeVisible();await expect.poll(()=>history.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  for(const name of ['Expand prompt','Minimize prompt','Expand prompt']) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect.poll(()=>history.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
  }
  const geometry=await rail.evaluate(el=>{const r=el.getBoundingClientRect(),work=document.querySelector('.studio-actions')!.getBoundingClientRect(),h=document.querySelector('.history')!.getBoundingClientRect();return {top:r.top,bottom:r.bottom,workBottom:work.bottom,historyRight:h.right,viewport:innerWidth,transform:getComputedStyle(el).transform};});
  expect(geometry.historyRight).toBe(geometry.viewport);expect(geometry.transform).toBe('none');expect(geometry.top-geometry.workBottom).toBeGreaterThanOrEqual(13);expect(960-geometry.bottom).toBe(58);
  await expect(rail.getByRole('button').last()).toHaveAttribute('data-prompt-ordinal','160');
  const mainTop=await history.evaluate(el=>el.scrollTop),railTop=await rail.evaluate(el=>el.scrollTop);
  await rail.hover();await page.mouse.wheel(0,-220);
  await expect.poll(()=>rail.evaluate(el=>el.scrollTop)).toBeLessThan(railTop);expect(await history.evaluate(el=>el.scrollTop)).toBe(mainTop);
  await rail.focus();await page.keyboard.press('Home');await expect(rail.getByRole('button').first()).toHaveAttribute('data-prompt-ordinal','1');
  const first=rail.getByRole('button').first();await first.hover();await expect(page.locator('.prompt-rail-preview time')).toHaveAttribute('datetime','2026-10-17T01:00:00Z');
  await first.click();await expect(page.locator('.turn').first()).toContainText('Timeline prompt 0');
  await rail.focus();await page.keyboard.press('End');await expect(rail.getByRole('button').last()).toHaveAttribute('data-prompt-ordinal','160');
  const before=await history.evaluate(el=>el.scrollTop);await page.mouse.move(1428,180);await page.mouse.wheel(0,160);await expect.poll(()=>history.evaluate(el=>el.scrollTop)).toBeGreaterThan(before);
});

test('short prompt lists grow upward from the same bottom anchor and narrow screens remain bounded',async({page})=>{
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  const rail=page.getByRole('navigation',{name:'Prompt positions in history'});
  await expect(rail).toBeVisible();
  const initial=await rail.boundingBox();expect(initial!.y).toBeGreaterThan(300);
  for(const width of [1440,900,600]) {
    await page.setViewportSize({width,height:844});
    await expect(async () => {
      const r = (await rail.boundingBox())!;
      expect(r.y).toBeGreaterThan(0);
      expect(r.y+r.height).toBeLessThan(844);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(await page.locator('.history').evaluate(el=>el.getBoundingClientRect().right)).toBe(width);
      const tools = await page.locator('.catalog-toggle').boundingBox();
      if (tools && r.x < tools.x+tools.width && r.x+r.width > tools.x) expect(r.y+r.height).toBeLessThanOrEqual(tools.y-10);
    }).toPass({ timeout: 5000 });
  }
  await page.screenshot({path:resolve('.local/prompt-timeline-600.png')});
});


// UI-33: the open Toolbox never covers the prompt rail; every tick stays reachable and the rail keeps one invariant lane across open, resized and minimized states.
for (const [width, height, deviceScaleFactor] of [[1440, 900, 1], [1440, 900, 2], [600, 900, 1]] as const) {
  test(`UI-33 prompt rail keeps its own lane and stays clickable beside open, resized and minimized Toolbox at ${width}x${height} dpr=${deviceScaleFactor}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
    try {
      const page = await context.newPage();
      await page.goto(server.launchUrl);
      await expect(page.locator('.home')).toBeVisible();
      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
      const rail = page.getByRole('navigation', { name: 'Prompt positions in history' });
      await expect(rail).toBeVisible();
      if (width <= 820) await page.getByRole('button', { name: 'Tools', exact: true }).click();
      const dock = page.locator('.modern-tool-station');
      await expect(dock).toBeVisible();
      await expect(dock).not.toHaveClass(/toolbox-minimized/);

      const openRects = await page.evaluate(() => {
        const box = (el: Element) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
        const dockBox = box(document.querySelector('.modern-tool-station')!);
        const railBox = box(document.querySelector('.history-prompt-marks')!);
        const ticks = [...document.querySelectorAll<HTMLElement>('.history-prompt-marks button')].map((button) => {
          const r = button.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          return {
            ordinal: button.dataset.promptOrdinal,
            overlapsDock: r.left < dockBox.right && r.right > dockBox.x && r.top < dockBox.bottom && r.bottom > dockBox.y,
            insideRail: cy >= railBox.y && cy <= railBox.bottom,
            clickable: !!(hit && button.contains(hit)),
          };
        });
        return { dockBox, railBox, ticks };
      });
      expect(openRects.railBox.x, 'prompt rail starts to the right of the open Toolbox').toBeGreaterThanOrEqual(openRects.dockBox.right + 6);
      expect(openRects.ticks.length).toBeGreaterThan(10);
      expect(openRects.ticks.every(t => !t.overlapsDock && t.insideRail && t.clickable), 'every rendered tick is clear of Toolbox and hit-testable').toBe(true);

      // Hover and click both the first and last rendered ticks while the Toolbox is open.
      const last = rail.locator('button').last();
      await last.hover();
      await expect(page.locator('.prompt-rail-preview')).toBeVisible();
      await last.click();
      const first = rail.locator('button').first();
      await first.hover();
      await expect(page.locator('.prompt-rail-preview')).toBeVisible();
      await first.click();

      // Changing Toolbox height (expanding a tool group) does not move the rail.
      const summary = dock.locator('.tool-heading').first();
      if (await summary.isVisible()) {
        await summary.click();
        const resizedRail = await rail.evaluate(el => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; });
        expect(resizedRail).toEqual({ x: openRects.railBox.x, y: openRects.railBox.y, width: openRects.railBox.width, height: openRects.railBox.height });
      }

      // Minimizing / closing Toolbox keeps the prompt rail's box identical.
      if (width <= 820) await page.getByRole('button', { name: 'Close tools', exact: true }).click();
      else {
        await dock.locator('.toolbox-collapse').click();
        await expect(dock).toHaveClass(/toolbox-minimized/);
      }
      await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      const minimizedRail = await rail.evaluate(el => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; });
      expect(minimizedRail).toEqual({ x: openRects.railBox.x, y: openRects.railBox.y, width: openRects.railBox.width, height: openRects.railBox.height });
    } finally {
      await context.close();
    }
  });
}
