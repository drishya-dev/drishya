import { defineConfig } from '@playwright/test';

// TEST-3: most specs start their own daemon on a free port and a temporary store, so files run in parallel. These measure scroll
// position, pacing or motion and fail under CPU contention rather than from a defect; they run alone, after the parallel project.
const timingSensitive = /(b2-live|conversation-scroll|hover-fit|live-sync|manual-scroll|material-motion|p1-pacing)\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/browser',
  // SHIP-16: ready stand-in `claude` and `codex` on PATH so the composer does not depend on the machine's installs.
  globalSetup: './tests/browser/global-setup.ts',
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
    // The serial pass starts a second Playwright process. Keep the parallel failure artifacts available for CI upload.
    { name: 'parallel', testIgnore: timingSensitive, outputDir: './test-results/parallel' },
    { name: 'serial', testMatch: timingSensitive, outputDir: './test-results/serial' },
  ],
});
