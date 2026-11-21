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
 if(process.env.DRISHYA_FOCUS_TRACE)await page.addInitScript(()=>{
  const rows:unknown[]=[];Object.assign(window,{__focusTrace:rows});
  const node=(el:EventTarget|null)=>el instanceof Element?`${el.tagName}.${el.className}`:String(el);
  const record=(type:string,target:EventTarget|null,extra:object={})=>{rows.push({at:performance.now(),type,target:node(target),active:node(document.activeElement),...extra});if(rows.length>500)rows.shift();};
  for(const type of ['focusin','focusout','keydown','toggle'])document.addEventListener(type,event=>record(type,event.target,{key:(event as KeyboardEvent).key,open:event.target instanceof HTMLDetailsElement?event.target.open:undefined}),true);
  const focus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){record('focus-call',this,{stack:new Error().stack});focus.apply(this,args);record('focus-result',this);};
 });
 await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());
 await page.route('**/controller',r=>r.fulfill({json:{harness:'codex',available:false,output:'',tools:Array.from({length:300},(_,n)=>`runtime_tool_${n}${n===299?'_'+ 'long_name_'.repeat(20):''}`),inventory:'runtime',approvals:[],state:'idle'}}));
});
test.afterEach(async({page},info)=>{if(process.env.DRISHYA_FOCUS_TRACE){const rows=await page.evaluate(()=>Reflect.get(window,'__focusTrace'));writeFileSync(info.outputPath('focus-trace.json'),JSON.stringify(rows,null,2));}});

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
    const composerNode = stage.querySelector('.prompt-composer');
    const inFront = composerNode && Number(getComputedStyle(node.parentElement!).zIndex)>Number(getComputedStyle(composerNode).zIndex);
    const sharesWidth = composer && composer.right>box.left && composer.left<box.right;
    // bounds
    const minMidY = rail.top + box.height / 2, maxMidY = rail.bottom - box.height / 2;
    const expectedMidY = Math.max(minMidY, Math.min(maxMidY, innerHeight / 2));
    return Math.max(
    // bounds
      Math.abs((box.top + box.bottom) / 2 - expectedMidY),
      header.bottom - box.top, box.bottom - (sharesWidth&&!inFront?composer!.top:innerHeight),
      rail.top - box.top, box.bottom - rail.bottom,
    );
  })).toBeLessThanOrEqual(1);
}

test('late tool-trail navigation yields focus to the search and its Escape summary',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const dock=await open(page,'modern','codex');
  const recorded=dock.locator('.tool-list');
  const search=recorded.getByRole('searchbox',{name:'Search tools'});
  await search.fill('Read');await recorded.locator('.tool-row').click();
  const trail=dock.locator('.tool-trail');
  await expect(trail.locator('.trail-count')).toContainText('of 3');
  // Hold the real reader's two-frame material-arrival boundary. The tool event
  // and selected operation still run; only its eventual focus is delayed.
  await page.evaluate(()=>{
    const original=window.requestAnimationFrame,held:FrameRequestCallback[]=[];let released=false;
    window.requestAnimationFrame=callback=>{held.push(callback);return 0;};
    Object.assign(window,{__releaseToolArrival:()=>{
      if(released)return;released=true;
      window.requestAnimationFrame=original;
      held.forEach(callback=>original.call(window,callback));
    },__heldToolArrival:held});
    document.querySelector<HTMLButtonElement>('.tool-trail button[aria-label="Last use"]')!.click();
  });
  try {
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__heldToolArrival').length)).toBeGreaterThan(0);
    await search.focus();await search.press('Escape');
    const summary=recorded.locator(':scope > summary');
    await expect(recorded).not.toHaveAttribute('open','');await expect(summary).toBeFocused();
    await page.evaluate(async()=>{
      Reflect.get(window,'__releaseToolArrival')();
      await new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    });
    // The latest requested use remains selected, without reclaiming keyboard ownership.
    await expect(trail.locator('.trail-count')).toHaveText('3 of 3');
    await expect(summary).toBeFocused();
  } finally {await page.evaluate(()=>Reflect.get(window,'__releaseToolArrival')?.());}
});

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
    (window as unknown as { firstRecentering: Animation }).firstRecentering = animation;
    animation.currentTime = 70;
  });
  await group.locator('summary').first().click();
  await expect(group).not.toHaveAttribute('open', '');
  await expect.poll(() => dock.evaluate(node => {
    const animations = node.getAnimations();
    return animations.length === 1 && animations[0] !==
      (window as unknown as { firstRecentering: Animation }).firstRecentering;
  })).toBe(true);
  await group.locator('summary').first().press('Enter');
  await expect(group).toHaveAttribute('open', '');
  expect(await dock.evaluate(node => node.getAnimations().length)).toBe(0);
  expect(await dock.evaluate(node => (window as unknown as { originalDock: Element }).originalDock === node)).toBe(true);
  await group.locator('summary').first().press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => dock.evaluate(node => node.getAnimations().length)).toBe(0);
  await group.locator('summary').first().click();
  await expect(group).toHaveAttribute('open', '');
  await assertDockBounds(dock);
  expect(await dock.evaluate(node => node.getAnimations().length)).toBe(0);
});

