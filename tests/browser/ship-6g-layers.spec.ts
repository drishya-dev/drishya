import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer;
let emptyQueueId: string, activeQueueId: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-6g-layers-'));
  const root = join(dir, 'repo');
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  const sessionA = '77777777-7777-4777-8777-777777777701';
  const sessionB = '77777777-7777-4777-8777-777777777702';
  const line = (sid: string, n: number, type: string, extra: Record<string, unknown>) =>
    JSON.stringify({ type, uuid: `77777777-7777-4777-8777-${sid.slice(-4)}${String(n).padStart(8, '0')}`, sessionId: sid, cwd: root, timestamp: new Date(Date.UTC(2026, 10, 5, 10, 0, n)).toISOString(), ...extra });

  const linesA: string[] = [
    line(sessionA, 1, 'user', { message: { role: 'user', content: 'Review this synthetic repository cleanly.' } }),
    line(sessionA, 2, 'queue-operation', { operation: 'enqueue', content: 'Historical dequeued input' }),
    line(sessionA, 3, 'queue-operation', { operation: 'dequeue' }),
  ];
  for (let i = 0; i < 18; i++) {
    linesA.push(line(sessionA, 10 + i * 2, 'assistant', {
      message: {
        id: `msg-${i}`, role: 'assistant',
        content: [
          { type: 'text', text: `Synthetic paragraph ${i + 1}: checking history scrollback and fixed chrome layering with readable text.` },
          { type: 'tool_use', id: `call-${i}`, name: 'Read', input: { file_path: join(root, 'src', 'index.ts') } },
        ],
      },
    }));
    linesA.push(line(sessionA, 11 + i * 2, 'user', {
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `call-${i}`, content: 'export const value = 1;\n' }] },
    }));
  }
  linesA.push(line(sessionA, 90, 'assistant', {
    message: {
      id: 'msg-end', role: 'assistant',
      content: [{ type: 'text', text: 'Synthetic summary complete.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 400 },
    },
  }));
  const journalA = join(dir, 'empty-queue.jsonl');
  writeFileSync(journalA, linesA.join('\n') + '\n');

  const linesB = [
    line(sessionB, 1, 'user', { message: { role: 'user', content: 'Review this synthetic repository cleanly.' } }),
    line(sessionB, 2, 'queue-operation', { operation: 'enqueue', content: 'Waiting synthetic queued prompt' }),
    ...linesA.slice(3, -1),
  ].map(raw => raw.replaceAll(sessionA, sessionB));
  const journalB = join(dir, 'active-queue.jsonl');
  writeFileSync(journalB, linesB.join('\n') + '\n');

  app = new App(join(dir, 'data'));
  emptyQueueId = (await app.ingest.importSource('claude-code', journalA)).recordingId;
  activeQueueId = (await app.ingest.importSource('claude-code', journalB)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-ship-6g' });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

async function revealFollowPill(page: Page) {
  const historyBox = (await page.locator('.history').boundingBox())!;
  await page.mouse.move(historyBox.x + historyBox.width / 2, historyBox.y + historyBox.height / 2);
  await page.mouse.wheel(0, -1200);
  const pill = page.locator('.follow-pill');
  if (!(await pill.isVisible())) {
    const toggle = page.getByRole('switch', { name: 'Automatically follow new work', exact: true });
    if (await toggle.count() && await toggle.getAttribute('aria-checked') === 'true') await toggle.click();
  }
  await expect(pill).toBeVisible();
}

async function assertMenuCornersClear(page: Page) {
  const menuPanel = page.locator('.workspace-menu[open] > .workspace-utilities');
  await expect(menuPanel).toBeVisible();
  const result = await menuPanel.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const inset = 6;
    const points: Array<[string, number, number]> = [
      ['top-left', rect.left + inset, rect.top + inset],
      ['top-right', rect.right - inset, rect.top + inset],
      ['bottom-left', rect.left + inset, rect.bottom - inset],
      ['bottom-right', rect.right - inset, rect.bottom - inset],
    ];
    for (const selector of ['.follow-pill', '.catalog-toggle', '.modern-replay-transport', '.queued-input-receipts', '.folder-explorer']) {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) continue;
      const r = target.getBoundingClientRect();
      const ix = Math.max(rect.left, r.left), rx = Math.min(rect.right, r.right);
      const iy = Math.max(rect.top, r.top), ry = Math.min(rect.bottom, r.bottom);
      if (ix + 2 < rx && iy + 2 < ry) points.push([`overlap(${selector})`, (ix + rx) / 2, (iy + ry) / 2]);
    }
    const failures: string[] = [];
    for (const [label, x, y] of points) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !el.contains(hit)) {
        failures.push(`${label}@(${Math.round(x)},${Math.round(y)}) hit ${hit?.tagName}.${hit?.className}`);
      }
    }
    return { width: rect.width, height: rect.height, failures };
  });
  expect(result.width).toBeGreaterThan(100);
  expect(result.height).toBeGreaterThan(100);
  expect(result.failures).toEqual([]);
}

