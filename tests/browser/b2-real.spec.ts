// B2 acceptance on real, opted-in local sessions. Skipped unless DRISHYA_REAL_SESSIONS names a JSON
// file of { adapterId: journalPath }. The same reader journey as b2-live.spec.ts, on real work:
//
// - Each journal is COPIED to a temp folder; the harness's own file is only read, never written.
// - The copy starts with the first half of the journal; the rest arrives in live bursts.
// - Assertions are on counts, ids and states only, so a failure cannot print captured content.
//   Run with screenshots/traces off (the default config) and report only the REPORT lines.
// - Everything temporary, including the store, is deleted afterwards. Nothing is committed.

import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';

const listFile = process.env.DRISHYA_REAL_SESSIONS;
const sessions: [string, string][] = listFile && existsSync(listFile) ? Object.entries(JSON.parse(readFileSync(listFile, 'utf8')) as Record<string, string>) : [];

if (sessions.length === 0) {
  test('real-session acceptance (opt-in)', () => {
    test.skip(true, 'set DRISHYA_REAL_SESSIONS to a JSON file of { adapterId: journalPath } to run it');
  });
}

for (const [adapterId, original] of sessions) {
  test(`real ${adapterId} session keeps the reader anchored through live bursts, map-off and reconnect`, async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), 'drishya-b2-real-'));
    const journal = join(dir, 'session.jsonl');
    const app = new App(join(dir, 'data'));
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      // Split at line boundaries: the first half is "what was there", the rest arrives live.
      copyFileSync(original, join(dir, 'whole.jsonl'));
      const lines = readFileSync(join(dir, 'whole.jsonl'), 'utf8').split('\n').filter((l) => l.length > 0);
      rmSync(join(dir, 'whole.jsonl'));
      const half = Math.floor(lines.length / 2);
      const rest = lines.slice(half);
      const bursts = [rest.slice(0, Math.ceil(rest.length / 2)), rest.slice(Math.ceil(rest.length / 2))];
      writeFileSync(journal, lines.slice(0, half).join('\n') + '\n');

      const recordingId = (await app.ingest.importSource(adapterId, journal)).recordingId;
      server = await startServer({ app, port: 0, token: 'real-session-acceptance' });
      app.ingest.startLive(recordingId);
      const stepsNow = () => app.projection(recordingId).timeline.length;

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(server.launchUrl);
      await page.locator('.row-main.link').first().click();
      const history = page.locator('.history');
      const latest = page.getByRole('button', { name: /Back to latest/ });
      const steps = page.locator('.reading-status');
      await expect(steps).toContainText(`${stepsNow()} recorded steps`);

      await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('checkbox', { name: /^Repository map/ }).uncheck();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
      await expect(page.locator('.map')).toHaveCount(0);

      const anchorOf = () =>
        history.evaluate((el) => {
          const viewport = el.getBoundingClientRect();
          const node = [...el.querySelectorAll<HTMLElement>('[data-passage-id]')].find((item) => item.getBoundingClientRect().bottom > viewport.top + 1);
          return { id: node?.dataset.passageId, offset: node ? Math.round(node.getBoundingClientRect().top - viewport.top) : undefined };
        });

      const widths = [1440, 390];
      let delta = 0;
      for (let b = 0; b < bursts.length; b++) {
        await page.setViewportSize({ width: widths[b]!, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await history.hover();
        await page.mouse.wheel(0, -900);
        await expect(latest).toBeVisible();
        const anchor = await anchorOf();
        expect(anchor.id).toBeTruthy();

        const before = stepsNow();
        appendFileSync(journal, bursts[b]!.join('\n') + '\n');
        await app.ingest.sync(recordingId);
        const after = stepsNow();
        delta = after - before;
        await expect(steps).toContainText(`${after} recorded steps`);
        if (delta > 0) await expect(latest).toContainText(`${delta} new step`);

        const moved = await anchorOf();
        expect(moved.id).toBe(anchor.id);
        expect(Math.abs((moved.offset ?? Infinity) - (anchor.offset ?? 0))).toBeLessThanOrEqual(1);

        await history.hover();
        await page.mouse.wheel(0, 100_000);
        await expect(latest).toBeVisible(); // reaching the bottom is not consent to follow again
        await latest.click();
        await expect(latest).toHaveCount(0);
      }

      // A captured operation opens in the detail panel (content or an explicit unavailable state).
      await page.setViewportSize({ width: 1440, height: 900 });
      const op = history.locator('article[data-op-id]').first();
      const opened = (await op.count()) > 0;
      if (opened) {
        await op.click();
        await expect(page.getByRole('region', { name: 'Operation detail' })).toBeVisible();
      }

      // A new browser connection reloads the same committed history; a resync adds nothing.
      const final = stepsNow();
      await page.reload();
      await expect(steps).toContainText(`${final} recorded steps`);
      await expect(page.locator('.map')).toHaveCount(0);
      expect((await app.ingest.sync(recordingId)).added).toBe(0);

      const rec = app.store.getRecording(recordingId)!;
      const p = app.projection(recordingId);
      console.log(
        `REPORT ${adapterId}: ${lines.length} journal lines (${half} initial, bursts ${bursts.map((x) => x.length).join('+')}), ` +
          `${rec.observationCount} observations, ${final} steps, ${p.operations.length} operations, ${p.gaps.length} visible gaps, ` +
          `health ${app.ingest.health(recordingId).state}, detail panel ${opened ? 'opened' : 'no operation to open'}, anchor held at ${widths.join(' and ')} px`,
      );
    } finally {
      if (server) await server.close();
      await app.close();
      const target = resolve(dir);
      if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside the temp root');
      rmSync(target, { recursive: true, force: true });
    }
  });
}
