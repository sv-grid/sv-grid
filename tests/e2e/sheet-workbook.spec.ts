import { expect, test, type Page } from '@playwright/test'

/**
 * A workbook with several sheets, driven the way Excel's is: the keyboard
 * stays on the cells after a tab is clicked, Ctrl+Z goes back to the sheet
 * a change was made on, a rename does not lose the trail, Delete Sheet
 * empties the undo list, and a click on a chart is not a step. Each was
 * wrong on 2026-09-21: the tab kept the focus, and an undo pressed on
 * Summary wrote Orders' old value into Summary's cell.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const sheetTab = (page: Page, name: RegExp) =>
  page.locator('[role="tablist"][aria-label="Sheets"] [role="tab"]', { hasText: name })
const activeSheet = async (page: Page) =>
  (await page.locator('[role="tablist"][aria-label="Sheets"] [role="tab"][aria-selected="true"]').innerText()).trim()
const nameBox = (page: Page) => page.locator('.sv-sheet input[aria-label="Name box"]').first()
const focusedTag = (page: Page) => page.evaluate(() => document.activeElement?.tagName ?? 'none')
async function typeInto(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}
async function open(page: Page, demo: string) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

test('a click on a sheet tab leaves the keyboard on the cells', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  await sheetTab(page, /Orders/).click()
  await page.waitForTimeout(300)
  expect(await focusedTag(page)).toBe('TABLE')
  await page.keyboard.press('ArrowDown')
  await expect(nameBox(page)).toHaveValue('A2')
  expect(await activeSheet(page)).toBe('Orders')
  // The add button and Shift+F11 leave it there too.
  await page.locator('[aria-label="Sheets"] ~ button.add, .sv-sheet-tabs button.add').first().click()
  await page.waitForTimeout(300)
  expect(await focusedTag(page)).toBe('TABLE')
  await page.keyboard.press('Shift+F11')
  await page.waitForTimeout(300)
  expect(await activeSheet(page)).toMatch(/^Sheet\d+$/)
})

test('Ctrl+Z and Ctrl+Y go to the sheet the change was made on', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  await sheetTab(page, /Orders/).click()
  await page.waitForTimeout(300)
  const was = await shown(page, 1, 3)
  await typeInto(page, 1, 3, '999')
  await sheetTab(page, /Summary/).click()
  await page.waitForTimeout(300)
  const summaryD2 = await shown(page, 1, 3)
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(500)
  expect(await activeSheet(page)).toBe('Orders')
  expect(await shown(page, 1, 3)).toBe(was)
  // Summary's own D2 was never touched.
  await sheetTab(page, /Summary/).click()
  await page.waitForTimeout(300)
  expect(await shown(page, 1, 3)).toBe(summaryD2)
  await page.keyboard.press('Control+Y')
  await page.waitForTimeout(500)
  expect(await activeSheet(page)).toBe('Orders')
  expect(await shown(page, 1, 3)).toBe('999')
  // The ribbon's Undo takes the same road.
  await sheetTab(page, /Summary/).click()
  await page.waitForTimeout(300)
  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: /^\s*Home\s*$/ }).first().click()
  await page.locator('.sv-ribbon .band:not(.measure) button[title^="Undo"]').first().click()
  await page.waitForTimeout(500)
  expect(await activeSheet(page)).toBe('Orders')
  expect(await shown(page, 1, 3)).toBe(was)
})

test('a renamed sheet keeps its undo trail; Delete Sheet empties the list', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  await sheetTab(page, /Orders/).click()
  await page.waitForTimeout(300)
  const was = await shown(page, 2, 3)
  await typeInto(page, 2, 3, '555')
  await sheetTab(page, /^Orders$/).dblclick()
  const rename = page.locator('.sv-sheet-tabs input.rename')
  await expect(rename).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Sales')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await expect(sheetTab(page, /^Sales$/)).toHaveCount(1)
  await sheetTab(page, /Summary/).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(500)
  expect(await activeSheet(page)).toBe('Sales')
  expect(await shown(page, 2, 3)).toBe(was)
  // Deleting a sheet cannot be undone, and in Excel nothing before it can either.
  await typeInto(page, 2, 3, '777')
  await sheetTab(page, /Products/).click({ button: 'right' })
  await page.locator('.sheet-menu [role="menuitem"]', { hasText: /^\s*Delete\s*$/ }).click()
  await page.locator('.sv-modal button.btn.primary', { hasText: /Delete/ }).click()
  await page.waitForTimeout(400)
  expect(await focusedTag(page)).toBe('TABLE')
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(400)
  expect(await shown(page, 2, 3)).toBe('777')
})

test('a click on a chart is not an undo step', async ({ page }) => {
  await open(page, '485-sheet-charts-objects')
  const chart = page.locator('.sv-sheet .sheet-object').first()
  const y = async () => (await chart.boundingBox())!.y
  const before = await y()
  await cell(page, 0, 0).click()
  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: /^\s*Home\s*$/ }).first().click()
  await page.locator('.sv-ribbon .band:not(.measure) button[title^="Insert Cells"]').first().click()
  await page.waitForTimeout(400)
  expect(await y()).toBeGreaterThan(before + 10)
  // Select the chart, then a cell, then undo: the row goes, not a phantom move.
  await chart.click()
  await chart.click()
  await cell(page, 1, 1).click()
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(500)
  expect(Math.abs((await y()) - before)).toBeLessThan(2)
  expect(await shown(page, 0, 0)).toBe('Region')
})

test('a 3D reference sums a cell across a range of sheet tabs, and recalculates', async ({ page }) => {
  // Sheet1:Sheet3!A1 read #PARSE! on 2026-09-21; Excel sums the cell down the
  // tabs, and a tab added between the two joins the total.
  await open(page, '207-blank-sheet')
  await cell(page, 0, 0).click()
  await typeInto(page, 0, 0, '10')
  await page.keyboard.press('Shift+F11'); await page.waitForTimeout(400)
  await typeInto(page, 0, 0, '20')
  await page.keyboard.press('Shift+F11'); await page.waitForTimeout(400)
  await typeInto(page, 0, 0, '30')
  await sheetTab(page, /^Sheet1$/).click(); await page.waitForTimeout(300)
  await typeInto(page, 2, 0, '=SUM(Sheet1:Sheet3!A1)')
  expect(await shown(page, 2, 0)).toBe('60')
  // Change a spanned cell and the sum follows.
  await sheetTab(page, /^Sheet2$/).click(); await page.waitForTimeout(300)
  await typeInto(page, 0, 0, '200')
  await sheetTab(page, /^Sheet1$/).click(); await page.waitForTimeout(300)
  expect(await shown(page, 2, 0)).toBe('240')
})
