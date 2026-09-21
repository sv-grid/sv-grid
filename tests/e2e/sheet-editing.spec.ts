import { expect, test, type Page } from '@playwright/test'

/**
 * Excel's editing habits that only a real browser can vouch for: pointing
 * at cells while a formula is typed, the function names offered in the
 * cell, Ctrl on the fill handle, Backspace opening the editor empty, Ctrl+F
 * for Find, a name typed into the Name Box, and a plain number typed into
 * a percent cell. Each was missing or wrong on 2026-09-21 until this pass.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const editorValue = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null
  return el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') ? el.value : null
})
const nameBox = (page: Page) => page.locator('.sv-sheet input[aria-label="Name box"]').first()
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

test('point mode: clicks and a drag while typing a formula put references in, and the edit goes on', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 2, '10')
  await typeInto(page, 1, 2, '20')
  await typeInto(page, 2, 2, '30')
  await cell(page, 4, 2).click()
  await page.keyboard.type('=')
  await cell(page, 0, 2).click()
  expect(await editorValue(page)).toBe('=C1')
  await page.keyboard.type('+')
  await cell(page, 1, 2).click()
  expect(await editorValue(page)).toBe('=C1+C2')
  // A second click on the spot the last one filled replaces it.
  await cell(page, 2, 2).click()
  expect(await editorValue(page)).toBe('=C1+C3')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  expect(await shown(page, 4, 2)).toBe('40')
  // A drag puts a range in.
  await cell(page, 5, 2).click()
  await page.keyboard.type('=SUM(')
  const from = (await cell(page, 0, 2).boundingBox())!
  const to = (await cell(page, 2, 2).boundingBox())!
  await page.mouse.move(from.x + 10, from.y + 10)
  await page.mouse.down()
  await page.mouse.move(to.x + 10, to.y + 10, { steps: 4 })
  await page.mouse.up()
  expect(await editorValue(page)).toBe('=SUM(C1:C3')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  expect(await shown(page, 5, 2)).toBe('60')
})

test('the function names are offered in the cell, and Tab takes one', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '4')
  await typeInto(page, 1, 0, '6')
  await cell(page, 2, 0).click()
  await page.keyboard.type('=su')
  const list = page.locator('.sv-sheet .sheet-fn-suggest [role="option"]')
  await expect(list.first()).toBeVisible()
  await expect(list.filter({ hasText: /^SUM$/ })).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Tab')
  expect(await editorValue(page)).toMatch(/^=SU[A-Z]*\($/)
  await page.keyboard.type('A1:A2)')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  expect(await shown(page, 2, 0)).toMatch(/^\d+$/)
  // Escape closes the list before it cancels the edit.
  await cell(page, 3, 0).click()
  await page.keyboard.type('=co')
  await expect(list.first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  expect(await editorValue(page)).toBe('=co')
  await page.keyboard.press('Escape')
})

test('Ctrl on the fill handle turns a series into a copy', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '1')
  await typeInto(page, 1, 0, '2')
  await cell(page, 0, 0).click()
  await page.keyboard.down('Shift')
  await cell(page, 1, 0).click()
  await page.keyboard.up('Shift')
  const handle = (await page.locator('.sv-sheet .sv-grid-fill-handle').first().boundingBox())!
  const target = (await cell(page, 4, 0).boundingBox())!
  await page.keyboard.down('Control')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + 10, target.y + target.height / 2, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await page.waitForTimeout(300)
  expect([await shown(page, 2, 0), await shown(page, 3, 0), await shown(page, 4, 0)]).toEqual(['1', '2', '1'])
})

test('Backspace opens the editor empty, so Escape gives the value back', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, 'keep')
  await cell(page, 0, 0).click()
  await page.keyboard.press('Backspace')
  expect(await editorValue(page)).toBe('')
  await page.keyboard.press('Escape')
  expect(await shown(page, 0, 0)).toBe('keep')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  expect(await shown(page, 0, 0)).toBe('')
})

test('Ctrl+F opens Find and Replace on the sheet', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, 'needle')
  await cell(page, 2, 2).click()
  await page.keyboard.press('Control+F')
  const modal = page.locator('.sv-modal').last()
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(/Find/)
  await page.keyboard.press('Escape')
})

test('a name typed into the Name Box is defined for the selection, one undo', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '42')
  await cell(page, 0, 0).click()
  await nameBox(page).click()
  await nameBox(page).fill('Answer')
  await page.keyboard.press('Enter')
  await expect(page.locator('.sv-sheet .status')).toContainText('Answer now refers to $A$1')
  await typeInto(page, 1, 0, '=Answer*2')
  expect(await shown(page, 1, 0)).toBe('84')
  await page.keyboard.press('Control+Z')
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(200)
  await typeInto(page, 1, 0, '=Answer*2')
  expect(await shown(page, 1, 0)).toBe('#NAME?')
  // An address stays an address, and a bad name is refused with a reason.
  await nameBox(page).click()
  await nameBox(page).fill('1st')
  await page.keyboard.press('Enter')
  await expect(page.locator('.sv-sheet .status')).toContainText('not a valid name')
})

test('a plain number typed into a percent cell is that percentage', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '10%')
  await typeInto(page, 0, 0, '5')
  expect(await shown(page, 0, 0)).toBe('5%')
  // A typed percent, or a formula, says what it says.
  await typeInto(page, 0, 0, '250%')
  expect(await shown(page, 0, 0)).toBe('250%')
  await typeInto(page, 0, 0, '=0.5')
  expect(await shown(page, 0, 0)).toBe('50%')
})
