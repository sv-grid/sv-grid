import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Inlines the emitted CSS into the JS entry so the build is ONE file. We use
// shadow: 'none' (light DOM) so the grid's overlay popups - which portal to
// document.body, outside any shadow root - are styled. That means the styles
// must live in the page; this plugin injects them via a <style> on load so
// consumers still only load a single <script>.
function inlineCss() {
  return {
    name: 'sv-grid-wc:inline-css',
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
      const inject =
        `(function(){try{if(typeof document==='undefined')return;` +
        `if(document.querySelector('style[data-sv-grid-wc]'))return;` +
        `var s=document.createElement('style');s.setAttribute('data-sv-grid-wc','');` +
        `s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}catch(e){}})();\n`
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = inject + chunk.code
        }
      }
    },
  }
}

// Builds a single, self-contained ESM file that registers the <sv-grid>
// custom element on load. Svelte's runtime and sv-grid-core are bundled
// IN (not externalized) so the file is a true zero-dependency drop-in for a
// CDN <script> tag or a non-Svelte host app.
export default defineConfig({
  plugins: [
    svelte({
      // Compile ONLY the wrapper as a custom element. Compiling the grid's
      // internal components this way would break them.
      dynamicCompileOptions({ filename }) {
        if (filename.endsWith('sv-grid-element.svelte')) {
          return { customElement: true }
        }
      },
    }),
    inlineCss(),
  ],
  build: {
    lib: {
      entry: 'src/sv-grid-element.svelte',
      formats: ['es'],
      fileName: () => 'sv-grid-element.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
})
