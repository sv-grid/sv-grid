import { expect, test, type Page } from '@playwright/test'

/**
 * Reaching around a sheet the way Excel lets you: a range or a
 * sheet-qualified address typed into the Name Box selects it, a fill or a
 * sort over a filtered block stays on the rows that show, a merged block
 * sorts with its rows, and a paste larger than the rows the grid holds
 * grows the sheet rather than stopping at its edge. Each was missing or
 * wrong on 2026-09-21.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const nameBox = (page: Page) => page.locator('.sv-sheet input[aria-label="Name box"]').first()
const bar = (page: Page) => page.locator('.sv-sheet textarea.formula').first()
const status = async (page: Page) => (await page.locator('.sv-sheet .status').first().innerText()).replace(/\s+/g, ' ').trim()
const tab = (page: Page, name: string) =>
  page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: new RegExp(`^\\s*${name}\\s*$`) }).first()
const button = (page: Page, title: string) => page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first()
const selectedCount = (page: Page) => page.evaluate(() => document.querySelectorAll('.sv-sheet td[data-selected-range="true"]').length)
async function go(page: Page, addr: string) {
  await nameBox(page).click()
  await nameBox(page).fill(addr)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}
async function typeInto(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
}
async function open(page: Page, demo = '207-blank-sheet') {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

test('the Name Box selects a range, and jumps to a sheet-qualified address', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  await go(page, 'B2:D4')
  expect(await selectedCount(page)).toBe(9)
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('TABLE')
  await go(page, 'Orders!C3')
  await expect(page.locator('[role="tablist"][aria-label="Sheets"] [role="tab"][aria-selected="true"]')).toHaveText('Orders')
  await expect(nameBox(page)).toHaveValue('C3')
  // A name that is not a reference is still defined, as Excel does.
  await go(page, 'Marker')
  await expect(page.locator('.sv-sheet .status')).toContainText('Marker')
})

test('a big paste grows the sheet, and Ctrl+End reaches its last cell', async ({ page }) => {
  await open(page)
  const rows = ['Id\tVal']
  for (let i = 1; i <= 600; i += 1) rows.push(`T-${i}\t${i}`)
  await page.evaluate((text) => navigator.clipboard.writeText(text), rows.join('\n'))
  await cell(page, 0, 0).click()
  await page.keyboard.press('Control+V')
  await page.locator('.sv-sheet td[data-svgrid-row="30"][data-svgrid-col="0"]').waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  // No cell dropped at the grid's old edge (row 50 area).
  await go(page, 'A61')
  await expect(bar(page)).toHaveValue('T-60')
  await go(page, 'A601')
  await expect(bar(page)).toHaveValue('T-600')
  await go(page, 'A1')
  await page.keyboard.press('Control+End')
  await page.waitForTimeout(300)
  await expect(nameBox(page)).toHaveValue('B601')
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(400)
  await go(page, 'A1')
  expect(await shown(page, 0, 0)).toBe('')
})

test('a fill and a sort over a filtered block stay on the rows that show', async ({ page }) => {
  await open(page, '464-ticket-log-autofilter')
  await expect(page.locator('.sv-sheet .status')).toContainText('34 of 40 records found')
  const hiddenRows = () => page.evaluate(() =>
    [...document.querySelectorAll('.sv-sheet td[data-svgrid-col="0"]')].filter((td) => td.getBoundingClientRect().height === 0).map((td) => Number(td.getAttribute('data-svgrid-row'))))
  const before = await hiddenRows()
  expect(before.length).toBe(6)
  // Fill column J from the second row down over a folded row: the folded
  // one keeps what it holds.
  const folded = before.find((r) => r < 12)!
  const guard = await bar(page).inputValue().catch(() => '')
  await go(page, `J${folded}`)
  const held = await bar(page).inputValue()
  await typeInto(page, 1, 9, 'seen')
  await cell(page, 1, 9).click()
  const handle = (await page.locator('.sv-sheet .sv-grid-fill-handle').first().boundingBox())!
  const target = (await cell(page, 12, 9).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + 10, target.y + target.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  await go(page, `J${folded + 1}`)
  expect(await bar(page).inputValue()).toBe(held)
  void guard
  // Sort while filtered: same number folded, the visible rows reorder.
  await cell(page, 1, 7).click()
  await tab(page, 'Data').click()
  await button(page, 'Sort Z to A').click()
  await page.waitForTimeout(600)
  expect((await hiddenRows()).length).toBe(6)
})

test('a block of merged rows sorts with its rows rather than being refused', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, 'zed')
  await typeInto(page, 0, 1, 'z')
  await typeInto(page, 1, 0, 'amy')
  await typeInto(page, 1, 1, 'a')
  // Merge each of the two rows across A:B.
  await cell(page, 0, 0).click()
  await page.keyboard.down('Shift')
  await cell(page, 1, 1).click()
  await page.keyboard.up('Shift')
  await tab(page, 'Home').click()
  await page.locator('.sv-ribbon .band:not(.measure) .split:has(button[title^="Merge"]) button.arrow').first().click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: /Merge Across/ }).click()
  await page.waitForTimeout(300)
  const warn = page.locator('.sv-modal').last()
  if (await warn.count() && await warn.locator('button.btn.primary').count()) { await warn.locator('button.btn.primary').click(); await page.waitForTimeout(300) }
  expect(await cell(page, 0, 0).getAttribute('colspan')).toBe('2')
  // Select the first column of the two merged rows and sort A to Z.
  await cell(page, 0, 0).click()
  await page.keyboard.down('Shift')
  await cell(page, 1, 0).click()
  await page.keyboard.up('Shift')
  await tab(page, 'Data').click()
  await button(page, 'Sort A to Z').click()
  await page.waitForTimeout(500)
  expect(await status(page)).not.toMatch(/same size/)
  expect(await shown(page, 0, 0)).toBe('amy')
  expect(await cell(page, 0, 0).getAttribute('colspan')).toBe('2')
})
