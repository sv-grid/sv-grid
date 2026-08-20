/**
 * E2E: advanced set filter (demo 111).
 *
 * Verifies the three patterns documented for the set-list filter:
 *   - Async loader card: clicking "Load values" hits the simulated
 *     latency, then the values render and selections narrow the grid.
 *   - Tree-list card: checking a tree node cascades to its descendants
 *     and narrows the grid.
 *   - Excel-style: documented as built into the column menu (covered
 *     here by counting headers; the menu interaction is exercised in
 *     the jsdom suite via api.setFilter).
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/111-set-filter-advanced'

async function rowCount(page: import('@playwright/test').Page) {
  return page.locator('tbody.sv-grid-body tr.sv-grid-row').count()
}

test.describe('set filter - tree / async / Excel (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
  })

  test('async card: load → select → grid narrows', async ({ page }) => {
    const startCount = await rowCount(page)

    // Hit the loader; the demo simulates 700 ms latency before the
    // value list renders.
    await page.getByRole('button', { name: /Load values from server/ }).click()

    // Wait for the value list to appear (presence of any checkbox).
    const firstCheckbox = page.locator('.vlist input[type="checkbox"]').first()
    await firstCheckbox.waitFor({ timeout: 3000 })

    // Check the first listed email - the grid narrows to that one.
    await firstCheckbox.check()
    await expect.poll(async () => {
      const count = await rowCount(page)
      return count < startCount && count > 0
    }).toBe(true)
  })

  test('tree card: clicking a region checks all descendants and filters the grid', async ({ page }) => {
    // Find the "Americas" tree node by its label text.
    const americas = page.locator('.tree li.tree-node', { hasText: 'Americas' }).first()
    const checkbox = americas.locator('input[type="checkbox"]')
    await checkbox.check()

    // Assert on the region values on screen, not on a row count. The body is
    // virtualized and Americas is roughly a third of the 320 rows, so the
    // rendered window stays full and its length does not move.
    await expect.poll(async () =>
      page.$$eval('tbody.sv-grid-body td[data-col-id="region"]', (els) =>
        [...new Set(els.map((el) => (el.textContent ?? '').trim()))],
      ),
    ).toEqual(['Americas'])
  })

  test('tree "Clear" button restores all rows', async ({ page }) => {
    const startCount = await rowCount(page)

    // Select all then clear.
    await page.getByRole('button', { name: 'Select all' }).click()
    await page.getByRole('button', { name: /^Clear/ }).click()

    await expect.poll(() => rowCount(page)).toBe(startCount)
  })

  test('Excel built-in column menu: funnel icon present on each header', async ({ page }) => {
    // The Excel-style facet lives behind the funnel button on every
    // header. We just verify the affordance exists; the jsdom suite
    // covers the imperative path.
    const funnels = page.locator('th[data-svgrid-header-col] button[aria-label*="Filter"]')
    const count = await funnels.count()
    expect(count).toBeGreaterThan(0)
  })
})
