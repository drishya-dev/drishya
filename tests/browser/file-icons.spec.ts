import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { openChanges } from './git-navigation.ts';

let dir: string;
let repo: string;
let app: App;
let server: RunningServer;
let recordingId: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });

test.beforeAll(async () => {
  dir = realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()), 'drishya-files17-browser-')));
  repo = join(dir, 'repo');
  mkdirSync(repo, { recursive: true });
  for (const folder of [
    '.github/workflows',
    '.claude',
    'src',
    'docs',
    'tests',
    'scripts',
    'dist',
    'node_modules',
    'public',
    'fixtures',
    'misc',
  ]) {
    mkdirSync(join(repo, folder), { recursive: true });
  }

  const files: Record<string, string> = {
    '.github/workflows/ci.yml': 'name: ci\n',
    '.claude/settings.json': '{}\n',
    'src/app.ts': 'export const app = 1;\n',
    'src/Component.tsx': 'export const Box = () => null;\n',
    'src/types.d.ts': 'export type Id = string;\n',
    'src/util.mjs': 'export const ok = true;\n',
    'src/style.css': 'body { margin: 0; }\n',
    'src/theme.scss': '$accent: #5e6ad2;\n',
    'src/main.py': 'print("ok")\n',
    'src/main.go': 'package main\nfunc main() {}\n',
    'src/lib.rs': 'pub fn ok() -> bool { true }\n',
    'src/query.sql': 'select 1;\n',
    'tests/app.spec.ts': 'export {};\n',
    'scripts/run.sh': '#!/usr/bin/env sh\necho ok\n',
    'scripts/setup.ps1': 'Write-Output "ok"\n',
    'docs/README.md': '# Docs\n',
    'dist/bundle.js': '// out\n',
    'node_modules/pkg.json': '{}\n',
    'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>\n',
    'fixtures/sample.json': '{"ok":true}\n',
    'misc/notes.txt': 'plain text\n',
    'package.json': '{"name":"sample","private":true}\n',
    'pnpm-lock.yaml': 'lockfileVersion: "9.0"\n',
    'tsconfig.json': '{"compilerOptions":{}}\n',
    'vite.config.ts': 'export default {};\n',
    Dockerfile: 'FROM node:24-alpine\n',
    '.env': 'SECRET_PLACEHOLDER=1\n',
    '.gitignore': 'node_modules/\n',
    LICENSE: 'MIT License\n',
  };
  for (const [rel, body] of Object.entries(files)) {
    writeFileSync(join(repo, rel), body);
  }

  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Synthetic');
  git(repo, 'config', 'user.email', 'synthetic@example.invalid');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'Synthetic base');

  // Leave one uncommitted edit + new file for Changes and evidence marks
  writeFileSync(join(repo, 'src/app.ts'), 'export const app = 2;\n');
  writeFileSync(join(repo, 'docs/guide.md'), '# Guide\n');

  const ts = '2026-11-12T10:00:00Z';
  const rows = [
    {
      type: 'user',
      uuid: 'u1',
      sessionId: 'files17-browser',
      cwd: repo,
      timestamp: ts,
      message: { role: 'user', content: 'Inspect the repository files.' },
    },
    {
      type: 'assistant',
      uuid: 'a1',
      sessionId: 'files17-browser',
      cwd: repo,
      timestamp: ts,
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'edit1',
            name: 'Edit',
            input: { file_path: join(repo, 'src/app.ts'), old_string: 'app = 1', new_string: 'app = 2' },
          },
          {
            type: 'tool_use',
            id: 'write1',
            name: 'Write',
            input: { file_path: join(repo, 'docs/guide.md'), content: '# Guide\n' },
          },
        ],
      },
    },
    {
      type: 'user',
      uuid: 'u2',
      sessionId: 'files17-browser',
      cwd: repo,
      timestamp: ts,
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'edit1', content: 'Updated src/app.ts' },
          { type: 'tool_result', tool_use_id: 'write1', content: 'Created docs/guide.md' },
        ],
      },
    },
  ];
  const journal = join(dir, 'claude-files17.jsonl');
  writeFileSync(journal, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');

  app = new App(join(dir, 'store'));
  recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir && resolve(dir).startsWith(realpathSync.native(tmpdir()) + sep)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function openFiles(page: Page, width: number) {
  await page.setViewportSize({ width, height: 920 });
  await page.route('**/v1/working-locations', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue(),
  );
  await page.goto(server.launchUrl);
  await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
  await page.locator('.viewer').waitFor();

  const explorer = page.locator('.folder-explorer');
  if (!(await explorer.isVisible())) {
    await page.getByRole('button', { name: 'Show files', exact: true }).click();
  }
  await expect(explorer).toBeVisible();
  const enableBtn = explorer.getByRole('button', { name: /Enable workspace reading/i });
  if (await enableBtn.count()) {
    await enableBtn.click();
    await expect(explorer).toHaveAttribute('data-reading-access', 'current');
  }
  await expect(explorer.locator('[data-spine-path="package.json"]')).toBeVisible();
  return explorer;
}

for (const width of [600, 1440] as const) {
  test(`file and folder icons render across Explorer, peek, Search, Workspace and Changes without changing row height at ${width}px`, async ({ page }) => {
    const explorer = await openFiles(page, width);

    for (const palette of ['jet', 'midnight', 'paper'] as const) {
      await page.evaluate((p) => {
        document.documentElement.dataset.palette = p;
        document.documentElement.dataset.theme = p === 'paper' ? 'light' : 'dark';
      }, palette);
      await expect(explorer.locator('[data-spine-path="package.json"] svg.file-format.format-manifest')).toBeVisible();
      await expect(explorer.locator('[data-spine-path="pnpm-lock.yaml"] svg.file-format.format-lock')).toBeVisible();
      await expect(explorer.locator('[data-spine-path="tsconfig.json"] svg.file-format.format-config')).toBeVisible();
      await expect(explorer.locator('[data-spine-path="vite.config.ts"] svg.file-format.format-config')).toBeVisible();
      await expect(explorer.locator('[data-spine-path=".env"] svg.file-format.format-env')).toBeVisible();
      await expect(explorer.locator('[data-spine-path=".gitignore"] svg.file-format.format-git')).toBeVisible();
      await expect(explorer.locator('[data-spine-path="LICENSE"] svg.file-format.format-license')).toBeVisible();
      await expect(explorer.locator('[data-spine-path="Dockerfile"] svg.file-format.format-docker')).toBeVisible();
      await expect(explorer.locator('[data-tree-path="docs"] svg.file-format.format-folder.folder-docs')).toBeVisible();
      await expect(explorer.locator('[data-tree-path="scripts"] svg.file-format.format-folder.folder-scripts')).toBeVisible();
      await expect(explorer.locator('[data-tree-path="tests"] svg.file-format.format-folder.folder-tests')).toBeVisible();
      await expect(explorer.locator('[data-tree-path="misc"] svg.file-format.format-folder:not([class*="folder-"])')).toBeVisible();
    }

    // Row height stays uniform across folder, marked folder, and file formats
    const heights = await page.evaluate(() => {
      const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().height ?? 0;
      return {
        plainFolder: box('[data-tree-path="misc"]'),
        docsFolder: box('[data-tree-path="docs"]'),
        manifestFile: box('[data-spine-path="package.json"]'),
        lockFile: box('[data-spine-path="pnpm-lock.yaml"]'),
        dotEnvFile: box('[data-spine-path=".env"]'),
      };
    });
    expect(heights.plainFolder).toBeGreaterThan(20);
    expect(Math.abs(heights.plainFolder - heights.docsFolder)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(heights.manifestFile - heights.lockFile)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(heights.plainFolder - heights.manifestFile)).toBeLessThanOrEqual(0.5);

    // Expand src/ and confirm edited file shows E mark louder/distinct from icon
    await explorer.locator('[data-tree-path="src"]').click();
    const editedRow = explorer.locator('[data-spine-path="src/app.ts"]');
    await expect(editedRow).toBeVisible();
    await expect(editedRow.locator('svg.file-format.format-ts')).toBeVisible();
    await expect(editedRow.locator('.file-change.change-E')).toHaveText('E');
    const [iconColor, markColor] = await editedRow.evaluate((row) => {
      const icon = row.querySelector('svg.file-format')!;
      const mark = row.querySelector('.file-change.change-E')!;
      return [getComputedStyle(icon).color, getComputedStyle(mark).color];
    });
    expect(iconColor).not.toBe(markColor);

    // Click src/app.ts to open file peek tab and confirm its format icon
    await editedRow.click();
    const peekTab = page.locator('.file-peek-tab[data-peek-path="src/app.ts"]');
    await expect(peekTab).toBeVisible();
    await expect(peekTab.locator('svg.file-format.format-ts')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

    // Open in Workspace to confirm Workspace tab icon, then return to agent and close peek
    const wsBtn = page.getByRole('button', { name: 'Open in Workspace', exact: true });
    if (await wsBtn.count() && await wsBtn.isEnabled()) {
      await wsBtn.click();
      await expect(page.locator('.desk-tab[data-workspace-tab="src/app.ts"] svg.file-format.format-ts')).toBeVisible();
      await page.getByRole('button', { name: 'Back to agent', exact: true }).click();
      await expect(page.locator('.developer-workspace')).toHaveCount(0);
    }
    const closePeek = page.locator('.current-file-reader .dialog-close').last();
    if (await closePeek.count()) await closePeek.click();
    else await page.keyboard.press('Escape');
    await expect(page.locator('.current-file-reader')).toHaveCount(0);

    // Open Command Navigation (Ctrl+K) to verify search result icons
    await page.keyboard.press('Control+k');
    const navInput = page.getByRole('combobox', { name: 'Find a command, file or session' });
    await expect(navInput).toBeVisible();
    await navInput.fill('guide.md');
    await expect(page.locator('[role="option"]').filter({ hasText: 'guide.md' }).first().locator('svg.file-format.format-md')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(navInput).toHaveCount(0);

    // Open Changes and verify file icons inside Uncommitted review list
    const review = await openChanges(page, 'Uncommitted');
    const gitStatus = await (await page.request.get(`${server.url}/v1/recordings/${recordingId}/git`)).json();
    if (!gitStatus.approved) {
      await review.getByRole('button', { name: 'Approve read-only Git', exact: true }).click();
    }
    await expect(review.locator('.compare-body')).toBeVisible();
    await expect(review.locator('svg.file-format').first()).toBeVisible();
    await page.keyboard.press('Escape');

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}
