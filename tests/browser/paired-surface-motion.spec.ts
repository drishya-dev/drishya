import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let directory: string, app: App, server: RunningServer, recording: string, fileRecording: string, linkRecording: string;
test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'drishya-paired-motion-'));
  app = new App(directory);
  recording = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  const root = join(directory,'repo');
  mkdirSync(root);
  const git = (...args: string[]) => execFileSync('git',['-c','commit.gpgsign=false','-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid', ...args],{cwd:root,stdio:'ignore'});
  git('init');
  writeFileSync(join(root,'first.ts'),'export const value = 1;\n');
  writeFileSync(join(root,'second.ts'),'export const value = 2;\n');
  git('add','.');
  git('commit','-m','Fixture');
  writeFileSync(join(root,'second.ts'),'export const value = 3;\n');
  const journal = join(directory,'peek.jsonl');
  writeFileSync(journal,[{type:'session_meta',payload:{id:'peek-motion-fixture',cwd:root}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Read both files'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
  fileRecording = (await app.ingest.importSource('codex',journal)).recordingId;
  const claude = join(directory,'links.jsonl');
  const base = {timestamp:'2026-11-10T00:00:00Z',sessionId:'paired-links',cwd:root};
  writeFileSync(claude,[
    {...base,type:'user',uuid:'u1',message:{role:'user',content:'Show me the links'}},
    {...base,type:'assistant',uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'text',text:'Read [the guide](https://example.com/guide) first.'}]}},
  ].map(row=>JSON.stringify(row)).join(String.fromCharCode(10))+String.fromCharCode(10));
  linkRecording = (await app.ingest.importSource('claude-code',claude)).recordingId;
  server = await startServer({app, port: 0, token: 'synthetic-paired-motion'});
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

async function openRecording(page: Page, id = recording) {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/#/r/${id}`);
  await expect(page.locator('.modern-session-header')).toBeVisible();
}

test('Changes returns to its true trigger and keeps the same reader if reopened during exit', async ({page}) => {
  const changesBundles: string[] = [];
  page.on('request', request => {
    if (/\/assets\/CompareWindow-.*\.js$/.test(new URL(request.url()).pathname)) changesBundles.push(request.url());
  });
  await openRecording(page);
  const button = page.locator('[data-compare-open]');
  await expect(button).toBeVisible();
  expect(changesBundles).toHaveLength(0);
  await button.click();
  const changes = page.locator('.compare-window');
  await expect(changes).toHaveAttribute('data-surface-phase', 'open');
  expect(changesBundles).toHaveLength(1);
  const result = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLElement>('[data-compare-open]')!;
    const window = document.querySelector<HTMLElement>('.compare-window')!;
    trigger.click();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const closing = window.dataset.surfacePhase;
    const expanded = trigger.getAttribute('aria-expanded');
    const inactive = window.inert;
    const exit = window.getAnimations().find(animation => animation.effect instanceof KeyframeEffect && animation.effect.target === window);
    const delta = exit?.effect instanceof KeyframeEffect ? exit.effect.getKeyframes().at(-1)?.translate : undefined;
    trigger.click();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return { closing, expanded, inactive, delta, preserved: window === document.querySelector('.compare-window') };
  });
  expect(result).toMatchObject({closing:'closing', expanded:'false', inactive:true, preserved:true});
  expect(result.delta).toMatch(/px/);
  await expect(changes).toHaveAttribute('data-surface-phase', 'open');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
});

