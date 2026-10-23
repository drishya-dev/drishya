import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { expandCard } from './history-gestures.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-delegation-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-delegation' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

const sample = () => JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));

/** The demo's earlier turns rest folded; unfold them and scroll until the delegation is mounted. */
async function openDelegation(page: Page, bundle: unknown) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/demo/bundle.json', route => route.fulfill({ json: bundle }));
  await page.goto(new URL('/?demo&experience=modern&motion=0', server.launchUrl).href);
  const history = page.locator('.history');
  await expect(history).toBeVisible();
  await history.focus(); await page.keyboard.press('Shift+C');
  const card = page.locator('article.op-spawn');
  for (let n = 0; n < 40 && !(await card.count()); n++) { await history.evaluate((el, y) => { el.scrollTop = y; }, n * 250); await page.waitForTimeout(150); }
  await expect(card).toHaveCount(1);
  await card.evaluate(el => el.scrollIntoView({ block: 'center' }));
  return card;
}

test('a Claude delegation says who ran it and reads as task and returned result', async ({ page }) => {
  const card = await openDelegation(page, sample());
  await expect(card.locator('.delegation-line')).toHaveText('claude-opus-5');
  await expandCard(card);
  const detail = card.locator('.delegation-material');
  await expect(detail.locator('.delegation-facts')).toContainText('Explore');
  await expect(detail.locator('.delegation-facts')).toContainText('claude-opus-5');
  await expect(detail).toContainText('Find tests covering totals');
  await expect(detail).toContainText('Two test files cover totals.');
  await expect(detail.locator('.delegation-scope')).toHaveText('3 actions by this agent in this recording.');
  await card.screenshot({ path: resolve('.local/delegation-claude.png') });
});

test('a Codex delegation keeps its address and effort, and never shows the acknowledgement as an answer', async ({ page }) => {
  const bundle = sample();
  const op = bundle.projection.operations.find((item: { detail: { kind: string } }) => item.detail.kind === 'spawn');
  const child = bundle.projection.agents.find((agent: { id: string }) => agent.id === op.detail.childAgentId);
  Object.assign(child, { address: '/root/worker', model: 'gpt-5-codex', effort: 'high', harness: 'codex' });
  op.detail = { kind: 'spawn', agentType: 'worker', descriptionEncrypted: true, resultPreview: '{"task_name":"review"}', childAgentId: child.id };
  for (const other of bundle.projection.operations) if (other.agentId === child.id) other.agentId = 'rec_x0001.agent:main';
  const card = await openDelegation(page, bundle);
  await expect(card.locator('.delegation-line')).toHaveText('/root/worker · gpt-5-codex · high');
  await expandCard(card);
  const detail = card.locator('.delegation-material');
  await expect(detail.locator('.delegation-facts')).toContainText('/root/worker');
  await expect(detail.locator('.delegation-facts')).toContainText('gpt-5-codex · high effort');
  await expect(detail).toContainText('Codex stored the task text encrypted');
  await expect(detail).toContainText('only an acknowledgement');
  await expect(detail).not.toContainText('task_name');
  await expect(detail.locator('.delegation-scope')).toContainText('not in this recording');
});
