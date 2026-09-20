import { expect, test, type Page } from '@playwright/test'

/**
 * What File > Print hands the printer, in a real browser.
 *
 * The printed page is a standalone HTML document the shell writes into a
 * new window, so nothing in jsdom can see it end to end: the sparklines are
 * drawn from the grid's own geometry, the charts are mounted offscreen and
 * serialized, and a table's look is drawn over the cells rather than
 * written into them. Each of those can be missing from the page while the
 * sheet on screen looks right, which is exactly what happened to the table
 * banding.
 *
 * `window.open` is replaced before the page loads, so the print window is
 * captured rather than opened and no printer dialog appears.
 *
 * Runs against the gallery on :5174, so it needs no private website
 * submodule.
 */

const GALLERY = 'http://localhost:5174'

async function open(page: Page, demo: string) {
  await page.addInitScript(() => {
    try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ }
    ;(window as unknown as { __printed: string }).__printed = ''
    const fake = {
      document: {
        open() {},
        write(html: string) { (window as unknown as { __printed: string }).__printed += html },
        close() {},
      },
      focus() {},
      print() {},
      addEventListener() {},
    }
    window.open = (() => fake) as unknown as typeof window.open
  })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(500)
}

/** File > Print, then what the shell wrote into the window it opened. */
async function printed(page: Page): Promise<string> {
  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: 'File' }).first().click()
  await page.locator('.sv-ribbon button[title^="Print"]').first().click()
  await page.waitForTimeout(1000)
  return page.evaluate(() => (window as unknown as { __printed: string }).__printed ?? '')
}

test.describe('the printed page', () => {
  test('carries the table header and its banding, not bare cells', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '491-sheet-tables')
    const html = await printed(page)
    expect(html).toContain('<table')
    // The header band, bold and filled, and a tinted row under it. The
    // colours come from the style the table wears, so the assertion is on
    // there being a fill at all rather than on one hex value.
    expect(html).toMatch(/<td[^>]*style="[^"]*background:[^"]*font-weight:600/)
    const fills = html.match(/background:/g) ?? []
    expect(fills.length).toBeGreaterThan(5)
  })

  test('draws the sparklines in their cells', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '486-sheet-sparklines')
    const html = await printed(page)
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThan(0)
  })

  test('puts a picture in the cell it belongs to, and a chart over its anchor', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '494-sheet-cell-images')
    expect((await printed(page)).match(/<img/g)?.length ?? 0).toBeGreaterThan(0)

    await open(page, '485-sheet-charts-objects')
    const charts = await printed(page)
    expect((charts.match(/<svg/g) ?? []).length).toBeGreaterThan(0)
    expect(charts).toContain('class="ob"')
  })

  test('is a document of its own, with no script in it', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, '491-sheet-tables')
    const html = await printed(page)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('print-color-adjust: exact')
    expect(html).not.toContain('<script')
  })
})