test('a pointer press during the lazy Changes load cannot replace its opening trigger', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  let unblock!:()=>void, loaded!:()=>void;
  const blocked=new Promise<void>(resolve=>{unblock=resolve;});
  const requested=new Promise<void>(resolve=>{loaded=resolve;});
  await page.route(/\/assets\/CompareWindow-.*\.js$/,async route=>{loaded();await blocked;await route.continue();});
  await openRecording(page);
  await page.evaluate(()=>{
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(...args){
      if(this.classList.contains('compare-window')) Object.assign(this,{openingFrame:(args[0] as Keyframe[])[0]});
      return animate.apply(this,args);
    };
  });
  try {
    await page.locator('[data-compare-open]').click();
    await requested;
    const file=page.locator('[data-workspace-files-trigger]').first();
    const box=await file.boundingBox();
    if (!box) throw new Error('Files control is unavailable');
    // Use a real second press without activating the unrelated Files control.
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(10,300);
    await page.mouse.up();
  } finally {unblock();}
  const changes=page.locator('.compare-window');
  await expect(changes).toHaveAttribute('data-surface-phase','open');
  const actual=await changes.evaluate(element=>{
    const windowBox=element.getBoundingClientRect(), trigger=document.querySelector('[data-compare-open]')!.getBoundingClientRect();
    const limit=(value:number)=>Math.round(Math.max(-72,Math.min(72,value*.16)));
    return {frame:(element as Element & {openingFrame?:Keyframe}).openingFrame?.translate,expected:`${limit(trigger.left+trigger.width/2-windowBox.left-windowBox.width/2)}px ${limit(trigger.top+trigger.height/2-windowBox.top-windowBox.height/2)}px`};
  });
  expect(actual.frame).toBe(actual.expected);
});

test('reduced motion and keyboard dismiss a modal immediately', async ({page}) => {
  await openRecording(page);
  const settings = page.getByRole('button', {name:'Workspace settings', exact:true});
  await settings.click();
  const dialog = page.locator('.settings-dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});
  await settings.click();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.getByRole('button', {name:'Close Workspace settings'}).click();
  await expect(dialog).toHaveCount(0);
});

test('switching to reduced motion finishes an in-flight Changes exit without waiting for it', async ({page}) => {
  await openRecording(page);
  const button = page.locator('[data-compare-open]');
  const changes = page.locator('.compare-window');
  await button.click();
  await expect(changes).toHaveAttribute('data-surface-phase','open');
  await changes.evaluate(element => {
    const animate = element.animate.bind(element);
    element.animate = (...args) => {
      const animation = animate(...args);
      animation.pause();
      return animation;
    };
  });
  await button.click();
  await expect(changes).toHaveAttribute('data-surface-phase','closing');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(changes).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('low resource keeps pointer-opened windows and native popovers immediate', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('drishya.lowResource','1'));
  await openRecording(page);
  await expect(page.locator('html')).toHaveAttribute('data-low-resource','');
  const settings = page.getByRole('button',{name:'Workspace settings',exact:true});
  await settings.click();
  const dialog = page.locator('.settings-dialog');
  expect(await dialog.evaluate(element => element.getAnimations().length)).toBe(0);
  await dialog.getByRole('button',{name:'Close Workspace settings'}).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Search',exact:true}).click();
  const search = page.locator('.search:popover-open');
  expect(await search.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
});

test('the narrow Toolbox catalog travels in both directions and ignores keyboard toggles', async ({page}) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await openRecording(page);
  const dock = page.locator('.modern-tool-station');
  const toggle = page.locator('.catalog-toggle');
  const events = () => dock.evaluate(element => (element as HTMLElement & { motionEvents: string[] }).motionEvents);
  await dock.evaluate(element => {
    const motionEvents: string[] = [];
    Object.assign(element, {motionEvents});
    element.addEventListener('transitionrun', event => {
      if (event.target !== element) return;
      motionEvents.push((event as TransitionEvent).propertyName);
    });
  });
  await toggle.click();
  await expect(dock).toBeVisible();
  await expect.poll(events).toContain('scale');
  await dock.evaluate(async element => {
    await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    (element as HTMLElement & { motionEvents: string[] }).motionEvents.length = 0;
  });
  await toggle.click();
  await expect.poll(events).toContain('scale');
  await expect(dock).toBeHidden();
  await toggle.press('Enter');
  await expect(dock).toBeVisible();
  expect(await dock.evaluate(element => element.getAnimations().length)).toBe(0);
});

test('resizing to the narrow layout hides an untouched Toolbox immediately', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page);
  const dock=page.locator('.modern-tool-station');
  await dock.locator('.md-agents > summary').click();
  await expect(dock).toBeVisible();
  await dock.evaluate(async element=>{await Promise.allSettled(element.getAnimations().map(animation=>animation.finished));});
  await page.setViewportSize({width:600,height:900});
  const state=await dock.evaluate(element=>({visible:element.checkVisibility(),displayTransition:element.getAnimations().some(animation=>animation instanceof CSSTransition&&animation.transitionProperty==='display')}));
  expect(state).toEqual({visible:false,displayTransition:false});
  await page.locator('.catalog-toggle').click();
  await expect(dock).toBeVisible();
});

