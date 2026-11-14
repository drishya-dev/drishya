import { defineConfig } from 'vitest/config';

// SEC-3: the security suite. Kept out of the default `pnpm test` run (which would otherwise start
// a daemon per file); `pnpm test:security` and `package:verify` run it. Files run one at a time so the
// scratch daemons, timing tests and process-wide environment never overlap.
export default defineConfig({
  test: {
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
