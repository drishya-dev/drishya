import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';

// PERF-4: a large recording opens from its latest prompts; when the whole history is ready it replaces them once, and the
// reader does not notice: the passage on screen stays at the same pixels, nothing is requested again, nothing arrives or
// flashes. The size is tuned down (and the background fold held for a moment) so a synthetic journal takes the path a
// 300 MB one does and the page can be looked at before and after.
// Past the 10,000 observations at which the page reads a recording through the paged history.
const TURNS = 3200;

function journalText(): string {
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-0000000000bb', version: '2.1.0' };
  const rows: unknown[] = [];
  let n = 0;
  const at = () => new Date(Date.UTC(2026, 10, 14, 9, 0, 0) + n++ * 1000).toISOString();
  const id = (t: number, k: number) => `00000000-0000-4000-8000-${String(t * 10 + k).padStart(12, '0')}`;
  const nl = String.fromCharCode(10);
  for (let t = 0; t < TURNS; t++) {
    rows.push({ ...base, uuid: id(t, 1), timestamp: at(), type: 'user', message: { role: 'user', content: `prompt number ${t}` } });
    rows.push({ ...base, uuid: id(t, 2), timestamp: at(), type: 'assistant', message: { id: `msg-${t}-a`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: `call-${t}`, name: 'Read', input: { file_path: `/home/dev/shop/src/file-${t}.ts` } }] } });
    rows.push({ ...base, uuid: id(t, 3), timestamp: at(), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `call-${t}`, content: Array.from({ length: t > TURNS - 12 ? 14 : 2 }, (_, i) => `  ${i + 1}${String.fromCharCode(9)}export const value${t}_${i} = ${i};`).join(nl) }] } });
    rows.push({ ...base, uuid: id(t, 4), timestamp: at(), type: 'assistant', message: { id: `msg-${t}-b`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: Array.from({ length: t > TURNS - 12 ? 6 : 1 }, (_, i) => `answer ${t}, paragraph ${i}: a few sentences of reading material so the passage has some height.`).join(nl + nl) }] } });
  }
  return rows.map((row) => JSON.stringify(row)).join(nl) + nl;
}

