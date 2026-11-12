import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
let mcpRecording: string, codexExecRecording: string, browserRecording: string;

test.setTimeout(60_000);

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-2g-'));
  app = new App(join(dir, 'home'));
  server = await startServer({ app, port: 0, token: 'ship-2g-test' });

  const ts = '2026-11-12T10:00:00.000Z';
  const markdownDoc = [
    '## Computer Use Environment',
    '',
    '- **Display**: `1280x800`',
    '- **Window**: `"Ready"`',
    '',
    '```ts',
    'const ok = true;',
    '```',
  ].join('\n');
  const nestedMcp = JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ content: [{ type: 'text', text: markdownDoc }] }) }],
  });
  const bigMarkdown = `## Large MCP Markdown\n\n- **Status**: clean\n\n${'line item\n'.repeat(6500)}`;
  const hugeNestedMcp = JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ content: [{ type: 'text', text: bigMarkdown }] }) }],
  });
  const nestedJsonMcp = JSON.stringify({
    content: [{ type: 'text', text: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ rows: [{ id: 1, title: 'alpha' }, { id: 2, title: 'beta' }] }) }] }) }],
  });
  const mcpPath = join(dir, 'mcp.jsonl');
  writeFileSync(mcpPath, [
    { timestamp: ts, type: 'session_meta', payload: { id: 'ship-2g-mcp', cwd: dir } },
    { timestamp: ts, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Inspect nested MCP tool results' }] } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call', name: 'mcp__cua_repl__js', arguments: '{"code":"report()"}', call_id: 'mcp-md' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call_output', call_id: 'mcp-md', output: nestedMcp } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call', name: 'mcp__cua_repl__js', arguments: '{"code":"big()"}', call_id: 'mcp-big' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call_output', call_id: 'mcp-big', output: hugeNestedMcp } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call', name: 'mcp__cua_repl__js', arguments: '{"code":"table()"}', call_id: 'mcp-json' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'function_call_output', call_id: 'mcp-json', output: nestedJsonMcp } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  mcpRecording = (await app.ingest.importSource('codex', mcpPath)).recordingId;

  const patch = '*** Begin Patch\n*** Update File: src/app.ts\n@@\n-const value = "old";\n+const value = "new";\n*** End Patch';
  const boundScript = `const patch = ${JSON.stringify(patch)};\nconst r = await tools.apply_patch(patch);\ntext(typeof r === "string" ? r : JSON.stringify(r));`;
  const mixedScript = `const patch = ${JSON.stringify(patch)};\nawait tools.apply_patch(patch);\nawait tools.exec_command({ cmd: "echo done" });`;
  const codexPath = join(dir, 'exec-patch.jsonl');
  writeFileSync(codexPath, [
    { timestamp: ts, type: 'session_meta', payload: { id: 'ship-2g-exec', cwd: dir } },
    { timestamp: ts, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Apply patches in exec' }] } },
    { timestamp: ts, type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: boundScript, call_id: 'exec-bound' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'exec-bound', output: 'Success. Updated the following files:\nM src/app.ts' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: mixedScript, call_id: 'exec-mixed' } },
    { timestamp: ts, type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'exec-mixed', output: 'done' } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  codexExecRecording = (await app.ingest.importSource('codex', codexPath)).recordingId;

  const browserPath = join(dir, 'browser-url.jsonl');
  writeFileSync(browserPath, [
    { timestamp: ts, type: 'user', uuid: 'u1', sessionId: 'ship-2g-browser', cwd: dir, message: { role: 'user', content: 'Read the page text' } },
    { timestamp: ts, type: 'assistant', uuid: 'a1', sessionId: 'ship-2g-browser', cwd: dir, message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'mcp__Claude_Browser__get_page_text', input: { max_chars: 12000 } }] } },
    { timestamp: ts, type: 'user', uuid: 'r1', sessionId: 'ship-2g-browser', cwd: dir, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'Title: RouteLab | Delivery planning\nURL: http://127.0.0.1:8501/\nSource element: <main>\n---\nHello page body\n\nTab Context:\n- url: https://unrelated-tab.invalid/' }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  browserRecording = (await app.ingest.importSource('claude-code', browserPath)).recordingId;
});

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
});

test.afterAll(async () => {
  await server.close();
  await app.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temp path');
  rmSync(dir, { recursive: true, force: true });
});

for (const width of [600, 1440]) {
  test(`unwraps nested MCP results into Markdown/JSON and expands large stored portions without escapes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${mcpRecording}`);
    await expect(page.locator('.history')).toBeVisible();

    const cards = page.locator('article.op-mcp');
    await expect(cards).toHaveCount(3);

    const mdCard = cards.nth(0);
    await mdCard.scrollIntoViewIfNeeded();
    await expect(mdCard.locator('.tool-markdown h2')).toHaveText('Computer Use Environment');
    await expect(mdCard.locator('.tool-markdown')).toContainText('"Ready"');
    expect(await mdCard.textContent()).not.toContain('\\"');
    expect(await mdCard.textContent()).not.toContain('\\n');

    const bigCard = cards.nth(1);
    await bigCard.scrollIntoViewIfNeeded();
    await bigCard.locator('button.op-expand').press('Enter');
    const expanded = bigCard.locator('.op-expanded');
    await expect(expanded.locator('.tool-markdown h2')).toHaveText('Large MCP Markdown');
    expect(await expanded.textContent()).not.toContain('\\n');

    const jsonCard = cards.nth(2);
    await jsonCard.scrollIntoViewIfNeeded();
    await expect(jsonCard.locator('.data-inline')).toBeVisible();
    await expect(jsonCard).toContainText('rows');
    expect(await jsonCard.textContent()).not.toContain('\\"');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`renders bound and mixed Codex exec apply_patch payloads in the diff reader at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${codexExecRecording}`);
    await expect(page.locator('.history')).toBeVisible();

    const editCard = page.locator('article.op-edit').first();
    await editCard.scrollIntoViewIfNeeded();
    await expect(editCard).toHaveAttribute('aria-label', 'Edit src/app.ts');
    await editCard.locator('button.op-expand').press('Enter');
    await expect(editCard.locator('.diff-reader .add')).toContainText('const value = "new";');

    const shellCard = page.locator('article.op-shell').first();
    await shellCard.scrollIntoViewIfNeeded();
    await shellCard.locator('button.op-expand').press('Enter');
    await expect(shellCard.locator('.exec-patch-material .diff-reader .add')).toContainText('const value = "new";');
    expect(await shellCard.locator('.exec-patch-material').textContent()).not.toContain('\\n');

    await page.evaluate(() => window.dispatchEvent(new Event('drishya-commands')));
    const commandsDialog = page.getByRole('dialog', { name: 'Commands', exact: true });
    await expect(commandsDialog).toBeVisible();
    await expect(commandsDialog.locator('.exec-patch-material .diff-reader .add')).toContainText('const value = "new";');
    expect(await commandsDialog.textContent()).not.toContain('\\n');
  });

  test(`shows returned page URL on get_page_text labelled as from result at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${browserRecording}`);
    await expect(page.locator('.history')).toBeVisible();

    const card = page.locator('article.op').first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.browser-address a')).toHaveText('http://127.0.0.1:8501/');
    await expect(card.locator('.browser-address')).toContainText('from result');
    expect(await card.locator('.browser-address').textContent()).not.toContain('unrelated-tab.invalid');
  });
}
