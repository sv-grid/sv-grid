/**
 * E2E: the rich date editor's geometry inside a grid cell.
 *
 * SvDateTimePicker is a standalone UI-kit control - a fixed-height pill with
 * its own border, radius and focus ring. Used as the in-cell editor it has to
 * shed all of that and line up with the cell exactly, or the editing cell
 * shows two mismatched boxes and the picker's radius/ring bleed past the
 * column's grid lines. The rules live in SvGrid.css and have to out-specify
 * the component's own scoped styles, so this is asserted in a real browser
 * with both stylesheets loaded rather than in jsdom.
 */
import { expect, test } from '@playwright/test'

const EDIT_DEMO = '/sv-grid/#/demos/05-inline-editing'
const FILTER_DEMO = '/sv-grid/#/demos/179-floating-filters'
const NARROW_FILTER_DEMO = '/sv-grid/#/demos/430-selection-bar'

/** Index of the `Joined` (date) column among the body cells. */
async function dateColumnIndex(page: import('@playwright/test').Page) {
  return page.$$eval('.sv-grid-column', (els) =>
    els.findIndex((el) => /joined/i.test(el.textContent ?? '')),
  )
}

test.describe('rich date editor inside a cell', () => {
  test('fills the cell box and drops its own border', async ({ page }) => {
    await page.goto(EDIT_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()

    const idx = await dateColumnIndex(page)
    expect(idx).toBeGreaterThan(-1)

    const rowsBefore = await page.$$eval('.sv-grid-table tbody tr', (els) =>
      els.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().height)),
    )

    const cell = page.locator('.sv-grid-table tbody tr').nth(2).locator('.sv-grid-cell').nth(idx)
    await cell.scrollIntoViewIfNeeded()
    await cell.dblclick()
    await page.locator('.sv-dtp__field').waitFor()

    const geom = await page.evaluate(() => {
      const cellEl = document.querySelector('.sv-grid-cell-editing')!
      const field = document.querySelector('.sv-dtp__field')!
      const cs = getComputedStyle(cellEl)
      const fs = getComputedStyle(field)
      const c = cellEl.getBoundingClientRect()
      const f = field.getBoundingClientRect()
      return {
        dx: f.x - c.x,
        dy: f.y - c.y,
        // The cell's right/bottom grid lines are borders, so the editor covers
        // the padding box: the cell's box minus those two 1px lines.
        dw: f.width - (c.width - parseFloat(cs.borderRightWidth)),
        dh: f.height - (c.height - parseFloat(cs.borderBottomWidth)),
        borderWidth: parseFloat(fs.borderTopWidth),
        radius: parseFloat(fs.borderTopLeftRadius),
      }
    })

    expect(Math.abs(geom.dx)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(geom.dy)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(geom.dw)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(geom.dh)).toBeLessThanOrEqual(0.5)
    expect(geom.borderWidth).toBe(0)
    expect(geom.radius).toBe(0)

    // Out of flow, so the edited row keeps the height of its neighbours.
    const rowsAfter = await page.$$eval('.sv-grid-table tbody tr', (els) =>
      els.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().height)),
    )
    expect(rowsAfter).toEqual(rowsBefore)
  })

  test('the filter row keeps its bordered picker', async ({ page }) => {
    await page.goto(FILTER_DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()

    // Scoped to `.sv-grid-cell-editing`, so a picker anywhere else - here the
    // floating filter row - still draws the standalone control's box.
    const border = await page
      .locator('.sv-dtp__field')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth))
    expect(border).toBeGreaterThan(0)
  })

  test('the filter-row picker stays inside its cell and its toggle is clickable', async ({ page }) => {
    // A narrow date column (105px) sharing the filter cell with the operator
    // button. The picker used to lay out at the full cell width beside that
    // button, so its box was cut off at the column line and the calendar
    // toggle landed under the NEXT column's filter control - visible, but no
    // click could ever reach it.
    await page.goto(NARROW_FILTER_DEMO)
    await page.locator('.sv-dtp__field').waitFor()

    const fit = await page.evaluate(() => {
      const field = document.querySelector('.sv-dtp__field')!
      const toggle = document.querySelector('.sv-dtp__toggle')!
      const cell = field.closest('th, td')!
      const f = field.getBoundingClientRect()
      const c = cell.getBoundingClientRect()
      const t = toggle.getBoundingClientRect()
      const atToggle = document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2)
      return {
        overflowRight: +(f.right - c.right).toFixed(1),
        overflowLeft: +(c.left - f.left).toFixed(1),
        toggleHit: !!atToggle && toggle.contains(atToggle),
      }
    })

    expect(fit.overflowRight).toBeLessThanOrEqual(0)
    expect(fit.overflowLeft).toBeLessThanOrEqual(0)
    expect(fit.toggleHit).toBe(true)
  })

  test('"between" on a date column filters by a picked range', async ({ page }) => {
    // The rich-picker branch used to win for every operator, so picking Between
    // left a single date picker: `valueTo` stayed empty, `condActive` never
    // fired, and the filter silently matched everything. Between now swaps in
    // one range field, so both bounds come from a single gesture.
    await page.goto(NARROW_FILTER_DEMO)
    await page.locator('.sv-dtp__field').waitFor()

    const rowCount = () => page.locator('tbody.sv-grid-body tr').count()
    const before = await rowCount()

    const dateColIndex = await page.evaluate(() => {
      const th = document.querySelector('.sv-dtp')!.closest('th')!
      return [...th.parentElement!.children].indexOf(th)
    })
    await page
      .locator('thead tr')
      .nth(1)
      .locator('th')
      .nth(dateColIndex)
      .locator('.sv-grid-filter-operator-btn')
      .click()

    // Every operator in the menu draws a glyph - `op-between` had no case in
    // the icon snippet, so its row rendered an empty <svg>.
    const emptyIcons = await page.$$eval('.sv-grid-operator-menu .sv-grid-menu-item', (els) =>
      els
        .filter((el) => (el.querySelector('svg')?.children.length ?? 0) === 0)
        .map((el) => (el.textContent ?? '').trim()),
    )
    expect(emptyIcons).toEqual([])

    await page.getByRole('menuitemradio', { name: 'Between' }).click()

    // One range field, not two single-date pickers.
    const range = page.locator('.sv-dri__field')
    await expect(range).toHaveCount(1)
    await expect(page.locator('.sv-dtp__field')).toHaveCount(0)

    // Clicking anywhere in the field opens the popover - the readonly input is
    // squeezed to a few pixels in a column this narrow.
    await range.click()
    await page.locator('.sv-dri__panel').waitFor()

    const day = (n: string) =>
      page
        .locator('.sv-dri__panel button:not([disabled])')
        .filter({ hasText: new RegExp(`^${n}$`) })
        .first()
    await day('10').click()
    await day('20').click()

    await expect(page.locator('.sv-dri__input')).toHaveValue(/2026-09-10.*2026-09-20/)
    await expect.poll(rowCount).toBeLessThan(before)

    const dues = await page.$$eval('tbody.sv-grid-body tr', (trs, i) =>
      trs.map((t) => (t.children[i]?.textContent ?? '').trim()), dateColIndex)
    expect(dues.length).toBeGreaterThan(0)
    for (const d of dues) {
      expect(d >= '2026-09-10' && d <= '2026-09-20', d).toBe(true)
    }
  })
})
