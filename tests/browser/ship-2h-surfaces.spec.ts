import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

let dir: string, repoRoot: string, app: App, server: RunningServer;
let claudeId: string, codexId: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-2h-'));
  repoRoot = join(dir, 'repo-with-deep-workspace', 'nested-module-folder', 'client');
  mkdirSync(repoRoot, { recursive: true });
  git(repoRoot, 'init', '-b', 'main');
  git(repoRoot, 'config', 'user.name', 'Synthetic');
  git(repoRoot, 'config', 'user.email', 'synthetic@example.invalid');
  git(repoRoot, 'config', 'core.autocrlf', 'false');
  writeFileSync(join(repoRoot, 'index.ts'), 'export const value = 1;\n');
  git(repoRoot, 'add', '.');
  git(repoRoot, 'commit', '-m', 'Initial commit');
  git(repoRoot, 'switch', '-c', 'no-commits-branch');
  // Uncommitted change so switching via "Show uncommitted" reveals a real edit.
  writeFileSync(join(repoRoot, 'index.ts'), 'export const value = 2;\n');

  // Claude Code session with long fallback title (no explicit custom-title), single edit + test + deep workspace path.
  const longPrompt =
    'Investigate why long session fallback titles truncated without an ellipsis and inspect the single failing verification check cleanly across palettes and viewports';
  const baseClaude = {
    cwd: repoRoot,
    sessionId: '22222222-0000-4000-8000-000000000222',
    version: '2.1.0',
    userType: 'external',
    entrypoint: 'cli',
    isSidechain: false,
    gitBranch: 'no-commits-branch',
  };
  let n = 0;
  let parent: string | null = null;
  const claudeRows: string[] = [];
  const pushClaude = (type: 'user' | 'assistant', message: object) => {
    const uuid = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    claudeRows.push(JSON.stringify({ ...baseClaude, parentUuid: parent, type, message, uuid, timestamp: `2026-11-11T10:00:${String(n).padStart(2, '0')}.000Z` }));
    parent = uuid;
  };
  const useClaude = (name: string, input: object, result: string, isError = false) => {
    const id = `toolu_2h_${n}`;
    pushClaude('assistant', { id: `msg_${n}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
    pushClaude('user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: result, is_error: isError }] });
  };
  pushClaude('user', { role: 'user', content: longPrompt });
  useClaude('Edit', { file_path: join(repoRoot, 'index.ts'), old_string: 'export const value = 1;', new_string: 'export const value = 2;' }, 'Edited.');
  useClaude('Bash', { command: 'pnpm test' }, '1 failed test', true);
  pushClaude('assistant', {
    id: `msg_${++n}`,
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: 'Updated `index.ts` and captured the single verification failure.' }],
    stop_reason: 'end_turn',
  });
  const claudeFile = join(dir, 'claude.jsonl');
  writeFileSync(claudeFile, `${claudeRows.join('\n')}\n`);

  // Minimal Codex session to confirm human harness label "Codex" and session details formatting.
  const codexRows = [
    JSON.stringify({ type: 'session_meta', timestamp: '2026-11-11T10:05:00.000Z', payload: { id: 'codex-2h', cwd: repoRoot, cli_version: '0.1.0', git: { branch: 'no-commits-branch' } } }),
    JSON.stringify({ type: 'response_item', timestamp: '2026-11-11T10:05:01.000Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Check index.ts for uncommitted edits' }] } }),
    JSON.stringify({ type: 'event_msg', timestamp: '2026-11-11T10:05:02.000Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1200, cached_input_tokens: 400, output_tokens: 180, total_tokens: 1380 }, model_context_window: 200000 } } }),
    JSON.stringify({ type: 'response_item', timestamp: '2026-11-11T10:05:03.000Z', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Checked `index.ts`.' }] } }),
  ];
  const codexFile = join(dir, 'codex.jsonl');
  writeFileSync(codexFile, `${codexRows.join('\n')}\n`);

  app = new App(join(dir, 'store'));
  claudeId = (await app.ingest.importSource('claude-code', claudeFile)).recordingId;
  codexId = (await app.ingest.importSource('codex', codexFile)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-ship-2h' });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function openSession(page: Page, id: string, width: number, palette: 'jet' | 'midnight' | 'paper' = 'jet') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
  await page.evaluate((p) => {
    document.documentElement.dataset.palette = p;
    document.documentElement.dataset.theme = p === 'paper' ? 'light' : 'dark';
  }, palette);
}

for (const [width, palette] of [
  [1440, 'jet'],
  [1440, 'midnight'],
  [600, 'paper'],
] as const) {
  test(`opened surfaces stay compact, aligned, legible and free of raw IDs at ${width}px (${palette})`, async ({ page }) => {
    await openSession(page, claudeId, width, palette);

    // 1 + 6. Settings dialog sizes to content on shorter tabs and uses distinct category icons.
    await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Workspace settings', exact: true });
    await expect(settings).toBeVisible();
    await settings.getByRole('tab', { name: 'Playback', exact: true }).click();
    const playbackBox = await settings.boundingBox();
    expect(playbackBox?.height ?? 999).toBeLessThan(650);
    expect(playbackBox?.height ?? 999).toBeLessThan(900 - 32);

    const iconPaths = await settings.locator('[role="tab"] svg path').evaluateAll((els) => els.map((e) => e.getAttribute('d')));
    // Appearance, Reading, Links, Playback, Privacy, Keyboard: at least 6 tabs with distinct SVG paths across Links vs Playback vs Privacy.
    expect(new Set(iconPaths).size).toBeGreaterThanOrEqual(6);
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);

    // 2 + 3. Session menu: Session details human harness + <wbr> workspace wrapping + ellipsis title + Navigate history clipping.
    await page.getByLabel('More workspace options', { exact: true }).click();
    const menu = page.locator('.workspace-menu[open]');
    await menu.locator('.session-identity > summary').click();
    const details = menu.locator('.session-identity');
    await expect(details.locator('dl')).toContainText('Claude Code');
    await expect(details.locator('dl')).not.toContainText('claude-code');
    const titleText = await details.locator('dd').first().innerText();
    expect(titleText).toMatch(/…$/);
    const wbrCount = await details.locator('dd wbr').count();
    expect(wbrCount).toBeGreaterThanOrEqual(2);

    const navDetails = menu.locator('.prompt-menu');
    await navDetails.locator('> summary').click();
    await expect(navDetails).toHaveAttribute('open', '');
    const navClip = await menu.locator('.workspace-utilities').evaluate((container) => {
      const cRect = container.getBoundingClientRect();
      const promptCopy = container.querySelector('.prompt-copy');
      const strip = container.querySelector('.activity-strip');
      return {
        popupOverflows: (container.querySelector('.prompt-popup')?.getBoundingClientRect().right ?? 0) > cRect.right + 1,
        stripOverflows: strip ? strip.getBoundingClientRect().right > cRect.right + 1 : false,
        copyOverflow: promptCopy ? promptCopy.getBoundingClientRect().right > cRect.right + 1 : false,
      };
    });
    expect(navClip.popupOverflows).toBe(false);
    expect(navClip.stripOverflows).toBe(false);
    expect(navClip.copyOverflow).toBe(false);
    await navDetails.locator('> summary').click();

    // Close menu and check Changes -> This session at head.tip === base.tip offers Show uncommitted and drops duplicate Nothing to read here.
    await page.keyboard.press('Escape');
    await page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true }).click();
    const changes = page.getByRole('region', { name: 'Changes', exact: true });
    await expect(changes).toBeVisible();
    const approve = changes.getByRole('button', { name: 'Approve read-only Git', exact: true });
    await expect(approve.or(changes.locator('.compare-body'))).toBeVisible();
    if (await approve.isVisible()) await approve.click();
    await expect(changes.locator('.compare-body')).toBeVisible();
    await expect(changes.getByText('Nothing to read here.')).toHaveCount(0);
    const showUncommitted = changes.getByRole('button', { name: 'Show uncommitted', exact: true });
    await expect(showUncommitted).toBeVisible();
    await showUncommitted.click();
    await expect(changes.locator('.compare-files')).toContainText('index.ts');
    await changes.getByRole('button', { name: 'Back to agent', exact: true }).click();

    // 7. Command palette groups, icons, shortcuts and plain copy.
    await page.keyboard.press('Control+k');
    const paletteDialog = page.getByRole('dialog', { name: 'Navigate workspace', exact: true });
    await expect(paletteDialog).toBeVisible();
    for (const heading of ['This session', 'Review', 'Repository', 'Workspace']) {
      await expect(paletteDialog.locator('.workspace-navigation-heading', { hasText: heading })).toBeVisible();
    }
    await expect(paletteDialog).not.toContainText('Outcomes, not coverage');
    expect(await paletteDialog.locator('.navigation-command-icon svg').count()).toBeGreaterThanOrEqual(8);
    expect(await paletteDialog.locator('.navigation-command-shortcut').allInnerTexts()).toEqual(expect.arrayContaining(['/', 'X']));
    await paletteDialog.getByRole('combobox', { name: 'Find a command, file or session' }).fill('captured commands');
    await expect(paletteDialog.getByRole('option', { name: /Find commands/ })).toBeVisible();
    await page.keyboard.press('Escape');

    // 1 + 5. Session review and Review packet dialog size to content (< 600 before preview) and use singular labels for counts of 1.
    await page.keyboard.press('Control+k');
    await expect(paletteDialog).toBeVisible();
    await paletteDialog.getByRole('combobox', { name: 'Find a command, file or session' }).fill('Review changes and checks');
    await paletteDialog.getByRole('option', { name: /Review changes and checks/ }).click();
    const reviewDialog = page.getByRole('dialog', { name: 'Session review', exact: true });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog.locator('.review-counts')).toContainText('1 file changed');
    await expect(reviewDialog.locator('.review-counts')).toContainText('1 test run');
    await expect(reviewDialog).not.toContainText(/\b1 files\b|\b1 test runs\b/);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+k');
    await expect(paletteDialog).toBeVisible();
    await paletteDialog.getByRole('combobox', { name: 'Find a command, file or session' }).fill('Prepare review packet');
    await paletteDialog.getByRole('option', { name: /Prepare review packet/ }).click();
    const packetDialog = page.getByRole('dialog', { name: 'Review packet', exact: true });
    await expect(packetDialog).toBeVisible();
    await expect(packetDialog.locator('.review-packet')).toBeVisible();
    const packetBox = await packetDialog.boundingBox();
    expect(packetBox?.height ?? 999).toBeLessThan(620);
    await expect(packetDialog).toContainText('1 file changed');
    await expect(packetDialog).toContainText('1 test run');
    await expect(packetDialog).not.toContainText(/\b1 files\b|\b1 test runs\b/);
    await page.keyboard.press('Escape');
  });
}

test('Codex Session details shows Codex and aligns Token details flush with Limits and Context', async ({ page }) => {
  await openSession(page, codexId, 1440, 'jet');
  await page.getByLabel('More workspace options', { exact: true }).click();
  const menu = page.locator('.workspace-menu[open]');
  await menu.locator('.session-identity > summary').click();
  await expect(menu.locator('.session-identity dd').nth(1)).toHaveText('Codex');
  await menu.locator('.session-identity > summary').click();

  await menu.locator('.usage-peek > summary').click();
  const usage = menu.locator('.usage-peek');
  const align = await usage.evaluate((el) => {
    const context = el.querySelector('h4')?.getBoundingClientRect();
    const detailsSummary = el.querySelector('.usage-token-details > summary')?.getBoundingClientRect();
    return { contextX: context?.left ?? 0, detailsX: detailsSummary?.left ?? 0 };
  });
  expect(Math.abs(align.contextX - align.detailsX)).toBeLessThanOrEqual(1.5);
});