for (const width of [600, 1440]) {
  test(`open session menu, Usage and Session details sit above Follow latest, Tools and Replay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?devtools=1&motion=0#/r/${emptyQueueId}`);
    await expect(page.locator('.history')).toBeVisible();

    // Empty queue (even with historical dequeued items): zero "Queued inputs" text anywhere.
    await expect(page.getByText('Queued inputs')).toHaveCount(0);

    // Scroll back so Follow latest appears (and Tools is visible at 600).
    await revealFollowPill(page);
    if (width === 600) await expect(page.locator('.catalog-toggle')).toBeVisible();

    // Open Session menu, expand Usage and Session details into the lower band.
    await page.getByLabel('More workspace options', { exact: true }).click();
    const menu = page.locator('.workspace-menu[open]');
    await menu.locator('.usage-peek > summary').click();
    await expect(menu.locator('.usage-peek')).toHaveAttribute('open', '');
    await assertMenuCornersClear(page);

    await menu.locator('.session-identity > summary').click();
    await expect(menu.locator('.session-identity')).toHaveAttribute('open', '');
    await assertMenuCornersClear(page);

    // Enter Replay mode: still zero "Queued inputs" text when empty, and menu stacks above replay + follow + tools.
    await menu.getByRole('button', { name: 'Replay this session', exact: true }).click();
    await expect(page.locator('.modern-replay-transport')).toBeVisible();
    await expect(page.getByText('Queued inputs')).toHaveCount(0);
    await revealFollowPill(page);
    await page.getByLabel('More workspace options', { exact: true }).click();
    await assertMenuCornersClear(page);
  });
}

for (const width of [600, 1440]) {
  test(`waiting Queued inputs renders as a clean control clear of Replay and Follow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?devtools=1&motion=0#/r/${activeQueueId}`);
    await expect(page.locator('.history')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Read queued inputs', exact: true });
    await expect(trigger).toHaveText('Queued inputs · 1');

    // Enter Replay mode and seek past step 1 so both the pending receipt and scrolled-back Follow appear over Replay.
    await page.getByLabel('More workspace options', { exact: true }).click();
    await page.getByRole('button', { name: 'Replay this session', exact: true }).click();
    await expect(page.locator('.modern-replay-transport')).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('slider', { name: 'Timeline', exact: true }).fill('8');
    await revealFollowPill(page);
    await expect(trigger).toBeVisible();

    const geometry = await trigger.evaluate(btn => {
      const style = getComputedStyle(btn);
      const t = btn.getBoundingClientRect();
      const replay = document.querySelector('.modern-replay-transport')!.getBoundingClientRect();
      const follow = document.querySelector('.follow-pill')!.getBoundingClientRect();
      return {
        bg: style.backgroundColor,
        borderTopWidth: parseFloat(style.borderTopWidth),
        radius: parseFloat(style.borderTopLeftRadius),
        triggerBottom: t.bottom,
        triggerRight: t.right,
        replayTop: replay.top,
        followTop: follow.top,
        followLeft: follow.left,
      };
    });
    expect(geometry.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(geometry.borderTopWidth).toBeGreaterThan(0);
    expect(geometry.radius).toBeGreaterThan(0);
    expect(geometry.triggerBottom).toBeLessThanOrEqual(geometry.replayTop + 1);
    // Clear of Follow latest vertically (stacked above it) or horizontally.
    const verticallyClearOfFollow = geometry.triggerBottom <= geometry.followTop + 1;
    const horizontallyClearOfFollow = geometry.triggerRight <= geometry.followLeft + 1;
    expect(verticallyClearOfFollow || horizontallyClearOfFollow).toBe(true);
  });
}

test('Files overlay at 600px shows a scrim over History, closes when scrim is clicked, and yields to open menus', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  await page.goto(`${server.url}/?motion=0#/r/${emptyQueueId}`);
  await expect(page.locator('.history')).toBeVisible();

  await page.locator('[data-workspace-files-trigger]').click();
  const explorer = page.locator('.folder-explorer');
  const scrim = page.locator('.files-scrim');
  await expect(explorer).toBeVisible();
  await expect(scrim).toBeVisible();

  const scrimHit = await page.evaluate(() => {
    const box = document.querySelector('.folder-explorer')!.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 20, box.right + 40);
    const y = Math.min(window.innerHeight - 160, box.top + 80);
    const hit = document.elementFromPoint(x, y);
    return hit?.className ?? null;
  });
  expect(scrimHit).toBe('files-scrim');

  // Open menu still renders above both the Files overlay and its scrim.
  await page.getByLabel('More workspace options', { exact: true }).click();
  await assertMenuCornersClear(page);
  await page.getByLabel('More workspace options', { exact: true }).click();

  // Clicking the scrim closes the Files overlay.
  await page.mouse.click(560, 300);
  await expect(explorer).toHaveCount(0);
  await expect(scrim).toHaveCount(0);
});
