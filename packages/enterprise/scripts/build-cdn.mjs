/**
 * Build the CDN bundle of @svgrid/enterprise.
 *
 * The published package ships raw Svelte/TS *source* (compiled by the consumer's
 * bundler). Generic CDNs can't compile that, so this emits a pre-compiled ESM
 * bundle under `dist/cdn/`:
 *
 *   - svgrid-enterprise.svelte-external.js
 *       Keeps `svelte`, `@svgrid/grid`, `jszip` and `pdfmake` EXTERNAL, so a page
 *       that already loads those (via an import map) shares one Svelte runtime
 *       AND the same grid instance. This is what the website's "copy runnable
 *       Svelte HTML" export loads for enterprise demos.
 *
 * Unlicensed use still works and shows the pack's built-in watermark + console
 * nudge (see src/watermark.ts) - the standard commercial "trial" model.
 *
 * CSS (if any) is folded into the JS as a runtime style injection.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const OUT = 'svgrid-enterprise.svelte-external.js'

rmSync('dist/cdn', { recursive: true, force: true })

await build({
  configFile: false,
  logLevel: 'warn',
  plugins: [svelte({ emitCss: false })],
  build: {
    lib: { entry, formats: ['es'], fileName: () => OUT },
    outDir: 'dist/cdn',
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      external: ['svelte', /^svelte\//, '@svgrid/grid', /^@svgrid\/grid\//, 'jszip', 'pdfmake'],
    },
  },
})

// Fold any extracted stylesheet into the JS as a runtime style injection.
const jsPath = `dist/cdn/${OUT}`
const css = readdirSync('dist/cdn').find((f) => f.endsWith('.css'))
if (css) {
  const cssText = readFileSync(`dist/cdn/${css}`, 'utf8')
  const inject = `\n;(function(){try{if(typeof document==='undefined')return;var s=document.createElement('style');s.setAttribute('data-svgrid-enterprise','');s.textContent=${JSON.stringify(
    cssText,
  )};document.head.appendChild(s)}catch(e){}})();\n`
  writeFileSync(jsPath, readFileSync(jsPath, 'utf8') + inject)
  rmSync(`dist/cdn/${css}`)
}

const size = existsSync(jsPath) ? Math.round(readFileSync(jsPath).length / 1024) + 'KB' : 'missing'
console.log(`build-cdn: ${OUT} (${size})`)
