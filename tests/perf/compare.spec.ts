/**
 * Drives the grid comparison harness headlessly and prints the table.
 *
 * The harness itself lives in `examples/src/bench/` and is a real page a human
 * can open at /bench.html. This spec calls the same entry point that the Run
 * button does, so the automated numbers and the numbers someone sees in a
 * browser come from identical code.
 *
 * NOT a gate. It compares against a third-party package whose version we do
 * not control, so a CI failure here would mean "they shipped a release", not
 * "we regressed". Run it deliberately:
 *
 *   pnpm bench:compare
 */
import { test, expect } from '@playwright/test'

type GridResult = {
  grid: string
  version: string
  license: string
  mount: number
  sortText: number
  sortNumber: number
  filter: number
  scrollP95: number
  scrollDropped: number
  domRows: number
  error?: string
}

const ROWS = Number(process.env.BENCH_ROWS ?? 100_000)
const REPEATS = Number(process.env.BENCH_REPEATS ?? 3)
const GRIDS = process.env.BENCH_GRIDS ?? 'svgrid,aggrid'

test('grid comparison', async ({ page }) => {
  test.setTimeout(900_000)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  const url = `http://localhost:5174/bench.html?rows=${ROWS}&repeats=${REPEATS}&grids=${GRIDS}`

  // Warm Vite's dependency optimizer before measuring anything. The adapters
  // import their grids lazily, so the first run discovers new dependencies
  // mid-benchmark; Vite then re-optimizes and force-reloads the page, which
  // destroys the execution context under `page.evaluate`. Touching each adapter
  // once, then reloading, gets that out of the way - and also means the first
  // measured mount is not the one paying for a cold module graph.
  await page.goto(url)
  await page.locator('#run').waitFor({ timeout: 60_000 })
  await page
    .evaluate(async (grids: string[]) => {
      const mod = await import('/src/bench/adapters.ts')
      const load = (mod as { loadAdapters: () => Promise<Record<string, () => Promise<unknown>>> }).loadAdapters
      const all = await load()
      for (const g of grids) {
        try {
          await all[g]?.()
        } catch {
          /* reported properly by the real run below */
        }
      }
    }, GRIDS.split(','))
    .catch(() => {
      /* a reload during warm-up is exactly what we are flushing out */
    })

  await page.goto(url, { waitUntil: 'load' })
  await page.locator('#run').waitFor({ timeout: 60_000 })

  // Each grid gets a FRESH PAGE.
  //
  // They used to run one after another in the same page, and that made the
  // comparison meaningless: the first grid warmed the JIT, fragmented the heap
  // and left 100k rows of garbage for the second to trip over. Back-to-back
  // runs on an idle machine had the second grid's text sort read 550 ms and
  // then 300 ms, and its mount 93 ms and then 52 ms, with no code change
  // between them. That is the same order-dependence the Node suite had, which
  // is fixed there by running every case in its own process.
  //
  // A fresh page per grid is the browser equivalent - new JS heap, new module
  // instances, nothing carried over.
  const results: GridResult[] = []
  for (const grid of GRIDS.split(',')) {
    const fresh = await page.context().newPage()
    fresh.on('pageerror', (e) => errors.push(String(e)))
    try {
      await fresh.goto(url)
      await fresh.locator('#run').waitFor({ timeout: 60_000 })
      const one = (await fresh.evaluate(async (key: string) => {
        const bench = (window as unknown as {
          __gridBench: {
            runAll: (host: HTMLElement, o: { rows: number; repeats: number; grids: string[] }) => Promise<unknown>
            host: HTMLElement
            DEFAULTS: { rows: number; repeats: number; grids: string[] }
          }
        }).__gridBench
        return bench.runAll(bench.host, { ...bench.DEFAULTS, grids: [key] })
      }, grid)) as GridResult[]
      results.push(...one)
    } finally {
      await fresh.close()
    }
  }

  const pad = (s: string | number, n: number) => String(s).padEnd(n)
  const rpad = (s: string | number, n: number) => String(s).padStart(n)
  const num = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')

  console.log(`\n  Grid comparison - ${ROWS.toLocaleString()} rows x 9 columns, median of ${REPEATS}\n`)
  console.log(
    `    ${pad('grid', 24)} ${rpad('mount', 9)} ${rpad('sort txt', 9)} ${rpad('sort num', 9)} ` +
    `${rpad('filter', 8)} ${rpad('scroll p95', 11)} ${rpad('dropped', 8)} ${rpad('DOM rows', 9)}`,
  )
  for (const r of results) {
    if (r.error) {
      console.log(`    ${pad(r.grid, 24)} FAILED: ${r.error}`)
      continue
    }
    console.log(
      `    ${pad(r.grid, 24)} ${rpad(num(r.mount), 9)} ${rpad(num(r.sortText), 9)} ` +
      `${rpad(num(r.sortNumber), 9)} ${rpad(num(r.filter), 8)} ${rpad(num(r.scrollP95), 11)} ` +
      `${rpad(r.scrollDropped + '/180', 8)} ${rpad(r.domRows, 9)}`,
    )
  }
  for (const r of results) {
    if (!r.error) console.log(`      ${r.grid}: ${r.version}, ${r.license}`)
  }
  console.log('\n    Lower is better except DOM rows, which shows virtualization is on.')
  console.log('    Filter is indicative only - see the note in examples/src/bench/run.ts.\n')

  if (errors.length) console.log(`    Page errors: ${errors.slice(0, 5).join(' | ')}\n`)

  // Assertions are about the harness working, not about who won. A grid that
  // failed to load, or that rendered every row into the DOM, means the run is
  // not a valid comparison and the numbers above should not be read.
  for (const r of results) {
    expect(r.error, `${r.grid} failed to run: ${r.error}`).toBeUndefined()
    expect(r.mount, `${r.grid} produced no mount timing`).toBeGreaterThan(0)
    expect(r.domRows, `${r.grid} rendered no rows`).toBeGreaterThan(0)
    expect(
      r.domRows,
      `${r.grid} kept ${r.domRows} rows in the DOM - virtualization is off, so this is not a like-for-like run`,
    ).toBeLessThan(ROWS / 10)
  }
})
