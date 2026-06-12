/**
 * E2E: engine-level pinned rows.
 *
 * Verifies that the `pinnedTopRows` and `pinnedBottomRows` props render
 * sticky rows in the same table, and that they stay visible while the
 * main row set scrolls. jsdom can't measure layout, so the
 * scroll-stays-visible assertion must live here.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/108-pinned-rows-engine'

test.describe('pinned rows (engine, real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
  })

  test('renders pinned-top tbody with the totals + benchmark rows', async ({ page }) => {
    const trs = page.locator('tbody.sv-grid-pinned-top-body tr.sv-grid-pinned-row-top')
    await expect(trs).toHaveCount(2)
  })

  test('renders pinned-bottom tbody with the page-totals row', async ({ page }) => {
    const trs = page.locator('tbody.sv-grid-pinned-bottom-body tr.sv-grid-pinned-row-bottom')
    await expect(trs).toHaveCount(1)
  })

  test('top + bottom pinned rows stay visible after scrolling 1000px down', async ({ page }) => {
    const top = page.locator('tr.sv-grid-pinned-row-top').first()
    const bot = page.locator('tr.sv-grid-pinned-row-bottom').first()
    await expect(top).toBeVisible()
    await expect(bot).toBeVisible()

    // Scroll the grid's internal container, not the page.
    await page.evaluate(() => {
      const sc = document.querySelector('.sv-grid-container') as HTMLElement | null
      if (sc) sc.scrollTop = 1000
    })

    // Sticky → both should still be in the viewport.
    await expect(top).toBeVisible()
    await expect(bot).toBeVisible()
  })

  test('toggling "Top pinned" off removes the top tbody', async ({ page }) => {
    const topBody = page.locator('tbody.sv-grid-pinned-top-body')
    await expect(topBody).toBeVisible()

    const checkbox = page.getByLabel(/Top pinned/)
    await checkbox.uncheck()

    await expect(topBody).toHaveCount(0)
  })

  test('shell exposes --sg-thead-h CSS variable', async ({ page }) => {
    const styleAttr = await page.locator('.sv-grid-shell').first().getAttribute('style')
    expect(styleAttr).toContain('--sg-thead-h')
  })

  test('pinned cells have position:sticky in computed styles', async ({ page }) => {
    const position = await page.locator('tr.sv-grid-pinned-row-top td').first().evaluate(
      (el) => window.getComputedStyle(el).position,
    )
    expect(position).toBe('sticky')
  })
})
