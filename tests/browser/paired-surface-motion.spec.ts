import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let directory: string, app: App, server: RunningServer, recording: string;
test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'drishya-paired-motion-'));
  app = new App(directory);
  recording = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  server = await startServer({app, port: 0, token: 'synthetic-paired-motion'});
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

async function openRecording(page: Page) {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/#/r/${recording}`);
  await expect(page.locator('.modern-session-header')).toBeVisible();
}

test('Changes returns to its true trigger and keeps the same reader if reopened during exit', async ({page}) => {
  await openRecording(page);
  const button = page.locator('[data-compare-open]');
  await button.click();
  const changes = page.locator('.compare-window');
  await expect(changes).toHaveAttribute('data-surface-phase', 'open');
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
