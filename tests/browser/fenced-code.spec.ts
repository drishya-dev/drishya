import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let app: App, server: RunningServer, dir: string, id: string;

const PROSE_SAMPLE = [
  'Overview paragraph establishing the prose reading column measure across the conversation history so wide blocks have a real baseline for comparison.',
  '',
  '```',
  'Unlabelled note with return const 42 and',
  'second line to verify one-line copy.',
  '```',
  '',
  '```plaintext',
  'Plaintext sentence with import from and 99.',
  '```',
  '',
  '```latex',
  '\\section{Notes} const x = 42; return x;',
  '```',
  '',
  '```ts',
  'export const ok = 1;',
  '```',
  '',
  '```typescript',
  'export function summarizeLongConfigurationValuesWithDescriptiveIdentifiers(alphaBetaGammaDeltaEpsilon: number, thetaLambdaMuNuXiOmicron: string) { return `${alphaBetaGammaDeltaEpsilon}:${thetaLambdaMuNuXiOmicron}`; }',
  '```',
  '',
  '```json',
  '{\n  "name": "drishya",\n  "count": 42,\n  "ready": true\n}',
  '```',
  '',
  '```bash',
  '$ corepack pnpm --filter @drishya/ui test && g++ -std=c++17 main.cpp -o main # build',
  '```',
  '',
  '```powershell',
  'PS C:\\repo> Get-ChildItem -Path src | Select-String "FencedCode"',
  '```',
  '',
  '```diff',
  'diff --git a/src/demo.ts b/src/demo.ts',
  '--- a/src/demo.ts',
  '+++ b/src/demo.ts',
  '@@ -1,2 +1,2 @@',
  '-export const oldVal = 1;',
  '+export const newVal = 2;',
  '```',
].join('\n');

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fenced-code-'));
  app = new App(join(dir, 'home'));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(
    journal,
    [
      {
        type: 'session_meta',
        payload: { id: '0199c0de-0000-7000-8000-000000000201', cwd: dir },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: PROSE_SAMPLE }],
        },
      },
    ]
      .map(entry => JSON.stringify(entry))
      .join('\n') + '\n',
  );
  id = (await app.ingest.importSource('codex', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true });
});