test('keyboard navigation disposes the detached pointer menu surface', async ({page}) => {
  await openRecording(page);
  await page.getByLabel('More workspace options',{exact:true}).click();
  const panel = page.locator('.workspace-menu > .workspace-utilities');
  await expect(panel).toHaveAttribute('data-surface-phase','open');
  const node = await panel.elementHandle();
  // Opening Home with the keyboard closes this Viewer without another pointer down.
  await page.locator('.modern-session-header').getByRole('button',{name:'Drishya',exact:true}).press('Enter');
  await expect(page.locator('.home')).toBeVisible();
  expect(await node!.evaluate(element => ({connected:element.isConnected, marked:element.hasAttribute('data-surface-motion')}))).toEqual({connected:false,marked:false});
});

test('a newer on-disk reading wins during the final peek tab exit', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page,fileRecording);
  await page.locator('[data-compare-open]').click();
  const changes = page.locator('.compare-window');
  await changes.getByRole('button',{name:'Approve read-only Git',exact:true}).click();
  await changes.getByRole('button',{name:'Uncommitted',exact:true}).click();
  await changes.getByText('second.ts',{exact:true}).first().click();
  const readOnDisk = changes.getByRole('button',{name:'Open on disk',exact:true});
  await expect(readOnDisk).toBeVisible();

  // Start the first peek separately from Changes so its own button can deliver the newer intent.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:'first.ts'}})));
  const peek=page.locator('.file-peek-reader');
  await expect(peek.getByRole('tab',{name:'first.ts'})).toBeVisible();
  await expect(peek).toHaveAttribute('data-surface-phase','open');
  await peek.evaluate(element=>{
    const animate=element.animate.bind(element);
    element.animate=(...args)=>{
      const animation=animate(...args);
      animation.pause();
      return animation;
    };
  });
  await peek.getByRole('button',{name:'Close preview tab first.ts'}).click();
  await expect(peek).toHaveAttribute('data-surface-phase','closing');
  await readOnDisk.evaluate((element:HTMLButtonElement)=>element.click());
  await expect(peek.getByRole('tab',{name:'second.ts'})).toBeVisible();
  await peek.evaluate(element=>element.getAnimations().forEach(animation=>animation.finish()));
  await expect(peek).toHaveAttribute('data-surface-phase','open');
  await expect(peek.getByRole('tab',{name:'second.ts'})).toHaveAttribute('aria-selected','true');
});

// MOTION-4b: the remaining surfaces. Each group shows an intermediate frame on the way in and on the way out, on the shared clock.
type Frame = {present: boolean; visible: boolean; opacity: number | null};
async function frames(page: Page, selector: string, act: () => Promise<unknown>, ms = 420): Promise<Frame[]> {
  await page.evaluate(sel => {
    const w = window as unknown as {__frames: Frame[]; __sampling: boolean};
    w.__frames = []; w.__sampling = true;
    let element: Element | null = document.querySelector(sel);
    const tick = () => {
      // Bind to the first match and keep following that node, so a surface that leaves is not replaced by another match.
      if (!element) element = document.querySelector(sel);
      w.__frames.push({present: !!element?.isConnected, visible: !!element?.isConnected && element.checkVisibility(), opacity: element?.isConnected ? Number(getComputedStyle(element).opacity) : null});
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, selector);
  await act();
  await page.waitForTimeout(ms);
  return page.evaluate(() => { const w = window as unknown as {__frames: Frame[]; __sampling: boolean}; w.__sampling = false; return w.__frames; });
}
const travelled = (list: Frame[]) => list.some(frame => frame.visible && frame.opacity !== null && frame.opacity > .02 && frame.opacity < .98);

test('every pointer-opened disclosure, in the Toolbox too, fades in and out and keeps the dock in place', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page);
  const drawer = page.locator('.modern-tool-station .md-agents');
  const summary = drawer.locator(':scope > summary');
  const opening = await frames(page, '.md-agents > div', () => summary.click());
  await expect(drawer).toHaveAttribute('open','');
  expect(travelled(opening)).toBe(true);
  const closing = await frames(page, '.md-agents > div', () => summary.click());
  await expect(drawer).not.toHaveAttribute('open','');
  // The content stays visible while it fades; it is gone for good afterwards.
  expect(travelled(closing)).toBe(true);
  expect(closing.at(-1)?.visible).toBe(false);
  // The keyboard settles at once: no frame between hidden and shown.
  await summary.focus();
  const keyboard = await frames(page, '.md-agents > div', () => page.keyboard.press('Enter'), 200);
  await expect(drawer).toHaveAttribute('open','');
  expect(travelled(keyboard)).toBe(false);
});

