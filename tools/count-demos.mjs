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

// Files that quote the demo count in prose. Checked by verifyClaims() below so
// the number cannot drift out of sync again - "150+" and "140" both survived in
// here for months while the real count was past 370.
const CLAIM_FILES = [
  'README.md',
  'AGENTS.md',
  'SUPPORTERS.md',
  'examples/README.md',
  'website/README.md',
  'packages/grid/README.md',
  'packages/mcp/README.md',
  'packages/mcp/src/index.ts',
  'website/src/lib/seo.ts',
  'website/src/lib/demos.ts',
  'website/src/lib/comparisons.ts',
  'website/src/routes/Home.svelte',
  'website/src/routes/Mcp.svelte',
  'tools/prerender-site.mjs',
  'tools/render-social-preview.mjs',
]

// How far below the real total a rounded "N+" claim may sit before it counts as
// stale. 370+ against 373 is fine; 150+ against 373 is not.
const STALE_GAP = 60

// Numbers below this are never the demo total - they are competitors' example
// counts ("20 maintained examples") or turns of phrase ("past 60 unrelated
// demos"), and matching them produces only false positives.
const MIN_CLAIM = 100

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

/**
 * Find demo-count claims in prose and flag the ones that no longer match.
 * A "N+" claim must not overstate the total and must not trail it by more than
 * STALE_GAP; a bare "N demos" claim must be exact.
 */
function verifyClaims(actual) {
  const problems = []
  const claim = /(\d{2,4})(\+?)\s+(?:[\w-]+\s+){0,3}?(demos|examples)/gi
  const constant = /DEMO_COUNT\s*=\s*(\d{2,4})/g

  for (const rel of CLAIM_FILES) {
    let text
    try {
      text = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue // file is optional; the website/ submodule may not be checked out
    }
    const lineOf = (index) => text.slice(0, index).split('\n').length

    for (const m of text.matchAll(claim)) {
      const n = Number(m[1])
      if (n < MIN_CLAIM) continue
      const rounded = m[2] === '+'
      if (rounded && n > actual) problems.push(`${rel}:${lineOf(m.index)} claims "${m[0].trim()}" but only ${actual} exist`)
      else if (rounded && n < actual - STALE_GAP) problems.push(`${rel}:${lineOf(m.index)} claims "${m[0].trim()}" - stale, real total is ${actual}`)
      else if (!rounded && n !== actual) problems.push(`${rel}:${lineOf(m.index)} claims "${m[0].trim()}" but the real total is ${actual}`)
    }
    for (const m of text.matchAll(constant)) {
      const n = Number(m[1])
      if (n !== actual) problems.push(`${rel}:${lineOf(m.index)} sets DEMO_COUNT = ${n} but the real total is ${actual}`)
    }
  }
  return problems
}

const claimProblems = verifyClaims(total)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ firstParty: live.length, community, total, pro, orphanEntries, orphanFiles, claimProblems }, null, 2))
} else {
  console.log(`first-party demos : ${live.length}`)
  console.log(`community demos   : ${community}`)
  console.log(`TOTAL LIVE        : ${total}`)
  console.log(`flagged pro       : ${pro}`)
  if (orphanEntries.length) console.log(`\nregistered but no .svelte file (${orphanEntries.length}): ${orphanEntries.join(', ')}`)
  if (orphanFiles.length) console.log(`\n.svelte file but not registered (${orphanFiles.length}): ${orphanFiles.join(', ')}`)
  if (claimProblems.length) {
    console.log(`\nstale demo-count claims (${claimProblems.length}):`)
    for (const p of claimProblems) console.log(`  ${p}`)
  }
}

// Non-zero exit if the registry and the filesystem disagree, or if a quoted
// count went stale, so CI can gate on it.
process.exit(orphanEntries.length || claimProblems.length ? 1 : 0)
