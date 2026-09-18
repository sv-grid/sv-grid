/**
 * Where the base bundle's bytes come from, by source file.
 *
 * `measure-size.mjs` says how big the base is; this says why. It runs the same
 * library build with a source map and walks the map of every chunk on the
 * static path, charging each minified byte to the source that produced it.
 * Gzip does not attribute per byte, so the per-file numbers are minified
 * bytes with the chunk's own gzip ratio applied - close enough to rank what
 * grew and to check that a feature meant for a lazy chunk, or for the
 * enterprise package, has not landed in base.
 *
 *   node scripts/attribute-size.mjs            # full SvGrid, top 40 files
 *   node scripts/attribute-size.mjs --all      # every file
 *   node scripts/attribute-size.mjs --grep merge   # files whose path matches
 *   node scripts/attribute-size.mjs --src <dir> --all   # another checkout's src
 */
import { build } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { gzipSync } from 'node:zlib'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Source map v3 mappings, decoded by hand: no dependency for a dev script. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function decodeMappings(mappings) {
  const lines = []
  let src = 0, srcLine = 0, srcCol = 0, name = 0
  for (const lineText of mappings.split(';')) {
    const segs = []
    let col = 0
    for (const segText of lineText ? lineText.split(',') : []) {
      const fields = []
      let value = 0, shift = 0
      for (const ch of segText) {
        const digit = B64.indexOf(ch)
        value += (digit & 31) << shift
        if (digit & 32) shift += 5
        else { fields.push(value & 1 ? -(value >> 1) : value >> 1); value = 0; shift = 0 }
      }
      col += fields[0]
      const seg = [col]
      if (fields.length > 1) { src += fields[1]; srcLine += fields[2]; srcCol += fields[3]; seg.push(src, srcLine, srcCol) }
      if (fields.length > 4) { name += fields[4]; seg.push(name) }
      segs.push(seg)
    }
    lines.push(segs)
  }
  return lines
}

const here = fileURLToPath(new URL('.', import.meta.url))
const srcAt = process.argv.indexOf('--src')
// `--src <dir>` measures another checkout's source (a git worktree at an
// older commit) with this checkout's toolchain, for a before/after.
const src = srcAt >= 0 ? process.argv[srcAt + 1] : join(here, '..', 'src')
const ALL = process.argv.includes('--all')
const grepAt = process.argv.indexOf('--grep')
const GREP = grepAt >= 0 ? process.argv[grepAt + 1] : null

const dir = mkdtempSync(join(tmpdir(), 'svgrid-attr-'))
const entry = join(dir, 'entry.js')
writeFileSync(entry, `export { default as SvGrid } from ${JSON.stringify(join(src, 'SvGrid.svelte').replace(/\\/g, '/'))}\n`)

const result = await build({
  configFile: false,
  logLevel: 'error',
  plugins: [svelte({ emitCss: false })],
  build: {
    write: false,
    lib: { entry, formats: ['es'], fileName: () => 'out.js' },
    minify: true,
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: { external: ['svelte', /^svelte\//] },
  },
})

const outputs = result[0]?.output ?? result.output ?? []
const chunks = new Map(outputs.filter((o) => o.type === 'chunk').map((o) => [o.fileName, o]))
const base = new Set()
const walk = (name) => {
  if (!name || base.has(name)) return
  base.add(name)
  for (const dep of chunks.get(name)?.imports ?? []) walk(dep)
}
walk(outputs.find((o) => o.type === 'chunk' && o.isEntry)?.fileName)

const perFile = new Map()
let baseGz = 0
for (const name of base) {
  const chunk = chunks.get(name)
  if (!chunk) continue // an external ('svelte') listed among the imports
  const code = chunk.code
  const gz = gzipSync(code, { level: 9 }).length
  baseGz += gz
  const ratio = gz / Buffer.byteLength(code)
  const map = chunk.map
  const lines = code.split('\n')
  const decoded = decodeMappings(map.mappings)
  for (let li = 0; li < decoded.length; li += 1) {
    const segs = decoded[li]
    const lineLen = Buffer.byteLength(lines[li] ?? '')
    for (let si = 0; si < segs.length; si += 1) {
      const seg = segs[si]
      const next = segs[si + 1]
      const from = seg[0]
      const to = next ? next[0] : lineLen
      const bytes = Math.max(0, to - from)
      const source = seg.length > 1 ? map.sources[seg[1]] : null
      const key = source ? relative(src, source).replace(/\\/g, '/') : '(generated)'
      perFile.set(key, (perFile.get(key) ?? 0) + bytes * ratio)
    }
  }
}

let rows = [...perFile.entries()].sort((a, b) => b[1] - a[1])
if (GREP) rows = rows.filter(([f]) => f.includes(GREP))
if (!ALL && !GREP) rows = rows.slice(0, 40)
const kb = (n) => (n / 1024).toFixed(2).padStart(7)
console.log(`base gzip ${(baseGz / 1024).toFixed(1)} KB across ${base.size} chunk(s); estimated gzip KB per source file:\n`)
for (const [file, bytes] of rows) console.log(`${kb(bytes)}  ${file}`)
if (GREP) console.log(`\n${kb(rows.reduce((t, [, b]) => t + b, 0))}  total matching "${GREP}"`)
