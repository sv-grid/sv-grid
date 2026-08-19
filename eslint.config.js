// @ts-check
/**
 * Root ESLint config (flat). Shared by every workspace package; `packages/grid`
 * layers the Svelte plugin on top of it.
 *
 * Deliberately NOT type-aware: the type-checking rules need a TS program per
 * package and would duplicate what `pnpm test:types` (tsc + svelte-check)
 * already does across 3000+ files. This pass catches the things the compiler
 * does not - unused code, sloppy equality, accidental globals.
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/.vite/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Static templates shipped verbatim by the create-* scaffolders.
      'packages/create-*/templates/**',
      // Generated bundles + vendored artifacts. `smart.export.js` is a minified
      // third-party build (Smart UI) whose own header says do not edit; its only
      // modification surface is smart-shim.ts.
      '**/*.min.js',
      'packages/enterprise/src/smart.export.js',
      'website/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // TypeScript resolves identifiers far better than this rule can - it knows
    // the DOM lib types (`AutoFill`), ambient declarations and project globals.
    // Only .ts is claimed here: naming `**/*.svelte` would make this config
    // match Svelte files in packages that have no Svelte parser configured,
    // turning "not linted" into a parse error for every component.
    files: ['**/*.ts', '**/*.tsx'],
    rules: { 'no-undef': 'off' },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // An unused symbol is usually a leftover; allow a leading _ to mark
      // "intentionally ignored" (rest-siblings omit, unused catch binding).
      // A leading _ marks "intentionally ignored". `T` + capital is the type
      // parameter convention: a public generic like `BoardConfig<TFeatures>` may
      // not reference the parameter in its body, but dropping it from the
      // signature would break every caller that passes one.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^(_|T[A-Z])', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // Two deliberate uses: a literal U+FEFF in a regex strips a byte-order
      // mark from fetched markdown, and a zero-width space breaks up a literal
      // closing script tag in a comment so the Svelte parser cannot see it.
      'no-irregular-whitespace': ['error', { skipRegExps: true, skipComments: true }],
      'no-var': 'error',
      // Flags the standard keyboard-handler shape, where a seed value is dead
      // only because the final `else return` bails on every other key:
      //   let delta = 0
      //   if (key === 'Left') delta = -step
      //   else if (key === 'Right') delta = step
      //   else return
      // Dropping the seed buys nothing and costs the type inference that makes
      // it readable, so this stays advisory rather than an error.
      'no-useless-assignment': 'off',
      // Building code at runtime is legitimate in exactly two places (the
      // playground runner and the designer preview), and both already carry a
      // disable comment saying so. Everywhere else it should be a mistake.
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // `any` is used deliberately at a few generic boundaries; the compiler is
      // the authority on types here, so this stays advisory.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // Optional peer dependencies (jszip, pdfmake) only fail to type-check when
      // they are NOT installed, so `@ts-expect-error` would itself error in a
      // workspace that has them. `@ts-ignore` is right there - but it still has
      // to say why.
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
      // A `/// <reference path>` to a local .d.ts pulls in ambient declarations
      // for those same optional peers; an `import` would emit a real runtime
      // dependency on a package that may not be there.
      '@typescript-eslint/triple-slash-reference': ['error', { path: 'always' }],
    },
  },
  {
    // Tests and tooling scripts: console output is the point.
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', 'tools/**', '**/scripts/**', '**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
]
