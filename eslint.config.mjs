// @ts-check
import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One ESLint configuration for the whole repository. Sub-projects do not carry their own.
 *
 * This is deliberately the type-aware ruleset, not a style pack. The rules below are the
 * ones that catch bugs — a dropped promise, an unchecked `any` crossing a trust boundary —
 * rather than the ones that argue about quotes. Formatting is prettier's job and is kept
 * out of eslint entirely so the two cannot disagree.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.output/**',
      '**/coverage/**',
      '**/routeTree.gen.ts',
      'backend/api/prisma/migrations/**',
      'eslint.config.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A variable read inside a closure before its single assignment is not a const candidate.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
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
    // Browser code: React components and hooks in every frontend app.
    files: ['frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // A spec may build a deliberately wrong value to prove the code rejects it.
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
