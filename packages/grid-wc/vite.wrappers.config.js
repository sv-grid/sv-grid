import { defineConfig } from 'vite'

/**
 * Builds the React and Vue wrappers.
 *
 * Separate from vite.config.js, which builds the custom elements themselves,
 * because these have opposite externalisation rules: an element bundles
 * everything (it is a zero-dependency drop-in for a `<script>` tag), while a
 * wrapper externalises everything (the consumer already has React or Vue, and
 * must not get a second copy of the grid either).
 *
 * `@svgrid/grid-wc` stays external and resolves through this package's own
 * `exports` map to `dist/sv-grid-element.js`, so a wrapper is a few KB that
 * reuses the one element bundle rather than duplicating ~100 KB of grid.
 *
 * Angular is not here: it needs ng-packagr and Angular's partial-Ivy
 * compilation, or consumers hit "component is not compiled".
 */
const TARGET = process.env.SVGRID_WRAPPER

if (!TARGET) throw new Error('vite.wrappers.config.js: set SVGRID_WRAPPER=react|vue|react-chart|vue-chart')

// The chart wrappers land NEXT to the grid ones (dist/react/chart.js), so the
// folder is shared and must not be emptied by the second build into it.
const ENTRIES = {
  react: ['src/react/index.tsx', 'dist/react', 'index.js'],
  vue: ['src/vue/index.ts', 'dist/vue', 'index.js'],
  'react-chart': ['src/react/chart.tsx', 'dist/react', 'chart.js'],
  'vue-chart': ['src/vue/chart.ts', 'dist/vue', 'chart.js'],
}
const [ENTRY, OUT_DIR, FILE] = ENTRIES[TARGET]

export default defineConfig({
  build: {
    lib: {
      entry: ENTRY,
      formats: ['es'],
      fileName: () => FILE,
    },
    outDir: OUT_DIR,
    emptyOutDir: !TARGET.endsWith('-chart'),
    target: 'es2022',
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'vue',
        '@svgrid/grid-wc',
        '@svgrid/grid-wc/shadow',
        '@svgrid/grid-wc/chart',
      ],
    },
  },
  esbuild: {
    // The React wrapper uses `createElement` directly rather than JSX, so no
    // JSX transform is needed and the output stays runtime-agnostic (it works
    // for both the classic and automatic runtimes).
    jsx: 'preserve',
  },
})
