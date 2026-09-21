/**
 * Move the last `pnpm bench:compare` run into the `benchmarks` block of
 * docs/_data/competitors.json, with the rig and the date, so comparison.md
 * and the compare pages render the numbers from the ledger instead of a
 * table someone pasted.
 *
 *   pnpm bench:compare            (writes tests/perf/.last-compare.json)
 *   node tools/record-benchmarks.mjs
 *
 * Only grids whose licence allows publishing are recorded; the local
 * adapters (examples/src/bench/adapters.local.ts) never reach the ledger
 * because the harness only sees them when BENCH_GRIDS names them and this
 * script only accepts the keys below.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arch, cpus, platform, release } from 'node:os'
import { loadLedger, LEDGER_FILE } from './lib/compare-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RUN_FILE = join(ROOT, 'tests', 'perf', '.last-compare.json')

/** Harness key -> what the ledger publishes. Anything else is dropped. */
const PUBLISHABLE = {
  svgrid: { id: 'svgrid', label: 'SvGrid', npm: '@svgrid/grid' },
  aggrid: { id: 'aggrid', label: 'AG Grid Community', npm: 'ag-grid-community' },
  svar: { id: 'svar', label: 'SVAR Svelte DataGrid', npm: 'wx-svelte-grid' },
  tanstack: { id: 'tanstack', label: 'TanStack Table, minimal DOM', npm: '@tanstack/svelte-table' },
}
const NAME_TO_KEY = {
  'sv-grid': 'svgrid',
  'AG Grid Community': 'aggrid',
  'SVAR Svelte DataGrid': 'svar',
  'TanStack Table (minimal DOM)': 'tanstack',
}

const run = JSON.parse(await readFile(RUN_FILE, 'utf-8'))
const ledger = await loadLedger()
const grids = []
for (const r of run.results) {
  const key = NAME_TO_KEY[r.grid]
  const pub = key ? PUBLISHABLE[key] : null
  if (!pub) { console.log(`skipping ${r.grid}: not a published grid`); continue }
  if (r.error) { console.error(`${r.grid}: run failed (${r.error}); not recorded`); continue }
  const ms = (v) => (Number.isFinite(v) ? Number(v.toFixed(1)) : null)
  grids.push({
    id: pub.id,
    label: pub.label,
    npm: pub.npm,
    version: r.version,
    results: {
      mount: ms(r.mount),
      sortText: ms(r.sortText),
      sortNumber: ms(r.sortNumber),
      filter: ms(r.filter),
      scrollP95: ms(r.scrollP95),
      scrollDropped: Number.isFinite(r.scrollDropped) ? r.scrollDropped : null,
      // A tick is only recorded when the grid kept the sort across it;
      // otherwise it did less than the others and the number would mislead.
      tickP95: r.tickSortHeld ? ms(r.tickP95) : null,
      tickOverBudget: r.tickSortHeld && Number.isFinite(r.tickOverBudget) ? r.tickOverBudget : null,
      domRows: r.domRows,
    },
  })
}
if (!grids.length) {
  console.error('no publishable results in the last run')
  process.exit(1)
}

const cpu = cpus()[0]?.model?.replace(/\s+/g, ' ').trim() ?? 'unknown CPU'
const benchmarks = {
  measuredAt: String(run.measuredAt).slice(0, 10),
  rows: run.rows,
  repeats: run.repeats,
  cases: ['mount', 'sortText', 'sortNumber', 'filter', 'scrollP95', 'tickP95'],
  rig: {
    statistic: `fastest of ${run.repeats} samples per operation, each grid in a fresh page`,
    browser: 'Chromium through Playwright, headless',
    machine: `${platform()} ${release()} ${arch()}, ${cpu}; a developer workstation, not a dedicated bench rig`,
    container: '1000 x 520 px container, 32 px rows, 140 px columns, each grid with its default theme',
    tick: '1,000 of the rows replaced per tick with a new amount, the grid sorted by amount, on the update path each grid provides, timed until the changed cells paint; 180 ticks after 10 to warm up',
  },
  grids,
}

const raw = JSON.parse(await readFile(LEDGER_FILE, 'utf-8'))
const out = { readme: raw.readme, registry: ledger.registry, bundles: ledger.bundles, benchmarks }
await writeFile(LEDGER_FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8')
console.log(`recorded ${grids.length} grids measured ${benchmarks.measuredAt} into ${LEDGER_FILE}`)
for (const g of grids) console.log(`  ${g.label.padEnd(30)} ${g.version.padEnd(10)} mount ${g.results.mount} ms, sort text ${g.results.sortText} ms, sort num ${g.results.sortNumber} ms, filter ${g.results.filter} ms, scroll p95 ${g.results.scrollP95} ms, tick p95 ${g.results.tickP95} ms`)
