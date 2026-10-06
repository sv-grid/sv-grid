import { expect, test, type Page } from '@playwright/test'

/**
 * Charts and pictures under frozen panes, in a real browser: which element
 * is on top at a point, which jsdom cannot say.
 *
 * Issue #116: a chart hung from A6 on a sheet with column A frozen had its
 * left part painted over by column A. The objects were drawn in one layer
 * at z-index 7 and the frozen cells stick at z-index 30, so everything
 * under a frozen pane lost, including an object anchored IN that pane.
 * Excel keeps an object with the pane of its anchor cell: one anchored in
 * a frozen pane is drawn over it and stays put while the sheet scrolls,
 * and one in the scrolling pane is cut at the pane's edge as it slides
 * under.
 *
 * Demo 485 freezes row 1 and column A. Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'

// Narrow and short, so the sheet scrolls both ways.
test.use({ viewport: { width: 1000, height: 1100 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const tab = (page: Page, name: string) =>
  page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: new RegExp(`^\\s*${name}\\s*$`) }).first()

async function open(page: Page, dir: 'ltr' | 'rtl' = 'ltr') {
  await page.addInitScript((d) => {
    try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ }
    const apply = () => document.documentElement?.setAttribute('dir', d)
    apply()
    document.addEventListener('readystatechange', apply)
    document.addEventListener('DOMContentLoaded', apply)
  }, dir)
  await page.goto(`${GALLERY}/#/485-sheet-charts-objects`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

/**
 * Insert > Chart: over the demo's block it lands at A6, in the frozen
 * column; over A1:B2 at A3.
 */
async function chartInColumnA(page: Page, small = false) {
  await expect(page.locator('.sv-sheet .sheet-object')).toHaveCount(2)
  await cell(page, small ? 0 : 1, small ? 0 : 1).click()
  if (small) await cell(page, 1, 1).click({ modifiers: ['Shift'] })
  await tab(page, 'Insert').click()
  // At this width the ribbon folds the Charts group into a button.
  const group = page.locator('.sv-ribbon .band:not(.measure) button[title="Charts"]')
  if (await group.count()) await group.first().click()
  await page.locator('button[title^="Chart the selected range"]:visible').first().click()
  await page.waitForTimeout(600)
  // Off the chart and off column A, so no selection sits on the points read.
  await cell(page, 1, 3).click()
  await page.waitForTimeout(200)
  await expect(page.locator('.sv-sheet .sheet-object')).toHaveCount(3)
  return page.locator('.sv-sheet .sheet-object').last()
}

async function scrollBy(page: Page, x: number, y: number) {
  await page.evaluate(([dx, dy]) => {
    const sc = document.querySelector('.sv-sheet .sv-grid-container') as HTMLElement
    sc.scrollLeft += document.documentElement.dir === 'rtl' ? -dx! : dx!
    sc.scrollTop += dy!
  }, [x, y])
  await page.waitForTimeout(300)
}

/** What is painted on top at a point: the object's id, a cell's address, or something else. */
const topAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px!, py!)
    const object = el?.closest('.sheet-object')
    if (object) return `object:${[...document.querySelectorAll('.sheet-object')].indexOf(object)}`
    const td = el?.closest('td[data-svgrid-row]') as HTMLElement | null
    if (td) return `cell:${td.dataset.svgridRow},${td.dataset.svgridCol}`
    return `other:${el?.className ?? ''}`
  }, [x, y])

