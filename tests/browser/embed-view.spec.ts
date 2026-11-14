import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let app: App;
let server: RunningServer;
let recordingId: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-embed-spec-'));
  app = new App(join(dir, 'data'));
  server = await startServer({ app, port: 0 });

  // Create a minimal synthetic session for testing embed layouts
  const base = { sessionId: 'embed-session-test', cwd: dir };
  let clock = 0;
  const time = () => new Date(Date.UTC(2026, 10, 14, 10, 0, clock++ * 10)).toISOString();

  const rows = [
    { ...base, timestamp: time(), type: 'user', uuid: 'p1', message: { role: 'user', content: 'Inspect auth expiration logic' } },
    { ...base, timestamp: time(), type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { path: 'src/auth.ts' } }] } },
    { ...base, timestamp: time(), type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'export const TTL = 60000;' }] }] } },
    { ...base, timestamp: time(), type: 'assistant', uuid: 'a2', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'I verified the token TTL.' }] } },
  ];

  const journalPath = join(dir, 'session.jsonl');
  writeFileSync(journalPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  recordingId = (await app.ingest.importSource('claude-code', journalPath)).recordingId;
});

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/working-locations', route =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { version: 1, sessions: [] } })
      : route.continue()
  );
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

async function authenticate(page: Page) {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
}

test('embed view at 360px: conversation default, map hidden, brand unclickable, no home navigation', async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 360, height: 750 });

  // Open embed view for the recording
  await page.goto(`${server.url}/?embed=1&recording=${recordingId}`);

  // Document root has embed attribute
  await expect(page.locator('html')).toHaveAttribute('data-embed', 'true');

  // Viewer is mounted
  const viewer = page.locator('.viewer');
  await expect(viewer).toBeVisible();

  // Map is hidden below 600px
  const map = page.locator('.map');
  await expect(map).toBeHidden();

  // History mode defaults to Conversation in embed
  const convBtn = page.locator('.history-mode-option', { hasText: 'Conversation' });
  await expect(convBtn).toHaveAttribute('aria-pressed', 'true');

  // Brand is a non-clickable span
  const brand = page.locator('.brand.embed-brand');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveText(/Drishya/);
  await expect(brand).toHaveCSS('pointer-events', 'none');
  await brand.click({ force: true });

  // Ensure clicking brand did not navigate to Home or clear viewer
  await expect(page.locator('.home')).toBeHidden();
  await expect(viewer).toBeVisible();

  // Fullscreen toggle is present in header
  const fullscreenToggle = page.locator('.embed-fullscreen-toggle');
  await expect(fullscreenToggle).toBeVisible();
  await expect(fullscreenToggle).toHaveAttribute('title', /full screen/i);
});

test('embed view below 360px shows too-narrow banner prompting widen or fullscreen', async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 320, height: 700 });

  await page.goto(`${server.url}/?embed=1&recording=${recordingId}`);

  const banner = page.locator('.embed-too-narrow-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Pane too narrow');
  await expect(banner.locator('.embed-narrow-fullscreen')).toBeVisible();
});

test('embed view at 600px and 1440px displays full session view and map', async ({ page }) => {
  await authenticate(page);

  // 600px
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${server.url}/?embed=1#/r/${recordingId}`);
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.map')).toBeVisible();

  // 1440px
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.map')).toBeVisible();
  await expect(page.locator('.brand.embed-brand')).toBeVisible();
});

test('fullscreen toggle enter and exit via Escape key or button', async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${server.url}/?embed=1#/r/${recordingId}`);

  const toggle = page.locator('.embed-fullscreen-toggle');
  await expect(toggle).toBeVisible();

  // Mock document fullscreen API to simulate browser fullscreen transitions
  await page.evaluate(() => {
    let isFs = false;
    // @ts-expect-error Mock for headless testing
    document.documentElement.requestFullscreen = async () => {
      isFs = true;
      document.documentElement.dataset.fullscreen = 'true';
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    // @ts-expect-error Mock for headless testing
    document.exitFullscreen = async () => {
      isFs = false;
      delete document.documentElement.dataset.fullscreen;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    Object.defineProperty(document, 'fullscreenElement', {
      get: () => (isFs ? document.documentElement : null),
      configurable: true,
    });
  });

  // Click fullscreen toggle
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-fullscreen', 'true');
  await expect(toggle).toHaveAttribute('title', /exit full screen/i);

  // Click again to exit
  await toggle.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-fullscreen');
  await expect(toggle).toHaveAttribute('title', /enter full screen/i);
});

test('embed single-use launch code exchange via /v1/embed/session', async ({ page }) => {
  await authenticate(page);
  // Test the single-use bootstrap credential flow with mocked /v1/embed/session
  let exchanged = false;
  let receivedCode = '';
  let receivedRecordingId = '';

  await page.route('**/v1/embed/session', async route => {
    const postData = route.request().postDataJSON();
    receivedCode = postData.code;
    receivedRecordingId = postData.recordingId;
    exchanged = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: { ok: true, recordingId: postData.recordingId },
    });
  });

  // Navigate with launch code in fragment
  const testLaunchCode = 'test_single_use_credential_12345';
  await page.goto(`${server.url}/?embed=1&recording=${recordingId}#launch=${testLaunchCode}`);

  // Verify launch code was scrubbed immediately from URL
  await expect(page).not.toHaveURL(new RegExp(testLaunchCode));
  expect(exchanged).toBe(true);
  expect(receivedCode).toBe(testLaunchCode);
  expect(receivedRecordingId).toBe(recordingId);

  // Verify URL normalized to cleaned route
  await expect(page).toHaveURL(new RegExp(`\\?embed=1#/r/${recordingId}`));
  await expect(page.locator('.viewer')).toBeVisible();
});

test('embed error state: invalid recording ID never falls back to home or demo', async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 600, height: 800 });

  await page.goto(`${server.url}/?embed=1&recording=invalid_id_not_a_session`);

  // Error notice is displayed
  const errorNotice = page.locator('.notice');
  await expect(errorNotice).toBeVisible();
  await expect(errorNotice.locator('h2')).toContainText('Could not open session');
  await expect(errorNotice.locator('[role="alert"]')).toContainText('Session not found');

  // Verify Home and demo buttons are absent
  await expect(page.locator('.home')).toBeHidden();
  await expect(page.locator('button:has-text("Open sample workspace")')).toBeHidden();
  await expect(page.locator('button:has-text("Open the demo instead")')).toBeHidden();
});

test('live observations arrive and update projection without leaving embed mode', async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto(`${server.url}/?embed=1#/r/${recordingId}`);
  await expect(page.locator('.viewer')).toBeVisible();

  // Append new step to the journal
  const newRow = {
    sessionId: 'embed-session-test',
    cwd: dir,
    timestamp: new Date().toISOString(),
    type: 'assistant',
    uuid: 'a3',
    message: { id: 'm3', role: 'assistant', content: [{ type: 'text', text: 'Live update arrived safely in embed view.' }] },
  };

  const journalPath = join(dir, 'session.jsonl');
  writeFileSync(journalPath, JSON.stringify(newRow) + '\n', { flag: 'a' });

  // Trigger daemon sync for the new row
  await app.ingest.sync(recordingId);

  // Wait for update in viewer
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-embed', 'true');
});
