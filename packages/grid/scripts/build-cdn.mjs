/**
 * Build the CDN bundles of @svgrid/grid.
 *
 * The normal `dist/` is a Svelte *source* library (ships raw .svelte files, to
 * be compiled by the consumer's Svelte-aware bundler). Generic CDNs can't
 * compile that, so this emits pre-compiled bundles under `dist/cdn/`:
 *
 *   - svgrid.js                 Svelte runtime bundled in (self-contained; a
 *                               plain `<script type=module>` import just works).
 *   - svgrid.svelte-external.js Svelte kept external (bare `svelte` imports),
 *                               so it can SHARE one Svelte runtime with a
 *                               component the page compiles itself. Used by the
 *                               "copy runnable Svelte HTML" single-file export.
 *
 * Both inline their CSS via a runtime style injection (no separate stylesheet).
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url))

async function buildBundle({ external, outFile }) {
  await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [svelte({ emitCss: false })],
    build: {
      lib: { entry, formats: ['es'], fileName: () => outFile },
      outDir: 'dist/cdn',
      emptyOutDir: false,
      minify: true,
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: external ? { external: ['svelte', /^svelte\//] } : {},
    },
  })
  // Fold any extracted stylesheet into the JS as a runtime style injection.
  const jsPath = `dist/cdn/${outFile}`
  const css = readdirSync('dist/cdn').find((f) => f.endsWith('.css'))
  if (css) {
    const cssText = readFileSync(`dist/cdn/${css}`, 'utf8')
    const inject = `\n;(function(){try{if(typeof document==='undefined')return;var s=document.createElement('style');s.setAttribute('data-svgrid','');s.textContent=${JSON.stringify(
      cssText,
    )};document.head.appendChild(s)}catch(e){}})();\n`
    writeFileSync(jsPath, readFileSync(jsPath, 'utf8') + inject)
    rmSync(`dist/cdn/${css}`)
  }
}

rmSync('dist/cdn', { recursive: true, force: true })
await buildBundle({ external: false, outFile: 'svgrid.js' })
await buildBundle({ external: true, outFile: 'svgrid.svelte-external.js' })

const size = (f) => (existsSync(`dist/cdn/${f}`) ? Math.round(readFileSync(`dist/cdn/${f}`).length / 1024) + 'KB' : 'missing')
console.log(`build-cdn: svgrid.js (${size('svgrid.js')}) + svgrid.svelte-external.js (${size('svgrid.svelte-external.js')})`)
