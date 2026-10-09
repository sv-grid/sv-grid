/**
 * Production build of the grid comparison harness (bench.html).
 *
 *   npx vite build --config vite.bench.config.js
 *   npx vite preview --config vite.bench.config.js --port 4190
 *   SVGRID_BENCH_PORT=4190 pnpm bench:compare
 *
 * The harness used to be measured on the dev server only. There the two
 * Svelte grids run as dev-mode Svelte, with its runtime checks, while AG Grid
 * runs the production code it ships as, so the comparison was not like for
 * like. This config builds bench.html for production, and swaps the gallery's
 * `process.env.NODE_ENV: "development"` / `__DEV__: true` replacements for
 * production ones so no grid runs dev-only code.
 */
import { mergeConfig } from 'vite'
import rollupReplace from '@rollup/plugin-replace'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import base from './vite.config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * adapters.local.ts (gitignored) may import a grid that is not installed on
 * this machine. The dev server only fails when that adapter is loaded, and
 * loadAdapters() catches it; a build fails outright. An import from that file
 * that does not resolve becomes a module that throws when loaded instead.
 */
const optionalLocalAdapters = {
  name: 'bench-optional-local-adapters',
  async resolveId(source, importer, options) {
    if (!importer || !importer.replace(/\\/g, '/').endsWith('/bench/adapters.local.ts')) return null
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
    // A .js suffix so a missing stylesheet is not handed to the CSS pipeline.
    return resolved ?? `\0bench-missing:${source}.js`
  },
  load(id) {
    if (!id.startsWith('\0bench-missing:')) return null
    return `throw new Error(${JSON.stringify(`${id.slice('\0bench-missing:'.length, -3)} is not installed`)})`
  },
}

const { plugins = [], ...rest } = base
export default mergeConfig(rest, {
  plugins: [
    optionalLocalAdapters,
    ...plugins.filter((p) => !(p && typeof p === 'object' && 'name' in p && p.name === 'replace')),
    rollupReplace({
      preventAssignment: true,
      values: {
        __DEV__: JSON.stringify(false),
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    }),
  ],
  build: {
    outDir: 'dist-bench',
    emptyOutDir: true,
    rollupOptions: { input: { bench: path.resolve(__dirname, 'bench.html') } },
  },
  preview: { port: 4190, strictPort: true },
})
