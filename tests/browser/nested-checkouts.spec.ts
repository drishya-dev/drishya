import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildGraph } from '../../packages/indexer/src/index.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, app: App, server: RunningServer, id: string, own = 0;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-nested-checkouts-'));
  root = join(dir, 'shop');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), root, { recursive: true });
  // The project's own files, counted before any agent worktree exists.
  own = (await buildGraph(root)).nodes.length;
  // An agent worktree: a complete copy of the project inside it, with its own `.git` file.
  const copy = join(root, '.claude', 'worktrees', 'agent-a');
  cpSync(resolve('fixtures/synthetic/workspace/shop'), copy, { recursive: true });
  writeFileSync(join(copy, '.git'), 'gitdir: /elsewhere/.git/worktrees/agent-a\n');
  const journal = join(dir, 'synthetic.jsonl');
  writeFileSync(journal, readFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'), 'utf8').replaceAll('/home/dev/shop', root.replaceAll('\\', '/')));
  app = new App(join(dir, 'store'));
  id = (await app.ingest.importSource('codex', journal)).recordingId;
  await app.approveGraphRoot(id, root);
  server = await startServer({ app, port: 0, token: 'synthetic-nested-checkouts' });
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
  }
});

// INDEX-1: an agent worktree inside the workspace is another checkout. The map and the Files tree list the project's own
// files once, and the map says what it left out.
for (const [width, height] of [[1440, 900], [600, 720]] as const)
  test(`the map and the Files tree leave out an agent worktree and say so at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    // Wait for the session's work, not only the history frame: opening restores the session's saved location (Explore
    // included) when the projection lands, so a click before that was undone on a slow runner (macOS, 18 Nov).
    await expect(page.locator('.history article[data-op-id]').first()).toBeVisible();
    const explore = page.getByRole('button', { name: 'Explore repository map', exact: true });
    await explore.click();
    await expect(explore).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.map-legend')).toContainText(`${own} files`);
    await expect(page.locator('.map-legend')).toContainText('1 nested checkout not shown');
    await page.getByRole('button', { name: 'Show files', exact: true }).click();
    const tree = page.getByRole('complementary', { name: 'Repository files', exact: true });
    await expect(tree).toBeVisible();
    await expect(tree.getByText('worktrees', { exact: true })).toHaveCount(0);
    await expect(tree.getByText('agent-a', { exact: true })).toHaveCount(0);
  });
