import { createRequire } from 'node:module'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(ROOT, 'website', 'package.json'))
const { build } = await import(pathToFileURL(req.resolve('vite')).href)
const { svelte } = await import(pathToFileURL(req.resolve('@sveltejs/vite-plugin-svelte')).href)

const DIST = join(ROOT, 'packages', 'sv-grid-core', 'dist')
const kb = (n) => (n / 1024).toFixed(1).padStart(5) + ' KB'

async function measure(label, exportsLine) {
  const entry = join(DIST, '__measure_entry.js')
  writeFileSync(entry, exportsLine + '\n')
  try {
    const out = await build({
      configFile: false, logLevel: 'silent',
      plugins: [svelte({ compilerOptions: { dev: false } })],
      build: {
        write: false, minify: true, target: 'es2020',
        lib: { entry, formats: ['es'], fileName: 'm' },
        rollupOptions: { external: ['svelte', /^svelte\//] },
      },
    })
    const chunks = (Array.isArray(out) ? out[0] : out).output.filter((o) => o.type === 'chunk')
    const code = Buffer.from(chunks.map((c) => c.code).join('\n'))
    console.log(
      label.padEnd(38) +
      'min ' + kb(code.length) +
      '   gzip ' + kb(gzipSync(code, { level: 9 }).length) +
      '   brotli ' + kb(brotliCompressSync(code).length),
    )
  } finally { unlinkSync(entry) }
}

console.log('\nsv-grid-community published bundle size (Svelte = external peer dep)\n')
await measure('Full package (all exports)',            `export * from './index.js'`)
await measure('Headless core only',                    `export { createSvGrid, createCoreRowModel } from './index.js'`)
await measure('<SvGrid> render component',              `export { SvGrid } from './index.js'`)
await measure('Typical grid (SvGrid + sort + filter)', `export { SvGrid, createCoreRowModel, tableFeatures, rowSortingFeature, columnFilteringFeature, renderSnippet } from './index.js'`)
console.log('')
