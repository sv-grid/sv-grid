import { test, expect } from '@playwright/test'

/**
 * The bulk-action bar on a phone.
 *
 * The bar's labels are `white-space: nowrap` and flex items do not shrink below
 * their content, so a bar with six actions on a 390px viewport did not clip or
 * wrap - the buttons drew straight over each other, and the strip read
 * "selectSelect alEdit fieldsMark doExport Delete". Nothing caught it: it
 * renders, it is inside the grid, and every desktop assertion passes.
 *
 * The fix is the narrow layout - icons only, labels kept as the accessible
 * name - plus `overflow-x: auto` as the backstop. This pins both.
 *
 * Runs against the gallery on :5174 (see playwright.config.ts).
 */

// Absolute: the top-level `baseURL` points at the WEBSITE on :5180, and the
// mobile project does not override it - the sibling spec uses absolute URLs
// for the same reason.
const DEMO = 'http://localhost:5174/#/430-selection-bar'
const BAR = '.sv-selbar'

test.describe('selection bar at phone width', () => {
  test('collapses to icons instead of overlapping its own labels', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('tbody [role="checkbox"]').first().waitFor({ timeout: 30_000 })
    await page.locator('tbody [role="checkbox"]').first().click()

    const bar = page.locator(BAR)
    await expect(bar).toBeVisible()

    // Every button fits inside the bar. Overlapping buttons still report
    // sensible individual boxes, so the test is "does the row of them fit",
    // not "is each one positioned".
    const box = (await bar.boundingBox())!
    const buttons = await bar.locator('button').all()
    expect(buttons.length).toBeGreaterThan(1)

    let widest = 0
    for (const b of buttons) {
      const bb = await b.boundingBox()
      if (!bb) continue
      expect(bb.x).toBeGreaterThanOrEqual(box.x - 1)
      widest = Math.max(widest, bb.x + bb.width)
    }
    expect(widest).toBeLessThanOrEqual(box.x + box.width + 1)

    // And it stays inside the viewport rather than running off the side.
    const viewport = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  })

  test('keeps an accessible name on every action once the label is hidden', async ({ page }) => {
    // `display: none` takes the label out of the accessibility tree, so without
    // an explicit aria-label the icon buttons would be nameless to a screen
    // reader - the exact cost that makes an icon-only bar a bad trade.
    await page.goto(DEMO)
    await page.locator('tbody [role="checkbox"]').first().waitFor({ timeout: 30_000 })
    await page.locator('tbody [role="checkbox"]').first().click()
    await expect(page.locator(BAR)).toBeVisible()

    // The demo keeps its optional extras in the overflow menu, so only the
    // essentials are buttons on the bar itself.
    for (const name of ['Select all', 'Edit fields', 'Delete']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
  })
})
