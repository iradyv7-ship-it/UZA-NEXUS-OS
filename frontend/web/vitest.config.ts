import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Tests for the web app's pure logic — formatting, permission mirrors, derivations.
 *
 * Deliberately node, not jsdom. These cover the code where a mistake is silent and
 * expensive: a masked field rendering a real number, or a role being offered an action it
 * cannot perform. Component rendering can be added later with jsdom + testing-library;
 * starting there would have cost more setup and covered less risk.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
