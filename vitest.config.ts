import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/daemon/test/**/*.test.ts', 'apps/ui/test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit-setup.ts'],
    pool: 'forks',
  },
});
