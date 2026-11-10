/**
 * E2E: the accessibility behaviour of a plain <SvGrid> that jsdom cannot show.
 *
 *  - Tab past the last cell and Shift+Tab before the first move focus off the
 *    grid. Every Tab used to be swallowed, so no key left it (WCAG 2.1.2).
 *  - In forced-colors mode the active cell keeps an indicator. The ring is a
 *    box-shadow, which forced colors removes, so there was none (WCAG 2.4.7).
 *  - axe in a real browser, where layout exists. The vitest axe suite runs in
 *    jsdom with the layout rules off; this is the run the ACR cites for them.
 */
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const DEMO = '/sv-grid/#/demos/01-quick-start'

const gridHasFocus = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return !!el && (el.getAttribute('role') === 'grid' || el.getAttribute('role') === 'treegrid')
  })

async function focusGrid(page: import('@playwright/test').Page) {
  await page.goto(DEMO)
  // A data cell, not the first: the first column can hold the row checkbox,
  // a button that takes focus itself.
  const cell = page.locator('[role="row"]').nth(1).locator('[role="gridcell"]').nth(2)
  await cell.waitFor()
  await cell.click()
  await expect.poll(() => gridHasFocus(page)).toBe(true)
}

test.describe('grid accessibility in a browser', () => {
  test('Tab inside the grid moves between cells and keeps focus', async ({ page }) => {
    await focusGrid(page)
    await page.keyboard.press('Tab')
    expect(await gridHasFocus(page)).toBe(true)
  })

  test('Tab on the last cell leaves the grid', async ({ page }) => {
    await focusGrid(page)
    await page.keyboard.press('Control+End')
    expect(await gridHasFocus(page)).toBe(true)
    await page.keyboard.press('Tab')
    expect(await gridHasFocus(page)).toBe(false)
  })

  test('Shift+Tab on the first cell leaves the grid', async ({ page }) => {
    await focusGrid(page)
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('Shift+Tab')
    expect(await gridHasFocus(page)).toBe(false)
  })

  test('tabbing into the grid shows where focus is, before any click', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('[role="gridcell"]').first().waitFor()
    // Start from a button just before the grid, then reach it by keyboard only.
    await page.evaluate(() => {
      const start = document.createElement('button')
      start.textContent = 'start'
      document.querySelector('.sv-grid-root')!.before(start)
      start.focus()
    })
    for (let i = 0; i < 30 && !(await gridHasFocus(page)); i++) await page.keyboard.press('Tab')
    expect(await gridHasFocus(page)).toBe(true)
    const ring = await page.locator('.sv-grid-cell-active').first().evaluate((el) => getComputedStyle(el).boxShadow)
    expect(ring).not.toBe('none')
  })

  test('the active cell keeps a visible indicator in forced-colors mode', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await focusGrid(page)
    await page.keyboard.press('ArrowRight')
    const outline = await page
      .locator('.sv-grid-cell-active')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
      })
    expect(outline.style).toBe('solid')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  })

  // A contrast theme removes fills. The mixed dash of a part-selected header
  // box is a fill, so the box read as empty; its tick is a border and stayed.
  for (const scheme of ['light', 'dark'] as const) {
    test(`forced colors (${scheme}): a ticked row box and a mixed header box keep their mark`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
      await page.goto(DEMO)
      const rows = page.locator('.sv-grid-table tbody .sv-grid-checkbox')
      await rows.nth(1).waitFor()
      await rows.nth(0).dispatchEvent('click')
      const head = page.locator('.sv-grid-table thead .sv-grid-checkbox').first()
      await expect(head).toHaveAttribute('aria-checked', 'mixed')
      const mark = (el: Element) => {
        const box = getComputedStyle(el)
        const after = getComputedStyle(el, '::after')
        return { canvas: box.backgroundColor, fill: after.backgroundColor, tick: after.borderRightColor, tickWidth: after.borderRightWidth }
      }
      const mixed = await head.evaluate(mark)
      expect(mixed.fill).not.toBe(mixed.canvas)
      const ticked = await rows.nth(0).evaluate(mark)
      expect(ticked.tick).not.toBe(ticked.canvas)
      expect(parseFloat(ticked.tickWidth)).toBeGreaterThan(0)
    })
  }

  // The theme keeps a fill's alpha: the pinned-column divider stayed 18% and vanished on Canvas.
  for (const scheme of ['light', 'dark'] as const) {
    test(`forced colors (${scheme}): the pinned-column divider is drawn in the theme's text color`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
      await page.goto('/sv-grid/#/demos/510-column-pin-splitter')
      const line = page.locator('.sv-pin-split-line').first()
      await line.waitFor({ state: 'attached', timeout: 60_000 })
      const seen = await line.evaluate((el) => {
        const probe = document.createElement('span')
        probe.style.color = 'CanvasText'
        document.body.appendChild(probe)
        const text = getComputedStyle(probe).color
        probe.remove()
        return { line: getComputedStyle(el).backgroundColor, text }
      })
      expect(seen.line).toBe(seen.text)
    })
  }

  test('axe finds no WCAG 2.2 A/AA violations in the grid', async ({ page }) => {
    await focusGrid(page)
    const results = await new AxeBuilder({ page })
      .include('.sv-grid-container')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const found = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) - ${v.help}`)
    expect(found).toEqual([])
  })
})
