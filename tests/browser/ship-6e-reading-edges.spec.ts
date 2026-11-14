import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
const ids = new Map<string, string>();

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-6e-'));
  const root = join(dir, 'repo');
  mkdirSync(root);
  const srcFile = join(root, 'src', 'engine.ts');
  mkdirSync(join(root, 'src'));
  writeFileSync(srcFile, 'export const version = 1;\n');

  // Claude Code multi-turn session
  const claudeJournal = join(dir, 'claude.jsonl');
  const claudeBase = { cwd: root, sessionId: 'ship-6e-claude', timestamp: '2026-11-10T10:00:00Z' };
  const claudeRows = Array.from({ length: 16 }, (_, n) => [
    { ...claudeBase, type: 'user', uuid: `cu${n}`, message: { role: 'user', content: `Inspect engine turn ${n} carefully across the pipeline.` } },
    { ...claudeBase, type: 'assistant', uuid: `ca${n}`, message: { id: `cm${n}`, role: 'assistant', content: [
      { type: 'text', text: `Turn ${n}: verifying full-height reading edges so fixed controls never overlap prose or operation cards while scrolling.` },
      { type: 'tool_use', id: `cr${n}`, name: 'Read', input: { file_path: srcFile } },
    ] } },
    { ...claudeBase, type: 'user', uuid: `ct${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `cr${n}`, content: `export const line${n} = ${n};\n`.repeat(12) }] } },
  ]).flat();
  writeFileSync(claudeJournal, claudeRows.map(row => JSON.stringify(row)).join('\n') + '\n');

  // Codex multi-turn session
  const codexJournal = join(dir, 'codex.jsonl');
  const codexRows: unknown[] = [
    { timestamp: '2026-11-10T10:00:00Z', type: 'session_meta', payload: { id: 'ship-6e-codex', cwd: root, originator: 'codex_cli_rs', cli_version: '0.50.0' } },
  ];
  for (let n = 0; n < 16; n++) {
    codexRows.push({ timestamp: `2026-11-10T10:${String(n + 1).padStart(2, '0')}:00Z`, type: 'event_msg', payload: { type: 'user_message', message: `Codex turn ${n}: check long history scroll clearance.` } });
    codexRows.push({ timestamp: `2026-11-10T10:${String(n + 1).padStart(2, '0')}:05Z`, type: 'response_item', payload: { type: 'function_call', name: 'shell_command', call_id: `call-${n}`, arguments: JSON.stringify({ command: `echo codex-turn-${n}`, workdir: root }) } });
    codexRows.push({ timestamp: `2026-11-10T10:${String(n + 1).padStart(2, '0')}:06Z`, type: 'response_item', payload: { type: 'function_call_output', call_id: `call-${n}`, output: `Chunked output ${n}\n`.repeat(10) } });
    codexRows.push({ timestamp: `2026-11-10T10:${String(n + 1).padStart(2, '0')}:10Z`, type: 'event_msg', payload: { type: 'agent_message', message: `Completed Codex verification step ${n} with prose that stays clear of chrome.` } });
  }
  writeFileSync(codexJournal, codexRows.map(row => JSON.stringify(row)).join('\n') + '\n');

  app = new App(join(dir, 'data'));
  ids.set('claude-code', (await app.ingest.importSource('claude-code', claudeJournal)).recordingId);
  ids.set('codex', (await app.ingest.importSource('codex', codexJournal)).recordingId);
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

async function openSession(page: Page, harness: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.get(harness)}`);
  await expect(page.locator('.history .passage-slot').first()).toBeVisible();
}

async function measureChromeAndVisibleTextOverlaps(page: Page) {
  return page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('.viewer')!;
    const history = viewer.querySelector<HTMLElement>('.history')!;
    const column = viewer.querySelector<HTMLElement>('.history-inner')!;

    const viewerRect = viewer.getBoundingClientRect();
    const colRect = column.getBoundingClientRect();
    const edgeTopPx = parseFloat(viewer.style.getPropertyValue('--reading-edge-top')) || 0;
    const edgeBottomPx = parseFloat(viewer.style.getPropertyValue('--reading-edge-bottom')) || 0;
    const visibleTop = viewerRect.top + edgeTopPx;
    const visibleBottom = viewerRect.bottom - edgeBottomPx;

    const topSelectors = '.modern-session-header :is(.modern-identity,.studio-session,.studio-actions,.session-connection), .workspace-leading, .workspace-secondary, .modern-review-control > .git-open';
    const bottomSelectors = '.catalog-toggle, .history-transport > .btn, .history-transport .workspace-follow, .history-transport .follow-pill, .follow-pill, .modern-native-composer, .modern-native-composer > .native-turn-details, .modern-native-composer > .queued-input-receipts, .modern-replay-transport';
    const visibleRects = (selector: string, requireColumnOverlap: boolean) => {
      const out: DOMRect[] = [];
      for (const el of viewer.querySelectorAll<HTMLElement>(selector)) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
        if (!el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (requireColumnOverlap && (r.right <= colRect.left + 1 || r.left >= colRect.right - 1)) continue;
        out.push(r);
      }
      return out;
    };

    const topChromes = visibleRects(topSelectors, false).filter((r, i, arr) => {
      const el = viewer.querySelectorAll<HTMLElement>(topSelectors)[i];
      void arr; void el;
      return r.top <= viewerRect.top + viewerRect.height * 0.45;
    });
    const topOverlappingColumn = [
      ...visibleRects('.modern-session-header :is(.modern-identity,.studio-session,.studio-actions,.session-connection)', false),
      ...visibleRects('.workspace-leading, .workspace-secondary, .modern-review-control > .git-open', true),
    ];
    const bottomChromes = visibleRects(bottomSelectors, false);

    // Every overlapping top control's bottom must sit inside the faded top edge (above `visibleTop`),
    // and every visible bottom control's top inside the faded bottom edge (below `visibleBottom`).
    const uncoveredTop = topOverlappingColumn.filter(r => r.bottom > visibleTop + 0.5).length;
    const uncoveredBottom = bottomChromes.filter(r => r.top < visibleBottom - 0.5).length;

    // Collect rects of visible characters inside the unveiled reading area [visibleTop, visibleBottom],
    // then verify none intersects any visible fixed chrome control (topChromes or bottomChromes).
    const allChromes = [...topOverlappingColumn, ...bottomChromes];
    const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let visibleCharIntersections = 0;
    let uncoveredCharIntersections = 0;
    let totalMeasuredRects = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? '';
      if (!text.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        // Clip vertically to the full-strength region (outside the faded reading edges)
        const clippedTop = Math.max(r.top, visibleTop);
        const clippedBottom = Math.min(r.bottom, visibleBottom);
        if (clippedBottom <= clippedTop + 0.5) continue;
        totalMeasuredRects++;
        for (const c of allChromes) {
          if (r.right > c.left + 0.5 && r.left < c.right - 0.5 && clippedBottom > c.top + 0.5 && clippedTop < c.bottom - 0.5) {
            visibleCharIntersections++;
            // Above 820 px text may pass under a control, but only behind that control's own surface: the topmost
            // element at the overlap must belong to the control and sit on a fill of 80 % or more.
            const x = (Math.max(r.left, c.left) + Math.min(r.right, c.right)) / 2, y = (Math.max(clippedTop, c.top) + Math.min(clippedBottom, c.bottom)) / 2;
            let top = document.elementFromPoint(x, y) as HTMLElement | null, surfaced = false;
            if (top && !column.contains(top)) for (let e: HTMLElement | null = top; e && e !== viewer; e = e.parentElement) {
              const bg = getComputedStyle(e).backgroundColor, alpha = /rgba?\(|color\(/.test(bg) ? Number((bg.match(/[\d.]+(?=\)$)/) ?? ['1'])[0]) : 1;
              if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && (bg.includes('/') || bg.startsWith('rgba') ? alpha >= 0.8 : true)) { surfaced = true; break; }
            }
            if (!surfaced) uncoveredCharIntersections++;
          }
        }
      }
    }

    return {
      historyTop: history.getBoundingClientRect().top,
      edgeTopPx,
      edgeBottomPx,
      // UI-39 (Yash, 13 Nov): nothing is painted over the world at the edges; History's own content fades instead.
      paintedEdges: viewer.querySelectorAll('.reading-edge').length,
      historyMask: getComputedStyle(history).maskImage || getComputedStyle(history).getPropertyValue('-webkit-mask-image'),
      historyBackdrop: getComputedStyle(history).backdropFilter,
      uncoveredTop,
      uncoveredBottom,
      visibleCharIntersections,
      uncoveredCharIntersections,
      totalMeasuredRects,
      secondaryButtonsRowAligned: (() => {
        const sec = viewer.querySelector<HTMLElement>('.workspace-secondary');
        if (!sec) return true;
        const buttons = [...sec.querySelectorAll<HTMLElement>('button')].filter(b => b.getClientRects().length);
        return buttons.length < 2 || buttons.every(b => Math.abs(b.getBoundingClientRect().top - buttons[0]!.getBoundingClientRect().top) < 4);
      })(),
      uncoveredTopRaw: topChromes.length,
    };
  });
}

