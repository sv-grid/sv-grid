/**
 * What's inside the base entry chunk of <SvGrid>? Lists the biggest modules
 * that land in the SYNCHRONOUS graph (out.js + its static-import chunks), so we
 * know where the ~65 KB entry weight actually goes before trying to split it.
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkgSrc = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const dir = mkdtempSync(join(tmpdir(), 'svgrid-eb-'))
const entry = join(dir, 'entry.js')
writeFileSync(entry, `export { default } from ${JSON.stringify(pkgSrc + 'SvGrid.svelte')}`)

const result = await build({
  configFile: false, logLevel: 'error',
  plugins: [svelte({ emitCss: false })],
  build: {
    write: false,
    lib: { entry, formats: ['es'], fileName: () => 'out.js' },
    minify: false, sourcemap: false, cssCodeSplit: false,
    rollupOptions: { external: ['svelte', /^svelte\//] },
  },
})
const outputs = result[0]?.output ?? result.output
const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
// Base = entry + its static-import closure (the synchronous graph).
const base = new Set()
const walk = (n) => { if (!n || base.has(n)) return; base.add(n); for (const d of chunks.get(n)?.imports ?? []) walk(d) }
walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)

const mods = {}
for (const name of base) for (const [id, m] of Object.entries(chunks.get(name)?.modules ?? {})) {
  const f = id.split(/[/\\]/).pop()
  mods[f] = (mods[f] ?? 0) + m.renderedLength
}
Object.entries(mods).filter(([, n]) => n > 2500).sort((a, b) => b[1] - a[1]).slice(0, 30)
  .forEach(([f, n]) => console.log(`${(n / 1024).toFixed(1).padStart(7)} KB raw  ${f}`))
