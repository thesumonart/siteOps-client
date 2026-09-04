import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat config for the SiteOps dashboard.
 *
 * Self-contained on purpose. It began as a shared preset in the monorepo's
 * `packages/config`, and inlining it here is what lets this project install and
 * lint without the server workspace present. Type-aware rules resolve the
 * nearest tsconfig via `projectService`.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.next-e2e/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Only files outside every tsconfig `include` glob belong here. A file
        // that is also in the project service makes typescript-eslint fail, so
        // `.ts` config files are deliberately absent: tsconfig includes them.
        projectService: {
          allowDefaultProject: ['*.config.mts', '*.config.mjs', 'eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `any` defeats the purpose of the strict compiler settings. It is an
      // error, not a warning, so CI blocks it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/e2e/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,

      // Pages Router only. This project is App Router exclusively, and the rule
      // emits a warning about a missing `pages/` directory.
      '@next/next/no-html-link-for-pages': 'off',

      // Server secrets must never be reachable from a client bundle. Only
      // NEXT_PUBLIC_* is legitimate in the browser, and that is enforced by the
      // typed env module rather than ad-hoc process.env reads.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Import from `@/lib/env` instead of reading process.env directly.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*'],
              message: 'Use the `@/` path alias instead of deep relative imports.',
            },
            {
              // The server is a separate deployment with its own repository.
              // Nothing here may reach into it, and nothing here may import a
              // driver that talks to its database — the API is the boundary.
              group: ['@siteops/*', 'mongoose', 'mongodb', '@nestjs/*'],
              message:
                'The frontend talks to siteOps-server over HTTP only. Shared contract types live in `@/contracts`.',
            },
          ],
        },
      ],
    },
  },
  {
    // The env module is where NEXT_PUBLIC_* values are read and validated.
    // Everything downstream imports the validated object instead.
    files: ['**/lib/env.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    /*
     * The end-to-end harness supplies the environment the app is started with
     * rather than consuming the validated one — the same position `env.ts`
     * occupies. It runs in Node, outside the bundle, so the `@/` alias the
     * import rule points at does not resolve there, and its teardown is the one
     * place allowed a database driver: it deletes the accounts the suite
     * creates, and the API offers no route that would.
     */
    files: ['**/playwright.config.ts', '**/e2e/**/*.ts', '**/next.config.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
