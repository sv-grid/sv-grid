/**
 * Verify every demo registered in the website picker registry has a thumbnail
 * in website/public/thumbs/<id>.webp, and warn about orphan thumbnails whose
 * demo was removed. Exits non-zero when anything is missing so CI catches
 * stale thumbnails before they ship as broken cards.
 *
 *   node tools/check-demo-thumbs.mjs     (or `pnpm thumbs:check`)
 *
 * Regenerate with: start the gallery, then `pnpm thumbs`.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'website', 'public', 'thumbs')
const REGISTRY = join(ROOT, 'website', 'src', 'lib', 'demos.ts')

const src = await readFile(REGISTRY, 'utf-8')
const ids = [...src.matchAll(/demo\('([^']+)'/g)].map((m) => m[1])

let files = []
try {
  files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.webp'))
} catch {
  // thumbs dir missing entirely
}
const have = new Set(files.map((f) => f.replace(/\.webp$/, '')))

const missing = ids.filter((id) => !have.has(id))
const orphans = [...have].filter((id) => !ids.includes(id))

process.stdout.write(
  `check-demo-thumbs: ${ids.length} demos, ${have.size} thumbnails\n`,
)
if (missing.length) {
  process.stdout.write(`  MISSING thumbnail (${missing.length}):\n`)
  for (const id of missing) process.stdout.write(`    - ${id}\n`)
}
if (orphans.length) {
  process.stdout.write(`  orphan thumbnail (demo removed) (${orphans.length}):\n`)
  for (const id of orphans) process.stdout.write(`    - ${id}\n`)
}
if (!missing.length && !orphans.length) {
  process.stdout.write('  all good - every demo has a thumbnail, no orphans\n')
}

// Missing thumbnails fail the check; orphans are a soft warning only.
process.exit(missing.length ? 1 : 0)