test('Home: About and the narrow workspace list open and close with motion', async ({page}) => {
  await page.setViewportSize({width:600,height:900});
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  const trigger = page.locator('.mh-workspace-trigger');
  const list = '.mh-workspace-options';
  const opening = await frames(page, list, () => trigger.click());
  expect(travelled(opening)).toBe(true);
  const leaving = await frames(page, list, () => trigger.click());
  expect(travelled(leaving)).toBe(true);
  expect(leaving.at(-1)?.visible).toBe(false);

  const about = page.locator('.mh-about');
  const wasOpen = await about.getAttribute('aria-expanded') === 'true';
  const toggled = await frames(page, '#home-introduction', () => about.click());
  const toggledBack = await frames(page, '#home-introduction', () => about.click());
  expect(travelled(wasOpen ? toggled : toggledBack)).toBe(true);
  expect(travelled(wasOpen ? toggledBack : toggled)).toBe(true);
});

test('exposed reasoning unfolds and folds on the menu clock', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page);
  const label = page.locator('.prose-reasoning .prose-label').first();
  await expect(label).toBeVisible();
  const first = await frames(page, '.prose-reasoning > div', () => label.click());
  const second = await frames(page, '.prose-reasoning > div', () => label.click());
  expect(travelled(first)).toBe(true);
  expect(travelled(second)).toBe(true);
  // One of the two was a close: the content stayed mounted while it faded, then left.
  const closed = [first, second].find(list => list.at(-1)?.present === false);
  expect(closed).toBeTruthy();
});

test('the command palette travels for a pointer open and close, never for the keyboard', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page);
  await page.mouse.click(720,450);
  await page.evaluate(() => window.dispatchEvent(new Event('drishya-navigate-workspace')));
  const palette = page.locator('dialog.workspace-navigation');
  await expect(palette).toBeVisible();
  await expect(palette).toHaveAttribute('data-surface-phase', /opening|open/);
  await page.getByRole('button',{name:'Close Navigate workspace'}).click();
  await expect(palette).toHaveAttribute('data-surface-phase','closing');
  await expect(palette).toHaveCount(0);
  await page.keyboard.press('Control+K');
  await expect(palette).toBeVisible();
  expect(await palette.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
});

test('hover link cards enter and leave on the shared menu clock', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page, linkRecording);
  const link = page.locator('.history a.md-url').first();
  await expect(link).toBeVisible();
  const entering = await frames(page, '[role=tooltip].link-card', () => link.hover(), 700);
  expect(travelled(entering)).toBe(true);
  const leaving = await frames(page, '[role=tooltip].link-card', () => page.mouse.move(2,400), 700);
  expect(travelled(leaving)).toBe(true);
  expect(leaving.at(-1)?.present).toBe(false);
});

test('the step note popover opens by pointer and folds on a press elsewhere', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await openRecording(page);
  const card = page.locator('article[data-op-id]').first();
  await card.hover();
  const info = card.locator('.op-info');
  await expect(info).toBeVisible();
  const opening = await frames(page, '.op-evidence:popover-open', () => info.click());
  expect(travelled(opening)).toBe(true);
  const closing = await frames(page, '.op-evidence', () => page.mouse.click(5,300));
  expect(closing.some(frame => frame.visible && frame.opacity !== null && frame.opacity < .98)).toBe(true);
});
