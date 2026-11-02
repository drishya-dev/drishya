import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-reading-defaults-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-reading-defaults' }); });
test.afterAll(async () => {
    await server?.close();
    await app?.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep))
        throw Error('Unsafe temp cleanup');
    rmSync(dir, { recursive: true, force: true });
});
async function open(page: import('@playwright/test').Page, text: string, terminal = false) {
    const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8')), op = sample.projection.operations.find((op: {
        kind: string;
    }) => op.kind === 'mcp');
    op.artifactIds = [];
    op.detail = terminal ? { kind: 'shell', command: 'captured command', outputPreview: text, exitCode: 0 } : { kind: 'mcp', server: 'records', tool: 'read', input: {}, resultPreview: text };
    if (terminal) {
        op.kind = 'shell';
        op.origin = { type: 'native', tool: 'shell_command' };
    }
    await page.route('**/demo/bundle.json', r => r.fulfill({ json: sample }));
    await page.goto(new URL(`/?demo&experience=modern&motion=0&at=${(op.endSequence ?? op.startSequence) + 1}`, server.launchUrl).href);
    await expect(page.locator('.history')).toBeVisible();
    const card = page.locator(`article[data-op-id="${op.id}"]`);
    await card.scrollIntoViewIfNeeded();
    return card;
}
for (const width of [600, 1440]) {
    test(`direct JSON reading retains keyboard Original and larger view at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const raw = JSON.stringify({ profile: { name: 'Captured', nested: { value: 2 } }, events: [{ name: 'first' }, { name: 'last' }] });
        const card = await open(page, raw), reading = card.getByRole('region', { name: 'Data reading', exact: true });
        await expect(reading).toBeVisible();
        await expect(reading.getByRole('tree', { name: 'JSON tree', exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'Inspect data', exact: true })).toHaveCount(0);
        await reading.getByRole('button', { name: 'Original', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(reading.locator('.data-original')).toHaveText(raw);
        await reading.getByRole('button', { name: 'Open larger', exact: true }).focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Data', exact: true });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Original', exact: true }).press('Enter');
        await expect(dialog.locator('.data-original')).toHaveText(raw);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
    });
    test(`delimited text stays literal until a keyboard CSV or TSV choice at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const raw = 'name,value\nfirst,2\nlast,3';
        const card = await open(page, raw, true);
        await expect(card.getByRole('table', { name: 'Delimited records', exact: true })).toHaveCount(0);
        await expect(card.locator('.output')).toContainText(raw.trim());
        const choice = card.getByRole('button', { name: 'Inspect delimited text', exact: true }).first();
        await choice.focus();
        await expect.poll(() => choice.locator('xpath=ancestor::*[contains(@class,"captured-result-views")][1]').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Delimited text', exact: true });
        await expect(dialog.locator('.data-original')).toHaveText(raw);
        await expect(dialog.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(dialog.getByRole('button', { name: 'CSV', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await expect(dialog.getByRole('button', { name: 'TSV', exact: true })).toHaveAttribute('aria-pressed', 'false');
        await dialog.getByRole('button', { name: 'CSV', exact: true }).press('Enter');
        await expect(dialog.getByRole('table', { name: 'Delimited records', exact: true })).toHaveAttribute('aria-colcount', '3');
        await dialog.getByRole('button', { name: 'Original', exact: true }).press('Enter');
        await expect(dialog.locator('.data-original')).toHaveText(raw);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
    });
}
test('terminal JSON, MCP envelopes and unrecognised log/error text keep their own readable body without a standing chooser row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [raw, terminal] of [[JSON.stringify({ result: { value: 2 }, items: [1, 2] }), true], [JSON.stringify({ content: [{ type: 'text', text: 'Sibling stays readable' }, { type: 'text', text: '{"value":2}' }] }), false], ['INFO starting\nWARN retrying\nError: captured failure remains literal', true]] as const) {
        const card = await open(page, raw, terminal);
        await expect(card.getByRole('region', { name: 'Data reading', exact: true })).toHaveCount(0);
        const choices = card.locator('.captured-result-views[aria-label="Result views"]');
        expect(await choices.evaluateAll(items => items.every(el => getComputedStyle(el).position === 'absolute'))).toBe(true);
        const inspect = card.getByRole('button', { name: 'Inspect data', exact: true });
        if (await inspect.count()) {
            await inspect.first().focus();
            await page.keyboard.press('Enter');
        }
        else {
            const manual = choices.locator('.result-original>summary');
            await manual.focus();
            await page.keyboard.press('Enter');
            await choices.getByRole('button', { name: 'Read as JSON', exact: true }).press('Enter');
        }
        const dialog = page.getByRole('dialog', { name: 'Data', exact: true });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Original', exact: true }).press('Enter');
        await expect(dialog.locator('.data-original')).toHaveText(raw);
        await page.keyboard.press('Escape');
        await page.unroute('**/demo/bundle.json');
    }
});
