import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined,
    headless: true,
  },
});
