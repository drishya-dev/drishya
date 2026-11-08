import { test as base, expect } from '@playwright/test';

/** Shared product fixture: all retained reading regressions run on Release 1 Modern. */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Each browser journey begins with its own reading locations. The daemon is
    // deliberately shared by tests, whereas real users intentionally share recovery.
    // Keep reloads within a journey intact; fresh-workspace covers recovery explicitly.
    let reset: Promise<unknown> | undefined;
    await page.route('**/v1/working-locations', async route => {
      if (route.request().method() === 'GET') {
        // StrictMode can boot twice: every initial read must wait for the same reset.
        reset ??= page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } });
        await reset;
      }
      await route.continue();
    });
    page.on('pageerror', error => console.error('Browser runtime:',error.message));
    await use(page);
  },
});
export { expect };
