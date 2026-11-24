// Genuine local acceptance. Prints only recording prefixes, byte sizes and counts.
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';
import { storageUsage } from '../../apps/daemon/src/storage.ts';

export async function storageClearAcceptance() {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-storage-real-'));
  const app = new App(dir);
  const screenshotDir = resolve('.local/storage-real');
  mkdirSync(screenshotDir, { recursive: true });
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const imported: { id: string; harness: string; path: string; hash: string; count: number; bytes: number }[] = [];
    for (const harness of ['claude-code', 'codex']) {
      const sources = (await app.ingest.discover(harness)).filter(s => s.bytes > 30_000 && s.bytes < 2_000_000 && Date.parse(s.modifiedAt) < Date.now() - 3600_000).sort((a, b) => b.bytes - a.bytes);
      const source = sources[0];
      if (!source) throw new Error(`No stable genuine ${harness} session available`);
      const beforeHash = hash(source.path);
      const { recordingId: id } = await app.ingest.importSource(harness, source.path);
      await app.history.page(id, { count: 1 });
      imported.push({ id, harness, path: source.path, hash: beforeHash, count: app.store.countObservations(id), bytes: statSync(source.path).size });
    }
    server = await startServer({ app, port: 0, watchRoots: [] });
    browser = await chromium.launch({ channel: process.env.DRISHYA_BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage();
    // Keep discovery outside the screen: only the two deliberately imported sessions are shown.
    await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
    await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Storage', exact: true }).click();
    for (const selected of imported) for (const width of [600, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const panel = page.locator('.storage-settings');
      await panel.getByRole('button', { name: 'Refresh storage', exact: true }).click();
      await expect(panel.locator('.storage-session')).toHaveCount(2);
      const before = await storageUsage(dir);
      await page.screenshot({ path: join(screenshotDir, `${selected.harness}-${width}-before.png`) });
      await panel.locator('.storage-session').filter({ hasText: selected.id.slice(0, 12) }).getByRole('button').click();
      await page.getByRole('dialog', { name: 'Clear imported session?' }).getByRole('button', { name: 'Clear imported data', exact: true }).click();
      await expect(panel.locator('.storage-session')).toHaveCount(1);
      expect(app.store.countObservations(selected.id)).toBe(0);
      expect(Number(app.store.db.prepare('SELECT count(*) AS n FROM search WHERE recording_id=?').get(selected.id)!.n)).toBe(0);
      const other = imported.find(s => s.id !== selected.id)!;
      expect(app.store.countObservations(other.id)).toBe(other.count);
      expect((await app.history.page(other.id, { count: 1 })).projection.recordingId).toBe(other.id);
      const after = await storageUsage(dir);
      expect(hash(selected.path)).toBe(selected.hash);
      const again = await app.ingest.importSource(selected.harness, selected.path);
      expect(again.recordingId).toBe(selected.id);
      expect(app.store.countObservations(selected.id)).toBe(selected.count);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      console.log(JSON.stringify({ harness: selected.harness, prefix: selected.id.slice(0, 12), sourceBytes: selected.bytes, observations: selected.count, width, diskBefore: before.bytes, diskAfter: after.bytes, capturedBefore: before.categories.captured, capturedAfter: after.categories.captured, preservedObservations: other.count, reimported: true }));
    }
  } finally {
    await browser?.close(); await server?.close(); await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Scratch path escaped');
    rmSync(dir, { recursive: true, force: true });
  }
}
