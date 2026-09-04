/**
 * doc-snippet-needs - what a page's failing snippets are missing.
 *
 * Doc blocks are excerpts: they reference the row type, the columns and the data
 * that the surrounding prose established. A `{preamble}` block declares that
 * setup once per page and the extractor splices it into every runnable block, so
 * the question when adding one is simply "which names are missing".
 *
 * Answers it, ranked by how many blocks a preamble would unlock.
 *
 *   node tools/build-doc-snippets.mjs --candidates
 *   cd examples && npx svelte-check --output human --threshold error > ../check.txt
 *   node tools/doc-snippet-needs.mjs ../check.txt
 */
import { readFileSync } from 'node:fs'

const MANIFEST = 'examples/src/doc-snippets/manifest.json'

/** `id -> Set(missing name)` from svelte-check human output. */
export function parseNeeds(output) {
  const byId = new Map()
  const lines = output.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const file = /doc-snippets[\\/]([A-Za-z0-9._-]+)\.svelte/.exec(lines[i])
    if (!file) continue
    // The diagnostic is on the following line.
    const msg = lines[i + 1] ?? ''
    const name =
      /Cannot find name '([^']+)'/.exec(msg)?.[1] ??
      /shorthand property '([^']+)'/.exec(msg)?.[1] ??
      /Cannot find module '([^']+)'/.exec(msg)?.[1]
    if (!name) continue
    if (!byId.has(file[1])) byId.set(file[1], new Set())
    byId.get(file[1]).add(name)
  }
  return byId
}

if (process.argv[1]?.endsWith('doc-snippet-needs.mjs')) {
  const output = readFileSync(process.argv[2] ?? 'check.txt', 'utf-8')
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
  const docOf = new Map(manifest.snippets.map((s) => [s.id, s.doc]))

  const needs = parseNeeds(output)
  const byDoc = new Map()
  for (const [id, names] of needs) {
    const doc = docOf.get(id)
    if (!doc) continue
    if (!byDoc.has(doc)) byDoc.set(doc, { blocks: 0, names: new Map() })
    const rec = byDoc.get(doc)
    rec.blocks += 1
    for (const n of names) rec.names.set(n, (rec.names.get(n) ?? 0) + 1)
  }

  const ranked = [...byDoc].sort((a, b) => b[1].blocks - a[1].blocks)
  const limit = Number(process.argv[3] ?? 30)
  console.log(`${needs.size} failing snippets across ${byDoc.size} pages\n`)
  for (const [doc, rec] of ranked.slice(0, limit)) {
    const names = [...rec.names]
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n)
      .join(' ')
    console.log(`${String(rec.blocks).padStart(2)} blocks  ${doc}`)
    console.log(`           needs: ${names}`)
  }
  const total = ranked.reduce((n, [, r]) => n + r.blocks, 0)
  console.log(`\n${total} blocks would become runnable if every page above got a preamble`)
}