for (const [label, viewport] of [['1440', { width: 1440, height: 900 }], ['600', { width: 600, height: 800 }]] as const) {
  test(`the swap to the whole history is quiet at ${label} px`, async ({ page }) => {
    const saved = { first: process.env.DRISHYA_TAIL_FIRST, prompts: process.env.DRISHYA_TAIL_PROMPTS, hold: process.env.DRISHYA_TAIL_HOLD_MS };
    process.env.DRISHYA_TAIL_FIRST = '1'; process.env.DRISHYA_TAIL_PROMPTS = '6'; process.env.DRISHYA_TAIL_HOLD_MS = '4500';
    const dir = mkdtempSync(join(tmpdir(), 'drishya-perf4-swap-'));
    const journal = join(dir, 'session.jsonl');
    writeFileSync(journal, journalText());
    const app = new App(join(dir, 'data'));
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    try {
      const { recordingId } = await app.ingest.importSource('claude-code', journal);
      server = await startServer({ app, port: 0, token: 'synthetic-perf4' });
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        const original = window.fetch.bind(window);
        const w = window as unknown as { __history: { at: number; partial: boolean }[] };
        w.__history = [];
        window.fetch = async (...args: Parameters<typeof fetch>) => {
          const response = await original(...args);
          if (String(args[0]).endsWith('/history') && args[1]?.body) void response.clone().json().then((body: { partial?: unknown }) => w.__history.push({ at: performance.now(), partial: !!body.partial }));
          return response;
        };
      });
      await page.goto(server.launchUrl);
      await expect(page.locator('.mh-home')).toBeVisible();
      await page.goto(new URL(`/#/r/${recordingId}`, server.launchUrl).href);
      // The latest work is on screen at once, from the recent-first page.
      await expect(page.locator('.history')).toContainText(`answer ${TURNS - 1}, paragraph 5`);
      const state = () => page.evaluate(() => (window as unknown as { __history: { partial: boolean }[] }).__history.map((h) => h.partial));
      expect((await state())[0]).toBe(true);
      // Let the first page settle (the follow camera and the measuring of the passages), then watch every frame until a
      // second after the whole history lands. The baseline is the passage's place in the last frame before the swap.
      await page.evaluate(() => new Promise<void>((done) => {
        // Armed once the follow camera is still (the swap must be measured against a view that is at rest).
        const scroller = document.querySelector<HTMLElement>('.history')!;
        let last = -1, still = 0;
        const poll = () => { const now = scroller.scrollTop + scroller.scrollHeight; still = now === last ? still + 1 : 0; last = now; if (still >= 30) done(); else requestAnimationFrame(poll); };
        requestAnimationFrame(poll);
      }));
      const observed = await page.evaluate(() => new Promise<{ anchor: string; before: number; worst: number; arrivalsBefore: number; first: number; last: number; shift: number; textBefore: string; textAfter: string; htmlBefore: string; htmlAfter: string; trace: string; arrivals: number; unloaded: number; requestsAfter: number }>((resolve) => {
        const w = window as unknown as { __history: { at: number; partial: boolean }[] };
        const scroller = document.querySelector<HTMLElement>('.history')!;
        const slot = () => {
          const top = scroller.getBoundingClientRect().top;
          return [...scroller.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]:not([data-unloaded])')].find((item) => item.getBoundingClientRect().bottom > top + 1);
        };
        const anchor = slot()!.dataset.passageId!;
        const offsetOf = () => {
          const node = [...scroller.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((item) => item.dataset.passageId === anchor);
          return node ? node.getBoundingClientRect().top - scroller.getBoundingClientRect().top : undefined;
        };
        const startHeight = scroller.scrollHeight;
        const slotOf = () => [...scroller.querySelectorAll<HTMLElement>('.passage-slot[data-passage-id]')].find((item) => item.dataset.passageId === anchor);
        const textBefore = slotOf()!.innerText, htmlBefore = slotOf()!.innerHTML;
        const arrivalsBefore = scroller.querySelectorAll('.arriving, .op.resolving').length;
        let before = offsetOf()!;
        // What is painted, not what a frame callback sees mid-frame: the browser's own layout-shift entries (scroll-compensated).
        new PerformanceObserver((list) => { for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] }[]) if (swapped && !entry.hadRecentInput && entry.sources?.some((source) => source.node && scroller.contains(source.node))) shift += entry.value; }).observe({ type: 'layout-shift', buffered: false });
        const trace: string[] = []; const ring: string[] = []; let lastTrace = '';
        let worst = 0, first = NaN, last = NaN, shift = 0, arrivals = 0, unloaded = 0, swapped = false, swapAt = 0, requestsAtSwap = 0;
        const frame = () => {
          const offset = offsetOf();
          if (!swapped) {
            if (scroller.scrollHeight > startHeight * 3) { swapped = true; swapAt = performance.now(); requestsAtSwap = w.__history.length; }
            else if (offset !== undefined) { if (before !== offset) { ring.push(`${Math.round(performance.now())}:${Math.round(offset)}/st${Math.round(scroller.scrollTop)}`); if (ring.length > 8) ring.shift(); } before = offset; }
          }
          if (swapped) {
            if (offset !== undefined) { worst = Math.max(worst, Math.abs(offset - before)); if (Number.isNaN(first)) first = offset; last = offset; }
            const box0 = scroller.getBoundingClientRect(); const mark = `${Math.round(offset ?? -99999)}/${Math.round(scroller.scrollHeight / 1000)}k[${[...scroller.querySelectorAll<HTMLElement>('.passage-slot')].map((it) => `${it.dataset.passageId!.slice(-4)}${it.dataset.unloaded ? 'u' : ''}:${Math.round(it.getBoundingClientRect().height)}@${Math.round(it.getBoundingClientRect().top - box0.top)}`).join(' ')}]`;
            if (mark !== lastTrace && trace.length < 25) { lastTrace = mark; trace.push(`${Math.round(performance.now() - swapAt)}ms ${mark}`); }
            arrivals = Math.max(arrivals, scroller.querySelectorAll('.arriving, .op.resolving').length);
            const box = scroller.getBoundingClientRect();
            unloaded = Math.max(unloaded, [...scroller.querySelectorAll<HTMLElement>('.passage-slot[data-unloaded]')].filter((item) => { const r = item.getBoundingClientRect(); return r.bottom > box.top && r.top < box.bottom; }).length);
            if (performance.now() - swapAt > 1200) return resolve({ anchor, before, worst, arrivalsBefore, first, last, shift, textBefore, textAfter: slotOf()?.innerText ?? '', htmlBefore, htmlAfter: slotOf()?.innerHTML ?? '', trace: `pre[${ring.join(' ')}] ` + trace.join(' | '), arrivals, unloaded, requestsAfter: w.__history.length - requestsAtSwap });
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }));
      const lineBreak = String.fromCharCode(10);
      expect(observed.textAfter.split(lineBreak), 'the same material, with the same words').toEqual(observed.textBefore.split(lineBreak));
      // (data-cut is the reader's own measurement mark on a clamped result; it follows from measuring, not from the material.)
      const bare = (html: string) => html.replace(/ style="[^"]*"/g, '').replace(/ data-cut=""/g, '');
      expect(bare(observed.htmlAfter)).toBe(bare(observed.htmlBefore));
      // Placed exactly where it was in the last frame before the swap, held there through the settling, nothing painted moved.
      expect(Math.abs(observed.first - observed.before), `the passage on screen jumped at the swap (${observed.trace})`).toBeLessThanOrEqual(2);
      expect(Math.abs(observed.last - observed.first), `the passage on screen drifted after the swap (${observed.trace})`).toBeLessThanOrEqual(1);
      expect(observed.shift, `painted layout shift at the swap (${observed.trace})`).toBeLessThan(0.01);
      expect(observed.arrivals, 'the swap replayed an arrival').toBeLessThanOrEqual(observed.arrivalsBefore);
      expect(observed.unloaded, 'a placeholder flashed in view').toBe(0);
      expect(observed.requestsAfter, 'the swap asked for more pages').toBe(0);
      // Earlier history joined above without moving the view: the document is far taller than the latest work alone.
      expect(await page.locator('.history').evaluate((el) => el.scrollHeight)).toBeGreaterThan(20_000);
      // Replay waits for the whole history only while it is partial; now it is available.
      await expect(page.locator('.history')).toContainText(`answer ${TURNS - 1}, paragraph 5`);
    } finally {
      for (const [key, value] of [['DRISHYA_TAIL_FIRST', saved.first], ['DRISHYA_TAIL_PROMPTS', saved.prompts], ['DRISHYA_TAIL_HOLD_MS', saved.hold]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      await server?.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
