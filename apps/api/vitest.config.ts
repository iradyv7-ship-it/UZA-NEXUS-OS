import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['test/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // A single fork: the tests share one Postgres database and reset it between files.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['test/setup-env.ts'],
    hookTimeout: 60_000,
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