for (const width of [600, 1440]) {
  test(`code and text blocks size to content, highlight honestly and keep quiet header at ${width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as unknown as { __copiedText: string }).__copiedText = value;
          },
        },
      });
    });

    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl);
    await page.locator('.home').waitFor();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);

    const blocks = page.locator('.history .prose .fenced-material');
    await expect(blocks).toHaveCount(9);

    const paragraph = page.locator('.history .prose > p').first();
    const pWidth = await paragraph.evaluate(el => el.getBoundingClientRect().width);
    const proseWidth = await page.locator('.history .prose').evaluate(el => el.getBoundingClientRect().width);

    // 1. Plain, unlabelled, and unknown languages have zero syntax spans and expected Wrap defaults.
    for (const [idx, expectedWrap] of [
      [0, true],  // unlabelled
      [1, true],  // plaintext
      [2, false], // unknown latex
    ] as const) {
      const block = blocks.nth(idx);
      await expect(block.locator('pre .tk-kw, pre .tk-str, pre .tk-fn, pre .tk-num, pre .tk-type, pre .tk-property')).toHaveCount(0);
      await expect(block.getByRole('button', { name: 'Wrap', exact: true })).toHaveAttribute('aria-pressed', String(expectedWrap));
    }

    // Multi-line prose offers Copy as one line; single-line plaintext and code blocks do not.
    await expect(blocks.nth(0).getByRole('button', { name: 'Copy as one line', exact: true })).toBeVisible();
    await expect(blocks.nth(1).getByRole('button', { name: 'Copy as one line', exact: true })).toHaveCount(0);
    await expect(blocks.nth(3).getByRole('button', { name: 'Copy as one line', exact: true })).toHaveCount(0);

    // 2. Content sizing: short TS snippet stays compact; long TS snippet caps at prose column & scrolls inside.
    const shortBlock = blocks.nth(3);
    const longBlock = blocks.nth(4);
    const shortWidth = await shortBlock.evaluate(el => el.getBoundingClientRect().width);
    const longWidth = await longBlock.evaluate(el => el.getBoundingClientRect().width);
    expect(shortWidth).toBeLessThan(pWidth * 0.6);
    expect(longWidth).toBeLessThanOrEqual(Math.ceil(Math.min(pWidth, proseWidth)) + 2);
    expect(await longBlock.locator('pre').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);

    // 3. Honest highlighting on known languages: JSON, bash, powershell, diff.
    await expect(blocks.nth(5).locator('pre .tk-property').first()).toHaveText('"name"');
    await expect(blocks.nth(5).locator('pre .tk-str').first()).toHaveText('"drishya"');
    await expect(blocks.nth(6).locator('pre .tk-com').first()).toHaveText('$');
    await expect(blocks.nth(6).locator('pre .tk-fn').first()).toHaveText('corepack');
    await expect(blocks.nth(7).locator('pre .tk-com').first()).toHaveText('PS C:\\repo>');
    await expect(blocks.nth(7).locator('pre .tk-fn').first()).toHaveText('Get-ChildItem');
    await expect(blocks.nth(8).locator('pre .fenced-diff-add')).toHaveCount(1);
    await expect(blocks.nth(8).locator('pre .fenced-diff-del')).toHaveCount(1);

    // 4. All three palettes keep separate surface & clean page geometry with no horizontal page scroll.
    for (const palette of ['jet', 'paper', 'midnight']) {
      await page.evaluate(p => {
        document.documentElement.dataset.palette = p;
        document.documentElement.dataset.theme = p === 'paper' ? 'light' : 'dark';
      }, palette);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const colors = await shortBlock.evaluate(el => {
        const pre = el.querySelector('pre.md-code')!;
        const cs = getComputedStyle(pre);
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        return {
          preBg: cs.backgroundColor,
          bodyBg,
          fontSize: parseFloat(cs.fontSize),
          lineHeight: parseFloat(cs.lineHeight),
          padTop: parseFloat(cs.paddingTop),
          padLeft: parseFloat(cs.paddingLeft),
          btnOpacity: getComputedStyle(el.querySelector('header button')!).opacity,
        };
      });
      expect(colors.preBg).not.toBe(colors.bodyBg);
      expect(colors.fontSize).toBe(12);
      expect(colors.lineHeight).toBeGreaterThanOrEqual(18);
      expect(colors.padTop).toBeGreaterThanOrEqual(10);
      expect(colors.padLeft).toBeGreaterThanOrEqual(12);
      expect(colors.btnOpacity).toBe('0');
    }

    // 5. Hover / focus reveals Wrap and Copy; Copy confirms in place; Copy as one line joins lines cleanly.
    await shortBlock.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.querySelectorAll('.history .prose .fenced-material')[3]!;
      const h = document.querySelector('.history')!;
      h.scrollTop += el.getBoundingClientRect().top - Math.round(innerHeight * 0.45);
    });
    const copyBtn = shortBlock.getByRole('button', { name: 'Copy', exact: true });
    await copyBtn.focus();
    expect(await copyBtn.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
    await copyBtn.click();
    await expect(shortBlock.locator('.fenced-copy-btn')).toHaveText('Copied');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __copiedText: string }).__copiedText)).toBe('export const ok = 1;');

    const proseBlock = blocks.nth(0);
    await page.evaluate(() => {
      const el = document.querySelectorAll('.history .prose .fenced-material')[0]!;
      const h = document.querySelector('.history')!;
      h.scrollTop += el.getBoundingClientRect().top - Math.round(innerHeight * 0.45);
    });
    await proseBlock.getByRole('button', { name: 'Copy as one line', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __copiedText: string }).__copiedText)).toBe(
      'Unlabelled note with return const 42 and second line to verify one-line copy.',
    );
  });
}
