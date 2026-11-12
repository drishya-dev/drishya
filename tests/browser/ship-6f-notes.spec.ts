import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let root: string;
let app: App;
let server: RunningServer;
let claudeId: string;
let codexId: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-6f-'));
  root = join(dir, 'shop');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), root, { recursive: true });
  const normalizedRoot = root.replaceAll('\\', '/');
  const claudeJournal = join(dir, 'claude.jsonl');
  const codexJournal = join(dir, 'codex.jsonl');
  writeFileSync(
    claudeJournal,
    readFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), 'utf8').replaceAll('/home/dev/shop', normalizedRoot),
  );
  writeFileSync(
    codexJournal,
    readFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'), 'utf8').replaceAll('/home/dev/shop', normalizedRoot),
  );
  app = new App(join(dir, 'store'));
  claudeId = (await app.ingest.importSource('claude-code', claudeJournal)).recordingId;
  codexId = (await app.ingest.importSource('codex', codexJournal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-ship-6f' });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/working-locations', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }),
  );
});

async function openSession(page: Page, recordingId: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.evaluate((id) => localStorage.removeItem(`drishya-moments-v1:daemon:${id}`), recordingId);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
  await expect(page.locator('.history article[data-op-id]').first()).toBeVisible();
}

async function openNotes(page: Page) {
  await page.keyboard.press('Control+k');
  const nav = page.getByRole('dialog', { name: 'Navigate workspace', exact: true });
  await nav.getByRole('combobox').fill('Notes');
  await nav.getByRole('option').filter({ hasText: 'Notes' }).click();
  const dialog = page.getByRole('dialog', { name: 'Notes', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const [label, getRecordingId] of [
  ['claude-code', () => claudeId],
  ['codex', () => codexId],
] as const) {
  for (const width of [600, 1440]) {
    test(`SHIP-6f (${label} @ ${width}px): empty Notes routing, one-click editor, shortcut a, and Earlier reading notes disclosure`, async ({ page }) => {
      const id = getRecordingId();
      await openSession(page, id, width);

      // 1. Empty Notes without a selected step -> Choose a step returns from Workspace to History with one-line hint + shortcut `a`.
      await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Developer workspace', exact: true })).toBeVisible();
      let notes = await openNotes(page);
      const chooseStep = notes.getByRole('button', { name: 'Choose a step', exact: true });
      await expect(chooseStep).toBeVisible();
      await expect(notes.getByRole('button', { name: 'Add a note to the selected step', exact: true })).toHaveCount(0);

      // Check Earlier reading notes disclosure button aesthetics & toggle behavior.
      const earlierBtn = notes.getByRole('button', { name: 'Earlier reading notes', exact: true });
      await expect(earlierBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(earlierBtn.locator('svg.earlier-notes-chevron')).toBeVisible();
      await expect(earlierBtn.locator('.earlier-notes-state')).toHaveText('Show');
      await earlierBtn.click();
      await expect(earlierBtn).toHaveAttribute('aria-expanded', 'true');
      await expect(earlierBtn.locator('.earlier-notes-state')).toHaveText('Hide');
      await earlierBtn.click();
      await expect(earlierBtn).toHaveAttribute('aria-expanded', 'false');

      await chooseStep.click();
      await expect(notes).toHaveCount(0);
      await expect(page.locator('.history')).toBeVisible();

      const hint = page.locator('.history-note-hint');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText('Add a note');
      await expect(hint).toContainText('a');

      // Hint clears horizontal viewport and stays beneath header/tools without overlapping composer.
      const hintBox = (await hint.boundingBox())!;
      const composerBox = (await page.locator('.prompt-composer').boundingBox())!;
      expect(hintBox.x).toBeGreaterThanOrEqual(0);
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(width + 1);
      expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(composerBox.y + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      // Focus a step with `g`, then press `a` -> opens Add a note, focuses textarea, and clears the hint.
      await page.locator('.history').focus();
      await page.keyboard.press('g');
      await expect(page.locator('.history article[data-reading-focus]')).toBeVisible();
      await page.keyboard.press('a');
      await expect(hint).toHaveCount(0);
      const focusedCard = page.locator('.history article[data-reading-focus]');
      const firstTextarea = focusedCard.getByRole('textbox', { name: 'Note on this step', exact: true });
      await expect(firstTextarea).toBeVisible();
      await expect(firstTextarea).toBeFocused();

      // Close step via Close button so we test expandedOp / selectedOp empty Notes one-click reachability cleanly.
      await focusedCard.getByRole('button', { name: /^Close .* in history$/ }).click();

      // 2. Empty Notes with a step selected/expanded -> one click on `Add a note to the selected step` opens focused textarea.
      const targetCard = page.locator('.history article[data-op-id]').first();
      const targetOpId = (await targetCard.getAttribute('data-op-id'))!;
      await targetCard.locator('.op-head .op-expand').click();
      await expect(targetCard).toHaveClass(/\bexpanded\b/);

      notes = await openNotes(page);
      const addToSelected = notes.getByRole('button', { name: 'Add a note to the selected step', exact: true });
      await expect(addToSelected).toBeVisible();
      await expect(notes.getByRole('button', { name: 'Choose a step', exact: true })).toHaveCount(0);
      await addToSelected.click();
      await expect(notes).toHaveCount(0);

      const finalCard = page.locator(`article[data-op-id="${targetOpId}"]`);
      const field = finalCard.getByRole('textbox', { name: 'Note on this step', exact: true });
      await expect(field).toBeVisible();
      await expect(field).toBeFocused();
      await field.fill(`Verified ${label} at ${width}px`);
      await finalCard.getByRole('button', { name: 'Save note', exact: true }).click();
      await expect(finalCard).toContainText('Saved locally');
    });
  }
}
