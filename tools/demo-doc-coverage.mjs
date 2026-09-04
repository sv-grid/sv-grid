/**
 * demo-doc-coverage - which gallery demos are not referenced from any doc page.
 *
 * A demo nobody links to is a demo nobody finds: the gallery is a flat list of
 * 365 entries, so the docs are the only place a reader meets the right one at
 * the right moment. Run with --json for the machine-readable list.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REGISTRY = 'website/src/lib/demos.ts'
const DOCS = 'docs'

/** Parse `demo('id', 'Title', 'Description', 'Category')` out of the registry. */
export function loadRegistry(src = readFileSync(REGISTRY, 'utf-8')) {
  const out = []
  // Titles and descriptions contain escaped quotes and commas, so match the
  // four leading string args positionally rather than splitting on commas.
  const re =
    /\bdemo\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'([^']+)'/g
  for (const m of src.matchAll(re)) {
    out.push({ id: m[1], title: m[2], description: m[3], category: m[4] })
  }
  return out
}

/** Every .md under docs/, as [relativePath, text]. */
export function loadDocs(dir = DOCS) {
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) files.push([p.replace(/\\/g, '/'), readFileSync(p, 'utf-8')])
    }
  }
  walk(dir)
  return files
}

/**
 * A demo counts as referenced when its id appears in a doc page. Deliberately a
 * substring test rather than a URL match: the corpus links demos five different
 * ways (site path, hash route, absolute URL, source path, bare "Demo 51"), and
 * for coverage purposes any of them means a reader can get there.
 */
export function coverage(registry, docs) {
  const referenced = new Map()
  for (const [path, text] of docs) {
    for (const d of registry) {
      if (text.includes(d.id)) {
        if (!referenced.has(d.id)) referenced.set(d.id, [])
        referenced.get(d.id).push(path)
      }
    }
  }
  const orphans = registry.filter((d) => !referenced.has(d.id))
  return { referenced, orphans }
}

if (process.argv[1]?.endsWith('demo-doc-coverage.mjs')) {
  const registry = loadRegistry()
  const docs = loadDocs()
  const { referenced, orphans } = coverage(registry, docs)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(orphans, null, 2))
  } else {
    const byCat = new Map()
    for (const d of orphans) {
      if (!byCat.has(d.category)) byCat.set(d.category, [])
      byCat.get(d.category).push(d)
    }
    console.log(
      `registry ${registry.length} | referenced ${referenced.size} | orphaned ${orphans.length}\n`,
    )
    for (const [cat, list] of [...byCat].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`${cat} (${list.length})`)
      for (const d of list) console.log(`  ${d.id.padEnd(36)} ${d.title}`)
      console.log()
    }
  }
}
