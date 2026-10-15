import { test as base, expect } from '@playwright/test';

/** Keep established presentation regressions on their explicit retained UI.
 * The default observation canvas has its own acceptance journeys. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('drishya-experience-v4', 'classic'));
    await use(page);
  },
});
export { expect };
