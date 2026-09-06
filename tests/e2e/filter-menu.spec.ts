/**
 * E2E: the column filter menu.
 *
 * Covers the things a jsdom test cannot settle - real focus after the lazy
 * GridMenus chunk mounts, and the date controls that arrive through a further
 * `import()` inside it.
 */
import { expect, test } from '@playwright/test'

const TEXT_DEMO = '/sv-grid/#/demos/03-excel-filters'
const DATE_DEMO = '/sv-grid/#/demos/05-inline-editing'

async function openFilterMenu(page: import('@playwright/test').Page, header: string) {
  const headers = await page.$$eval('.sv-grid-column', (els) =>
    els.map((el) => (el.textContent ?? '').trim()),
  )
  const index = headers.findIndex((h) => h.startsWith(header))
  expect(index, `column ${header}`).toBeGreaterThan(-1)
  const th = page.locator('.sv-grid-column').nth(index)
  await th.hover()
  await th.locator('.sv-grid-col-filter-btn').click()
  await page.locator('.sv-grid-menu-filter').waitFor()
  return page.locator('.sv-grid-filter-menu')
}

test.describe('filter menu', () => {
  test('opens with focus inside the panel', async ({ page }) => {
    // Focus used to stay on the funnel button outside the popover, so a
    // keyboard user landed nowhere and had to tab through the whole menu.
    await page.goto(TEXT_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    await openFilterMenu(page, 'First name')

    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(document.activeElement?.closest?.('.sv-grid-menu-filter')),
        ),
      )
      .toBe(true)
  })

  test('each value shows how many rows it matches', async ({ page }) => {
    await page.goto(TEXT_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const menu = await openFilterMenu(page, 'First name')

    const hints = await menu
      .locator('[role="option"] .sv-listbox__hint')
      .allTextContents()
    expect(hints.length).toBeGreaterThan(0)
    for (const hint of hints) expect(hint).toMatch(/^\d+$/)
  })

  test('"select all" under a search acts on the results only', async ({ page }) => {
    // It used to act on the whole column: with everything ticked (the default)
    // it read as "on", so the click cleared the entire selection instead of
    // keeping the matches.
    await page.goto(TEXT_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const menu = await openFilterMenu(page, 'First name')

    const total = await menu.locator('[role="option"]').count()
    expect(total).toBeGreaterThan(2)

    const search = menu.locator('.sv-grid-menu-search')
    await search.fill('ada')
    await expect(menu.locator('[role="option"]')).toHaveCount(1)
    await expect(menu.locator('.sv-grid-facet-label')).toHaveText('(Select all results)')

    await menu.locator('.sv-grid-facet-all input').click()

    // Only the match was unticked; clearing the search shows the rest intact.
    await search.fill('')
    await expect(menu.locator('[role="option"]')).toHaveCount(total)
    await expect(menu.locator('[role="option"][aria-selected="true"]')).toHaveCount(
      total - 1,
    )
  })

  test('a date column gets the same rich controls as the filter row', async ({ page }) => {
    // The menu rendered a bare <input type="date"> while the filter row used
    // the picker, so one column offered two different date UIs.
    await page.goto(DATE_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const menu = await openFilterMenu(page, 'Joined')

    await expect(menu.locator('.sv-dtp__field')).toHaveCount(1)
    await expect(menu.locator('input[type="date"]')).toHaveCount(0)

    // Between swaps in the range field, and the second condition survives.
    await menu.locator('.sv-grid-menu-operator-select').first().selectOption('between')
    await expect(menu.locator('.sv-dri__field')).toHaveCount(1)
    await expect(menu.locator('.sv-grid-menu-add-cond')).toHaveCount(1)
  })
})
