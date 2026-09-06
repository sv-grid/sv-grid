import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Inlines the emitted CSS into the JS entry so the build is ONE file per
// element. Two things need it:
//
//  - <sv-grid> renders in the light DOM, so a <style> in document.head is all
//    it needs.
//  - <sv-grid-shadow> renders in a shadow root, where a document <style> does
//    not reach - but ~20 overlay surfaces (cell dropdown, date picker,
//    tooltips, toasts, modals) portal to document.body to escape ancestor
//    clipping, and those land outside the root. So it needs BOTH copies, and
//    the CSS text is stashed on a global for `adoptGridStyles` to pick up.
function inlineCss() {
  return {
    name: '@svgrid/grid-wc:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = ''
      for (const [name, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && name.endsWith('.css')) {
          css += typeof asset.source === 'string' ? asset.source : asset.source.toString()
          delete bundle[name]
        }
      }
      if (!css) return
      const json = JSON.stringify(css)
      const inject =
        `(function(){try{if(typeof globalThis!=='undefined')globalThis.__SVGRID_WC_CSS__=${json};` +
        `if(typeof document==='undefined')return;` +
        `if(document.querySelector('style[data-svgrid-grid-wc]'))return;` +
        `var s=document.createElement('style');s.setAttribute('data-svgrid-grid-wc','');` +
        `s.textContent=${json};document.head.appendChild(s);}catch(e){}})();\n`
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = inject + chunk.code
        }
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

export default defineConfig({
  plugins: [
    svelte({
      // Compile ONLY the two wrappers as custom elements. Compiling the grid's
      // internal components - or the shared GridBody - this way would break
      // them.
      dynamicCompileOptions({ filename }) {
        if (
          filename.endsWith('sv-grid-element.svelte') ||
          filename.endsWith('sv-grid-shadow-element.svelte')
        ) {
          return { customElement: true }
        }
      },
    }),
    inlineCss(),
  ],
  build: {
    lib: {
      entry: SHADOW ? 'src/sv-grid-shadow-element.svelte' : 'src/sv-grid-element.svelte',
      formats: ['es'],
      fileName: () => (SHADOW ? 'sv-grid-shadow-element.js' : 'sv-grid-element.js'),
    },
    // The shadow build goes in its own folder so the two runs cannot collide on
    // a chunk name, and so dist/ stays exactly what it was for <sv-grid>.
    outDir: SHADOW ? 'dist/shadow' : 'dist',
    emptyOutDir: !SHADOW,
    target: 'es2022',
  },
})
