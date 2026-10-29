import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-hover-inside-'));
  // A session like the one that showed the fault: wide edits (long single lines) and a long command, one after another.
  const session = 'hover-inside', source = join(dir, session + '.jsonl'), base = { cwd: dir, sessionId: session };
  const long = (n: number) => `const value${n} = readFileSync(path, "utf8").replace(/needle/g, "replacement").split("\\n").map(line => line.trim()).filter(Boolean).join(",");`.repeat(3);
  const rows: object[] = [{ ...base, timestamp: '2026-10-29T00:00:00Z', type: 'user', uuid: 'p', message: { role: 'user', content: 'Rewrite the loader' } }];
  let n = 0;
  const call = (name: string, input: object, result: string) => {
    const tool = `t${n++}`;
    rows.push({ ...base, timestamp: '2026-10-29T00:00:01Z', type: 'assistant', uuid: `a-${tool}`, message: { id: `m-${tool}`, role: 'assistant', content: [{ type: 'tool_use', id: tool, name, input }] } });
    rows.push({ ...base, timestamp: '2026-10-29T00:00:02Z', type: 'user', uuid: `r-${tool}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool, content: result }] } });
  };
  for (let i = 0; i < 6; i++) call('Edit', { file_path: join(dir, `src/loader${i}.ts`), old_string: long(i), new_string: long(i + 100) + '\n' + long(i + 200) }, 'The file has been updated successfully.');
  call('Bash', { command: 'node scripts/run-all.mjs --flag-one --flag-two ' + 'x'.repeat(240) }, 'ok');
  call('Read', { file_path: join(dir, 'src/loader0.ts') }, Array.from({ length: 40 }, (_, i) => `${i + 1}\t${long(i)}`).join('\n'));
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', source)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-hover-inside' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-14: a card enlarged for reading stays inside the window and clear of the Toolbox, the prompt rail, the Files panel and the header.
// Hover reading is off at 820 px and below by design, so the supported widths here are the ones where it exists.
for (const width of [1024, 1440]) test(`hover-enlarged cards stay inside the window and clear of floating surfaces at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const cards = page.locator('.history article.op[data-op-id]');
  await expect(cards.first()).toBeVisible();
  const opIds = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-op-id')!));
  let focusedCount = 0;
  for (const opId of opIds) {
    const card = page.locator(`.history article.op[data-op-id="${opId}"]`);
    await card.scrollIntoViewIfNeeded();
    let focused = false;
    for (let attempt = 0; attempt < 2 && !focused; attempt++) {
      await page.mouse.move(5, 5);
      await card.locator('.op-head').first().hover();
      focused = await expect(card).toHaveAttribute('data-hover-reading', 'focused', { timeout: 2000 }).then(() => true, () => false);
    }
    if (!focused) continue;
    focusedCount++;
    const result = await card.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const surfaces = ['.modern-toolbox', '.complete-prompt-rail', '.folder-explorer', '.modern-session-header'].flatMap((selector) => [...document.querySelectorAll(selector)].map((el) => ({ selector, rect: el.getBoundingClientRect() })));
      const overlaps = surfaces.filter(({ rect }) => rect.width > 0 && rect.height > 0 && box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top).map(({ selector }) => selector);
      return { left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top), bottom: Math.round(box.bottom), overlaps, width: innerWidth, height: innerHeight };
    });
    expect(result.left, `${opId} left`).toBeGreaterThanOrEqual(0);
    expect(result.right, `${opId} right`).toBeLessThanOrEqual(result.width);
    expect(result.top, `${opId} top`).toBeGreaterThanOrEqual(0);
    expect(result.bottom, `${opId} bottom`).toBeLessThanOrEqual(result.height);
    expect(result.overlaps, `${opId} overlaps`).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('.op[data-hover-reading]')).toHaveCount(0);
  }
  expect(focusedCount).toBeGreaterThan(3);
});
