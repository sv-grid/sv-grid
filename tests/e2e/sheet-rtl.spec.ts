import { expect, test, type Page } from '@playwright/test'

/**
 * The spreadsheet shell laid out right to left, which is how an Arabic or
 * Hebrew app runs it. Nothing here needs a translation: `dir="rtl"` alone
 * mirrors the reading order, and what this guards is that the parts the
 * shell POSITIONS follow it rather than staying pinned to the physical left
 * edge. Three of them did not, and each has a test below:
 *
 *   - the row-number gutter and any pinned column, which stuck to the left
 *     edge of the viewport and scrolled away from their own cells;
 *   - an anchored object (a chart, a picture), which grew rightwards out of
 *     the sheet instead of leftwards from its anchor cell;
 *   - the ribbon's arrow keys, which moved the wrong way.
 *
 * The direction is set before the page loads, the way a real app sets it, so
 * the shell measures under it rather than being flipped afterwards.
 */

const GALLERY = 'http://localhost:5174'

async function open(page: Page, demo: string, dir: 'ltr' | 'rtl') {
  await page.addInitScript((d) => {
    try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ }
    const apply = () => document.documentElement?.setAttribute('dir', d)
    apply()
    document.addEventListener('readystatechange', apply)
    document.addEventListener('DOMContentLoaded', apply)
  }, dir)
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.sv-sheet')!).direction)).toBe(dir)
}

const box = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) }
  }, selector)

test.describe('right-to-left spreadsheet', () => {
  test('the bands mirror: the gutter, the Name Box and the tabs start on the right', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '207-blank-sheet', 'rtl')
    const sheet = (await box(page, '.sv-sheet'))!
    const gutter = (await box(page, 'td.sv-grid-row-number-cell'))!
    const firstHeader = (await box(page, 'th[data-svgrid-header-col]'))!
    const nameBox = (await box(page, '.sv-formula-bar .name-box input'))!
    const firstTab = (await box(page, '.sv-ribbon .tabs button'))!

    // The row gutter is the rightmost column, with column A to its left.
    expect(gutter.right).toBeGreaterThan(sheet.left + sheet.width * 0.8)
    expect(firstHeader.right).toBeLessThanOrEqual(gutter.left + 1)
    // The Name Box and the first ribbon tab start on the right too.
    expect(nameBox.right).toBeGreaterThan(sheet.left + sheet.width * 0.8)
    expect(firstTab.right).toBeGreaterThan(sheet.left + sheet.width * 0.8)
  })

  test('the gutter stays pinned while the cells scroll under it', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '207-blank-sheet', 'rtl')
    const before = (await box(page, 'td.sv-grid-row-number-cell'))!
    const cellBefore = (await box(page, 'td[data-svgrid-row="1"][data-svgrid-col="0"]'))!
    await page.evaluate(() => {
      const sc = document.querySelector('.sv-sheet .sv-grid-container') as HTMLElement | null
      if (sc) sc.scrollLeft -= 200
    })
    await page.waitForTimeout(300)
    const after = (await box(page, 'td.sv-grid-row-number-cell'))!
    const cellAfter = (await box(page, 'td[data-svgrid-row="1"][data-svgrid-col="0"]'))!
    // The cells moved, the pinned gutter did not.
    expect(Math.abs(cellAfter.left - cellBefore.left)).toBeGreaterThan(100)
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(1)
    const sheet = (await box(page, '.sv-sheet'))!
    expect(after.right).toBeLessThanOrEqual(sheet.right + 1)
  })

  test('an anchored chart hangs from its cell and grows into the sheet', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '485-sheet-charts-objects', 'rtl')
    const sheet = (await box(page, '.sv-sheet'))!
    const anchor = (await box(page, 'td[data-svgrid-row="6"][data-svgrid-col="1"]'))!
    const object = (await box(page, '.sheet-object'))!
    // The demo anchors it at B7, clear of the frozen column A. Anchored at
    // the cell's inline start, which is its right edge, minus the
    // object's own 8px offset - and growing leftwards, inside the sheet.
    expect(Math.abs(object.right - (anchor.right - 8))).toBeLessThanOrEqual(2)
    expect(object.left).toBeGreaterThanOrEqual(sheet.left - 1)
    expect(object.right).toBeLessThanOrEqual(sheet.right + 1)
  })

  test('the same chart hangs from the other edge when the app is left to right', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '485-sheet-charts-objects', 'ltr')
    const anchor = (await box(page, 'td[data-svgrid-row="6"][data-svgrid-col="1"]'))!
    const object = (await box(page, '.sheet-object'))!
    expect(Math.abs(object.left - (anchor.left + 8))).toBeLessThanOrEqual(2)
  })

  test('the ribbon arrows follow the reading order', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '207-blank-sheet', 'rtl')
    const selected = page.locator('.sv-ribbon .tabs button[aria-selected="true"]')
    await selected.focus()
    const first = (await selected.textContent()) ?? ''
    // Leftwards is forwards on a right-to-left strip.
    await page.keyboard.press('ArrowLeft')
    const second = (await selected.textContent()) ?? ''
    expect(second).not.toBe(first)
    await page.keyboard.press('ArrowRight')
    await expect(selected).toHaveText(first)
  })
})
