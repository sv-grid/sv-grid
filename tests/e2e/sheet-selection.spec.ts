import { expect, test, type Page } from '@playwright/test'

/**
 * A multi-range selection and month-name dates, as Excel has them. A
 * Ctrl+click selection of two ranges sums and formats both, not only the
 * last; a date with the month spelled out (4-Mar-2026, March 4) is a value
 * a formula can read. Both were wrong on 2026-09-21: the status bar and the
 * shading saw only the active range, and month-name dates stayed as text.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const bar = (page: Page) => page.locator('.sv-sheet textarea.formula').first()
const status = async (page: Page) => (await page.locator('.sv-sheet .status').first().innerText()).replace(/\s+/g, ' ').trim()
const styleOf = (page: Page, r: number, c: number, prop: string) =>
  cell(page, r, c).locator('.sheet-cell').evaluate((s, p) => getComputedStyle(s)[p as never] as string, prop)
async function typeInto(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
}
async function open(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/207-blank-sheet`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

test('a Ctrl+click multi-range selection aggregates and formats both parts', async ({ page }) => {
  await open(page)
  for (let r = 0; r < 5; r += 1) await typeInto(page, r, 0, String((r + 1) * 10))
  // A1:A2 with Shift, then A5 with Ctrl.
  await cell(page, 0, 0).click()
  await page.keyboard.down('Shift')
  await cell(page, 1, 0).click()
  await page.keyboard.up('Shift')
  await page.keyboard.down('Control')
  await cell(page, 4, 0).click()
  await page.keyboard.up('Control')
  const st = await status(page)
  expect(st).toMatch(/Count: 3/)
  expect(st).toMatch(/Sum: 80/)
  // Bold covers both ranges, not the gap.
  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: /^\s*Home\s*$/ }).first().click()
  await page.locator('.sv-ribbon .band:not(.measure) button[title^="Bold"]').first().click()
  await page.waitForTimeout(200)
  expect(Number(await styleOf(page, 0, 0, 'fontWeight'))).toBeGreaterThanOrEqual(600)
  expect(Number(await styleOf(page, 4, 0, 'fontWeight'))).toBeGreaterThanOrEqual(600)
  expect(Number(await styleOf(page, 2, 0, 'fontWeight'))).toBeLessThan(600)
})

test('a month-name date is a value a formula can read', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '4-Mar-2026')
  expect(await shown(page, 0, 0)).toBe('2026-03-04')
  await typeInto(page, 1, 0, 'March 4, 2026')
  expect(await shown(page, 1, 0)).toBe('2026-03-04')
  await typeInto(page, 2, 0, '=A1+1')
  expect(await shown(page, 2, 0)).toBe('5-Mar-2026')
  await typeInto(page, 3, 0, '=A2-A1')
  expect(await shown(page, 3, 0)).toBe('0')
  await cell(page, 0, 0).click()
  await expect(bar(page)).toHaveValue('2026-03-04')
})
