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

/**
 * The newest demos must carry an `added` date, which is what drives the "new"
 * dot in the gallery (see isNewDemo in website/src/lib/demos.ts).
 *
 * Checked here rather than trusted to memory because the failure is silent: a
 * demo with no date simply never shows the dot, and nobody notices a badge
 * that did not appear. The window is the three highest-numbered demos - ids
 * are assigned incrementally, so those are the recent ones, and dating an
 * older demo would be pointless anyway since the dot expires on age.
 *
 * A date already present is also checked for shape and for being in the past,
 * since a future date would read as "new" indefinitely.
 */
function verifyAddedDates() {
  const problems = []
  const today = new Date().toISOString().slice(0, 10)

  // Slice the registry into one span per `demo(` call. Matching id and date
  // with a single regex does NOT work: a lazy `[\s\S]*?` between them happily
  // runs past dozens of entries, so an undated demo gets paired with some
  // later demo's date and the error names the wrong file.
  const entries = new Map()
  const calls = [...src.matchAll(/\bdemo\(\s*'([^']+)'/g)]
  for (const [i, m] of calls.entries()) {
    const end = i + 1 < calls.length ? calls[i + 1].index : src.length
    entries.set(m[1], src.slice(m.index, end))
  }

  for (const [id, entry] of entries) {
    const m = entry.match(/\badded:\s*'([^']*)'/)
    if (!m) continue
    const date = m[1]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push(`${id} has added: '${date}', which is not YYYY-MM-DD`)
    else if (date > today) problems.push(`${id} has added: '${date}', which is in the future`)
  }

  const newest = live
    .map((id) => ({ id, n: Number.parseInt(id, 10) }))
    .filter((d) => Number.isFinite(d.n))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)

  for (const { id } of newest) {
    if (!/\badded:\s*'/.test(entries.get(id) ?? '')) {
      problems.push(`${id} is one of the newest demos but has no \`added\` date, so it will not show the "new" dot`)
    }
  }
  return problems
}

const dateProblems = verifyAddedDates()

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ firstParty: live.length, community, total, pro, orphanEntries, orphanFiles, claimProblems, dateProblems }, null, 2))
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
  if (dateProblems.length) {
    console.log(`\nmissing / bad \`added\` dates (${dateProblems.length}):`)
    for (const p of dateProblems) console.log(`  ${p}`)
  }
}

// Non-zero exit if the registry and the filesystem disagree, or if a quoted
// count went stale, so CI can gate on it.
process.exit(orphanEntries.length || claimProblems.length || dateProblems.length ? 1 : 0)
