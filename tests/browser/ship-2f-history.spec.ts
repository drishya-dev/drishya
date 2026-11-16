import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
let claudeId: string, codexId: string;

const TASK_NOTICE = '<task-notification>\n<task-id>bg42</task-id>\n<status>completed</status>\n<summary>Test run finished</summary>\n</task-notification>';

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-2f-'));
  app = new App(join(dir, 'store'));
  const t = (s: number) => new Date(Date.UTC(2026, 10, 12, 10, 0, s)).toISOString();

  const claudeFile = join(dir, 'claude.jsonl');
  const longPrompt = Array.from({ length: 14 }, (_, i) => `Prompt line ${i + 1} checking fold and chevron rules in long prompts.`).join('\n');
  writeFileSync(claudeFile, [
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(0), type: 'user', uuid: 'u1', message: { role: 'user', content: 'Inspect the layout rules.' } },
    {
      cwd: dir, sessionId: 'ship2f-claude', timestamp: t(1), type: 'assistant', uuid: 'a1',
      message: {
        id: 'm1', role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Compare the CSS specificity between history-ink and large-screens.' },
          { type: 'text', text: 'Thinking prose is quieter while the answer stays full strength.' },
          { type: 'tool_use', id: 'tu_read', name: 'Read', input: { file_path: join(dir, 'sample.ts') } },
        ],
      },
    },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(2), type: 'user', uuid: 'u_r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_read', content: 'export const x = 1;\n' }] } },
    {
      cwd: dir, sessionId: 'ship2f-claude', timestamp: t(3), type: 'assistant', uuid: 'a2',
      message: {
        id: 'm2', role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_plan', name: 'mcp__ccd_turn__update_plan', input: { items: [{ content: 'Check contrast tokens', status: 'in_progress' }, { content: 'Verify 600 px cards', status: 'pending' }] } }],
      },
    },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(4), type: 'user', uuid: 'u_r2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_plan', content: 'Updated plan.' }] } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(5), type: 'user', uuid: 'n1', message: { role: 'user', content: '[Request interrupted by user]' } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(6), type: 'user', uuid: 'n2', message: { role: 'user', content: TASK_NOTICE } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(7), type: 'user', uuid: 'c1', message: { role: 'user', content: '<command-name>/compact</command-name>\n<command-message>compact</command-message>\n<command-args></command-args>' } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(8), type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger: 'manual', preTokens: 42000 } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(9), type: 'user', uuid: 'c_sum', isCompactSummary: true, message: { role: 'user', content: 'Continued after compacting the CSS investigation.' } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(10), type: 'assistant', uuid: 'a3', message: { id: 'm3', role: 'assistant', content: [{ type: 'text', text: 'Ready to verify.' }] } },
    { cwd: dir, sessionId: 'ship2f-claude', timestamp: t(11), type: 'user', uuid: 'u_long', message: { role: 'user', content: longPrompt } },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  claudeId = (await app.ingest.importSource('claude-code', claudeFile)).recordingId;

  const codexFile = join(dir, 'codex.jsonl');
  writeFileSync(codexFile, [
    { timestamp: t(0), type: 'session_meta', payload: { id: '0199c0de-0000-7000-8000-000000002f01', cwd: dir, cli_version: '0.0.0-synthetic', originator: 'Codex Desktop', source: 'exec' } },
    { timestamp: t(1), type: 'event_msg', payload: { type: 'task_started', turn_id: 't1', root_turn_id: 't1', started_at: 1794477601 } },
    { timestamp: t(1), type: 'turn_context', payload: { turn_id: 't1', root_turn_id: 't1', cwd: dir, model: 'synthetic-model' } },
    { timestamp: t(2), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the workspace and propose a plan.' }] } },
    { timestamp: t(3), type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text: 'Checking files first.' }] } },
    { timestamp: t(4), type: 'response_item', payload: { type: 'function_call', name: 'functions.exec_command', call_id: 'c1', arguments: JSON.stringify({ cmd: 'echo ok' }) } },
    { timestamp: t(5), type: 'response_item', payload: { type: 'function_call_output', call_id: 'c1', output: 'ok' } },
    { timestamp: t(6), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '<proposed_plan>\n# Plan\n1. Check tokens.\n2. Verify frames.\n</proposed_plan>' }] } },
    { timestamp: t(7), type: 'event_msg', payload: { type: 'context_compacted' } },
    { timestamp: t(8), type: 'response_item', payload: { type: 'compacted', message: 'Compacted earlier reasoning before next turn.' } },
    { timestamp: t(9), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done with synthetic Codex session.' }] } },
    { timestamp: t(10), type: 'event_msg', payload: { type: 'task_complete', turn_id: 't1', root_turn_id: 't1', started_at: 1794477601, completed_at: 1794477610, duration_ms: 9000 } },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  codexId = (await app.ingest.importSource('codex', codexFile)).recordingId;

  server = await startServer({ app, port: 0, token: 'synthetic-ship2f' });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SHIP-2f: history separates thinking, quiet notices, compaction seams, full-column 600px cards, no orphan chevrons, and readable plan provenance', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('drishya.reasoningDetail', 'expanded'); });
  // Each palette and viewport samples a fresh location, not the previous case's reopened plan.
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET'
    ? route.fulfill({json: {version: 1, sessions: []}})
    : route.continue());

  for (const width of [600, 1440]) {
    for (const palette of ['jet', 'midnight', 'paper'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.launchUrl);
      await expect(page.locator('.home')).toBeVisible();
      await page.goto(`${server.url}/?experience=modern&motion=0#/r/${claudeId}`);
      await expect(page.locator('.history .prose:not(.prose-reasoning)').first()).toBeVisible();
      await page.evaluate((p) => {
        document.documentElement.dataset.palette = p;
        document.documentElement.dataset.theme = p === 'paper' ? 'light' : 'dark';
      }, palette);

      // Expand the derived plan card so its provenance badge mounts
      const planToggle = page.locator('article.op-plan .op-expand').first();
      await expect(planToggle).toBeVisible();
      if ((await planToggle.getAttribute('aria-expanded')) !== 'true') await planToggle.click();
      await expect(page.locator('article.op-plan .prov').first()).toBeVisible();
      await expect(page.locator('.history .prose.prose-reasoning:not(.reasoning-gap)').first()).toBeVisible();

      const metrics = await page.evaluate(() => {
        const think = document.querySelector('.history .prose.prose-reasoning:not(.reasoning-gap)')!;
        const ans = document.querySelector('.history .prose:not(.prose-reasoning)')!;
        const notices = [...document.querySelectorAll('.history .turn.turn-notice')];
        const compactTurns = notices.filter((n) => n.textContent?.includes('/compact'));
        const comp = document.querySelector('.history .context-evidence')!;
        const histCol = document.querySelector('.history-inner')!;
        const orphanFolds = [...document.querySelectorAll('.history .turn-fold')].filter((b) => !b.textContent?.trim()).length;
        const longPromptTurn = [...document.querySelectorAll('.history .turn')].find((t) => t.textContent?.includes('Prompt line 1'));
        const cardWidths = [...document.querySelectorAll('.history .op')].map((op) => ({
          cls: op.className,
          w: Math.round(op.getBoundingClientRect().width),
          rowW: Math.round(op.closest('.ops-row')!.getBoundingClientRect().width),
        }));
        const planProv = document.querySelector('article.op-plan .prov')!.textContent ?? '';
        return {
          thinkFs: parseFloat(getComputedStyle(think).fontSize),
          thinkColor: getComputedStyle(think).color,
          thinkBorderLeft: getComputedStyle(think).borderLeftWidth,
          ansFs: parseFloat(getComputedStyle(ans).fontSize),
          ansColor: getComputedStyle(ans).color,
          ansBorderLeft: getComputedStyle(ans).borderLeftWidth,
          noticeCount: notices.length,
          noticeIcons: notices.filter((n) => n.querySelector('.turn-notice-icon')).length,
          interruptedOriginalCount: notices.find((n) => /interrupted/i.test(n.textContent ?? ''))?.querySelectorAll('.turn-captured').length ?? -1,
          bgTaskSummary: notices.find((n) => /background task/i.test(n.textContent ?? ''))?.querySelector('.turn-captured summary')?.textContent ?? null,
          compactTurnCount: compactTurns.length,
          compHasIcon: !!comp.querySelector('.context-compaction-icon'),
          compWidth: Math.round(comp.getBoundingClientRect().width),
          histColWidth: Math.round(histCol.getBoundingClientRect().width),
          orphanFolds,
          longPromptHasOrphanFold: !!longPromptTurn?.querySelector('.turn-fold'),
          cardWidths,
          planProv,
        };
      });

      expect(metrics.thinkFs).toBeLessThan(metrics.ansFs);
      expect(metrics.thinkColor).not.toBe(metrics.ansColor);
      expect(metrics.thinkBorderLeft).toBe('1px');
      expect(metrics.ansBorderLeft).toBe('0px');

      expect(metrics.noticeCount).toBe(2);
      expect(metrics.noticeIcons).toBe(2);
      expect(metrics.interruptedOriginalCount).toBe(0);
      expect(metrics.bgTaskSummary).toBe('Original notice');
      expect(metrics.compactTurnCount).toBe(0);
      expect(metrics.compHasIcon).toBe(true);
      expect(metrics.compWidth).toBeGreaterThan(metrics.histColWidth - 90);
      expect(metrics.orphanFolds).toBe(0);
      expect(metrics.longPromptHasOrphanFold).toBe(false);

      expect(metrics.planProv).toContain('Compared with the previous plan');
      expect(metrics.planProv).not.toContain('claude-desktop-update-plan-v1');

      for (const card of metrics.cardWidths) {
        if (width === 600) {
          expect(card.w).toBeGreaterThanOrEqual(card.rowW - 4);
        } else if (card.cls.includes('op-read')) {
          expect(card.w).toBeLessThanOrEqual(450);
        }
      }
    }

    // Check Codex session compaction + proposed plan provenance + full-column cards at 600 px
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${codexId}`);
    await expect(page.locator('.history .context-evidence').first()).toBeVisible();
    const codexPlanToggle = page.locator('article.op-plan .op-expand').first();
    await expect(codexPlanToggle).toBeVisible();
    if ((await codexPlanToggle.getAttribute('aria-expanded')) !== 'true') await codexPlanToggle.click();
    await expect(page.locator('article.op-plan .prov').first()).toBeVisible();
    const codexCheck = await page.evaluate(() => {
      const comp = document.querySelector('.history .context-evidence')!;
      const op = document.querySelector('.history .op:not(.op-plan)')!;
      const row = op.closest('.ops-row')!;
      const planProv = document.querySelector('article.op-plan .prov')!.textContent ?? '';
      return {
        compIcon: !!comp.querySelector('.context-compaction-icon'),
        orphanFolds: [...document.querySelectorAll('.history .turn-fold')].filter((b) => !b.textContent?.trim()).length,
        opW: Math.round(op.getBoundingClientRect().width),
        rowW: Math.round(row.getBoundingClientRect().width),
        planProv,
      };
    });
    expect(codexCheck.compIcon).toBe(true);
    expect(codexCheck.orphanFolds).toBe(0);
    expect(codexCheck.planProv).toContain('Proposed plan from output');
    expect(codexCheck.planProv).not.toContain('codex-proposed-plan-v1');
    if (width === 600) expect(codexCheck.opW).toBeGreaterThanOrEqual(codexCheck.rowW - 4);
  }
});
