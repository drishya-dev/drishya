import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// UI-50: Text formatting handled consistently everywhere.
// - Prose: Markdown table renders as structured HTML table with .md-table-scroll.
// - Plan card: Proposal/plan document renders Markdown table as structured HTML table.
// - Shell output: Literal output (stdout) is NEVER re-rendered as Markdown (captured ≠ derived).
//   Table-shaped stdout keeps its line structure unbroken (.output-scroll, white-space: pre),
//   columns stay vertically aligned, and wide rows scroll horizontally within the card.

let dir: string, app: App, server: RunningServer, id: string;

const PROSE_MARKDOWN = [
  '### Performance Benchmark Results',
  '',
  'Here is the verified table in agent prose:',
  '',
  '| Metric | Measured | Target | Verdict |',
  '| :--- | :---: | :---: | :--- |',
  '| First Contentful Paint | 180ms | < 300ms | pass |',
  '| Time to Interactive | 420ms | < 800ms | pass |',
  '| Cumulative Layout Shift | 0.001 | < 0.05 | pass |',
].join('\n');

const PLAN_MARKDOWN = [
  '# Implementation Plan',
  '',
  '| Phase | Deliverable | Status |',
  '| :--- | :--- | :--- |',
  '| 1. Matrix | Audit all 13 text formatting types across 8 surfaces | Complete |',
  '| 2. Alignment | Keep literal output line structure intact with horizontal scroll | Complete |',
  '| 3. Unification | Unify rendered markdown typography between prose and cards | Complete |',
].join('\n');

const SHELL_TABLE = [
  '| Service | Port | Memory | Status | Uptime |',
  '|---|---|---|---|---|',
  '| web-frontend-production-worker-alpha | 3000 | 128MB | running | 14d 6h |',
  '| daemon-backend-service-replica-beta  | 7878 | 64MB  | running | 14d 6h |',
  '| metrics-aggregator-internal-gamma   | 9090 | 256MB | running | 14d 6h |',
].join('\n');

