/**
 * E2E: the 100,000-row market blotter stays sorted while the feed ticks.
 *
 * jsdom cannot run the feed's animation-frame loop against a real layout, so
 * this runs the demo in a browser: 100,000 rows are reported, updates are
 * being applied, the first visible rows stay in descending % change while
 * the feed runs, and only a window of rows is in the DOM. The frame-time
 * readout is printed for the log but not asserted: this runs on shared CI
 * machines, and a perf gate that flakes gets switched off (see
 * tests/perf/README-style note in scroll-p95.spec.ts).
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/495-market-blotter-100k'

async function firstPctValues(page: Page, count: number): Promise<number[]> {
  return page.evaluate((n) => {
    const rows = Array.from(document.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)')).slice(0, n)
    return rows.map((tr) => {
      // Chg % is the fifth harness column; symbol is pinned, so read by header order.
      const cells = Array.from(tr.querySelectorAll('td.sv-grid-cell:not(.sv-grid-selection-cell)'))
      const pct = cells[4]
      return Number(String(pct?.textContent ?? '').replace(/[^0-9.-]/g, ''))
    })
  }, count)
}

test('100k rows, the sort holds under the feed, and the DOM stays a window', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(DEMO)
  await expect(page.getByTestId('blotter-rows')).toHaveText('100,000', { timeout: 60_000 })
  await page.locator('tbody.sv-grid-body tr.sv-grid-row').first().waitFor({ timeout: 30_000 })

  // The feed is applying: the per-second counter moves off zero.
  await expect
    .poll(async () => Number((await page.getByTestId('blotter-rate').textContent())?.replace(/,/g, '') ?? 0), { timeout: 15_000 })
    .toBeGreaterThan(0)

  // Let it run, then check the order three times a second apart. Descending
  // by % change: each of the first rows >= the next.
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(1000)
    const top = await firstPctValues(page, 6)
    expect(top.length).toBeGreaterThanOrEqual(3)
    for (let j = 1; j < top.length; j++) expect(top[j]!).toBeLessThanOrEqual(top[j - 1]!)
  }

  const domRows = await page.locator('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)').count()
  expect(domRows).toBeLessThan(100)

  const p95 = await page.getByTestId('blotter-p95').textContent()
  console.log(`market blotter: frame p95 over the last 3 s = ${p95}, DOM rows = ${domRows}`)
  expect(errors).toEqual([])
})
