import { expect, type Locator, type Page } from '@playwright/test';

/** Point at the exposed history gutter, below responsive chrome and inside native scrollbars. */
export async function pointAtHistory(page: Page, history: Locator = page.locator('.history')) {
  let point:{x:number;y:number}|undefined;
  await expect.poll(async()=>{point=await history.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect();
    const top=Math.max(rect.top+40,Math.min(header?.bottom??rect.top,rect.top+120));
    // Floating Modern controls can cover the old fixed gutter point. Pick a real
    // history target so the test's wheel reaches history, rather than a dock.
    for(const x of [rect.x+el.clientWidth-4,rect.x+el.clientWidth-24,rect.x+4]){
      for(let y=top;y<rect.bottom-24;y+=40){
        const hit=document.elementFromPoint(x,y);
        if(hit&&(hit===el||hit.closest('.connected-workspace'))&&!hit.closest('article,.prose,.turn-text,.prompt-rail,.prompt-composer,.folder-explorer,.modern-tool-station,dialog,button,input,textarea,select,summary,[role=complementary],[role=navigation]'))return {x,y};
      }
    }
    return undefined;
  });return !!point;},{message:'An exposed history gutter after floating chrome settles'}).toBe(true);
  await page.mouse.move(point!.x, point!.y);
}

/** Expand a history card with the keyboard. A pointer would come to rest on the card, where hover reading
 * can engage after its dwell and move the card under the next click; follow-up actions use `press` too. */
export async function expandCard(card: Locator) {
  const expand = card.locator('button.op-expand');
  await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
}

/** Sample every mounted material, not only the first visible item: a whole-card
 * jump can replace that first item and make a first-item-only check pass. */
export async function beginReadingSamples(page: Page) {
  await page.evaluate(() => {
    const samples = { frames: 0, jumps: [] as { before: number; after: number }[], running: true };
    (window as any).__readingSamples = samples;
    let previous = new Map<string, number>();
    const tick = () => {
      if (!samples.running) return;
      const history = document.querySelector('.history');
      if (!history) { samples.jumps.push({ before: 0, after: Infinity }); return; }
      const bounds = history.getBoundingClientRect();
      const next = new Map<string, number>();
      for (const node of history.querySelectorAll<HTMLElement>('[data-op-id],[data-prose-id]')) {
        const id = node.dataset.opId ?? node.dataset.proseId!;
        const top = node.getBoundingClientRect().top;
        const before = previous.get(id);
        if (before !== undefined && before > bounds.top + 40 && before < bounds.bottom - 140 && (top - before < -5 || top - before > 200)) samples.jumps.push({ before, after: top });
        next.set(id, top);
      }
      previous = next;
      samples.frames++;
      // ResizeObserver runs after RAF callbacks and before paint. Sample from a
      // task after that rendering step, not its deliberately uncorrected geometry.
      requestAnimationFrame(() => setTimeout(tick, 0));
    };
    requestAnimationFrame(() => setTimeout(tick, 0));
  });
}

export async function finishReadingSamples(page: Page): Promise<{ frames: number; jumps: { before: number; after: number }[] }> {
  return page.evaluate(() => {
    const samples = (window as any).__readingSamples;
    samples.running = false;
    return { frames: samples.frames, jumps: samples.jumps };
  });
}
