/**
 * Count the live demos: registry entries in website/src/lib/demos.ts that have
 * a matching examples/src/demos/<id>.svelte file, plus the community demos.
 *
 * This exists because the demo count is quoted in READMEs, the website, and the
 * docs, and it drifted to "280+" while the real number was past 360. Re-run it
 * before quoting a number anywhere.
 *
 *   node tools/count-demos.mjs          # summary
 *   node tools/count-demos.mjs --json   # machine-readable
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = join(ROOT, 'website', 'src', 'lib', 'demos.ts')
const DEMO_DIR = join(ROOT, 'examples', 'src', 'demos')

const src = readFileSync(REGISTRY, 'utf8')
const ids = [...src.matchAll(/demo\(\s*'([^']+)'/g)].map((m) => m[1])

const files = new Set(
  readdirSync(DEMO_DIR)
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => f.slice(0, -'.svelte'.length)),
)

const live = ids.filter((id) => files.has(id))
const orphanEntries = ids.filter((id) => !files.has(id))
const orphanFiles = [...files].filter((f) => !ids.includes(f))

let community = 0
try {
  community = readdirSync(join(DEMO_DIR, 'community')).filter((f) => f.endsWith('.svelte')).length
} catch {
  // community/ is optional
}

const pro = (src.match(/pro:\s*true/g) || []).length
const total = live.length + community

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ firstParty: live.length, community, total, pro, orphanEntries, orphanFiles }, null, 2))
} else {
  console.log(`first-party demos : ${live.length}`)
  console.log(`community demos   : ${community}`)
  console.log(`TOTAL LIVE        : ${total}`)
  console.log(`flagged pro       : ${pro}`)
  if (orphanEntries.length) console.log(`\nregistered but no .svelte file (${orphanEntries.length}): ${orphanEntries.join(', ')}`)
  if (orphanFiles.length) console.log(`\n.svelte file but not registered (${orphanFiles.length}): ${orphanFiles.join(', ')}`)
}

// Non-zero exit if the registry and the filesystem disagree, so CI can gate on it.
process.exit(orphanEntries.length ? 1 : 0)
