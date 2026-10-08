import type { Locator, Page } from '@playwright/test';

/** Point at the exposed history gutter, below responsive chrome and inside native scrollbars. */
export async function pointAtHistory(page: Page, history: Locator = page.locator('.history')) {
  const point = await history.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect();
    return { x: rect.x + el.clientWidth - 4, y: Math.min(rect.bottom - 24, Math.max(rect.top, header?.bottom ?? rect.top) + 40) };
  });
  await page.mouse.move(point.x, point.y);
}
