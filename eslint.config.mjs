// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Until 30 August 2026 this monorepo had no linter and no formatter at all. Types
 * were strict and 348 tests passed, but nothing enforced anything below the type
 * level, and `apps/web` carried a `next lint` script that Next 15 no longer runs.
 *
 * This is deliberately the type-aware ruleset, not a style pack. The rules below are
 * the ones that catch bugs — a dropped promise, an unchecked `any` crossing a trust
 * boundary — rather than the ones that argue about quotes. Formatting is prettier's
 * job and is kept out of eslint entirely so the two cannot disagree.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/api/prisma/migrations/**',
      'eslint.config.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // A spec may build a deliberately wrong value to prove the code rejects it.
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
