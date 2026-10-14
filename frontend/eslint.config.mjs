import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
export default defineConfig([
  js.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { document: 'readonly', window: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', FormData: 'readonly', Response: 'readonly' },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }] },
  },
  globalIgnores(['.next/**', 'out/**']),
]);
