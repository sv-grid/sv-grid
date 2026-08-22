/**
 * Build the Node ESM bundle of `@svgrid/enterprise/studio`.
 *
 * svelte-package already emits `dist/studio/` for bundler consumers, but that
 * output is a tree of extensionless relative imports only a bundler resolves.
 * The pure, Svelte-free Studio core also has to run in bare Node - it powers
 * the `@svgrid/studio` CLI (`svgrid-studio`) and the `@svgrid/mcp` server, both
 * plain `node dist/cli.js` processes. This emits a single self-contained ESM
 * file under `dist/node/` that Node resolves via the package's `./studio`
 * "node" export condition.
 *
 * The Studio core has NO runtime dependency on Svelte or `@svgrid/grid` (it
 * imports only erasable types), so everything bundles in. The one exception is
 * `svelte/compiler`, which `verify.ts` imports *dynamically* and optionally -
 * it stays external so it loads lazily from the consumer's install (and the
 * verify step degrades gracefully when it isn't present).
 */
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const entry = fileURLToPath(new URL('../src/studio/index.ts', import.meta.url))
const OUT = 'studio.js'

rmSync('dist/node', { recursive: true, force: true })

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    lib: { entry, formats: ['es'], fileName: () => OUT },
    outDir: 'dist/node',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: 'node18',
    rollupOptions: {
      // Keep the optional, lazily-imported Svelte compiler external (verify.ts),
      // plus Svelte / grid / Node builtins as a safety net - none are referenced
      // at module load, so the bundle stays self-contained.
      external: ['svelte', /^svelte\//, '@svgrid/grid', /^@svgrid\/grid\//, /^node:/],
    },
  },
})

const jsPath = `dist/node/${OUT}`
const size = existsSync(jsPath) ? Math.round(readFileSync(jsPath).length / 1024) + 'KB' : 'missing'
console.log(`build-node: ${OUT} (${size})`)
