import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
let dir: string, root: string, journal: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'drishya-source-versions-'));
    root = join(dir, 'repo');
    mkdirSync(root);
    writeFileSync(join(root, 'index.ts'), 'export const originalValue = 1;\n');
    const timestamp = '2026-10-18T00:00:00Z';
    journal = join(dir, 'source.jsonl');
    writeFileSync(journal, [{ timestamp, type: 'session_meta', payload: { id: 'versions', cwd: root } }, { timestamp, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review index.ts' }] } }, { timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'read', arguments: JSON.stringify({ cmd: 'cat index.ts', workdir: root }) } }, { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'read', output: 'Exit code: 0\nOutput:\nexport const originalValue = 1;\n' } }].map(row => JSON.stringify(row)).join('\n') + '\n');
    app = new App(join(dir, 'store'));
    id = (await app.ingest.importSource('codex', journal)).recordingId;
    server = await startServer({ app, port: 0, token: 'synthetic-source-versions' });
});
test.afterAll(async () => { if (server)
    await server.close(); if (app)
    await app.close(); if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
        throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
} });
test('disk changes disclose retained/new versions and preserve the exact local draft', async ({ page }) => {
    let submissions = 0;
    await page.route('**/controller/prompt', route => { submissions++; void route.abort(); });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history')).toBeVisible();
    await page.getByRole('button', { name: 'Enable workspace reading' }).click();
    await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
    await page.getByRole('treeitem', { name: /index.ts/ }).click();
    const desk = page.getByRole('region', { name: 'Workspace file index.ts' });
    await desk.getByRole('button', { name: 'Edit file', exact: true }).click();
    const editor = desk.getByRole('textbox', { name: 'Local draft for index.ts' });
    await editor.fill('export const localDraftValue = 2;\n');
    await editor.evaluate(el => (el as HTMLTextAreaElement).setSelectionRange(7, 12));
    writeFileSync(join(root, 'index.ts'), 'export const externalDiskValue = 3;\n');
    await desk.getByRole('button', { name: 'Check disk version' }).click();
    await expect(desk).toContainText('A newer disk version is available');
    await expect(editor).toHaveValue('export const localDraftValue = 2;\n');
    await desk.getByRole('button', { name: 'Compare disk versions' }).click();
    await expect(desk.getByRole('region', { name: 'Source version comparison' })).toContainText('externalDiskValue');
    await desk.getByRole('button', { name: 'Close source comparison' }).click();
    await expect(editor).toHaveValue('export const localDraftValue = 2;\n');
    expect(await editor.evaluate(el => (el as HTMLTextAreaElement).selectionStart)).toBe(7);
    await desk.getByRole('button', { name: 'Compare latest disk with draft' }).click();
    await expect(desk.getByRole('region', { name: 'Source version comparison' })).toContainText('localDraftValue');
    await desk.getByRole('button', { name: 'Read newer disk version' }).click();
    await expect(editor).toHaveValue('export const localDraftValue = 2;\n');
    await desk.getByRole('button', { name: 'Review edit with harness' }).click();
    await expect(page.getByRole('textbox', { name: 'Prompt for selected harness session' })).toHaveValue(/Base SHA-256:/);
    expect(submissions).toBe(0);
    expect(readFileSync(join(root, 'index.ts'), 'utf8')).toBe('export const externalDiskValue = 3;\n');
    const timestamp = '2026-10-18T00:01:00Z';
    writeFileSync(journal, readFileSync(journal, 'utf8') + [
        { timestamp, type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'later-check', arguments: JSON.stringify({ cmd: 'pnpm test -- later-check', workdir: root }) } },
        { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'later-check', output: 'Exit code: 1\nOutput:\nFAIL LATER_CHECK_EVIDENCE' } },
    ].map(row => JSON.stringify(row)).join('\n') + '\n');
    await app.ingest.sync(id);
    await page.locator('.workspace-menu>summary').click();
    await page.getByRole('button', { name: 'Review follow-up evidence', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Review work' })).toContainText('Preparation is not submission');
    await expect(page.getByRole('dialog', { name: 'Review work' })).toContainText('1 failed operation');
});
test('captured source compares exact stored ranges with a separately approved disk sample', async ({ page }) => {
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history')).toBeVisible();
    await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
    await page.getByRole('treeitem', { name: /index.ts/ }).click();
    await page.getByRole('region', { name: 'Workspace file index.ts' }).getByRole('button', { name: 'Recorded work', exact: true }).click();
    await page.getByRole('button', { name: 'Compare captured source with disk' }).click();
    const comparison = page.getByRole('region', { name: 'Source version comparison' });
    await expect(comparison).toContainText('originalValue');
    await expect(comparison).toContainText('externalDiskValue');
    await expect(comparison).toContainText('Captured range');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await comparison.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});
