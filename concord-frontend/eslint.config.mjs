import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off', // Next.js auto-generates these references
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      // Test files use require() for mocking patterns (jest.mock, vi.mock)
      '@typescript-eslint/no-require-imports': 'off',
      // Test files use anonymous arrow function components in mocks
      'react/display-name': 'off',
    },
  },
  {
    ignores: ['node_modules/', '.next/', 'out/', 'dist/', 'build/', '*.min.js'],
  },
];

export default eslintConfig;
