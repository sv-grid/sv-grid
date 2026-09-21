import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The spreadsheet shell's accessibility, in a real browser: an axe audit of
 * the whole shell on demos that between them raise every band of it (the
 * ribbon, the formula bar, the grid, the tab strip, the status bar, a filter,
 * a conditional format, an anchored chart), and the keyboard model jsdom
 * cannot vouch for, which is real focus moving between those bands.
 *
 * The audit runs on the LIGHT theme, because that is the one the demos'
 * document colours are written for, and again on the dark theme with the
 * cells' own colours left out: a font colour the document sets is the
 * document's, exactly as in Excel, and the shell is not entitled to override
 * it. Everything the SHELL chooses is audited in both.
 *
 * Runs against the gallery on :5174 (see playwright.config.ts), so it needs
 * no private website submodule.
 */

const GALLERY = 'http://localhost:5174'
const DEMOS = [
  '207-blank-sheet', '456-sales-report-workbook', '464-ticket-log-autofilter',
  '460-review-comments-protection', '485-sheet-charts-objects', '486-sheet-sparklines',
  // The surfaces added since: a table's banded look, a collaborator's
  // cursor, a circular model, the auditing sheet and pictures in cells.
  '491-sheet-tables', '488-sheet-collaboration', '492-sheet-iterative',
  '493-sheet-auditing', '494-sheet-cell-images',
]

/** The gallery reads its theme from localStorage before it paints. */
function theme(page: Page, mode: 'light' | 'dark') {
  return page.addInitScript((m) => {
    try { localStorage.setItem('sg-theme', m) } catch { /* private mode */ }
  }, mode)
}

async function open(page: Page, demo: string) {
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet').first().waitFor({ timeout: 60_000 })
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(400)
}

async function audit(page: Page, exclude?: string) {
  let builder = new AxeBuilder({ page })
    .include('.sv-sheet')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
  if (exclude) builder = builder.exclude(exclude)
  const results = await builder.analyze()
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 200)),
  }))
}

test.describe('spreadsheet accessibility', () => {
  for (const demo of DEMOS) {
    test(`axe finds no violation in the shell of ${demo}`, async ({ page }) => {
      test.setTimeout(120_000)
      await theme(page, 'light')
      await open(page, demo)
      expect(await audit(page)).toEqual([])
    })
  }

  test('the shell is clean on the dark theme too, document colours aside', async ({ page }) => {
    test.setTimeout(180_000)
    await theme(page, 'dark')
    for (const demo of DEMOS) {
      await open(page, demo)
      // A cell whose colour the document sets is Excel's to answer for, not
      // the shell's: a red "Bad" font on a dark canvas is what Excel shows too.
      expect(await audit(page, '.sheet-cell[style*="color"]'), demo).toEqual([])
    }
  })
})

test.describe('spreadsheet keyboard model', () => {
  test('the ribbon tab strip is one Tab stop and the arrows carry focus with the selection', async ({ page }) => {
    test.setTimeout(120_000)
    await theme(page, 'light')
    await open(page, '456-sales-report-workbook')
    const strip = page.locator('.sv-ribbon .tabs')
    const selected = strip.locator('button[aria-selected="true"]')
    // Roving tabindex: only the selected tab is reachable by Tab.
    expect(await strip.locator('button[role="tab"][tabindex="0"]').count()).toBe(1)

    await selected.focus()
    const first = await selected.textContent()
    await page.keyboard.press('ArrowRight')
    await expect(selected).not.toHaveText(first ?? '')
    // Focus follows, or a screen reader would still be on the old tab.
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-selected'))).toBe('true')

    await page.keyboard.press('End')
    await expect(selected).toHaveText('View')
    await page.keyboard.press('Home')
    await expect(selected).toHaveText('File')
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('File')
  })

  test('the sheet tab strip walks with the arrows, Home and End', async ({ page }) => {
    test.setTimeout(120_000)
    await theme(page, 'light')
    await open(page, '456-sales-report-workbook')
    const strip = page.locator('.sv-sheet [role="tablist"]').last()
    const selected = strip.locator('button[aria-selected="true"]')
    const names = await strip.locator('button[role="tab"]').allTextContents()
    expect(names.length).toBeGreaterThan(1)

    await selected.focus()
    await page.keyboard.press('ArrowRight')
    await expect(selected).toHaveText(names[1]!)
    await page.keyboard.press('End')
    await expect(selected).toHaveText(names[names.length - 1]!)
    await page.keyboard.press('Home')
    await expect(selected).toHaveText(names[0]!)
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-selected'))).toBe('true')
  })

  test('a dialog takes focus and Escape hands it back to the cells', async ({ page }) => {
    test.setTimeout(120_000)
    await theme(page, 'light')
    await open(page, '207-blank-sheet')
    await page.locator('.sv-sheet td[data-svgrid-row="1"][data-svgrid-col="1"]').click()
    const onGrid = () => page.evaluate(() => document.activeElement?.getAttribute('role'))
    expect(await onGrid()).toBe('grid')

    await page.keyboard.press('Control+1')
    const dialog = page.locator('.sv-modal').first()
    await dialog.waitFor({ timeout: 10_000 })
    // Focus is inside the dialog, not left behind on the sheet.
    expect(await page.evaluate(() => Boolean(document.querySelector('.sv-modal')?.contains(document.activeElement)))).toBe(true)
    // ...and on the content, not the header Close (x): Enter must not dismiss
    // the dialog the instant it opens.
    expect(await page.evaluate(() => document.activeElement?.classList.contains('sv-modal__x'))).toBe(false)
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(await onGrid()).toBe('grid')
  })

  test('the right-click context menu closes on Escape', async ({ page }) => {
    test.setTimeout(120_000)
    await theme(page, 'light')
    await open(page, '207-blank-sheet')
    await page.locator('.sv-sheet td[data-svgrid-row="2"][data-svgrid-col="2"]').click({ button: 'right' })
    const menu = page.locator('.sv-grid-context-menu')
    await menu.waitFor({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(page.locator('.sv-grid-menu-backdrop')).toHaveCount(0)
  })

  test('the Name Box reads the active cell as its value, not as a hint', async ({ page }) => {
    test.setTimeout(120_000)
    await theme(page, 'light')
    await open(page, '207-blank-sheet')
    const nameBox = page.locator('.sv-formula-bar .name-box input')
    await page.locator('.sv-sheet td[data-svgrid-row="2"][data-svgrid-col="1"]').click()
    await expect(nameBox).toHaveValue('B3')
    // Focused, it offers that address as a selected draft to type over.
    await nameBox.focus()
    await expect(nameBox).toHaveValue('B3')
    await nameBox.fill('C5')
    await nameBox.press('Enter')
    await page.locator('.sv-sheet').first().click({ position: { x: 5, y: 5 } })
    await expect(nameBox).toHaveValue('C5')
  })
})