function journal() {
  const base = {
    cwd: '/home/dev/shop',
    sessionId: 'c0ffee00-0000-4000-8000-0000000000e2',
    version: '2.1.0',
    userType: 'external',
    entrypoint: 'cli',
    isSidechain: false,
  };
  let n = 0;
  let parent: string | null = null;
  const rows: string[] = [];

  const push = (type: 'user' | 'assistant', message: object) => {
    const uuid = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    rows.push(JSON.stringify({ ...base, parentUuid: parent, type, message, uuid, timestamp: `2026-09-21T10:00:${String(n).padStart(2, '0')}.000Z` }));
    parent = uuid;
  };

  const use = (name: string, input: object, result: string) => {
    const tool = `toolu_c${n}`;
    push('assistant', {
      id: `msg_${n}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'tool_use', id: tool, name, input }],
      stop_reason: 'tool_use',
    });
    push('user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool, content: result, is_error: false }] });
  };

  push('user', { role: 'user', content: 'Run table command, submit plan, and report performance.' });

  // 1. Shell command printing a table
  use('Bash', { command: 'node table.cjs', description: 'Print status table' }, SHELL_TABLE);

  // 2. Plan mode exit proposing a plan with a table
  use('ExitPlanMode', { plan: PLAN_MARKDOWN, planFilePath: '/home/dev/shop/.claude/plans/ui-50.md' }, 'User has approved your plan. You can now start coding.');

  // 3. Prose message containing a markdown table
  push('assistant', {
    id: `msg_${++n}`,
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: PROSE_MARKDOWN }],
  });

  return rows.join('\n') + '\n';
}

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-formatting-'));
  app = new App(dir);
  server = await startServer({ app, port: 0 });
  const file = join(dir, 'formatting.jsonl');
  writeFileSync(file, journal());
  id = (await app.ingest.importSource('claude-code', file)).recordingId;
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

const settle = async (page: Page, el: Locator) => {
  await el.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(150);
};

const frame = async (el: Locator, name: string) => {
  const out = resolve('.local/ui-50');
  mkdirSync(out, { recursive: true });
  await el.screenshot({ path: join(out, `${name}.png`) });
};

async function openSession(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('article.op').first()).toBeVisible();
}

for (const width of [1440, 600]) {
  test.describe(`Formatting surfaces at ${width}px`, () => {
    test('table in prose renders as structured HTML table with horizontal scroll container', async ({ page }) => {
      await openSession(page, width);
      const prose = page.locator('.prose').first();
      await expect(prose).toBeVisible();
      await settle(page, prose);
      await frame(prose, `prose-table-${width}`);

      const tableContainer = prose.locator('.md-prose-table, .md-document-table');
      await expect(tableContainer).toBeVisible();

      // Renders as a semantic table with thead, tbody, th, td
      const table = tableContainer.locator('table');
      await expect(table).toBeVisible();
      await expect(table.locator('th')).toHaveCount(4);
      await expect(table.locator('th').first()).toHaveText('Metric');
      await expect(table.locator('tbody tr')).toHaveCount(3);
      await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('First Contentful Paint');

      // Scroll container exists and has region role
      const scroller = tableContainer.locator('.md-table-scroll');
      await expect(scroller).toBeVisible();
      await expect(scroller).toHaveAttribute('role', 'region');
      await expect(scroller).toHaveAttribute('aria-label', 'Markdown table');
    });

    test('table in plan card renders as structured HTML table within plan-document', async ({ page }) => {
      await openSession(page, width);
      const planOp = page.locator('article.op-plan').first();
      await expect(planOp).toBeVisible();
      await settle(page, planOp);
      await frame(planOp, `plan-table-${width}`);

      const planDoc = planOp.locator('.plan-document');
      await expect(planDoc).toBeVisible();

      // Renders markdown table inside plan document
      const table = planDoc.locator('table');
      await expect(table).toBeVisible();
      await expect(table.locator('th')).toHaveCount(3);
      await expect(table.locator('th').first()).toHaveText('Phase');
      await expect(table.locator('tbody tr')).toHaveCount(3);
      await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('1. Matrix');

      // Shared table scroll container
      const scroller = planDoc.locator('.md-table-scroll');
      await expect(scroller).toBeVisible();
      await expect(scroller).toHaveAttribute('role', 'region');
    });

    test('table printed to shell stdout stays literal, keeps line structure unbroken, and scrolls horizontally', async ({ page }) => {
      await openSession(page, width);
      const shellOp = page.locator('article.op-shell').first();
      await expect(shellOp).toBeVisible();
      await settle(page, shellOp);
      await frame(shellOp, `shell-table-${width}`);

      // Provenance non-negotiable: captured stdout must NOT be turned into an HTML table
      await expect(shellOp.locator('table')).toHaveCount(0);

      // Rendered as literal pre.output with .output-scroll
      const output = shellOp.locator('pre.output');
      await expect(output).toBeVisible();
      await expect(output).toHaveClass(/output-scroll/);

      // Line structure: white-space is pre and overflow-x is auto
      const styles = await output.evaluate((el) => {
        const computed = getComputedStyle(el);
        return {
          whiteSpace: computed.whiteSpace,
          overflowX: computed.overflowX,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });

      expect(styles.whiteSpace).toBe('pre');
      expect(styles.overflowX).toBe('auto');

      // Lines do not wrap: every line starts at the same horizontal offset
      const lineLefts = await output.locator('span').evaluateAll((spans) => {
        return spans.filter(s => s.textContent?.trim()).map(s => Math.round(s.getBoundingClientRect().left));
      });
      expect(lineLefts.length).toBeGreaterThanOrEqual(4);
      // All lines share the exact same left edge (aligned rows)
      expect(new Set(lineLefts).size).toBe(1);

      // At narrower viewport (e.g. 600px), wide literal table content scrolls horizontally without breaking
      if (width === 600) {
        expect(styles.scrollWidth).toBeGreaterThan(styles.clientWidth);
      }
    });
  });
}