const rectOf = async (page: Page, locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!

test.describe('objects under frozen panes (#116)', () => {
  test('a chart anchored in the frozen column is drawn over it, whole', async ({ page }) => {
    await open(page)
    const chart = await chartInColumnA(page)
    const box = await rectOf(page, chart)
    const colA = await rectOf(page, cell(page, 1, 0))
    // Anchored at A6 with its 8px offset, so its left part is over column A.
    expect(box.x).toBeLessThan(colA.x + colA.width - 40)
    const x = colA.x + colA.width / 2
    expect(x).toBeGreaterThan(box.x + 4)
    expect(await topAt(page, x, box.y + box.height / 2)).toBe('object:2')
  })

  test('it stays put while the sheet scrolls across, over the cells that scroll under it', async ({ page }) => {
    await open(page)
    const chart = await chartInColumnA(page)
    const before = await rectOf(page, chart)
    const colA = await rectOf(page, cell(page, 1, 0))
    const d = await rectOf(page, cell(page, 1, 3))
    await scrollBy(page, 120, 0)
    // The sheet did scroll, and the chart did not.
    expect(Math.abs((await rectOf(page, cell(page, 1, 3))).x - d.x)).toBeGreaterThan(60)
    const after = await rectOf(page, chart)
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
    // Still on top inside column A, and over the scrolled cells to its right.
    const y = after.y + after.height / 2
    expect(await topAt(page, colA.x + colA.width / 2, y)).toBe('object:2')
    expect(await topAt(page, colA.x + colA.width + 60, y)).toBe('object:2')
  })

  test('scrolled up, it slides under the frozen row and the header', async ({ page }) => {
    // Shorter, so the 22 rows scroll.
    await page.setViewportSize({ width: 1000, height: 820 })
    await open(page)
    const chart = await chartInColumnA(page, true)
    const colA = await rectOf(page, cell(page, 1, 0))
    const frozen = await rectOf(page, cell(page, 0, 0))
    const before = await rectOf(page, chart)
    // Enough to carry the chart's top 12px up into row 1.
    await scrollBy(page, 0, Math.round(before.y - (frozen.y + frozen.height)) + 12)
    const after = await rectOf(page, chart)
    expect(after.y).toBeLessThan(frozen.y + frozen.height - 8)
    expect(await topAt(page, colA.x + colA.width / 2, frozen.y + frozen.height - 4)).toBe('cell:0,0')
    // Below the frozen row it is still the chart.
    expect(await topAt(page, colA.x + colA.width / 2, frozen.y + frozen.height + 10)).toBe('object:2')
  })

  test('a chart hanging past the sheet does not make the page taller', async ({ page }) => {
    // A chart's clip-path hid the part below the sheet's window, but it still
    // counted as overflow: the page was taller by it, and scrolling the sheet
    // shrank the page again, so a scrolled page jumped. On CI's taller text
    // layout the gallery page scrolled and the test above missed by ~40px.
    await page.setViewportSize({ width: 1000, height: 700 })
    await open(page)
    // The sheet fills the page below the demo's description, which wraps to
    // more lines on CI's Linux fonts: at a fixed 700px CI was left with the
    // header and row 1 only, and B2 could not be clicked. Size the viewport so
    // the sheet's window is ~120px (three body rows) whatever the text does.
    const h0 = (await rectOf(page, page.locator('.sv-sheet .sv-grid-container'))).height
    await page.setViewportSize({ width: 1000, height: Math.round(700 + 120 - h0) })
    await page.waitForTimeout(400)
    const chart = await chartInColumnA(page, true)
    const sheetWindow = await rectOf(page, page.locator('.sv-sheet .sv-grid-container'))
    const box = await rectOf(page, chart)
    expect(box.y + box.height).toBeGreaterThan(sheetWindow.y + sheetWindow.height + 40)
    const page0 = await page.evaluate(() => {
      let el = document.querySelector('.sv-sheet')!.parentElement
      while (el && !/auto|scroll/.test(getComputedStyle(el).overflowY)) el = el.parentElement
      const sc = (el ?? document.scrollingElement)! as HTMLElement
      sc.setAttribute('data-test-page-scroller', '')
      sc.scrollTop = sc.scrollHeight
      return { top: sc.scrollTop, height: sc.scrollHeight, client: sc.clientHeight }
    })
    expect(page0.height).toBeLessThanOrEqual(page0.client + 8)
    await scrollBy(page, 0, 60)
    const page1 = await page.evaluate(() => {
      const sc = document.querySelector('[data-test-page-scroller]') as HTMLElement
      return { top: sc.scrollTop, height: sc.scrollHeight, client: sc.clientHeight }
    })
    expect(page1).toEqual(page0)
  })

  test('a chart in the scrolling pane is cut at the frozen column as it slides under', async ({ page }) => {
    await open(page)
    // The demo's first chart hangs from B7.
    const chart = page.locator('.sv-sheet .sheet-object').first()
    const colA = await rectOf(page, cell(page, 1, 0))
    await scrollBy(page, 60, 0)
    const box = await rectOf(page, chart)
    expect(box.x).toBeLessThan(colA.x + colA.width)
    const y = box.y + box.height / 2
    expect(await topAt(page, colA.x + colA.width - 10, y)).toMatch(/^cell:\d+,0$/)
    expect(await topAt(page, colA.x + colA.width + 20, y)).toBe('object:0')
  })

  for (const headings of [true, false]) {
    test(`a chart hung from the frozen row scrolls across and is cut at the frozen column${headings ? '' : ', with the headings hidden'}`, async ({ page }) => {
      await open(page)
      if (!headings) {
        await tab(page, 'View').click()
        const group = page.locator('.sv-ribbon .band:not(.measure) button[title="Show"]')
        if (await group.count()) await group.first().click()
        await page.locator('button[title^="Show or hide the row numbers"]:visible').first().click()
        await page.waitForTimeout(400)
        await expect(page.locator('.sv-sheet td.sv-grid-row-number-cell')).toHaveCount(0)
      }
      // Drag the demo's first chart up by its top edge until it hangs from B1.
      const chart = page.locator('.sv-sheet .sheet-object').first()
      const before = await rectOf(page, chart)
      const b1 = await rectOf(page, cell(page, 0, 1))
      const from = { x: before.x + 60, y: before.y + 20 }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x, from.y - (before.y - (b1.y + 4)), { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(400)
      const hung = await rectOf(page, chart)
      expect(Math.abs(hung.y - (b1.y + 4))).toBeLessThanOrEqual(2)
      // Over the frozen row itself, and over the body rows it hangs into.
      expect(await topAt(page, hung.x + 30, b1.y + b1.height - 3)).toBe('object:0')
      const colA = await rectOf(page, cell(page, 1, 0))
      const d = await rectOf(page, cell(page, 1, 3))
      await scrollBy(page, 60, 0)
      expect(Math.abs((await rectOf(page, cell(page, 1, 3))).x - d.x)).toBeGreaterThan(30)
      const moved = await rectOf(page, chart)
      expect(moved.x).toBeLessThan(colA.x + colA.width)
      // Slid across under column A: the frozen cells win there, the chart right of it.
      const y = moved.y + moved.height / 2
      expect(await topAt(page, colA.x + colA.width - 10, y)).toMatch(/^cell:\d+,0$/)
      expect(await topAt(page, colA.x + colA.width + 20, y)).toBe('object:0')
    })
  }

  test('right to left: the frozen column is on the right and the chart is still over it', async ({ page }) => {
    await open(page, 'rtl')
    const chart = await chartInColumnA(page)
    const box = await rectOf(page, chart)
    const colA = await rectOf(page, cell(page, 1, 0))
    expect(box.x + box.width).toBeGreaterThan(colA.x + 40)
    expect(await topAt(page, colA.x + colA.width / 2, box.y + box.height / 2)).toBe('object:2')
    const d = await rectOf(page, cell(page, 1, 3))
    await scrollBy(page, 120, 0)
    expect(Math.abs((await rectOf(page, cell(page, 1, 3))).x - d.x)).toBeGreaterThan(60)
    expect(await topAt(page, colA.x + colA.width / 2, box.y + box.height / 2)).toBe('object:2')
  })

  test('a chart in the frozen column still drags, and lands where it is dropped', async ({ page }) => {
    await open(page)
    const chart = await chartInColumnA(page)
    const before = await rectOf(page, chart)
    const from = { x: before.x + 30, y: before.y + before.height / 2 }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const after = await rectOf(page, chart)
    expect(Math.abs(after.x - (before.x + 40))).toBeLessThanOrEqual(2)
    expect(Math.abs(after.y - (before.y + 30))).toBeLessThanOrEqual(2)
  })
})
