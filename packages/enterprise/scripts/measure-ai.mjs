/**
 * Measure the gzipped footprint of the Enterprise AI features (ai.ts), the way a
 * consumer would actually ship them: bundled + minified + gzipped, with Svelte
 * and @svgrid/grid kept external (peer deps that don't count toward AI's weight).
 *
 * Two numbers:
 *   - "AI standalone" = ai.ts + everything it pulls in from enterprise (its
 *      ./export + ./license deps). What a separate @svgrid/ai package would ship.
 *   - "AI code only"  = ai.ts with ./export ALSO external, i.e. AI's own weight
 *      minus the export engine it leans on.
 */
import { build } from 'vite'
import { gzipSync } from 'node:zlib'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const src = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

async function measure(label, externalExport) {
  const dir = mkdtempSync(join(tmpdir(), 'svgrid-ai-'))
  const entry = join(dir, 'entry.js')
  writeFileSync(entry, `export * from ${JSON.stringify(src + 'ai.ts')}`)
  const external = ['svelte', /^svelte\//, '@svgrid/grid', /^@svgrid\/grid\//]
  if (externalExport) external.push(/[\\/]export(\.ts)?$/, /[\\/]smart(-shim)?/)

  const result = await build({
    configFile: false, logLevel: 'error',
    build: {
      write: false,
      lib: { entry, formats: ['es'], fileName: () => 'out.js' },
      minify: true, sourcemap: false,
      rollupOptions: { external },
    },
  })
  const outs = result[0]?.output ?? result.output
  let raw = 0, gz = 0
  for (const o of outs) {
    if (o.type !== 'chunk') continue
    raw += Buffer.byteLength(o.code)
    gz += gzipSync(o.code, { level: 9 }).length
  }
  console.log(`${label.padEnd(22)} raw ${kb(raw).padStart(9)}   gzip ${kb(gz).padStart(9)}`)
}

await measure('AI standalone (+export)', false)
await measure('AI code only', true)
