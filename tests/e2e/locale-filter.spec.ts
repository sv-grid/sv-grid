/**
 * E2E: locale-aware filtering.
 *
 * Drives the global-filter input in demo 110 with unaccented queries
 * and asserts the data table narrows correctly. Real-browser keystrokes
 * (rather than dispatchEvent('input') in jsdom) confirm the debounce
 * + reactivity chain end-to-end.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/110-locale-aware-filter'

async function visibleCities(page: import('@playwright/test').Page) {
  return page.$$eval(
    'tbody.sv-grid-body tr.sv-grid-row td:first-child',
    (els) => els.map((el) => (el.textContent ?? '').trim()).filter((t) => t.length > 0),
  )
}

test.describe('locale-aware text filter (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
  })

  test('"munchen" matches "München"', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('munchen')
    await expect.poll(() => visibleCities(page)).toEqual(['München'])
  })

  test('"sao paulo" matches "São Paulo"', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('sao paulo')
    await expect.poll(() => visibleCities(page)).toEqual(['São Paulo'])
  })

  test('"tokyo" matches "Tōkyō"', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('tokyo')
    await expect.poll(() => visibleCities(page)).toEqual(['Tōkyō'])
  })

  test('"reykjavik" matches "Reykjavík"', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('reykjavik')
    await expect.poll(() => visibleCities(page)).toEqual(['Reykjavík'])
  })

  test('"rhein" matches the Notes column on Köln', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('rhein')
    // Köln's notes contain "Dom-Stadt am Rhein"
    await expect.poll(() => visibleCities(page)).toEqual(['Köln'])
  })

  test('clearing the input restores all rows', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    await input.fill('munchen')
    await expect.poll(async () => (await visibleCities(page)).length).toBe(1)

    await input.fill('')
    await expect.poll(async () => (await visibleCities(page)).length).toBeGreaterThanOrEqual(20)
  })

  test('locale picker change keeps the same accent-folding behavior', async ({ page }) => {
    const input = page.locator('.sv-grid-global-filter input').first()
    const picker = page.getByRole('combobox').first()

    await input.fill('geneve')
    await expect.poll(() => visibleCities(page)).toEqual(['Genève'])

    await picker.selectOption('de-DE')
    // German locale - "geneve" still matches "Genève" because the
    // NFD-strip happens before any locale-aware lowercase.
    await expect.poll(() => visibleCities(page)).toEqual(['Genève'])
  })
})