for (const harness of ['claude-code', 'codex'] as const) {
  for (const width of [600, 1440] as const) {
    test(`${harness} reading edges fade history under fixed chrome without text intersection at ${width}px`, async ({ page }) => {
      await openSession(page, harness, width);
      const history = page.locator('.history');
      // Wait for initial virtual layout to settle before scrolling to mid-history
      await page.waitForTimeout(200);
      await history.evaluate(el => {
        el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.45);
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, bubbles: true }));
      });
      await expect(page.getByRole('button', { name: /Back to latest/ })).toBeVisible();
      await page.waitForTimeout(150);

      const m = await measureChromeAndVisibleTextOverlaps(page);
      expect(m.historyTop).toBe(0);
      expect(m.paintedEdges).toBe(0);
      if (width <= 820) {
        // Full strength begins just below the measured top chrome and ends just above the bottom chrome.
        expect(m.historyMask).toContain(`rgb(0, 0, 0) ${m.edgeTopPx + 36}px`);
        expect(m.historyMask).toContain(`calc(100% - ${m.edgeBottomPx + 36}px)`);
      } else expect(m.historyMask, 'wide windows show the work at full strength (Yash, 13 Nov)').toBe('none');
      expect(m.edgeTopPx).toBeGreaterThan(40);
      expect(m.edgeBottomPx).toBeGreaterThan(40);
      expect(m.historyBackdrop).toBe('none');
      expect(m.uncoveredTop).toBe(0);
      expect(m.uncoveredBottom).toBe(0);
      expect(m.totalMeasuredRects).toBeGreaterThan(10);
      if (width <= 820) expect(m.visibleCharIntersections).toBe(0);
      expect(m.uncoveredCharIntersections).toBe(0);
      if (width === 600) expect(m.secondaryButtonsRowAligned).toBe(true);
    });
  }
}

