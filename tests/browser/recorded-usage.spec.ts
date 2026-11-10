import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
const ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-usage-browser-'));
  app = new App(join(dir, 'store'));
  for (const [name, adapter, path] of [
    ['codex', 'codex', 'usage/codex-rollout-usage.jsonl'],
    ['claude', 'claude-code', 'usage/claude-usage.jsonl'],
    ['missing', 'codex', 'codex/rollout-checkout-review.jsonl'],
  ]) ids[name!] = (await app.ingest.importSource(adapter!, resolve('fixtures/synthetic', path!))).recordingId;
  const unknown = join(dir, 'unknown-cost.jsonl');
  writeFileSync(unknown, readFileSync(resolve('fixtures/synthetic/usage/claude-usage.jsonl'), 'utf8').replaceAll('"hasUnknownModelCost":false', '"hasUnknownModelCost":true'));
  ids.unknown = (await app.ingest.importSource('claude-code', unknown)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-usage-browser' });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

test('recorded usage stays sourced and hides absent values', async ({ page }) => {
  await page.route(/\/v1\/.*controller/, route => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  for (const name of ['codex', 'claude', 'missing', 'unknown']) {
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[name]}`);
    await page.getByLabel('More workspace options', { exact: true }).click();
    if (!await page.locator('.usage-peek').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.usage-peek>summary').click();
    const usage = page.locator('.usage-peek');
    const tokenDetails=usage.locator('details').filter({has:page.locator('summary',{hasText:'Token details'})});
    if(!await tokenDetails.evaluate(el=>(el as HTMLDetailsElement).open))await tokenDetails.locator('summary').click();
    await expect(usage.getByText('Not reported', { exact: true })).toHaveCount(0);
    if (name === 'codex') {
      await expect(usage).toContainText('Recorded · Codex token_count');
      await expect(usage).toContainText('29,250');
      await expect(usage.getByText('Cost · harness estimate')).toHaveCount(0);
    } else if (name === 'missing') {
      await expect(usage).toContainText('No usage values recorded');
      await expect(usage.locator('dt')).toHaveCount(0);
    } else {
      await expect(usage).toContainText('Recorded · Claude cost-state');
      await expect(usage.getByText('Cost · harness estimate')).toHaveCount(name === 'unknown' ? 0 : 1);
      if (name === 'claude') await expect(usage).toContainText('$0.0871');
    }
    // The rescan is about the journal: it lives inside Session details, never Usage (UI-29).
    const menu = page.locator('.workspace-menu');
    await expect(usage.getByRole('button', { name: 'Rescan original journal' })).toHaveCount(0);
    await menu.locator('.session-identity > summary').click();
    await expect(menu.getByRole('button', { name: 'Rescan original journal' })).toBeVisible();
    await menu.getByRole('button', { name: 'Rescan original journal' }).click();
    await expect(menu.getByRole('status').filter({hasText:'0 new observations'})).toHaveCount(1);
    await page.screenshot({ path: resolve(`.local/usage-${name}.png`) });
  }
});

// Harsh's review of USAGE-1: Codex parses its two rate-limit windows independently, so Limits shows whichever is valid.
for (const width of [600, 1440]) test(`Limits keeps independently valid windows at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/\/v1\/.*controller/, route => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
  const lines = readFileSync(resolve('fixtures/synthetic/usage/codex-rollout-usage.jsonl'), 'utf8').trim().split('\n');
  const primary = { used_percent: 4, window_minutes: 300, resets_at: 1792486800 }, secondary = { used_percent: 12.5, window_minutes: 10080, resets_at: 1792900000 };
  const cases: [string, Record<string, unknown>, RegExp, RegExp][] = [
    ['primary-only', { plan_type: 'plus', primary }, /5-hour window/, /7-day window|rate_limits\.secondary/],
    ['secondary-only', { primary: null, secondary }, /7-day window/, /5-hour window|rate_limits\.primary/],
    ['missing-primary', { secondary }, /7-day window/, /5-hour window|rate_limits\.primary/],
    ['invalid-primary', { primary: { used_percent: 'invalid' }, secondary }, /7-day window/, /5-hour window|rate_limits\.primary/],
    ['both', { plan_type: 'plus', primary, secondary }, /5-hour window[\s\S]*7-day window/, /No plan limit recorded/],
  ];
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  for (const [index, [name, limits, present, absent]] of cases.entries()) {
    const id = `0199c0de-0000-7000-8000-0000000001${index}0`;
    const token = JSON.stringify({ timestamp: '2026-10-20T09:00:02.000Z', type: 'event_msg', payload: { type: 'token_count', info: null, rate_limits: limits } });
    const journal = join(dir, `${name}.jsonl`);
    writeFileSync(journal, [...lines.slice(0, 4), token].join('\n').replaceAll('0199c0de-0000-7000-8000-0000000000aa', id) + '\n');
    const recordingId = (await app.ingest.importSource('codex', journal)).recordingId;
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
    await page.getByLabel('More workspace options', { exact: true }).click();
    if (!await page.locator('.usage-peek').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.usage-peek>summary').click();
    const section = page.locator('.usage-peek section[aria-label="Limits"]');
    await expect(section, name).toContainText(present);
    await expect(section, name).not.toContainText(absent);
    await expect(section.locator('.usage-share'), name).toHaveCount(name === 'both' ? 2 : 1);
    await expect(section.locator('[title*="rate_limits.secondary"]'), name).toHaveCount(name === 'primary-only' ? 0 : 1);
    expect(await page.locator('.usage-peek').evaluate(el => el.scrollWidth - el.clientWidth), name).toBeLessThanOrEqual(1);
  }
});

// USAGE-1 (Yash, 8 Nov): a Claude Code session with a /context report shows its categories as one segmented bar and the window the
// report printed, and never "window not recorded"; without a report it says plainly that none is recorded. The session line keeps a ring.
for (const width of [600, 1440]) test('Context shows the /context report as one segmented bar at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/\/v1\/.*controller/, route => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
  const grid = '⛁ ⛁ ⛶ ⛶';
  const report = [' Context Usage', grid + '   claude-opus-5-5', grid + '   293k/1M tokens (29%)', grid + '   Estimated usage by category',
    grid + '   ⛁ System prompt: 2.3k tokens (0.2%)', grid + '   ⛁ Messages: 266.9k tokens (26.7%)', grid + '   ⛶ Free space: 672.5k (67.3%)', grid + '   ⛝ Autocompact buffer: 33k tokens (3.3%)'].join('\n');
  const source = readFileSync(resolve('fixtures/synthetic/usage/claude-usage.jsonl'), 'utf8').trim();
  const withReport = join(dir, 'with-report.jsonl');
  writeFileSync(withReport, source + '\n' + JSON.stringify({ cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-0000000000bb', version: '2.1.0', type: 'user', isSidechain: false, parentUuid: null,
    message: { role: 'user', content: '<local-command-stdout>' + report + '</local-command-stdout>' }, uuid: '00000000-0000-4000-9000-0000000000ff', timestamp: '2026-10-20T09:30:00.000Z' }) + '\n');
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  const reportId = (await app.ingest.importSource('claude-code', withReport)).recordingId;
  for (const [name, id] of [['with', reportId], ['without', ids.claude!]] as const) {
    await page.goto(server.url + '/?experience=modern&motion=0#/r/' + id);
    await expect(page.locator('.session-line')).toBeVisible();
    await page.getByLabel('More workspace options', { exact: true }).click();
    if (!await page.locator('.usage-peek').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.usage-peek>summary').click();
    const context = page.locator('.usage-peek section[aria-label="Context"]');
    await expect(context.getByText('window not recorded')).toHaveCount(0);
    await expect(page.locator('.usage-peek section[aria-label="Limits"]')).toContainText('Claude Code does not record plan limits in its journal.');
    if (name === 'with') {
      await expect(context.locator('.usage-stack')).toHaveCount(1);
      await expect(context.locator('.usage-stack > span')).toHaveCount(4);
      await expect(context).toContainText('293k of 1M tokens');
      await expect(context.locator('.usage-legend li')).toHaveCount(4);
      await expect(context.getByText(/From \/context · read/)).toBeVisible();
      await expect(page.locator('.session-line .context-ring')).toHaveCount(1);
      await expect(page.locator('.session-line .context-ring')).toHaveAttribute('aria-label', /1,000,000 token window as printed by your latest \/context report/);
      const widths = await context.locator('.usage-stack > span').evaluateAll(spans => spans.map(span => span.getBoundingClientRect().width));
      expect(widths[2]!).toBeGreaterThan(widths[1]! * 2); // Free space is the long segment; Messages longer than System prompt
      expect(widths[1]!).toBeGreaterThan(widths[0]!);
    } else {
      await expect(context.locator('.usage-stack')).toHaveCount(0);
      await expect(context).toContainText('No context report is recorded');
      await expect(page.locator('.session-line .context-ring')).toHaveCount(0);
    }
    expect(await page.locator('.usage-peek').evaluate(el => el.scrollWidth - el.clientWidth), name).toBeLessThanOrEqual(1);
    await page.screenshot({ path: resolve('.local/usage-context-' + name + '-' + width + '.png') });
  }
});

test('existing local recorded usage reads through an isolated copy without native or live routes', async ({ page }) => {
  test.skip(!process.env.DRISHYA_USAGE_REAL_CONFIG, 'Opt-in existing redacted store copy only');
  const config = JSON.parse(readFileSync(process.env.DRISHYA_USAGE_REAL_CONFIG!, 'utf8')) as { dir: string; selected: { id: string; harness: string }[] };
  if (!resolve(config.dir).startsWith(resolve('.local/data-2-real-'))) throw new Error('Require the dedicated isolated usage store');
  const isolated = new App(config.dir), local = await startServer({ app: isolated, port: 0 });
  try {
    await page.route(/\/v1\/.*(?:controller|native)/, route => route.fulfill({ status: 404, body: '{}' }));
    await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
    await page.route('**/refresh', route => route.fulfill({ contentType: 'application/json', body: '{"added":0,"more":false}' }));
    await page.goto(local.launchUrl); await expect(page.locator('.home')).toBeVisible();
    for (const row of config.selected) {
      await page.goto(`${local.url}/?experience=modern&motion=0#/r/${row.id}`);
      await page.getByLabel('More workspace options', { exact: true }).click();
      if (!await page.locator('.usage-peek').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.usage-peek>summary').click();
      await expect(page.locator('.usage-peek')).toContainText(row.harness === 'codex' ? 'Recorded · Codex token_count' : 'Recorded · Claude');
      await expect(page.locator('.usage-peek section[aria-label="Usage"] dt').first()).toBeVisible();
    }
  } finally { await local.close(); await isolated.close(); }
});
