/**
 * Refresh the registry half of docs/_data/competitors.json from npm.
 *
 * For every package a comparison names (plus SvGrid's own and a few the guides
 * quote) this reads the packument and the last-month download count and
 * writes version, licence, publish date, Svelte peer range and downloads with
 * the date they were read. The comparison pages, the hub and the guides
 * render those values; nothing else on the site may type them
 * (tools/competitor-facts.test.ts).
 *
 *   pnpm competitors:verify            refresh every package
 *   pnpm competitors:verify --only X   refresh one package
 *   pnpm competitors:check             offline: fail when a package is missing or stale
 *
 * The bundle and benchmark halves of the ledger are written by other scripts
 * and are carried over untouched.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { loadComparisons, loadLedger, LEDGER_FILE } from './lib/compare-data.mjs'
import { daysBetween } from './lib/competitor-facts.mjs'

/** Packages the guides quote that no comparison names directly. */
const EXTRA_PACKAGES = ['@svgrid/grid', '@humanspeak/svelte-headless-table', 'ag-grid-enterprise', '@tanstack/table-core']

/** A registry entry older than this fails `--check`. */
export const REGISTRY_MAX_AGE_DAYS = 120

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const onlyAt = args.indexOf('--only')
const ONLY = onlyAt !== -1 ? args[onlyAt + 1] : null

const README =
  'Measured facts about the grids the comparison pages name. `registry` is written by tools/verify-competitors.mjs from registry.npmjs.org and api.npmjs.org; `bundles` by packages/grid/scripts/measure-competitor-bundles.mjs; `benchmarks` by tests/perf/compare.spec.ts through tools/record-benchmarks.mjs. Every entry carries the date it was read or measured. Rendered by tools/lib/compare-page.mjs; guarded by tools/competitor-facts.test.ts. Never edit by hand.'

async function fetchJson(url, accept = 'application/json') {
  const r = await fetch(url, { headers: { accept } })
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json()
}

/** The facts for one package, as the registry states them today. */
async function readPackage(name) {
  const doc = await fetchJson(`https://registry.npmjs.org/${name}`)
  const version = doc['dist-tags']?.latest
  if (!version) throw new Error(`${name}: no latest dist-tag`)
  const v = doc.versions?.[version] ?? {}
  const license = typeof v.license === 'string' ? v.license : typeof v.license?.type === 'string' ? v.license.type : typeof doc.license === 'string' ? doc.license : ''
  const peerSvelte = v.peerDependencies?.svelte ?? null
  const lastPublished = String(doc.time?.[version] ?? '').slice(0, 10)
  const dl = await fetchJson(`https://api.npmjs.org/downloads/point/last-month/${name}`)
  return {
    version,
    license,
    lastPublished,
    peerSvelte,
    downloadsLastMonth: Number(dl.downloads ?? 0),
    downloadsWindow: { start: String(dl.start ?? ''), end: String(dl.end ?? '') },
    verified: new Date().toISOString().slice(0, 10),
    sources: [`https://registry.npmjs.org/${name}`, `https://api.npmjs.org/downloads/point/last-month/${name}`],
  }
}

const comparisons = await loadComparisons()
const packages = [...new Set([...comparisons.map((c) => c.npm).filter(Boolean), ...EXTRA_PACKAGES])].sort()
const ledger = await loadLedger()

if (CHECK) {
  const today = new Date().toISOString().slice(0, 10)
  const problems = []
  for (const name of packages) {
    const reg = ledger.registry[name]
    if (!reg) { problems.push(`${name}: not in the ledger (run pnpm competitors:verify)`); continue }
    const age = daysBetween(reg.verified, today)
    if (!(age <= REGISTRY_MAX_AGE_DAYS)) problems.push(`${name}: verified ${reg.verified}, ${age} days ago (limit ${REGISTRY_MAX_AGE_DAYS})`)
  }
  if (problems.length) {
    console.error('competitors:check failed:\n  ' + problems.join('\n  '))
    process.exit(1)
  }
  console.log(`competitors:check ok - ${packages.length} packages, all verified within ${REGISTRY_MAX_AGE_DAYS} days`)
  process.exit(0)
}

const registry = { ...ledger.registry }
const targets = ONLY ? packages.filter((p) => p === ONLY) : packages
if (ONLY && !targets.length) {
  console.error(`--only ${ONLY}: no comparison names that package`)
  process.exit(1)
}
let failed = 0
for (const name of targets) {
  try {
    registry[name] = await readPackage(name)
    const r = registry[name]
    console.log(`${name.padEnd(36)} ${r.version.padEnd(10)} ${(r.license || '?').padEnd(22)} ${String(r.downloadsLastMonth).padStart(10)} dl/month  published ${r.lastPublished}${r.peerSvelte ? `  svelte ${r.peerSvelte}` : ''}`)
  } catch (err) {
    failed += 1
    console.error(`${name}: ${err.message}`)
  }
}

const out = {
  readme: README,
  registry: Object.fromEntries(Object.keys(registry).sort().map((k) => [k, registry[k]])),
  bundles: ledger.bundles ?? {},
  ...(ledger.benchmarks ? { benchmarks: ledger.benchmarks } : {}),
}
await mkdir(dirname(LEDGER_FILE), { recursive: true })
await writeFile(LEDGER_FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8')
console.log(`wrote ${LEDGER_FILE} (${Object.keys(out.registry).length} packages${failed ? `, ${failed} failed` : ''})`)
if (failed) process.exit(1)
