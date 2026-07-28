// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/node_modules/**',
      'eslint.config.js',
      '**/next-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
);
