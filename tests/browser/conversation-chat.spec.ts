import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-chat-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-27: the agent's prose fills the reading column; only the person's prompt sits on the right, in a capsule tinted from the palette.
const WORDS = 'The reader keeps the line short enough to follow while the block itself uses the whole reading column of the stage. ';
const NOTICE = '<task-notification>\n<task-id>bg42</task-id>\n<status>completed</status>\n<summary>Background command "Run tests" completed (exit code 0)</summary>\n</task-notification>';
test('prose uses the reading column and the prompt is a capsule on the right', async ({ page }) => {
  const session = 'chat', source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session };
  const user = (uuid: string, time: string, content: unknown) => ({ ...base, timestamp: time, type: 'user', uuid, message: { role: 'user', content } });
  const assistant = (uuid: string, time: string, text: string) => ({ ...base, timestamp: time, type: 'assistant', uuid, message: { id: `m-${uuid}`, role: 'assistant', content: [{ type: 'text', text }] } });
  const longPrompt = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of a long prompt that keeps going so that it needs the disclosure.`).join('\n');
  writeFileSync(source, [
    user('p1', '2026-11-08T00:00:00Z', 'Explain the layout'),
    assistant('a1', '2026-11-08T00:00:01Z', `${WORDS.repeat(8)}\n\n${WORDS.repeat(6)}\n\n| a | b |\n|---|---|\n| 1 | 2 |`),
    user('p2', '2026-11-08T00:00:02Z', longPrompt),
    assistant('a2', '2026-11-08T00:00:03Z', 'Done.'),
    user('n1', '2026-11-08T00:00:04Z', NOTICE),
    assistant('a3', '2026-11-08T00:00:05Z', 'The tests passed.'),
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;

  for (const width of [600, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    const turns = page.locator('.history .turn');
    await expect(turns).toHaveCount(3);
    const prose = page.locator('.history .prose').first();
    await prose.scrollIntoViewIfNeeded();

    // The prose block spans the reading column; paragraphs keep the UI-39 measure of 75ch in the body font.
    const geometry = await page.evaluate(() => {
      const box = (el: Element) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width }; };
      const proseEl = document.querySelector('.history .prose')!, p = proseEl.querySelector('p')!;
      const inner = document.querySelector('.history-inner')!;
      const cs = getComputedStyle(inner);
      const content = { left: inner.getBoundingClientRect().left + parseFloat(cs.paddingLeft), right: inner.getBoundingClientRect().right - parseFloat(cs.paddingRight) };
      // Measure the same type and inherited layout, including any browser font adjustments.
      const sample = p.cloneNode(false) as HTMLParagraphElement;
      sample.style.cssText = 'position:absolute;visibility:hidden;width:75ch;max-width:none';
      p.after(sample); const measure = sample.getBoundingClientRect().width; sample.remove();
      const marks = document.querySelector('.history-prompt-marks')?.getBoundingClientRect();
      return { prose: box(proseEl), p: box(p), content, measure, marksLeft: marks?.left ?? Infinity, doc: document.documentElement.scrollWidth };
    });
    expect(geometry.prose.width, `prose spans the column at ${width}`).toBeGreaterThan(geometry.content.right - geometry.content.left - 40 - (width <= 880 ? 26 : 0));
    expect(geometry.p.width).toBeLessThanOrEqual(geometry.measure + 1);
    expect(geometry.p.width).toBeGreaterThan(Math.min(geometry.measure, geometry.prose.width) * 0.8);
    expect(geometry.prose.right, 'prose clears the prompt rail').toBeLessThanOrEqual(geometry.marksLeft + 1);
    expect(geometry.doc).toBeLessThanOrEqual(width);

    // The person's prompt: right-aligned capsule from the palette accent; the label stays for assistive technology.
    const first = turns.nth(0);
    const capsule = first.locator('.turn-capsule');
    const cBox = (await capsule.boundingBox())!, tBox = (await first.boundingBox())!;
    expect(Math.abs(cBox.x + cBox.width - (tBox.x + tBox.width))).toBeLessThan(2);
    expect(cBox.width).toBeLessThan(tBox.width);
    await expect(capsule).toHaveCSS('border-top-left-radius', '20px');
    expect(await capsule.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await expect(first.locator('.turn-who')).toHaveText('You');
    expect(await first.locator('.turn-who').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);

    // A long prompt clamps inside the capsule (no fourth line leaking into its padding) and opens in place.
    // Turns are picked by content: the virtualized history mounts only those near the viewport, so an index is not a position in the session.
    const long = turns.filter({ hasText: 'Line 1 of a long prompt' });
    await long.scrollIntoViewIfNeeded();
    const text = long.locator('.turn-text');
    await expect(text).toHaveClass(/clamped/);
    expect(await text.evaluate((el) => el.clientHeight)).toBeLessThan(await text.evaluate((el) => el.scrollHeight));
    const more = long.getByRole('button', { name: /Show full prompt/ });
    await more.click();
    await expect(text).not.toHaveClass(/clamped/);
    await expect(long.getByRole('button', { name: 'Show less' })).toBeVisible();
    await long.getByRole('button', { name: 'Show less' }).click(); // the choice is remembered; leave it as found for the next width
    await expect(text).toHaveClass(/clamped/);

    // A notice written in the user role is not the person's: no capsule styling, on the agent's side.
    const notice = turns.filter({ has: page.locator('.turn-source') });
    await page.locator('.history').evaluate((el) => { el.scrollTop = el.scrollHeight; }); // prose is shown whole (SHIP-15), so the notice is far below
    await expect(notice).toBeVisible();
    await expect(notice.locator('.turn-who')).toContainText('Claude Code');
    expect(await notice.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const nBox = (await notice.locator('.turn-notice-main').boundingBox())!;
    expect(nBox.x).toBeLessThan(width / 2);
  }
});
