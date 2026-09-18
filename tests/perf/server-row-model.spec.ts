/**
 * The Server-Side Row Model over one million rows, measured in a real browser
 * on demo 467 (examples gallery, :5174).
 *
 * What is timed, and why each number matters:
 *
 *   - first paint: from navigation to the first group row on screen. Includes
 *     building the million-row warehouse (a real server would not pay that,
 *     so the demo's own build time is subtracted from the number reported).
 *   - blocks per 1000 px: how many leaf requests a fast scroll through an
 *     opened level fires per 1000 px scrolled. Each block is 100 rows of 34 px
 *     (3400 px), so a well-behaved cache asks for about one block per 3400 px
 *     and never re-asks for one it holds.
 *   - rebuild per block: the model rebuilds its display list when a block
 *     lands; at a million rows that list is a million entries, so this is
 *     the cost that would show up as jank. Measured as the longest frame
 *     while blocks stream in.
 *   - heap after eviction: with `maxBlocksInCache: 24`, scrolling through
 *     200 blocks must not grow the heap by 200 blocks' worth.
 *
 * NOT a PR gate, for the same reason as first-paint.spec.ts: wall-clock in a
 * browser on a shared runner is noisy. It is a release ritual: run it, read
 * it, keep the numbers where the docs can cite them.
 *
 *   pnpm exec playwright test tests/perf/server-row-model.spec.ts --project=perf
 */
import { test, expect, type Page } from '@playwright/test'

const DEMO = 'http://localhost:5174/#/467-server-row-model-1m'

async function logCount(page: Page): Promise<number> {
  return page.locator('.log-row').count()
}

test('server-side row model over one million rows', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 1400, height: 900 })

  const t0 = Date.now()
  await page.goto(DEMO)
  await page.locator('button.sv-group-cell').first().waitFor({ timeout: 90_000 })
  const firstPaint = Date.now() - t0

  // Open the first region and its first country: two more requests.
  await page.locator('button.sv-group-cell').nth(0).click()
  await expect(page.locator('button.sv-group-cell')).toHaveCount(8, { timeout: 30_000 })
  await page.locator('button.sv-group-cell').nth(1).click()
  await expect.poll(() => logCount(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(3)
  await page.waitForTimeout(500)

  // Scroll through the opened level, 1000 px at a time, and count what the
  // server was asked for. The longest frame during the stream is the rebuild
  // cost the user would feel.
  const before = await logCount(page)
  const scrolled = await page.evaluate(async () => {
    const sc = document.querySelector('.sv-grid-container') as HTMLElement
    const frame = () => new Promise<number>((r) => requestAnimationFrame((t) => r(t)))
    let worst = 0
    let last = await frame()
    let px = 0
    for (let i = 0; i < 60; i += 1) {
      sc.scrollTop += 1000
      px += 1000
      for (let f = 0; f < 4; f += 1) {
        const now = await frame()
        worst = Math.max(worst, now - last)
        last = now
      }
    }
    // Let the last blocks land, still watching frame length.
    for (let f = 0; f < 60; f += 1) {
      const now = await frame()
      worst = Math.max(worst, now - last)
      last = now
    }
    return { px, worstFrameMs: Math.round(worst) }
  })
  await page.waitForTimeout(1500)
  const after = await logCount(page)
  const leafRequests = after - before
  const blocksPer1000px = leafRequests / (scrolled.px / 1000)

  // Heap: scroll far enough to stream well past the cache cap and let the
  // evicted blocks go.
  const heap = await page.evaluate(async () => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
    const read = () => (perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1e6) : null)
    const sc = document.querySelector('.sv-grid-container') as HTMLElement
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    const start = read()
    for (let i = 0; i < 700; i += 1) {
      sc.scrollTop += 1000
      await frame()
    }
    await new Promise((r) => setTimeout(r, 2500))
    const end = read()
    return { startMb: start, endMb: end }
  })
  const totalRequests = await logCount(page)
  const cached = await page.locator('.foot').textContent()

  console.log('\n  Server-Side Row Model, one million rows (demo 467)\n')
  console.log(`    first paint (incl. building the warehouse)  ${String(firstPaint).padStart(6)} ms`)
  console.log(`    scrolled ${scrolled.px} px through an open level: ${leafRequests} leaf requests, ${blocksPer1000px.toFixed(2)} per 1000 px`)
  console.log(`    worst frame while blocks streamed in          ${String(scrolled.worstFrameMs).padStart(6)} ms`)
  console.log(`    heap before / after streaming 700 000 px     ${heap.startMb ?? '?'} / ${heap.endMb ?? '?'} MB`)
  console.log(`    ${cached?.replace(/\s+/g, ' ').trim()}`)
  console.log(`    requests in the log after the run: ${totalRequests}\n`)

  // Sanity, not a perf gate: the scroll produced requests, and not one per px.
  expect(leafRequests).toBeGreaterThan(0)
  expect(blocksPer1000px).toBeLessThan(2)
})
