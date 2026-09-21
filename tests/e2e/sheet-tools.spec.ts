import { expect, test, type Page } from '@playwright/test'

/**
 * The data tools from a single cell, the way Excel starts them: Create
 * Table's Total Row is added under the data rather than taken from it
 * and its SUBTOTAL reads the column; a PivotTable and a chart take the
 * region around the active cell; and Wrap Text turned off gives the row
 * its height back. Each was wrong on 2026-09-21.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const modal = (page: Page) => page.locator('.sv-modal').last()
const tab = (page: Page, name: string) =>
  page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: new RegExp(`^\\s*${name}\\s*$`) }).first()
const button = (page: Page, title: string) => page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first()
async function typeInto(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}
async function open(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/207-blank-sheet`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}
async function block(page: Page, rows: string[][]) {
  for (let r = 0; r < rows.length; r += 1) for (let c = 0; c < rows[r]!.length; c += 1) await typeInto(page, r, c, rows[r]![c]!)
}

test('Create Table with a Total Row adds the row under the data, with a SUBTOTAL that reads the column', async ({ page }) => {
  await open(page)
  await block(page, [['Item', 'Qty', 'Price'], ['Pen', '2', '1.5'], ['Pad', '1', '4'], ['Ink', '3', '2']])
  await cell(page, 1, 1).click()
  await page.keyboard.press('Control+T')
  await expect(modal(page).locator('input[type="text"]').first()).toHaveValue('A1:C4')
  await modal(page).locator('input[type="text"]').nth(1).fill('Stock')
  await modal(page).locator('label.check', { hasText: /totals row/i }).locator('input').check()
  await modal(page).locator('button.btn.primary').click()
  await page.waitForTimeout(400)
  // The data stays; the totals row is a new row 5 with Total and the sum of the last column.
  expect(await shown(page, 3, 0)).toBe('Ink')
  expect(await shown(page, 4, 0)).toBe('Total')
  expect(await shown(page, 4, 2)).toBe('7.5')
  await typeInto(page, 4, 1, '=SUBTOTAL(109,[Qty])')
  expect(await shown(page, 4, 1)).toBe('6')
  await typeInto(page, 6, 0, '=SUM(Stock[Qty])')
  expect(await shown(page, 6, 0)).toBe('6')
})

test('a PivotTable and a chart start from the region around a single cell', async ({ page }) => {
  await open(page)
  await block(page, [['Region', 'Rep', 'Sales'], ['North', 'Ana', '100'], ['South', 'Ben', '50'], ['North', 'Ben', '25']])
  await cell(page, 1, 1).click()
  await tab(page, 'Insert').click()
  await button(page, 'Summarise the selected block').click()
  await expect(modal(page).locator('input[type="text"]').first()).toHaveValue('A1:C4')
  await modal(page).locator('input[type="text"]').nth(1).fill('E1')
  await modal(page).locator('select').nth(0).selectOption('rows')
  await modal(page).locator('select').nth(2).selectOption('values')
  await modal(page).locator('button.btn.primary').click()
  await page.waitForTimeout(500)
  const rows = [await shown(page, 1, 4), await shown(page, 2, 4)]
  expect(rows).toContain('North')
  expect(await shown(page, rows.indexOf('North') + 1, 5)).toBe('125')
  await cell(page, 2, 0).click()
  await button(page, 'Chart the selected range').click()
  await page.waitForTimeout(500)
  await expect(page.locator('.sv-sheet .sheet-object')).toHaveCount(1)
})

test('Wrap Text off gives a row its height back; a hand-sized row keeps its size', async ({ page }) => {
  await open(page)
  await typeInto(page, 2, 0, 'a fairly long sentence that needs to wrap inside a narrow column of the sheet')
  await cell(page, 2, 0).click()
  const before = (await cell(page, 2, 0).boundingBox())!.height
  await tab(page, 'Home').click()
  await button(page, 'Wrap Text').click()
  await page.waitForTimeout(400)
  expect((await cell(page, 2, 0).boundingBox())!.height).toBeGreaterThan(before + 10)
  await button(page, 'Wrap Text').click()
  await page.waitForTimeout(400)
  expect(Math.abs((await cell(page, 2, 0).boundingBox())!.height - before)).toBeLessThan(3)
  // Wrap again, then a height typed into Row Height...: that one is the
  // user's, and Wrap Text off leaves it alone.
  await button(page, 'Wrap Text').click()
  await page.waitForTimeout(400)
  await cell(page, 2, 0).click()
  await page.keyboard.press('Shift+Space')
  await cell(page, 2, 1).click({ button: 'right' })
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: /Row Height/ }).first().click()
  await modal(page).locator('input[type="number"]').fill('120')
  await modal(page).locator('button.btn.primary').click()
  await page.waitForTimeout(300)
  expect(Math.abs((await cell(page, 2, 0).boundingBox())!.height - 120)).toBeLessThan(2)
  await button(page, 'Wrap Text').click()
  await page.waitForTimeout(400)
  expect(Math.abs((await cell(page, 2, 0).boundingBox())!.height - 120)).toBeLessThan(2)
})

test('Format Cells sets a cell\'s vertical alignment, top and bottom', async ({ page }) => {
  // Vertical-align is one of the most-used cell settings and the Alignment
  // tab had no control for it on 2026-09-21; the cell span is a grid box, so
  // top and bottom move its anchor.
  await open(page)
  await typeInto(page, 0, 0, 'anchor')
  const alignItems = () => cell(page, 0, 0).evaluate((el) => getComputedStyle(el.querySelector('.sheet-cell') ?? el).alignItems)
  expect(await alignItems()).toBe('center')
  async function setVertical(v: string) {
    await cell(page, 0, 0).click()
    await page.keyboard.press('Control+1')
    await modal(page).waitFor()
    await modal(page).locator('button', { hasText: /^\s*Alignment\s*$/ }).first().click()
    await page.waitForTimeout(200)
    await modal(page).locator('select').nth(1).selectOption(v)
    await modal(page).locator('button.btn.primary', { hasText: /^OK$/i }).first().click()
    await page.waitForTimeout(300)
  }
  await setVertical('top')
  expect(await alignItems()).toBe('start')
  await setVertical('bottom')
  expect(await alignItems()).toBe('end')
})