test('the edge fade holds on low-resource machines, and destinations stay clear', async ({ page }) => {
  await openSession(page, 'claude-code', 600);
  const history = page.locator('.history');

  // Destination 1: start of history clears top chrome + fade
  await history.evaluate(el => {
    el.scrollTop = 0;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
  });
  await page.waitForTimeout(150);
  const atStart = await page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('.viewer')!;
    const first = viewer.querySelector<HTMLElement>('.passage-slot .passage')!;
    const topEdge = parseFloat(viewer.style.getPropertyValue('--reading-edge-top')) || 0;
    return { firstTop: first.getBoundingClientRect().top - viewer.getBoundingClientRect().top, topEdge };
  });
  expect(atStart.firstTop).toBeGreaterThanOrEqual(atStart.topEdge);

  // Destination 2: PromptRail jump places prompt clear of top chrome
  const railButtons = page.locator('.history-prompt-marks button');
  await expect(railButtons.nth(4)).toBeVisible();
  await railButtons.nth(4).click();
  await page.waitForTimeout(200);
  const afterJump = await page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('.viewer')!;
    const activeId = document.querySelector('.history-prompt-marks button[aria-current="location"]')?.getAttribute('data-turn-step');
    const slot = [...viewer.querySelectorAll<HTMLElement>('.passage-slot')].find(s => s.querySelector(`.turn`))!;
    void activeId; void slot;
    const rects = [...viewer.querySelectorAll<HTMLElement>('.history-prompt-marks button')];
    const targetIdx = rects.findIndex(b => b.getAttribute('aria-current') === 'location');
    const passages = [...viewer.querySelectorAll<HTMLElement>('.passage-slot')];
    const matching = passages.find(p => {
      const r = p.getBoundingClientRect();
      return r.bottom > viewer.getBoundingClientRect().top + (parseFloat(viewer.style.getPropertyValue('--reading-edge-top')) || 0);
    })!;
    return {
      targetIdx,
      topEdge: parseFloat(viewer.style.getPropertyValue('--reading-edge-top')) || 0,
      firstVisibleBottom: matching.getBoundingClientRect().bottom,
    };
  });
  expect(afterJump.firstVisibleBottom).toBeGreaterThan(afterJump.topEdge);

  // Destination 3: end of history clears bottom chrome + fade
  await page.getByRole('button', { name: /Back to latest/ }).click();
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight))).toBeLessThan(4);
  const atEnd = await page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('.viewer')!;
    const slots = [...viewer.querySelectorAll<HTMLElement>('.passage-slot')];
    const last = slots.at(-1)!.getBoundingClientRect();
    const bottomEdge = parseFloat(viewer.style.getPropertyValue('--reading-edge-bottom')) || 0;
    return { lastBottom: last.bottom, limit: viewer.getBoundingClientRect().bottom - bottomEdge };
  });
  expect(atEnd.lastBottom).toBeLessThanOrEqual(atEnd.limit + 2);

  // Expanding composer updates --reading-edge-bottom to cover grown composer
  await history.evaluate(el => { el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.45); });
  const collapsedBottom = await page.evaluate(() => parseFloat(document.querySelector<HTMLElement>('.viewer')!.style.getPropertyValue('--reading-edge-bottom')));
  await page.getByRole('button', { name: 'Expand prompt', exact: true }).click();
  await page.waitForTimeout(150);
  const openOverlap = await measureChromeAndVisibleTextOverlaps(page);
  expect(openOverlap.uncoveredBottom).toBe(0);
  expect(openOverlap.visibleCharIntersections).toBe(0);
  expect(openOverlap.edgeBottomPx).toBeGreaterThanOrEqual(collapsedBottom);

  // The fade is an alpha mask with no blur, so low-resource machines keep it unchanged.
  await page.evaluate(() => { document.documentElement.dataset.lowResource = '1'; });
  const lowResource = await measureChromeAndVisibleTextOverlaps(page);
  expect(lowResource.historyMask).toContain('linear-gradient');
  expect(lowResource.visibleCharIntersections).toBe(0);
});
