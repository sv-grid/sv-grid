/**
 * First-paint measurement: how long from asking for a dataset to seeing rows.
 *
 * docs/help/benchmarks.md carried a first-paint table for a long time that
 * nothing produced. `pnpm bench` closed that hole for the row pipeline, but the
 * pipeline runs in Node and paint does not - these numbers need a real browser,
 * a real layout, and a real compositor.
 *
 * NOT a PR gate. It is a release ritual: run it, read it, paste the numbers into
 * the docs. Wall-clock in a browser on a shared runner is even noisier than in
 * Node, and a flaky perf gate gets disabled within a month of landing. The gate
 * that CI does run is `pnpm bench:check`, which counts algorithmic work instead.
 *
 * Runs against the examples gallery on :5174, which lives in this repo, so it
 * works on a checkout without the private website submodule.
 *
 *   pnpm bench:dom
 */
import { test, expect } from '@playwright/test'

const DEMO = 'http://localhost:5174/#/06-large-dataset'

/**
 * The dataset buttons demo 06 renders, with the row count each one reports when
 * it has finished loading.
 *
 * The completion signal is that readout rather than the grid unmounting. The
 * demo does clear `rows` before generating, but Svelte flushes that on a
 * microtask, so for the smaller sizes the DOM can go from the old rows to the
 * new ones between two animation frames and an observer watching for zero rows
 * never sees it. The readout only renders once `busy` is false and rows exist,
 * which is exactly the state we are timing.
 */
const SIZES = [
  { label: '1k × 29', done: '1,000 rows' },
  { label: '10k × 53', done: '10,000 rows' },
  { label: '50k × 77', done: '50,000 rows' },
  { label: '100k × 100', done: '100,000 rows' },
]

/**
 * Click a dataset button and time it until the new rows are on screen.
 *
 * Stops on the first animation frame AFTER the readout confirms the new dataset
 * and rows are present, so the number includes layout and paint. The demo's own
 * "generated in N ms" figure measures only the data build, which is the smaller
 * half.
 */
async function timeSize(
  page: import('@playwright/test').Page,
  size: { label: string; done: string },
): Promise<{ total: number; build: number | null }> {
  return page.evaluate(async ({ label, done }) => {
    const button = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === label,
    ) as HTMLButtonElement | undefined
    if (!button) throw new Error(`no dataset button labelled "${label}"`)
    if (button.disabled) throw new Error(`dataset button "${label}" is disabled (already active)`)

    const ready = () =>
      document.body.innerText.includes(done) &&
      document.querySelectorAll('tr.sv-grid-row').length > 0

    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

    const t0 = performance.now()
    button.click()

    const deadline = t0 + 120_000
    for (;;) {
      await frame()
      if (ready()) {
        await frame() // one more so what we observed has been painted
        const total = performance.now() - t0
        // The demo reports how long it spent building the synthetic dataset.
        // Splitting that out matters: generating 100k x 95 cells of test data
        // is the demo's cost, not the grid's, and lumping the two together
        // would overstate what a real app with data already in hand pays.
        const m = /generated in (\d+) ms/.exec(document.body.innerText)
        const build = m ? Number(m[1]) : null
        return { total, build }
      }
      if (performance.now() > deadline) throw new Error(`timed out waiting for "${label}"`)
    }
  }, size)
}

test('first paint across dataset sizes', async ({ page }) => {
  test.setTimeout(600_000)

  await page.goto(DEMO)
  await expect(page.locator('tr.sv-grid-row').first()).toBeVisible({ timeout: 120_000 })

  /** Which dataset button is active - the demo disables that one. */
  const activeSize = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => (b as HTMLButtonElement).disabled)
        .map((b) => (b.textContent ?? '').trim())
        .find((t) => /\d.*×/.test(t)) ?? null,
    )

  const results: Array<{ size: string; total: number; build: number | null }> = []
  for (const size of SIZES) {
    const runs: Array<{ total: number; build: number | null }> = []
    // Two samples, keep the faster. Noise only ever adds time - a scheduler
    // hiccup or a GC pause cannot make a build finish sooner - so the minimum
    // is the cleanest estimate of what the machine can do. Reported, not gated.
    for (let i = 0; i < 2; i++) {
      if ((await activeSize()) === size.label) {
        // Bounce through a different size so the next click is a real
        // transition. The smallest is the cheapest, unless that IS the target.
        await timeSize(page, size.label === SIZES[0]!.label ? SIZES[1]! : SIZES[0]!)
      }
      runs.push(await timeSize(page, size))
    }
    const best = runs.reduce((a, b) => (b.total < a.total ? b : a))
    results.push({ size: size.label, ...best })
  }

  console.log('\n  First paint, click dataset -> rows painted\n')
  console.log(`    ${'size'.padEnd(14)} ${'total'.padStart(9)} ${'build data'.padStart(11)} ${'grid'.padStart(9)}`)
  for (const r of results) {
    const grid = r.build != null ? (r.total - r.build).toFixed(0) + ' ms' : 'n/a'
    const build = r.build != null ? r.build + ' ms' : 'n/a'
    console.log(
      `    ${r.size.padEnd(14)} ${(r.total.toFixed(0) + ' ms').padStart(9)} ${build.padStart(11)} ${grid.padStart(9)}`,
    )
  }
  console.log('\n    "build data" is the demo generating synthetic rows, which a real')
  console.log('    app does not pay. "grid" is the remainder: mount, layout, paint.\n')

  // The only assertion: every size actually rendered. Timing is reported, not
  // gated - see the header. A zero here would mean the measurement broke, not
  // that the grid got infinitely fast.
  for (const r of results) expect(r.total).toBeGreaterThan(0)
})
