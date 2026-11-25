import { defineConfig } from 'vitest/config';
import { availableParallelism } from 'node:os';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/daemon/test/**/*.test.ts', 'apps/ui/test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit-setup.ts'],
    pool: 'forks',
    // Windows Git suites start many native processes per file. Keep the local
    // full run within the measured concurrency while retaining CLI overrides.
    ...(process.platform === 'win32' ? { maxWorkers: Math.max(1, Math.min(4, availableParallelism() - 1)) } : {}),
  },
});
