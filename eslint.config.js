// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/.expo/**',
      '**/node_modules/**',
      'eslint.config.js',
      '**/next-env.d.ts',
      '**/metro.config.js',
    ],
  },
  ...tseslint.configs.recommended,
  {
    // expo-font's useFonts needs static require() calls for Metro to bundle the assets.
    files: ['apps/mobile-donor/App.tsx', 'apps/mobile-institution/App.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
