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
