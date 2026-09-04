/**
 * check-doc-snippets - compile-verify the extracted doc snippets.
 *
 * The Svelte compiler alone is not a sufficient gate: `{undeclaredThing}` in
 * markup compiles fine and fails at runtime with a ReferenceError. svelte-check
 * catches it ("Cannot find name"), along with wrong prop types and bad imports,
 * so a snippet only earns the `{runnable}` flag once it passes here.
 *
 * Writes `examples/src/doc-snippets/passing.json` for the --promote step.
 *
 *   node tools/build-doc-snippets.mjs --candidates
 *   node tools/check-doc-snippets.mjs
 *   node tools/build-doc-snippets.mjs --promote
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const OUT = 'examples/src/doc-snippets'
const MANIFEST = join(OUT, 'manifest.json')
// Outside OUT: the extractor clears that directory on every run, and the
// promote step needs this list to survive the regenerate in between.
export const PASSING = join('node_modules', '.cache', 'doc-snippets', 'passing.json')

/**
 * svelte-check human output names the file on one line and the diagnostic on
 * the next. We only need the set of files with at least one error, so the file
 * line is enough - and it is stable across svelte-check versions in a way the
 * message formatting is not.
 */
export function failingIds(output) {
  const ids = new Set()
  for (const m of output.matchAll(/doc-snippets[\\/]([A-Za-z0-9._-]+)\.svelte/g)) {
    ids.add(m[1])
  }
  return ids
}

if (process.argv[1]?.endsWith('check-doc-snippets.mjs')) {
  if (!existsSync(MANIFEST)) {
    console.error(`no ${MANIFEST}; run tools/build-doc-snippets.mjs first`)
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
  const all = readdirSync(OUT)
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => f.replace(/\.svelte$/, ''))

  // Run in the examples workspace: that is where svelte, the tsconfig and the
  // @svgrid aliases resolve from.
  const res = spawnSync(
    'npx',
    ['svelte-check', '--output', 'human', '--threshold', 'error'],
    { cwd: 'examples', encoding: 'utf-8', shell: true, maxBuffer: 64 * 1024 * 1024 },
  )
  const output = `${res.stdout ?? ''}\n${res.stderr ?? ''}`

  const failed = failingIds(output)
  const passing = all.filter((id) => !failed.has(id))
  mkdirSync(join('node_modules', '.cache', 'doc-snippets'), { recursive: true })
  writeFileSync(PASSING, `${JSON.stringify(passing, null, 2)}\n`)

  const byDoc = new Map()
  for (const s of manifest.snippets) if (failed.has(s.id)) {
    byDoc.set(s.doc, (byDoc.get(s.doc) ?? 0) + 1)
  }

  console.log(`checked ${all.length} snippets: ${passing.length} pass, ${failed.size} fail`)
  if (byDoc.size) {
    console.log('\nfailures by doc page:')
    for (const [doc, n] of [...byDoc].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`  ${String(n).padStart(3)}  ${doc}`)
    }
  }
}
