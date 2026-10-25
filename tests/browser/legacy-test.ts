import { test as base, expect } from '@playwright/test';

/** Keep established presentation regressions on their explicit retained UI.
 * The default observation canvas has its own acceptance journeys. */
export const test = base.extend({
  page: async ({ page }, use) => {
    // UI-4: a saved Legacy choice applies only with the developer switch (Modern is the only product choice).
    await page.addInitScript(() => { localStorage.setItem('drishya-experience-v4', 'classic'); localStorage.setItem('drishya-dev-ui-versions', '1'); });
    // Each browser journey begins with its own reading locations. The daemon is
    // deliberately shared by tests, whereas real users intentionally share recovery.
    // Keep reloads within a journey intact; fresh-workspace covers recovery explicitly.
    let first = true;
    await page.route('**/v1/working-locations', async route => {
      if (first && route.request().method() === 'GET') {
        first = false;
        await page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } });
      }
      await route.continue();
    });
    page.on('pageerror', error => console.error('Browser runtime:',error.message));
    await use(page);
  },
});
export { expect };
