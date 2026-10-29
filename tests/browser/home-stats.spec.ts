import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { RecordingSummary } from '../../packages/contracts/src/index.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-home-stats-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});
async function home(page: Page, stats: RecordingSummary['stats'][]) {
  const now = new Date().toISOString();
  const recordings = stats.map((value, index) => ({ id: `r-${index}`, title: `Synthetic session ${index}`, harness: value?.source === 'codex-turns' ? 'codex' : 'claude-code',
    workspaceRoot: '/synthetic/repository', createdAt: now, updatedAt: now, lastSourceTime: now,
    observationCount: 20, live: false, pinned: false, ...(value ? { stats: value } : {}) }));
  await page.route('**/v1/recordings', route => route.fulfill({ json: { recordings } }));
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-session').first()).toBeVisible();
}

test('only present harness stats appear, with their reported provenance and no placeholders', async ({ page }) => {
  await home(page, [
    { source: 'claude-cost-state', durationMs: 65000, linesAdded: 1240, linesRemoved: 5 },
    { source: 'codex-turns', durationMs: 2000, lastOutcome: 'aborted' },
    { source: 'claude-cost-state', linesAdded: 0 }, undefined,
  ]);
  const rows = page.locator('.mh-session');
  await expect(rows.nth(0).locator('.mh-row-stats')).toHaveText('1 m 05 s+1.2K−5');
  await expect(rows.nth(0).locator('.mh-row-stats>span')).toHaveCount(3);
  for (const stat of await rows.nth(0).locator('.mh-row-stats>span').all()) await expect(stat).toHaveAttribute('title', /reported by Claude Code/);
  await expect(rows.nth(1).locator('.mh-row-stats')).toHaveText('2 saborted');
  for (const stat of await rows.nth(1).locator('.mh-row-stats>span').all()) await expect(stat).toHaveAttribute('title', /recorded by Codex/);
  await expect(rows.nth(2).locator('.mh-row-stats')).toHaveText('+0');
  await expect(rows.nth(2).locator('.mh-row-stats>span')).toHaveCount(1);
  await expect(rows.nth(3).locator('.mh-row-stats')).toHaveCount(0);
});

test('stats stay on one line inside the unchanged fixed row height at supported desktop widths', async ({ page }) => {
  await home(page, [
    { source: 'claude-cost-state', durationMs: 12345678, linesAdded: 123456789, linesRemoved: 9876543 },
    { source: 'codex-turns', durationMs: 12345678, lastOutcome: 'completed' }, undefined,
  ]);
  for (const width of [600, 620, 650, 651, 720, 900, 901, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.mh-session').evaluateAll(rows => rows.map(row => {
      const bounds = row.getBoundingClientRect(), stats = row.querySelector('.mh-row-stats');
      const parts = [...row.querySelectorAll('.mh-row-stats>span')].map(stat => stat.getBoundingClientRect());
      return { height: bounds.height, expected: Number.parseFloat(getComputedStyle(row).getPropertyValue('--mh-row-height')),
        fits: parts.every(p => p.x >= bounds.x && p.right <= bounds.right && p.y >= bounds.y && p.bottom <= bounds.bottom),
        oneLine: !stats || stats.getBoundingClientRect().height === 18,
        titleWidth: row.querySelector('.mh-session-open')!.getBoundingClientRect().width };
    }));
    for (const row of geometry) {
      expect(row.height, `row height at ${width}`).toBe(row.expected);
      expect(row.fits, `stats fit at ${width}`).toBe(true);
      expect(row.oneLine, `one stats line at ${width}`).toBe(true);
      expect(row.titleWidth, `title has room at ${width}`).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('300 sessions with stats retain bounded virtualization and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await home(page, Array.from({ length: 300 }, (_, n) => n % 2
    ? { source: 'codex-turns', durationMs: n * 1000, lastOutcome: 'completed' }
    : { source: 'claude-cost-state', durationMs: n * 1000, linesAdded: n, linesRemoved: n }));
  await page.locator('.mh-session-list').focus(); await page.keyboard.press('End');
  await expect(page.locator('[data-session-index="299"] .mh-session-open')).toBeFocused();
  expect(await page.locator('.mh-session').count()).toBeLessThan(50);
  await expect(page.locator('[data-session-index="299"] .mh-row-stats')).toContainText('completed');
});
