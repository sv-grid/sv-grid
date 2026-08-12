/**
 * Measure the real gzipped cost of the two things the homepage/README claim:
 *   - "full render component" = <SvGrid> and everything it pulls in
 *   - "headless core"         = createGrid/createSvGrid engine, no rendering
 *
 * Each is bundled in ISOLATION with Svelte kept external (it's a peer dep, so it
 * does NOT count toward what SvGrid adds to a consumer's bundle), minified, then
 * gzipped. This mirrors what a real app that imports only that symbol ships.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkgSrc = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const ENTRIES = {
  'full render component (SvGrid)': `export { default } from ${JSON.stringify(pkgSrc + 'SvGrid.svelte')}`,
  'headless core (createGrid)': `export { createGrid, createSvGrid } from ${JSON.stringify(pkgSrc + 'createGrid.svelte.ts')}`,
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB'

for (const [label, code] of Object.entries(ENTRIES)) {
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-size-'))
  const entry = join(dir, 'entry.js')
  writeFileSync(entry, code)

  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [svelte({ emitCss: false })],
    build: {
      write: false,
      lib: { entry, formats: ['es'], fileName: () => 'out.js' },
      minify: true,
      sourcemap: false,
      cssCodeSplit: false,
      rollupOptions: { external: ['svelte', /^svelte\//] },
    },
  })

  const outputs = result[0]?.output ?? result.output ?? []
  const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
  // A chunk is "base" if it's reachable from the entry via STATIC imports only
  // (it loads synchronously with the entry); "lazy" if reached only via import().
  const base = new Set()
  const walk = (name) => {
    if (!name || base.has(name)) return
    base.add(name)
    for (const dep of chunks.get(name)?.imports ?? []) walk(dep)
  }
  walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)

  let baseJs = 0, lazyJs = 0, css = 0
  for (const o of outputs) {
    const content = o.type === 'chunk' ? o.code : o.source
    const bytes = Buffer.byteLength(content)
    const gz = gzipSync(content, { level: 9 }).length
    const kind = o.fileName.endsWith('.css') ? 'css' : base.has(o.fileName) ? 'base' : 'lazy'
    if (kind === 'css') css += gz
    else if (kind === 'base') baseJs += gz
    else lazyJs += gz
    console.log(`   ${kind.padEnd(6)} ${o.fileName.padEnd(28)} raw ${kb(bytes).padStart(9)}   gzip ${kb(gz).padStart(9)}`)
  }
  const entryJs = baseJs
  console.log(
    `=> ${label}: base JS gzip ${kb(entryJs)}` +
      (css ? ` + CSS ${kb(css)}` : '') +
      (lazyJs ? `   |  lazy chunks (loaded on demand) ${kb(lazyJs)}` : '') +
      '\n',
  )
}
