/**
 * Build the <sv-sheet> custom element and its wrappers:
 *
 *   dist/wc/sv-sheet-element.js    <sv-sheet>, with Svelte, @svgrid/grid and
 *                                  the pack bundled in: a drop-in for a CDN
 *                                  <script type="module"> or a host with no
 *                                  Svelte in its build. jszip and pdfmake
 *                                  stay external (optional peers, loaded on
 *                                  demand by Save As and the PDF export), so
 *                                  a page that wants them names them in an
 *                                  import map.
 *   dist/wc/react.js, vue.js       the wrappers, everything external
 *   dist/wc/*.d.ts                 the element's and the wrappers' types
 *
 * Unlicensed use works and shows the pack's watermark, as every entry does.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, rmSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const OUT = join(pkg, 'dist', 'wc')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// 1. The element. The wrapper .svelte compiles as a custom element; the
//    components inside it compile as the ordinary components they are.
await build({
  configFile: false,
  logLevel: 'warn',
  root: pkg,
  plugins: [
    svelte({
      emitCss: false,
      dynamicCompileOptions({ filename }) {
        if (filename.endsWith('sv-sheet-element.svelte')) return { customElement: true }
      },
    }),
  ],
  build: {
    // The element itself is the entry: the package declares no side effects
    // beyond CSS, so an entry that merely imported it would have the import
    // shaken away and ship the surface module alone.
    lib: { entry: join(pkg, 'src', 'wc', 'sv-sheet-element.svelte'), formats: ['es'], fileName: () => 'sv-sheet-element.js' },
    outDir: OUT,
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    target: 'es2022',
    rollupOptions: { external: ['jszip', 'pdfmake'] },
  },
})
// Any stylesheet vite still extracted goes into the JS as a runtime injection.
const css = readdirSync(OUT).find((f) => f.endsWith('.css'))
if (css) {
  const text = readFileSync(join(OUT, css), 'utf8')
  const target = join(OUT, 'sv-sheet-element.js')
  writeFileSync(target, readFileSync(target, 'utf8') + `\n;(function(){try{if(typeof document==='undefined')return;var s=document.createElement('style');s.setAttribute('data-svgrid-sv-sheet','');s.textContent=${JSON.stringify(text)};document.head.appendChild(s)}catch(e){}})();\n`)
  rmSync(join(OUT, css))
}

// 2. The wrappers: a few KB each, reusing the one element bundle.
for (const [entry, file] of [['react.ts', 'react.js'], ['vue.ts', 'vue.js']]) {
  await build({
    configFile: false,
    logLevel: 'warn',
    root: pkg,
    build: {
      lib: { entry: join(pkg, 'wc', entry), formats: ['es'], fileName: () => file },
      outDir: OUT,
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: 'es2022',
      rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'vue', '@svgrid/enterprise/wc'] },
    },
    esbuild: { jsx: 'preserve' },
  })
}

// 3. The declarations, beside each entry so the exports map can point at them.
copyFileSync(join(pkg, 'src', 'wc', 'types', 'sv-sheet-element.d.ts'), join(OUT, 'sv-sheet-element.d.ts'))
copyFileSync(join(pkg, 'wc', 'react.d.ts'), join(OUT, 'react.d.ts'))
copyFileSync(join(pkg, 'wc', 'vue.d.ts'), join(OUT, 'vue.d.ts'))

const size = Math.round(readFileSync(join(OUT, 'sv-sheet-element.js')).length / 1024)
console.log(`build-wc: dist/wc/sv-sheet-element.js (${size}KB), react.js, vue.js`)
