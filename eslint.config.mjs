// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Every tsconfig that owns source files; the first one including a file wins. */
const TS_PROJECTS = [
  './tsconfig.json',
  './packages/*/tsconfig.json',
  './packages/infrastructure/src/*/tsconfig.json',
  './packages/*/tsconfig.test.json',
  './apps/desktop/tsconfig.json',
  './apps/desktop/src/*/tsconfig.json',
  './apps/desktop/e2e/tsconfig.json',
];

/**
 * Architectural elements. Clean/Hexagonal layering: dependencies only point inward
 * (domain ← application ← infrastructure/ui ← composition roots in apps/desktop).
 */
const ELEMENTS = [
  { type: 'domain', pattern: 'packages/domain' },
  { type: 'app-testing', pattern: 'packages/application/src/testing' },
  { type: 'application', pattern: 'packages/application' },
  { type: 'contracts', pattern: 'packages/contracts' },
  { type: 'infra-main', pattern: 'packages/infrastructure/src/main' },
  { type: 'infra-pty', pattern: 'packages/infrastructure/src/pty-host' },
  { type: 'infra-renderer', pattern: 'packages/infrastructure/src/renderer' },
  { type: 'ui', pattern: 'packages/ui' },
  { type: 'app-main', pattern: 'apps/desktop/src/main' },
  { type: 'app-preload', pattern: 'apps/desktop/src/preload' },
  { type: 'app-pty-host', pattern: 'apps/desktop/src/pty-host' },
  { type: 'app-renderer', pattern: 'apps/desktop/src/renderer' },
  { type: 'e2e', pattern: 'apps/desktop/e2e' },
];

/**
 * What each element may import: other elements, external packages and Node built-ins.
 * Anything not listed is a lint error.
 */
const ALLOWED = {
  domain: { elements: [], externals: [], core: false },
  application: { elements: ['domain'], externals: [], core: false },
  'app-testing': { elements: ['domain', 'application'], externals: [], core: false },
  contracts: { elements: ['domain'], externals: ['zod'], core: false },
  'infra-main': {
    elements: ['domain', 'application', 'contracts'],
    externals: ['electron', 'zod', 'jsonc-parser'],
    core: true,
  },
  'infra-pty': {
    elements: ['domain', 'application', 'contracts'],
    externals: ['node-pty'],
    core: true,
  },
  'infra-renderer': {
    elements: ['domain', 'application', 'contracts'],
    externals: ['@xterm/*'],
    core: false,
  },
  ui: { elements: ['domain', 'application'], externals: ['react'], core: false },
  'app-main': {
    elements: ['domain', 'application', 'contracts', 'infra-main'],
    externals: ['electron'],
    core: true,
  },
  'app-preload': { elements: ['contracts'], externals: ['electron'], core: false },
  'app-pty-host': {
    elements: ['domain', 'application', 'contracts', 'infra-pty'],
    externals: [],
    core: true,
  },
  'app-renderer': {
    elements: ['domain', 'application', 'contracts', 'infra-renderer', 'ui'],
    externals: ['react', 'react-dom', '@fontsource/*'],
    core: false,
  },
  e2e: { elements: [], externals: ['@playwright/test'], core: true },
};

/** @param {string} type @param {{ elements: string[], externals: string[], core: boolean }} allowed */
function policiesFor(type, allowed) {
  const from = { element: { type } };
  const policies = [];
  if (allowed.elements.length > 0) {
    policies.push({ from, allow: { to: { element: { types: { anyOf: allowed.elements } } } } });
  }
  if (allowed.externals.length > 0) {
    policies.push({
      from,
      allow: { to: { module: { origin: 'external', source: allowed.externals } } },
    });
  }
  if (allowed.core) {
    policies.push({ from, allow: { to: { module: { origin: 'core' } } } });
  }
  return policies;
}

const TEST_POLICIES = [
  {
    from: { file: { categories: 'test' } },
    allow: {
      to: { element: { types: { anyOf: ['app-testing'] } } },
    },
  },
  {
    from: { file: { categories: 'test' } },
    allow: {
      to: { module: { origin: 'external', source: ['vitest', 'fast-check', 'react-dom'] } },
    },
  },
  { from: { file: { categories: 'test' } }, allow: { to: { module: { origin: 'core' } } } },
];

export default defineConfig(
  {
    ignores: [
      'archive/**',
      '**/node_modules/**',
      '**/out/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: TS_PROJECTS,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      'max-params': ['error', 3],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
    ignores: ['**/*.config.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: TS_PROJECTS, noWarnOnMultipleProjects: true },
      },
      'boundaries/elements': ELEMENTS,
      'boundaries/files': [
        { category: 'test', pattern: '**/*.{test,arbitrary}.{ts,tsx}' },
        { category: 'test', pattern: 'packages/ui/src/testing/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          checkUnknownLocals: true,
          policies: [
            ...Object.entries(ALLOWED).flatMap(([type, allowed]) => policiesFor(type, allowed)),
            ...TEST_POLICIES,
          ],
        },
      ],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'apps/desktop/src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
