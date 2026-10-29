import { defineConfig } from '@playwright/test';

// TEST-3: most specs start their own daemon on a free port and a temporary store, so files run in parallel. These measure scroll
// position, pacing or motion and fail under CPU contention rather than from a defect; they run alone, after the parallel project.
const timingSensitive = /(b2-live|hover-fit|live-sync|manual-scroll|material-motion|p1-pacing)\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: Number(process.env.DRISHYA_WORKERS || 4),
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.DRISHYA_BROWSER_CHANNEL || undefined,
    headless: true,
  },
  projects: [
    { name: 'parallel', testIgnore: timingSensitive },
    { name: 'serial', testMatch: timingSensitive },
  ],
});
