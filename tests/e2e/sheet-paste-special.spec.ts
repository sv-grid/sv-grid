import { expect, test, type Page } from '@playwright/test'

/**
 * Paste Special on what the CLIPBOARD holds, in a real browser.
 *
 * Ctrl+V always read the system clipboard (a table from Excel, Sheets,
 * another tab); Paste > Values / Formulas / Formatting / Transpose and the
 * Paste Special dialog read only the sheet's own copy, and did nothing at
 * all, silently, for anything copied elsewhere. Demo 466 puts what Excel
 * puts on the clipboard, so it is the fixture. The transposed formulas are
 * checked too: they are turned the way Excel turns them, so a totals
 * column laid on its side still totals.
 *
 * Runs against the gallery on :5174; the clipboard API needs the
 * permissions below, which Chromium grants to a test context.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const pasteMenu = async (page: Page, item: RegExp) => {
  await page.locator('.sv-ribbon .band:not(.measure) .split button.arrow', { hasText: /Paste/ }).first().click()
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: item }).first().click()
  await page.waitForTimeout(500)
}

async function open(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/466-paste-from-excel`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
  await page.locator('main button', { hasText: /Copy an Excel block/ }).first().click()
  await page.waitForTimeout(300)
}

test('Paste > Transpose lays an Excel block on its side, formulas turned with it', async ({ page }) => {
  await open(page)
  await cell(page, 2, 1).click()
  await pasteMenu(page, /Transpose/)
  // The header row is now the first column, bold as it was.
  expect(await shown(page, 2, 1)).toBe('Item')
  expect(await shown(page, 3, 1)).toBe('Unit price')
  expect(await shown(page, 5, 1)).toBe('Total')
  await expect(cell(page, 2, 1).locator('.sheet-cell')).toHaveCSS('font-weight', '700')
  await expect(cell(page, 2, 2).locator('.sheet-cell')).not.toHaveCSS('font-weight', '700')
  // The totals still total: each formula reads the price and quantity above it.
  expect(await shown(page, 5, 2)).toBe('3703.5')
  expect(await shown(page, 5, 3)).toBe('1079.88')
  expect(await shown(page, 5, 4)).toBe('690')
  await cell(page, 5, 2).click()
  await expect(page.locator('.sv-sheet textarea.formula')).toHaveValue('=C4*C5')
})

test('Paste > Values drops the formulas and the formats of an Excel block', async ({ page }) => {
  await open(page)
  await cell(page, 8, 1).click()
  await pasteMenu(page, /Values/)
  expect(await shown(page, 9, 4)).toBe('3703.5')
  await cell(page, 9, 4).click()
  await expect(page.locator('.sv-sheet textarea.formula')).toHaveValue('3703.5')
  await expect(cell(page, 8, 1).locator('.sheet-cell')).not.toHaveCSS('font-weight', '700')
})

test('the Paste Special dialog offers the clipboard, and says so when it is empty', async ({ page }) => {
  await open(page)
  await cell(page, 13, 1).click()
  await page.keyboard.press('Control+Shift+V')
  const modal = page.locator('.sv-modal').last()
  await expect(modal).toBeVisible()
  await expect(modal.locator('button.btn.primary')).toBeEnabled()
  await modal.locator('label', { hasText: /Transpose/ }).locator('input').check()
  await modal.locator('button.btn.primary').click()
  await page.waitForTimeout(500)
  expect(await shown(page, 13, 1)).toBe('Item')
  expect(await shown(page, 16, 4)).toBe('690')
  // Nothing on the clipboard: the status bar says so rather than nothing happening.
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await cell(page, 19, 1).click()
  await pasteMenu(page, /Transpose/)
  await expect(page.locator('.sv-sheet .status')).toContainText('Nothing to paste')
})
