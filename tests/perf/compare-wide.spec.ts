/**
 * Drives the wide-grid suite of the comparison harness (bench.html?suite=wide)
 * and prints the table. Many columns, few rows: horizontal scrolling and the
 * far jumps a fast scrollbar drag produces.
 *
 * NOT a gate, for the same reason as compare.spec.ts. Run it deliberately,
 * against the production build of the harness:
 *
 *   cd examples && npx vite build --config vite.bench.config.js
 *   npx vite preview --config vite.bench.config.js      (port 4190)
 *   SVGRID_BENCH_PORT=4190 BENCH_COLS=1000 npx playwright test tests/perf/compare-wide.spec.ts --project=perf
 */
import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { trackPhases, type PhaseWork } from './bench-phases'

// Recording video costs CPU during the measurement; the config records every test.
test.use({ video: 'off' })

type WideResult = {
  grid: string
  version: string
  license: string
  rows: number
  cols: number
  mount: number
  hScrollP95: number
  hScrollDropped: number
  jumpP50: number
  jumpP90: number
  domCells: number
  /** Main-thread work per scroll frame / per jump (bench-phases.ts). */
  hScrollWork?: PhaseWork | null
  jumpWork?: PhaseWork | null
  error?: string
}

const ROWS = Number(process.env.BENCH_WIDE_ROWS ?? 500)
const COLS = Number(process.env.BENCH_COLS ?? 1_000)
const REPEATS = Number(process.env.BENCH_REPEATS ?? 3)
const GRIDS = process.env.BENCH_GRIDS ?? 'svgrid,aggrid,svar,tanstack'

test('grid comparison, wide', async ({ page }) => {
  test.setTimeout(1_800_000)
  const errors: string[] = []
  const PORT = process.env.SVGRID_BENCH_PORT ?? '5174'
  const url = `http://localhost:${PORT}/bench.html?suite=wide&rows=${ROWS}&cols=${COLS}&repeats=${REPEATS}&grids=${GRIDS}`

  // One fresh page per grid, as in compare.spec.ts: a grid must not inherit
  // the heap, JIT state or garbage of the one measured before it.
  const results: WideResult[] = []
  for (const grid of GRIDS.split(',')) {
    const fresh = await page.context().newPage()
    fresh.on('pageerror', (e) => errors.push(`${grid}: ${String(e)}`))
    const phases = await trackPhases(fresh)
    try {
      await fresh.goto(url)
      await fresh.locator('#run').waitFor({ timeout: 60_000 })
      const one = (await fresh.evaluate(async (key: string) => {
        const bench = (window as unknown as {
          __gridBench: {
            runWide: (host: HTMLElement, o: { rows: number; cols: number; repeats: number; grids: string[] }) => Promise<unknown>
            host: HTMLElement
            DEFAULTS: { rows: number; cols: number; repeats: number; grids: string[] }
          }
        }).__gridBench
        return bench.runWide(bench.host, { ...bench.DEFAULTS, grids: [key] })
      }, grid)) as WideResult[]
      for (const r of one) {
        r.hScrollWork = phases.work('hscroll', 180)
        r.jumpWork = phases.work('jumps', 30)
      }
      results.push(...one)
    } finally {
      await fresh.close()
    }
  }

  const pad = (s: string | number, n: number) => String(s).padEnd(n)
  const rpad = (s: string | number, n: number) => String(s).padStart(n)
  const num = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
  console.log(`\n  Grid comparison, wide - ${ROWS.toLocaleString()} rows x ${COLS.toLocaleString()} columns, best mount of ${REPEATS}\n`)
  console.log(
    `    ${pad('grid', 30)} ${rpad('mount', 9)} ${rpad('h-scroll p95', 13)} ${rpad('dropped', 8)} ` +
      `${rpad('jump p50', 9)} ${rpad('jump p90', 9)} ${rpad('DOM cells', 10)} ${rpad('work/frame', 11)} ${rpad('work/jump', 10)}`,
  )
  for (const r of results) {
    if (r.error) {
      console.log(`    ${pad(r.grid, 30)} FAILED: ${r.error}`)
      continue
    }
    console.log(
      `    ${pad(r.grid, 30)} ${rpad(num(r.mount), 9)} ${rpad(num(r.hScrollP95), 13)} ${rpad(r.hScrollDropped + '/180', 8)} ` +
        `${rpad(num(r.jumpP50), 9)} ${rpad(num(r.jumpP90), 9)} ${rpad(r.domCells, 10)} ` +
        `${rpad(num(r.hScrollWork?.taskMs ?? NaN), 11)} ${rpad(num(r.jumpWork?.taskMs ?? NaN), 10)}`,
    )
  }
  for (const r of results) if (!r.error) console.log(`      ${r.grid}: ${r.version}, ${r.license}`)
  if (errors.length) console.log(`\n    Page errors: ${errors.slice(0, 5).join(' | ')}\n`)

  writeFileSync(
    join(process.cwd(), 'tests', 'perf', '.last-compare-wide.json'),
    JSON.stringify({ measuredAt: new Date().toISOString(), rows: ROWS, cols: COLS, repeats: REPEATS, grids: GRIDS.split(','), url, results }, null, 2) + '\n',
  )

  // About the harness working, not about who won.
  for (const r of results) {
    expect(r.error, `${r.grid} failed to run: ${r.error}`).toBeUndefined()
    expect(r.mount, `${r.grid} produced no mount timing`).toBeGreaterThan(0)
    expect(r.domCells, `${r.grid} rendered no cells`).toBeGreaterThan(0)
  }
})
