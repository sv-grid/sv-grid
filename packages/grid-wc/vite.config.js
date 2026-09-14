import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Inlines the emitted CSS into the JS chunks so the build is JS files only,
// each carrying its own styles. Two things need it:
//
//  - <sv-grid> renders in the light DOM, so a <style> in document.head is all
//    it needs.
//  - <sv-grid-shadow> renders in a shadow root, where a document <style> does
//    not reach - but ~20 overlay surfaces (cell dropdown, date picker,
//    tooltips, toasts, modals) portal to document.body to escape ancestor
//    clipping, and those land outside the root. So it needs BOTH copies, and
//    the CSS text is stashed on a global for `adoptGridStyles` to pick up.
//
// Per CHUNK, not one sheet for the whole bundle (`cssCodeSplit: true` below):
// the entry gets the grid's own styles, and a lazy chunk (the chart, the date
// pickers, the menus) gets the styles of the components inside it, injected
// when that chunk loads. With one sheet the chart's stylesheet alone put
// 5.7 KiB gzip into the entry of a page that never charts. A lazy chunk hands
// its CSS to `__SVGRID_WC_ADD_CSS__` so the shadow element can adopt it into
// every open root, or queues it on `__SVGRID_WC_CSS_CHUNKS__` when it loads
// before adopt-styles does.
function inlineCss() {
  return {
    name: '@svgrid/grid-wc:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const cssAssets = new Set()
      const cssOf = (chunk) => {
        let css = ''
        for (const name of chunk.viteMetadata?.importedCss ?? []) {
          const asset = bundle[name]
          if (asset && asset.type === 'asset') {
            css += typeof asset.source === 'string' ? asset.source : asset.source.toString()
            cssAssets.add(name)
          }
        }
        return css
      }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        const css = cssOf(chunk)
        if (!css) continue
        const json = JSON.stringify(css)
        const inject = chunk.isEntry
          ? `(function(){try{if(typeof globalThis!=='undefined')globalThis.__SVGRID_WC_CSS__=${json};` +
            `if(typeof document==='undefined')return;` +
            `if(document.querySelector('style[data-svgrid-grid-wc]'))return;` +
            `var s=document.createElement('style');s.setAttribute('data-svgrid-grid-wc','');` +
            `s.textContent=${json};document.head.appendChild(s);}catch(e){}})();\n`
          : `(function(){try{var c=${json};if(typeof globalThis!=='undefined'){var f=globalThis.__SVGRID_WC_ADD_CSS__;` +
            `if(typeof f==='function')f(c);else(globalThis.__SVGRID_WC_CSS_CHUNKS__=globalThis.__SVGRID_WC_CSS_CHUNKS__||[]).push(c);}` +
            `if(typeof document==='undefined')return;` +
            `if(document.querySelector('style[data-svgrid-grid-wc-chunk=${JSON.stringify(chunk.name)}]'))return;` +
            `var s=document.createElement('style');s.setAttribute('data-svgrid-grid-wc-chunk',${JSON.stringify(chunk.name)});` +
            `s.textContent=c;document.head.appendChild(s);}catch(e){}})();\n`
        chunk.code = inject + chunk.code
      }
      // Any stylesheet no chunk claimed (there should be none) still goes into
      // the entry rather than being dropped on the floor.
      let orphan = ''
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && name.endsWith('.css')) {
          if (!cssAssets.has(name)) orphan += typeof asset.source === 'string' ? asset.source : asset.source.toString()
          delete bundle[name]
        }
      }
      if (orphan) {
        const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
        if (entry) entry.code = `(function(){try{if(typeof document==='undefined')return;var s=document.createElement('style');s.setAttribute('data-svgrid-grid-wc-orphan','');s.textContent=${JSON.stringify(orphan)};document.head.appendChild(s);}catch(e){}})();\n` + entry.code
      }
    },
  }
}

// ONE ELEMENT PER BUILD, selected by SVGRID_WC_SHADOW, and `pnpm build` runs
// the config twice.
//
// Not two entries in one build, which is the obvious way and was measured and
// rejected: sharing a build makes rollup hoist the code both entries touch into
// a common eager chunk, and <sv-grid>'s initial payload went 102.6 -> 133.1 KB
// gzip - a 30% regression on the existing element, to add a second one nobody
// loading the first will use. Separate builds duplicate the lazy chunks on
// disk instead, which costs bytes in the tarball and nothing at runtime,
// because a page loads one element or the other.
//
// Svelte's runtime and @svgrid/grid are bundled IN (not externalized) so each
// build is a zero-dependency drop-in for a CDN <script> tag or a non-Svelte
// host app.
const SHADOW = process.env.SVGRID_WC_SHADOW === '1'
// A third element, <sv-chart>, in its own build for the same reason: it
// shares the chart engine with <sv-grid>'s lazy chart chunk, and a shared
// build would hoist that engine into both entries' eager payload.
const CHART = process.env.SVGRID_WC_ELEMENT === 'chart'
const ENTRY = CHART ? 'src/sv-chart-element.svelte' : SHADOW ? 'src/sv-grid-shadow-element.svelte' : 'src/sv-grid-element.svelte'
const FILE = CHART ? 'sv-chart-element.js' : SHADOW ? 'sv-grid-shadow-element.js' : 'sv-grid-element.js'
const OUT_DIR = CHART ? 'dist/chart' : SHADOW ? 'dist/shadow' : 'dist'

export default defineConfig({
  plugins: [
    svelte({
      // Compile ONLY the two wrappers as custom elements. Compiling the grid's
      // internal components - or the shared GridBody - this way would break
      // them.
      dynamicCompileOptions({ filename }) {
        if (
          filename.endsWith('sv-grid-element.svelte') ||
          filename.endsWith('sv-grid-shadow-element.svelte') ||
          filename.endsWith('sv-chart-element.svelte')
        ) {
          return { customElement: true }
        }
      },
    }),
    inlineCss(),
  ],
  build: {
    lib: {
      entry: ENTRY,
      formats: ['es'],
      fileName: () => FILE,
    },
    // The shadow and chart builds go in their own folders so the runs cannot
    // collide on a chunk name, and so dist/ stays exactly what it was for <sv-grid>.
    outDir: OUT_DIR,
    emptyOutDir: !SHADOW && !CHART,
    // One stylesheet per chunk (lib mode defaults to one for the bundle), so
    // inlineCss can give each lazy chunk its own styles. See the plugin.
    cssCodeSplit: true,
    target: 'es2022',
  },
})
