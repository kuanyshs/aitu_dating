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
    // Zod idiom: a schema and its inferred type share one name.
    files: ['src/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-redeclare': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/ui/theme/palette.ts',
      'src/ui/strings.ts',
      'src/catalogs/labels.ts',
      'src/repository/mock/seed/**',
      'src/**/*.test.ts',
    ],
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
  {
    // Pure modules stay free of React Native so they can move to a shared package
    // and run in the Node test runner (ADR 0002).
    files: [
      'src/contracts/**/*.ts',
      'src/catalogs/**/*.ts',
      'src/clock/**/*.ts',
      'src/repository/**/*.ts',
      'src/storage/**/*.ts',
    ],
    ignores: ['src/storage/asyncStorage.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native-*',
                'expo',
                'expo-*',
                '@/ui/*',
                '@/app/*',
              ],
              message: 'Pure modules must not depend on React, Expo or UI code.',
            },
          ],
        },
      ],
    },
  },
]);
