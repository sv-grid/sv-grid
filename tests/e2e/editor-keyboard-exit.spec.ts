/**
 * E2E: every cell editor takes focus when it opens, and Escape closes it.
 *
 * The checkbox and rating editors are <button>s and had no focus-on-mount
 * action (only the text-style editors did), so nothing inside the cell ever
 * held focus. Their own key handlers therefore never fired, and the grid root
 * - where the keystrokes actually landed - returns early while a cell is being
 * edited. The result: the cell was stuck in edit mode, unreachable from the
 * keyboard, until the user clicked somewhere else.
 *
 * Demo 80 puts eight editor kinds in one grid, which is what makes this worth
 * asserting as a sweep rather than per editor.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/80-cell-types-showcase'

// Header prefix -> the editor kind it exercises.
const EDITORS: Array<[string, string]> = [
  ['Vendor', 'text'],
  ['Annual contract', 'number'],
  ['Renewal', 'date'],
  ['NDA', 'checkbox'],
  ['Tier', 'list'],
  ['Categories', 'chips'],
  ['Brand', 'color'],
  ['Performance', 'rating'],
]

test.describe('cell editors: focus and Escape', () => {
  test('each editor takes focus and Escape closes it', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const headers = await page.$$eval('.sv-grid-column', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    )

    for (const [header, kind] of EDITORS) {
      const index = headers.findIndex((h) => h.startsWith(header))
      expect(index, `column ${header}`).toBeGreaterThan(-1)

      const cell = page.locator('tbody.sv-grid-body tr').nth(1).locator('td').nth(index)
      await cell.scrollIntoViewIfNeeded()
      await cell.dblclick()
      await page.locator('.sv-grid-cell-editing').waitFor()

      const focusInsideEditor = await page.evaluate(() =>
        Boolean(document.activeElement?.closest?.('.sv-grid-cell-editing')),
      )
      expect(focusInsideEditor, `${kind} editor should hold focus`).toBe(true)

      await page.keyboard.press('Escape')
      await expect(
        page.locator('.sv-grid-cell-editing'),
        `Escape should close the ${kind} editor`,
      ).toHaveCount(0)
    }
  })

  test('the checkbox editor toggles on Space and is left alone by Escape', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const headers = await page.$$eval('.sv-grid-column', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    )
    const index = headers.findIndex((h) => h.startsWith('NDA'))
    const cell = page.locator('tbody.sv-grid-body tr').nth(1).locator('td').nth(index)
    const checked = () =>
      cell.locator('[role="checkbox"]').first().getAttribute('aria-checked')

    const before = await checked()
    await cell.dblclick()
    await page.locator('.sv-grid-cell-editing').waitFor()
    await page.keyboard.press(' ')
    await expect.poll(checked).not.toBe(before)

    // Escape after reopening exits without touching the committed value.
    const afterToggle = await checked()
    await cell.dblclick()
    await page.locator('.sv-grid-cell-editing').waitFor()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-grid-cell-editing')).toHaveCount(0)
    expect(await checked()).toBe(afterToggle)
  })

  test('the rating editor moves between stars with the arrows', async ({ page }) => {
    // Focus lands on the star holding the current value; without arrow keys a
    // keyboard user could only re-pick that same star.
    await page.goto(DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()
    const headers = await page.$$eval('.sv-grid-column', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    )
    const index = headers.findIndex((h) => h.startsWith('Performance'))
    const cell = page.locator('tbody.sv-grid-body tr').nth(1).locator('td').nth(index)

    await cell.scrollIntoViewIfNeeded()
    await cell.dblclick()
    await page.locator('.sv-grid-rating-star').first().waitFor()

    const litStars = () => page.locator('.sv-grid-rating-star-on').count()
    const opened = await litStars()
    expect(opened).toBeGreaterThan(1) // room to move left

    await page.keyboard.press('ArrowLeft')
    await expect.poll(litStars).toBe(opened - 1)
    await expect(page.locator('.sv-grid-rating-star').nth(opened - 2)).toBeFocused()

    await page.keyboard.press('Home')
    await expect.poll(litStars).toBe(1)
  })
})
