// @ts-check

import pluginSvelte from 'eslint-plugin-svelte'
import rootConfig from '../../eslint.config.js'

export default [
  ...rootConfig,
  ...pluginSvelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    rules: {
      'svelte/block-lang': ['error', { script: ['ts'] }],
      'svelte/no-svelte-internal': 'error',
      'svelte/valid-compile': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'import/newline-after-import': 'off',
      // Runes declare with `let` by contract: `$props()` and `$derived` are
      // rewritten by the compiler and `$state` is reassigned through the proxy,
      // so the base rule's "never reassigned" reading is wrong here. The Svelte
      // rule understands runes; the base one must be off or they fight.
      'prefer-const': 'off',
      'svelte/prefer-const': ['error', { excludedRunes: ['$props', '$derived'] }],
      // `export type { X } from './y'` in a `<script module>` is a type
      // re-export; the base rule reads it as assigning to an import.
      'no-import-assign': 'off',
      // Reading a value for its own sake (`viewportVersion;`) is how an $effect
      // registers a dependency - the whole point is that nothing consumes it.
      '@typescript-eslint/no-unused-expressions': 'off',
      // `svelte/valid-compile` is off above, so this rule never sees the
      // compiler warnings the svelte-ignore comments exist to silence and calls
      // every one of them unused. svelte-check is what verifies those.
      'svelte/no-unused-svelte-ignore': 'off',
      // TypeScript already resolves these, including DOM lib types like
      // `AutoFill` that this rule cannot see.
      'no-undef': 'off',
      // Flags every `new Set` / `new Map` / `new Date` in a component, but this
      // codebase deliberately replaces collections instead of mutating them
      // (`picked = new Set(picked)`), which is already reactive. Sampled widely:
      // the hits are local scratch, non-serializable runtime handles, or a Date
      // inside $state - none of them want the reactive wrappers.
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    // The plugin points `.svelte` AND `.svelte.ts` at svelte-eslint-parser but
    // sets no inner parser, so TypeScript syntax in a runes module fails to
    // parse ("Unexpected token <TypeName>"). Hand it the TS parser.
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  },
]