test('tall foreground Toolbox stays scrollable and reachable above the open composer', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 640 });
  const dock = await open(page, 'modern', 'claude-code');
  // Foreground drawers own this space until closed: open the prompt first.
  await page.getByRole('button',{name:'Close tools',exact:true}).click();
  const expand = page.getByRole('button', { name: 'Expand prompt', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('button',{name:'Tools',exact:true}).click();
  for (const selector of ['.md-agents>summary', 'summary[data-mcp-server="synthetic"]', 'summary:has-text("Run tools")']) {
    await dock.locator(selector).press('Enter');
  }
  await expect.poll(() => dock.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  await assertDockBounds(dock);
  // The runtime inventory is rendered here; the legacy ToolList rows are hidden.
  const last = dock.locator('.md-runtime-tool').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await last.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  expect(await dock.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

// UI-32: Toolbox keeps its complete outer frame across heights/palettes with scroll edge cues, and never overlaps Follow controls.
async function measureBottomControls(page: Page) {
  return page.evaluate(() => {
    const rect = (s: string) => {
      const el = document.querySelector(s);
      if (!el || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
      !!(a && b && a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5);
    const dock = rect(".modern-tool-station");
    const pill = rect(".follow-pill");
    const follow = rect(".workspace-follow");
    const toggle = rect(".catalog-toggle");
    const transport = rect(".modern-replay-transport");
    const dockEl = document.querySelector(".modern-tool-station");
    const toolboxEl = document.querySelector(".modern-toolbox");
    const dockStyle = dockEl ? getComputedStyle(dockEl) : null;
    const innerStyle = toolboxEl ? getComputedStyle(toolboxEl) : null;
    return {
      innerWidth, innerHeight, dock, pill, follow, toggle, transport,
      gap: pill && follow ? follow.left - pill.right : null,
      centerDeltaY: pill && follow ? Math.abs((pill.top + pill.height / 2) - (follow.top + follow.height / 2)) : null,
      overlapPillFollow: overlaps(pill, follow),
      overlapDockFollow: overlaps(dock, follow),
      overlapDockPill: overlaps(dock, pill),
      overlapDockToggle: overlaps(dock, toggle),
      overlapPillTransport: overlaps(pill, transport),
      dockBorders: dockStyle ? [dockStyle.borderTopWidth, dockStyle.borderRightWidth, dockStyle.borderBottomWidth, dockStyle.borderLeftWidth] : null,
      dockRadius: dockStyle ? parseFloat(dockStyle.borderBottomRightRadius) : 0,
      innerBorders: innerStyle ? [innerStyle.borderTopWidth, innerStyle.borderRightWidth, innerStyle.borderBottomWidth, innerStyle.borderLeftWidth] : null,
      scrollTop: dockEl?.scrollTop ?? 0,
      scrollMax: dockEl ? Math.max(0, dockEl.scrollHeight - dockEl.clientHeight) : 0,
      cueTop: dockEl?.getAttribute("data-scroll-top") ?? null,
      cueBottom: dockEl?.getAttribute("data-scroll-bottom") ?? null,
    };
  });
}

for (const palette of ["dark", "light", "midnight"] as const) {
  test(`UI-32 Toolbox preserves its complete outer border, scroll cues, and reachable footer in ${palette} palette`, async ({ page }) => {
    await page.addInitScript((v) => { try { localStorage.setItem("drishya.theme", v); } catch {} }, palette);
    await page.setViewportSize({ width: 1440, height: 500 });
    const dock = await open(page, "modern", "claude-code");
    await dock.locator(".tool-list > summary").press("Enter");
    await expect(dock.locator(".tool-list")).not.toHaveAttribute("open", "");
    // Pressing Enter scrolled the summary into view; return to top before asserting top/bottom cues.
    await dock.evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(() => dock.getAttribute("data-scroll-top")).toBeNull();

    const closedTop = await measureBottomControls(page);
    expect(closedTop.dockBorders).toEqual(["1px", "1px", "1px", "1px"]);
    expect(closedTop.dockRadius).toBeGreaterThan(0);
    expect(closedTop.innerBorders).toEqual(["0px", "0px", "0px", "0px"]);
    expect(closedTop.scrollMax).toBeGreaterThan(0);
    expect(closedTop.cueTop).toBeNull();
    expect(closedTop.cueBottom).toBe("1");
    expect(closedTop.dock!.bottom).toBeLessThanOrEqual(closedTop.innerHeight - 10);

    const mcpTrigger = dock.locator("summary[data-mcp-server=\"synthetic\"]");
    await mcpTrigger.press("Enter");
    await expect(dock.locator(".md-server[open]")).toHaveCount(1);
    await dock.evaluate((el) => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2); });
    await expect.poll(() => dock.getAttribute("data-scroll-top")).toBe("1");
    await expect.poll(() => dock.getAttribute("data-scroll-bottom")).toBe("1");

    const footerSummary = dock.locator(".tool-list > summary");
    await footerSummary.scrollIntoViewIfNeeded();
    const atBottom = await dock.evaluate((el) => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
    expect(atBottom).toBeGreaterThan(0);
    await expect.poll(() => dock.getAttribute("data-scroll-bottom")).toBeNull();
    await expect(footerSummary).toBeInViewport();
    const footerRect = await footerSummary.evaluate((el) => el.getBoundingClientRect());
    const dockRect = await dock.evaluate((el) => el.getBoundingClientRect());
    expect(footerRect.bottom).toBeLessThanOrEqual(dockRect.bottom + 0.5);
    expect(footerRect.bottom).toBeLessThanOrEqual(500);
  });
}

test("UI-32 jump-to-latest pill and Follow switch group without overlap across widths, zoom, modes and composer", async ({ browser, page }) => {
  const liveId = "synthetic-window-ui32-live", liveSource = "ui32-live-src", liveJournal = join(dir, "ui32-live.jsonl");
  writeFileSync(liveJournal, "");
  app.store.upsertRecording({ id: liveId, adapterId: "claude-code", harness: "claude-code", sourcePath: liveJournal, title: "Live UI-32 test", workspaceRoot: dir });
  app.store.appendObservations(liveId, liveSource, { offset: 1, generation: 0, fingerprint: "ui32-1" }, [
    { id: "u32-0", recordingId: liveId, source: { adapterId: "claude-code", adapterVersion: "synthetic", sourceId: liveSource, generation: 0, byteOffset: 0, part: 0 }, observedAt: "2026-11-12T00:00:00Z", workspaceRoot: dir, agentId: "main", kind: "session.meta", payload: { harness: "claude-code" }, privacyPolicyVersion: PRIVACY_POLICY_VERSION, redactions: [], availability: "complete" },
    { id: "u32-1", recordingId: liveId, source: { adapterId: "claude-code", adapterVersion: "synthetic", sourceId: liveSource, generation: 0, byteOffset: 1, part: 0 }, observedAt: "2026-11-12T00:00:01Z", workspaceRoot: dir, agentId: "main", kind: "message.user", payload: { text: "Start UI-32 live test" }, privacyPolicyVersion: PRIVACY_POLICY_VERSION, redactions: [], availability: "complete" },
  ]);

  const checkAligned = async (targetPage: Page, label: string) => {
    const followBtn = targetPage.locator(".workspace-follow");
    await expect(followBtn).toBeVisible();
    if ((await followBtn.getAttribute("aria-checked")) === "true") await followBtn.click();
    await expect(targetPage.locator(".follow-pill")).toBeVisible();
    const m = await measureBottomControls(targetPage);
    expect(m.overlapPillFollow, `${label}: pill/follow overlap`).toBe(false);
    expect(m.gap, `${label}: standard gap`).toBeGreaterThanOrEqual(6);
    expect(m.gap, `${label}: standard gap`).toBeLessThanOrEqual(12);
    expect(m.centerDeltaY, `${label}: vertical alignment`).toBeLessThanOrEqual(1.5);
    expect(m.pill!.right, `${label}: pill inside viewport`).toBeLessThanOrEqual(m.innerWidth);
    expect(m.follow!.right, `${label}: follow inside viewport`).toBeLessThanOrEqual(m.innerWidth);
    expect(m.follow!.bottom, `${label}: follow above bottom edge`).toBeLessThanOrEqual(m.innerHeight);
    if (m.dock) {
      expect(m.overlapDockFollow, `${label}: toolbox above follow`).toBe(false);
      expect(m.overlapDockPill, `${label}: toolbox above pill`).toBe(false);
      expect(m.overlapDockToggle, `${label}: toolbox above toggle`).toBe(false);
    }
    return m;
  };

  // 1. 600px narrow + expanded composer + Toolbox open + live unread step badge widening .follow-pill.
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator(".home")).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${liveId}`);
  await expect(page.locator(".history")).toBeVisible();
  const toolsBtn = page.getByRole("button", { name: "Tools", exact: true });
  if (await toolsBtn.isVisible()) await toolsBtn.click();
  await expect(page.locator(".modern-tool-station")).toBeVisible();
  await checkAligned(page, "600px live minimized composer");

  app.store.appendObservations(liveId, liveSource, { offset: 2, generation: 0, fingerprint: "ui32-2" }, [
    { id: "u32-2", recordingId: liveId, source: { adapterId: "claude-code", adapterVersion: "synthetic", sourceId: liveSource, generation: 0, byteOffset: 2, part: 0 }, observedAt: "2026-11-12T00:00:02Z", workspaceRoot: dir, agentId: "main", kind: "message.assistant", payload: { text: "Second live response" }, privacyPolicyVersion: PRIVACY_POLICY_VERSION, redactions: [], availability: "complete" },
  ]);
  app.ingest.emit("change", { type: "recording", recordingId: liveId, revision: app.store.getRecording(liveId)?.revision ?? 0, observationCount: app.store.countObservations(liveId), added: 1, live: true });
  await expect(page.locator(".follow-pill small")).toHaveText("1");
  const badgeMetrics = await checkAligned(page, "600px with unread count badge");
  expect(badgeMetrics.pill!.width).toBeGreaterThan(34);

  const expandBtn = page.getByRole("button", { name: "Expand prompt", exact: true });
  if (await expandBtn.isVisible()) await expandBtn.click();
  await expect(page.locator(".modern-native-composer.open")).toBeVisible();
  await checkAligned(page, "600px live expanded composer");

  // 2. 1440px & 3840px ultrawide stage with composer, plus Settings -> Replay sequence -> Exit replay.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.get("claude-code")}`);
  await expect(page.locator(".modern-tool-station")).toBeVisible();
  await checkAligned(page, "1440px history with composer");

  await page.setViewportSize({ width: 3840, height: 1440 });
  const ultrawide = await checkAligned(page, "3840px ultrawide stage");
  expect(ultrawide.follow!.right).toBeLessThan(3840 - 600);

  // 3. Replay transport keeps floating .follow-pill inside the ultrawide stage and above the transport bar, and exiting restores the grouped controls.
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  await page.getByRole("tab", { name: "Playback", exact: true }).click();
  await page.getByRole("button", { name: "Replay sequence", exact: true }).click();
  await expect(page.locator(".modern-replay-transport")).toBeVisible();
  await page.locator(".history").hover();
  await page.mouse.wheel(0, -120);
  await expect(page.locator(".follow-pill")).toBeVisible();
  const diag = await measureBottomControls(page);
  expect(diag.pill).not.toBeNull();
  expect(diag.overlapPillTransport).toBe(false);
  expect(diag.pill!.bottom).toBeLessThanOrEqual(diag.transport!.top);
  expect(diag.pill!.right).toBeLessThan(3840 - 600);
  await page.getByRole("button", { name: "Exit replay", exact: true }).click();
  await checkAligned(page, "3840px after exit replay");

  // 4. Without composer (?demo) at 1440px, 600px and 67% zoom context (dpr: 0.67).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0`);
  await expect(page.locator(".modern-tool-station")).toBeVisible();
  await expect(page.locator(".prompt-composer")).toHaveCount(0);
  await checkAligned(page, "demo no-composer 1440px");
  await page.setViewportSize({ width: 600, height: 900 });
  const demoTools = page.getByRole("button", { name: "Tools", exact: true });
  if (await demoTools.isVisible()) await demoTools.click();
  await checkAligned(page, "demo no-composer 600px");
  const zoomCtx = await browser.newContext({ viewport: { width: 2149, height: 1343 }, deviceScaleFactor: 0.67 });
  try {
    const zp = await zoomCtx.newPage();
    await zp.goto(`${server.url}/?demo&experience=modern&motion=0`);
    await expect(zp.locator(".modern-tool-station")).toBeVisible();
    await expect(zp.locator(".prompt-composer")).toHaveCount(0);
    await checkAligned(zp, "demo no-composer 67% zoom");
  } finally {
    await zoomCtx.close();
  }
});


// UI-32b: Toolbox sits centered on viewport Y center when unconstrained, and Follow toggles never shift History, Toolbox or chrome.
test("UI-32b Toolbox centers on viewport Y axis and Follow controls never shift layout or scroll", async ({ page }) => {
  const shiftId = "synthetic-ui32b-shift", shiftSrc = "ui32b-src", shiftJournal = join(dir, "ui32b-shift.jsonl");
  writeFileSync(shiftJournal, "");
  app.store.upsertRecording({ id: shiftId, adapterId: "claude-code", harness: "claude-code", sourcePath: shiftJournal, title: "Synthetic UI-32b shift", workspaceRoot: dir });
  const obs: import("../../packages/contracts/src/index.ts").Observation[] = [];
  let seq = 0;
  const push = (kind: import("../../packages/contracts/src/index.ts").Observation["kind"], payload: Record<string, unknown>) => {
    obs.push({
      id: `ui32b-${seq}`, recordingId: shiftId,
      source: { adapterId: "claude-code", adapterVersion: "synthetic", sourceId: shiftSrc, generation: 0, byteOffset: seq++, part: 0 },
      observedAt: `2026-11-12T00:00:${String(seq % 60).padStart(2, "0")}Z`,
      workspaceRoot: dir, agentId: "main", kind, payload: payload as never,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION, redactions: [], availability: "complete",
    });
  };
  push("session.meta", { harness: "claude-code" });
  push("message.user", { text: "Synthetic UI-32b prompt" });
  push("queue.receipt", { state: "recorded", preview: "Queued receipt" });
  push("queue.receipt", { state: "delivered", preview: "Queued receipt" });
  for (let i = 0; i < 30; i++) push("message.assistant", { text: `Assistant paragraph ${i}. `.repeat(10) });
  app.store.appendObservations(shiftId, shiftSrc, { offset: seq, generation: 0, fingerprint: "ui32b-1" }, obs);

  const snapshot = () => page.evaluate(() => {
    const pick = (s: string) => {
      const el = document.querySelector(s);
      if (!el || !el.getClientRects().length) return null;
      const r = el.getBoundingClientRect();
      return { left: +r.left.toFixed(1), top: +r.top.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), midY: +((r.top + r.bottom) / 2).toFixed(1) };
    };
    const h = document.querySelector<HTMLElement>(".history")!;
    const firstVisible = [...document.querySelectorAll<HTMLElement>(".passage-slot[data-passage-id]")].find(n => n.getBoundingClientRect().bottom > 0);
    return {
      vh: innerHeight,
      scrollTop: Math.round(h.scrollTop),
      scrollHeight: Math.round(h.scrollHeight),
      firstSlotTop: firstVisible ? +firstVisible.getBoundingClientRect().top.toFixed(1) : null,
      station: pick(".modern-tool-station"),
      rail: pick(".toolbox-rail"),
      followSwitch: pick(".workspace-follow"),
      composer: pick(".prompt-composer"),
      promptRail: pick(".history-prompt-marks"),
      folder: pick(".folder-explorer"),
    };
  });

  for (const [width, height] of [[1440, 900], [1280, 760], [600, 900]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(server.launchUrl);
    await expect(page.locator(".home")).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${shiftId}`);
    await expect(page.locator(".history")).toBeVisible();
    const toolsBtn = page.getByRole("button", { name: "Tools", exact: true });
    if (await toolsBtn.isVisible()) await toolsBtn.click();
    const dock = page.locator(".modern-tool-station");
    await expect(dock).toBeVisible();
    await assertDockBounds(dock);

    let before = await snapshot();
    if (width >= 1020) {
      expect(Math.abs(before.station!.midY - height / 2), `${width}x${height} centered on Y axis`).toBeLessThanOrEqual(1);
    } else {
      // Narrow 600px view with composer-setup constrains the lower rail for the full Toolbox;
      // verify its minimized pill (whose compact height fits freely inside the rail) centers on viewport Y axis.
      await dock.locator(".toolbox-collapse").click();
      await expect(dock).toHaveClass(/toolbox-minimized/);
      await assertDockBounds(dock);
      const compact = await snapshot();
      expect(Math.abs(compact.station!.midY - height / 2), `${width}x${height} minimized Toolbox centered on Y axis`).toBeLessThanOrEqual(1);
      await dock.locator(".toolbox-collapse").click();
      await expect(dock).not.toHaveClass(/toolbox-minimized/);
      await assertDockBounds(dock);
    }

    // Toggling Follow latest off/on must not move history scroll, passages, Toolbox or chrome. Take the baseline once the
    // opening has finished: after the first paint the session starts watching and reloads its projection, and on a loaded
    // runner that second paint landed between this baseline and the toggle (scrollTop 2701 then 2648, 18 Nov).
    let steady = "";
    await expect.poll(async () => {
      const sample = JSON.stringify(await snapshot());
      const same = sample === steady;
      steady = sample;
      return same;
    }, { intervals: [300], timeout: 15_000, message: "layout steady across two samples 300 ms apart" }).toBe(true);
    before = JSON.parse(steady) as typeof before;
    await page.locator(".workspace-follow").click();
    await expect(page.locator(".follow-pill")).toBeVisible();
    await page.waitForTimeout(150);
    const afterOff = await snapshot();
    expect(afterOff.scrollTop, `${width}x${height} scrollTop unchanged on Follow OFF`).toBe(before.scrollTop);
    expect(afterOff.scrollHeight, `${width}x${height} scrollHeight unchanged on Follow OFF`).toBe(before.scrollHeight);
    expect(afterOff.firstSlotTop, `${width}x${height} first visible passage unchanged on Follow OFF`).toBe(before.firstSlotTop);
    expect(afterOff.station, `${width}x${height} Toolbox unchanged on Follow OFF`).toEqual(before.station);
    expect(afterOff.followSwitch, `${width}x${height} Follow switch unchanged on Follow OFF`).toEqual(before.followSwitch);
    expect(afterOff.composer, `${width}x${height} composer unchanged on Follow OFF`).toEqual(before.composer);
    expect(afterOff.promptRail, `${width}x${height} prompt rail unchanged on Follow OFF`).toEqual(before.promptRail);

    // Clicking Back to latest from bottom leaves every layout surface unmoved.
    await page.locator(".follow-pill").click();
    await expect(page.locator(".follow-pill")).toHaveCount(0);
    await page.waitForTimeout(150);
    const afterOn = await snapshot();
    expect(afterOn.scrollTop, `${width}x${height} scrollTop unchanged on Back to latest`).toBe(before.scrollTop);
    expect(afterOn.firstSlotTop, `${width}x${height} passage unchanged on Back to latest`).toBe(before.firstSlotTop);
    expect(afterOn.station, `${width}x${height} Toolbox unchanged on Back to latest`).toEqual(before.station);
    expect(afterOn.followSwitch, `${width}x${height} Follow switch unchanged on Back to latest`).toEqual(before.followSwitch);

    if (width >= 1020) {
      await dock.locator(".toolbox-collapse").click();
      await expect(dock).toHaveClass(/toolbox-minimized/);
      await assertDockBounds(dock);
      const mini = await snapshot();
      expect(Math.abs(mini.station!.midY - height / 2), `${width}x${height} minimized Toolbox centered on Y axis`).toBeLessThanOrEqual(1);
      await dock.locator(".toolbox-collapse").click();
    }
  }
});
