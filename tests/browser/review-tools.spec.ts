import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { reviewJournal } from '../../fixtures/synthetic/review-tools.ts';
let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-review-tools-browser-')); app = new App(join(dir, 'store')); const path = join(dir, 'source.jsonl'); writeFileSync(path, reviewJournal(dir)); id = (await app.ingest.importSource('codex', path)).recordingId; server = await startServer({ app, port: 0, token: 'synthetic-review-browser' }); });
test.afterAll(async () => { if (server)
    await server.close(); if (app)
    await app.close(); if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
        throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
} });
test('command navigation filters failures, reads exact output and reviews complete selected commands', async ({ page }) => {
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history')).toBeVisible();
    await page.keyboard.press('Control+k');
    const navigation = page.getByRole('dialog', { name: 'Navigate workspace' });
    await navigation.getByRole('combobox').fill('Review captured commands');
    await navigation.getByRole('combobox').press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Recorded review tools' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Outcome', { exact: true }).selectOption('failed');
    await expect(dialog.locator('.command-ledger-row')).toHaveCount(5);
    await dialog.locator('.command-ledger-row > button').first().click();
    await expect(dialog.getByRole('region', { name: 'Captured command detail' })).toContainText('FAIL repeated-case synthetic output');
    await dialog.getByRole('button', { name: 'Back to commands' }).click();
    await dialog.getByLabel('Command text or directory').fill('COMPLETE_END');
    await dialog.getByLabel('Outcome', { exact: true }).selectOption('');
    await expect(dialog.locator('.command-ledger-row')).toHaveCount(1);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Review selected script' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Complete selected script' })).toHaveValue(new RegExp('COMPLETE_END$'));
    await expect(dialog).toContainText('Drishya does not execute');
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: resolve('.local/review-tools-phone.png') });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});
test('findings link exact matches, repetitions page occurrences and prompt summaries open history', async ({ page }) => {
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history')).toBeVisible();
    await page.keyboard.press('Control+k');
    let navigation = page.getByRole('dialog', { name: 'Navigate workspace' });
    await navigation.getByRole('combobox').fill('Review evidence-linked findings');
    await navigation.getByRole('combobox').press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Recorded review tools' });
    await expect(dialog.locator('.review-tools-results .review-tool-item')).toHaveCount(2);
    await expect(dialog.locator('mark').first()).toHaveText('git push origin main --force');
    await dialog.getByRole('button', { name: 'Repetitions', exact: true }).click();
    await dialog.getByRole('button', { name: /Same captured command failed 4 times/ }).click();
    await expect(dialog.locator('.review-tools-results > .review-tool-item')).toHaveCount(4);
    await dialog.locator('.review-tools-results > .review-tool-item').first().click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.op.selected')).toBeVisible();
    await expect(page.locator('.history')).toBeVisible();
    await page.keyboard.press('Control+k');
    navigation = page.getByRole('dialog', { name: 'Navigate workspace' });
    await navigation.getByRole('combobox').fill('Review prompt summaries');
    await navigation.getByRole('combobox').press('Enter');
    await dialog.getByLabel('Sort summaries').selectOption('failures');
    await expect(dialog).toContainText('8 operations');
    await dialog.getByRole('button', { name: /Review the captured changes and checks/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.history')).toContainText('Review the captured changes and checks');
});
