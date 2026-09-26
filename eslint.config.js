// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

const HEX_OR_RGB = '/^(#[0-9a-fA-F]{3,8}|rgba?\\()/';
const CYRILLIC = '/[А-Яа-яЁё]/';

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', '.claude/*', 'playwright-report/*', 'test-results/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/theme/palette.ts', 'src/ui/strings.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${HEX_OR_RGB}]`,
          message: 'Use theme tokens instead of raw colors (only palette.ts may hold colors).',
        },
        {
          selector: `Literal[value=${CYRILLIC}]`,
          message: 'UI copy lives in src/ui/strings.ts.',
        },
        {
          selector: `JSXText[value=${CYRILLIC}]`,
          message: 'UI copy lives in src/ui/strings.ts.',
        },
      ],
    },
  },
]);
