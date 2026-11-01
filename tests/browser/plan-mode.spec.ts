import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-plan-mode-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CONTENT-4b: the shapes below are the ones a genuine Claude Code session recorded on 28 October 2026 (EnterPlanMode with no
// input, ExitPlanMode with {plan, planFilePath}, and the desktop app's update_plan as a full list, then advance/done changes).
const UPDATE_PLAN = 'mcp__ccd_turn__update_plan';
const PLAN_TEXT = '# Plan: tidy the checkout guard\n\n## Steps\n\n1. Read the guard\n2. Reject a missing total';

test('plan-mode and desktop checklist records show as one proposed plan and one evolving checklist', async ({ page }) => {
  const session = 'plan-mode', source = join(dir, session + '.jsonl');
  const base = { cwd: dir, sessionId: session, timestamp: '2026-10-28T00:00:00Z' };
  let n = 0;
  const call = (name: string, input: object, result: string) => {
    const id = `t${n++}`;
    return [
      { ...base, type: 'assistant', uuid: `a-${id}`, message: { id: `m-${id}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } },
      { ...base, type: 'user', uuid: `r-${id}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: result }] } },
    ];
  };
  const item = (content: string, status: string) => ({ content, status });
  const rows = [
    { ...base, type: 'user', uuid: 'p', message: { role: 'user', content: 'Plan the guard change' } },
    ...call('EnterPlanMode', {}, 'Entered plan mode.'),
    ...call('ExitPlanMode', { plan: PLAN_TEXT, planFilePath: join(dir, '.claude', 'plans', 'x.md') }, 'User has approved your plan. You can now start coding.'),
    ...call(UPDATE_PLAN, { items: [item('Read the guard', 'in_progress'), item('Reject a missing total', 'pending'), item('Run the tests', 'pending')], scope: 'first_task' }, 'Plan shown (3 steps).'),
    ...call(UPDATE_PLAN, { advance: true }, 'Plan advanced.'),
    ...call(UPDATE_PLAN, { done: [2], start: 3 }, 'Plan updated.'),
  ];
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;

  for (const width of [600, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Captured work' })).toBeVisible();

    // ExitPlanMode: the plan text as Markdown, labelled as a captured proposal, never as an approval.
    const document = page.locator('.plan-document');
    await expect(document).toHaveCount(1);
    await expect(document.locator('h1, h2').first()).toContainText('tidy the checkout guard');
    await expect(document.locator('.plan-basis')).toHaveText('Captured proposal · not an approval');
    await expect(document).not.toContainText('approved');

    // update_plan: three recorded changes are one pinned list that ends with the last state.
    const pinned = page.locator('.plan-card[role=group]');
    await expect(pinned).toHaveCount(1);
    await expect(pinned).toContainText('Revision 3 · 2 of 3 done');
    await expect(pinned.locator('li.plan-completed')).toHaveCount(2);
    await expect(pinned.locator('li.plan-in_progress')).toContainText('Run the tests');
  }
});
