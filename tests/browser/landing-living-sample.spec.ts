import {test,expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {serveLanding} from '../../scripts/build-landing.ts';

let site: Awaited<ReturnType<typeof serveLanding>>;

test.beforeAll(async () => {
  const built = spawnSync(process.execPath, ['scripts/build-landing.ts'], {encoding: 'utf8'});
  if (built.status !== 0) throw new Error(built.stderr);
  site = await serveLanding();
});

test.afterAll(async () => {
  await site?.close();
});

test('both #session and #live-sample anchors reach the walkthrough', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(site.url + '/#session');
  await expect(page.locator('#session-title')).toBeVisible();

  await page.goto(site.url + '/#live-sample');
  await expect(page.locator('#session-title')).toBeVisible();
});

test('presents 4 selectors with exact step evidence and links', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(site.url + '/#session');

  const selectors = page.locator('[data-chapter-key]');
  await expect(selectors).toHaveCount(4);

  // 1. Read (step 4)
  await selectors.nth(0).click();
  await expect(page.locator('#chapter-counter')).toHaveText('1 of 4');
  await expect(page.locator('#full-replay')).toHaveAttribute('href', /\/demo\/\?demo&at=4/);
  await expect(page.locator('#chapter-material')).toContainText('src/checkout/guard.ts');

  // 2. Failure (step 24)
  await selectors.nth(1).click();
  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');
  await expect(page.locator('#full-replay')).toHaveAttribute('href', /\/demo\/\?demo&at=24/);
  await expect(page.locator('#chapter-material')).toContainText('5 passed · 1 failed');

  // 3. Edit (step 26)
  await selectors.nth(2).click();
  await expect(page.locator('#chapter-counter')).toHaveText('3 of 4');
  await expect(page.locator('#full-replay')).toHaveAttribute('href', /\/demo\/\?demo&at=26/);
  await expect(page.locator('#chapter-material')).toContainText('cart.total == null');

  // 4. Retest (step 28)
  await selectors.nth(3).click();
  await expect(page.locator('#chapter-counter')).toHaveText('4 of 4');
  await expect(page.locator('#full-replay')).toHaveAttribute('href', /\/demo\/\?demo&at=28/);
  await expect(page.locator('#chapter-material')).toContainText('6 passed · 0 failed');
});

test('scroll independence: normal document scroll past walkthrough does not change moment', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(site.url + '/?moment=failure#session');

  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');

  // Scroll past the walkthrough into workspace and local sections
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(100);
  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');

  // Scroll to footer
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');
});

test('play, pause, replay, repeat controls and visibility pausing', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto(site.url + '/#session');

  const playBtn = page.locator('#play-sample');
  const replayBtn = page.locator('#replay-sample');
  const repeatCheck = page.locator('#repeat-sample');

  await expect(playBtn).toHaveText(/Play sample/);
  await playBtn.click();
  await expect(playBtn).toHaveText(/Pause sample/);
  await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

  // Pause leaves selected chapter visible
  await playBtn.click();
  await expect(playBtn).toHaveText(/Play sample/);
  await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

  // Replay returns to chapter 1
  await page.locator('[data-chapter-key]').nth(2).click();
  await expect(page.locator('#chapter-counter')).toHaveText('3 of 4');
  await replayBtn.click();
  await expect(page.locator('#chapter-counter')).toHaveText('1 of 4');
  await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

  // Repeat toggle
  await expect(repeatCheck).not.toBeChecked();
  await repeatCheck.check();
  await expect(repeatCheck).toBeChecked();

  // Tab hidden pauses playback
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
});

test('metadata failure fallback with Retry button', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.route('**/chapters.json', route => route.abort());
  await page.goto(site.url + '/#session');

  const errorEl = page.locator('#sample-error');
  await expect(errorEl).toBeVisible();
  await expect(errorEl).toContainText('The interactive sample couldn’t load');

  const retryBtn = page.locator('#retry-sample');
  await expect(retryBtn).toBeVisible();

  // Unroute and retry
  await page.unroute('**/chapters.json');
  await retryBtn.click();
  await expect(errorEl).toBeHidden();
});

test('no JavaScript retains static readable walkthrough', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 600, height: 900}});
  const page = await context.newPage();
  await page.goto(site.url + '/#session');

  await expect(page.locator('#session-title')).toBeVisible();
  await expect(page.locator('#chapter-material')).toBeVisible();
  await expect(page.locator('#chapter-material')).toContainText('src/checkout/guard.ts');

  const staticDetails = page.locator('.static-walkthrough');
  await staticDetails.locator('summary').click();
  await expect(page.locator('#moment-retest')).toContainText('6 passed');
  await context.close();
});

for (const width of [600, 1024, 1440, 1920]) {
  test(`responsive walkthrough layout at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto(site.url + '/#session');

    await expect(page.locator('#session-title')).toBeVisible();
    await expect(page.locator('.chapter-selectors')).toBeVisible();
    await expect(page.locator('.stage')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('short viewport 1440x600 layout preserves normal flow', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 600});
  await page.goto(site.url + '/#session');

  await expect(page.locator('#session-title')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
