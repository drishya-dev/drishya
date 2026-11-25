import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

// FEEDBACK-1: a plain link to GitHub's issue chooser, on Home and in Settings. Drishya sends nothing itself.
const CHOOSER = 'https://github.com/drishya-dev/drishya/issues/new/choose';
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-feedback-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); }
});

const home = async (page: Page) => { await page.goto(`${server.url}/?experience=modern#token=${server.token}`); };

for (const width of [600, 1440]) {
  test(`Home footer offers the feedback link at ${width} px without crowding or overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await home(page);
    const footer = page.locator('.mh-footer');
    const link = footer.getByRole('link', { name: /Feedback/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', CHOOSER);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(link).toBeInViewport();
    const [star, mine, note] = await Promise.all([footer.getByRole('link', { name: /Star on GitHub/ }).boundingBox(), link.boundingBox(), footer.locator('> span').first().boundingBox()]);
    // Same row, same order, no overlap: note · star · feedback.
    expect(note!.x + note!.width).toBeLessThanOrEqual(star!.x);
    expect(star!.x + star!.width).toBeLessThanOrEqual(mine!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Quiet: small muted text, not a button.
    expect(await link.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(12);
    expect(await link.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
  });

  test(`Settings carries the same link at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await home(page);
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
    await dialog.getByRole('tab', { name: 'Privacy', exact: true }).click();
    const link = dialog.getByRole('link', { name: /Send feedback/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', CHOOSER);
    await expect(link).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('the link opens GitHub in a new tab and Drishya itself requests nothing from another host', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', r => { if (new URL(r.url()).origin !== new URL(server.url).origin) external.push(r.url()); });
  // Never reach the real GitHub from a test: the click is allowed to open the tab, the request is answered by a stub.
  await context.route('https://github.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  await home(page);
  await expect(page.locator('.mh-footer').getByRole('link', { name: /Feedback/ })).toBeVisible();
  expect(external).toEqual([]);
  const popup = page.waitForEvent('popup');
  await page.locator('.mh-footer').getByRole('link', { name: /Feedback/ }).click();
  expect((await popup).url()).toBe(CHOOSER);
  // The opened page never sees this one, and this page is still ours.
  expect(await page.evaluate(() => location.origin)).toBe(new URL(server.url).origin);
  expect(external).toEqual([]);
});

test('keyboard focus shows a ring and Enter activates it', async ({ page, context }) => {
  await context.route('https://github.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  await home(page);
  const link = page.locator('.mh-footer').getByRole('link', { name: /Feedback/ });
  await link.focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  const popup = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  expect((await popup).url()).toBe(CHOOSER);
});
