/**
 * Sustained-scroll frame time, as a 95th percentile.
 *
 * p95 rather than mean FPS on purpose: a mean smooths over exactly the stutter
 * a user notices. One 90 ms frame in a second of scrolling is visible jank and
 * barely moves an average.
 *
 * NOT a PR gate, for the same reason as first-paint.spec.ts - see its header.
 * Reported, read at release time, pasted into docs/help/benchmarks.md.
 *
 *   pnpm bench:dom
 */
import { test, expect } from '@playwright/test'

type Sample = { p50: number; p95: number; max: number; frames: number; longFrames: number }

/**
 * Wheel-scroll the grid body and sample the gap between animation frames.
 *
 * Driven from inside the page rather than with Playwright's mouse API: CDP
 * input events arrive on their own cadence, which shows up in the frame deltas
 * as if it were rendering cost. Dispatching the wheel and sampling in the same
 * rAF loop measures the grid, not the driver.
 */
async function measureScroll(
  page: import('@playwright/test').Page,
  opts: { frames: number; dy: number },
): Promise<Sample> {
  return page.evaluate(async ({ frames, dy }) => {
    const scroller =
      document.querySelector<HTMLElement>('.sv-grid-scroll') ??
      document.querySelector<HTMLElement>('.sv-grid-body-wrap') ??
      document.querySelector<HTMLElement>('.sv-grid-root')
    if (!scroller) throw new Error('no grid scroll container found')

    const deltas: number[] = []
    let last = performance.now()

    // Warm-up: let the virtualizer settle before sampling.
    for (let i = 0; i < 20; i++) {
      scroller.scrollTop += dy
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }

    last = performance.now()
    for (let i = 0; i < frames; i++) {
      scroller.scrollTop += dy
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const now = performance.now()
      deltas.push(now - last)
      last = now
      // Bounce off the bottom so a long run keeps doing real work.
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - dy) {
        scroller.scrollTop = 0
      }
    }

    const sorted = [...deltas].sort((a, b) => a - b)
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!
    const p50 = at(0.5)
    // A frame is "long" when it took more than 1.5 display intervals, i.e. the
    // compositor missed a vsync. Since the loop is driven by rAF, the interval
    // can never come in UNDER the refresh rate - so the absolute numbers are
    // floored at ~16.7ms on a 60Hz panel and the only meaningful question is
    // how often a frame was missed.
    const longFrames = deltas.filter((d) => d > p50 * 1.5).length
    return { p50, p95: at(0.95), max: sorted[sorted.length - 1]!, frames: deltas.length, longFrames }
  }, opts)
}

const CASES = [
  { name: '100k rows x 100 cols', url: 'http://localhost:5174/#/06-large-dataset', size: '100k × 100' },
  { name: '1,000,000 rows x 9 cols', url: 'http://localhost:5174/#/78-million-rows', size: null },
]

test('sustained scroll frame time', async ({ page }) => {
  test.setTimeout(300_000)

  const results: Array<{ name: string } & Sample> = []

  for (const c of CASES) {
    await page.goto(c.url)
    await expect(page.locator('tr.sv-grid-row').first()).toBeVisible({ timeout: 120_000 })

    if (c.size) {
      await page.getByRole('button', { name: c.size, exact: true }).click()
      // The demo unmounts the grid while it builds the bigger dataset.
      await expect(page.locator('tr.sv-grid-row').first()).toBeVisible({ timeout: 120_000 })
    }

    const sample = await measureScroll(page, { frames: 240, dy: 60 })
    results.push({ name: c.name, ...sample })
  }

  console.log('\n  Sustained scroll, 60 px/frame, frame intervals in ms\n')
  console.log(
    `    ${'case'.padEnd(26)} ${'p50'.padStart(7)} ${'p95'.padStart(7)} ${'max'.padStart(7)} ${'dropped'.padStart(9)}`,
  )
  for (const r of results) {
    const dropped = `${r.longFrames}/${r.frames}`
    console.log(
      `    ${r.name.padEnd(26)} ${r.p50.toFixed(1).padStart(7)} ${r.p95.toFixed(1).padStart(7)} ` +
      `${r.max.toFixed(1).padStart(7)} ${dropped.padStart(9)}`,
    )
  }
  console.log('\n    The loop is rAF-driven, so an interval can never fall below the')
  console.log('    display refresh (~16.7ms at 60Hz). These numbers answer "does it')
  console.log('    hold the frame budget", not "how cheap is a frame". The dropped')
  console.log('    column - frames over 1.5x the median - is the jank signal.\n')

  // Sanity only: we sampled real frames. Timings are reported, not gated.
  for (const r of results) {
    expect(r.frames).toBeGreaterThan(200)
    expect(r.p50).toBeGreaterThan(0)
  }
})
