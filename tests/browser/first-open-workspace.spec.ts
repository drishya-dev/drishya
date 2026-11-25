import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';

async function startSession(harness: 'claude-code' | 'codex') {
  const scratch = mkdtempSync(join(tmpdir(), 'drishya-first-open-'));
  const workspace = join(scratch, 'late repository');
  const journal = join(scratch, 'session.jsonl');
  const now = new Date().toISOString();
  const identity = '54200000-0000-4000-8000-000000000001';
  const append = (row: unknown) => appendFileSync(journal, JSON.stringify(row) + '\n');
  mkdirSync(workspace);
  writeFileSync(join(workspace, 'repository-file.ts'), 'export const fixture = true;\n');
  if (harness === 'codex') {
    append({ timestamp: now, type: 'session_meta', payload: { id: identity } });
    append({ timestamp: now, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Opening before workspace metadata' }] } });
  } else {
    append({ type: 'user', uuid: 'user-before-root', sessionId: identity, timestamp: now, message: { role: 'user', content: 'Opening before workspace metadata' } });
  }
  const app = new App(join(scratch, 'store'));
  const { recordingId } = await app.ingest.importSource(harness, journal);
  const server = await startServer({ app, port: 0, token: 'first-open-synthetic-test' });
  const publishWorkspace = () => {
    if (harness === 'codex') append({ timestamp: now, type: 'turn_context', payload: { cwd: workspace } });
    else append({ type: 'assistant', uuid: 'assistant-with-root', sessionId: identity, timestamp: now, cwd: workspace, message: { role: 'assistant', content: [{ type: 'text', text: 'Workspace metadata arrived' }] } });
  };
  return {
    app, server, scratch, recordingId, workspace, publishWorkspace, async close() {
      await server.close();
      await app.close();
      if (!resolve(scratch).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test cleanup');
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

async function openSession(page: Page, url: string, recordingId: string) {
  const target = new URL(url);
  target.searchParams.set('experience', 'modern');
  // Establish the local browser session first. Only the discovery list is isolated from this machine.
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(target.href);
  await expect(page.locator('.mh-session-open').filter({ hasText: 'Opening before workspace metadata' })).toBeVisible();
  await page.locator('.mh-session-open').filter({ hasText: 'Opening before workspace metadata' }).click();
  await page.waitForURL(url => url.hash === `#/r/${recordingId}`);
}

for (const { width, harness } of [{ width: 600, harness: 'claude-code' }, { width: 1440, harness: 'codex' }] as const) {
  test(`${harness} offers workspace and map setup when its recorded path arrives at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await startSession(harness);
    let finishController!: () => void;
    const pendingController = new Promise<void>(resolve => { finishController = resolve; });
    // Hold only CLI readiness. The real daemon reads the journal and serves workspace/graph data.
    await page.route(`**/v1/recordings/${fixture.recordingId}/controller`, async route => {
      await pendingController;
      await route.abort().catch(() => undefined);
    });
    try {
      await openSession(page, fixture.server.launchUrl, fixture.recordingId);
      const composer = page.getByRole('region', { name: 'Harness prompt' });
      await expect(composer).toContainText('no workspace path was recorded');
      await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
      const mapSetup = page.getByRole('button', { name: 'Map the whole repository', exact: true });
      await expect(page.locator('.map-legend')).toContainText('0 files');
      await expect(mapSetup).toHaveCount(0);
      fixture.publishWorkspace();
      await expect.poll(() => fixture.app.store.getRecording(fixture.recordingId)?.workspaceRoot).toBe(fixture.workspace);
      await expect(mapSetup).toBeVisible();
      await page.keyboard.press('Escape');
      const files = page.getByRole('complementary', { name: 'Repository files' });
      if (!await files.isVisible()) await page.getByRole('button', { name: 'Show files', exact: true }).click();
      const enable = files.getByRole('button', { name: 'Enable workspace reading' });
      await expect(enable).toBeEnabled();
      await expect(files.getByRole('treeitem', { name: 'repository-file.ts' })).toHaveCount(0);
      await enable.click();
      await expect(files.getByRole('treeitem', { name: 'repository-file.ts' })).toBeVisible();
      await expect(files).toHaveAttribute('data-reading-access', 'current');
      if (width === 600) await files.getByRole('button', { name: 'Minimize files', exact: true }).click();
      const expand = composer.getByRole('button', { name: 'Expand prompt', exact: true });
      if (await expand.count()) await expand.click();
      await expect(composer.locator('.modern-composer-location')).toHaveText('late repository');
      await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
      await expect(page.locator('.map-legend')).toContainText('1 file');
      await expect(mapSetup).toHaveCount(0);
      await page.waitForURL(url => url.hash === `#/r/${fixture.recordingId}`);
    } finally {
      finishController();
      await fixture.close();
    }
  });
}

test('a delayed workspace status stays with the session that requested it', async ({ page }) => {
  const fixture = await startSession('claude-code');
  const secondJournal = join(fixture.scratch, 'second-session.jsonl');
  writeFileSync(secondJournal, JSON.stringify({
    type: 'user', uuid: 'second-user', sessionId: '54200000-0000-4000-8000-000000000002', timestamp: new Date().toISOString(),
    message: { role: 'user', content: 'Second session without workspace metadata' },
  }) + '\n');
  const second = await fixture.app.ingest.importSource('claude-code', secondJournal);
  let releaseStatus!: () => void;
  const statusHeld = new Promise<void>(resolve => { releaseStatus = resolve; });
  let statusArrived!: () => void;
  const received = new Promise<void>(resolve => { statusArrived = resolve; });
  let statusDelivered!: () => void;
  const delivered = new Promise<void>(resolve => { statusDelivered = resolve; });
  try {
    await openSession(page, fixture.server.launchUrl, fixture.recordingId);
    const composer = page.getByRole('region', { name: 'Harness prompt' });
    await expect(composer).toContainText('no workspace path was recorded');
    await page.route(`**/v1/recordings/${fixture.recordingId}/workspace`, async route => {
      const response = await route.fetch();
      const lateStatus = (await response.json()).root === fixture.workspace;
      if (lateStatus) {
        statusArrived();
        await statusHeld;
      }
      await route.fulfill({ response }).catch(() => undefined);
      if (lateStatus) statusDelivered();
    });
    fixture.publishWorkspace();
    await received;
    await page.evaluate(id => { location.hash = `#/r/${id}`; }, second.recordingId);
    await expect(page.locator('.history')).toContainText('Second session without workspace metadata');
    await expect(composer).toContainText('no workspace path was recorded');
    releaseStatus();
    await delivered;
    await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
    await expect(page.locator('.map-legend')).toContainText('0 files');
    await expect(page.getByRole('button', { name: 'Map the whole repository', exact: true })).toHaveCount(0);
    await expect(composer).toContainText('no workspace path was recorded');
  } finally {
    releaseStatus();
    await fixture.close();
  }
});
