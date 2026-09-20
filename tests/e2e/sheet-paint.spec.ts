import { expect, test, type Page } from '@playwright/test'

/**
 * What the sheet PAINTS where jsdom cannot say: a title on a banded row
 * reading in full across its band, a collaborator's name tag on the first
 * row staying in the body rather than under the sticky column header, and
 * the dialog a table opens on itself saying so.
 *
 * All three came out of a QA pass over the sheet demos (2026-09-21): the
 * band titles in demos 492 and 493 were cut at column A's edge, because a
 * filled cell never spilled; the tag hung above its cell, which on row 1
 * is under the header; and Ctrl+T inside a table said "Create Table".
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)

async function open(page: Page, demo: string) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

test('a title on a banded row reads in full across the band', async ({ page }) => {
  await open(page, '492-sheet-iterative')
  for (const r of [0, 6]) {
    const span = cell(page, r, 0).locator('.sheet-cell')
    await expect(span).toHaveClass(/spill/)
    // Nothing of the text is cut: the span is as wide as its text, and it
    // paints the band's own fill as it runs over B and C.
    const fits = await span.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
    expect(fits, `row ${r + 1}`).toBe(true)
    const column = (await cell(page, r, 0).boundingBox())!
    const box = (await span.boundingBox())!
    expect(box.width).toBeGreaterThan(column.width)
    await expect(span).toHaveCSS('background-color', 'rgb(226, 232, 240)')
  }
})

test("a collaborator's tag on the first row sits under the cell, in the body", async ({ page }) => {
  await open(page, '488-sheet-collaboration')
  const left = page.locator('.sv-sheet').nth(0)
  const right = page.locator('.sv-sheet').nth(1)
  const tag = right.locator('.sheet-presence-tag').first()
  // Ada moves to C1 on the left: her tag on the right cannot go above C1,
  // which is the column header, so it flips below.
  await left.locator('td[data-svgrid-row="0"][data-svgrid-col="2"]').click()
  await page.waitForTimeout(500)
  await expect(tag).toHaveClass(/below/)
  const c1 = (await right.locator('td[data-svgrid-row="0"][data-svgrid-col="2"]').boundingBox())!
  const box = (await tag.boundingBox())!
  expect(Math.abs(box.y - (c1.y + c1.height))).toBeLessThanOrEqual(2)
  // And on a row with room above, it hangs over the cell as before.
  await left.locator('td[data-svgrid-row="3"][data-svgrid-col="2"]').click()
  await page.waitForTimeout(500)
  await expect(tag).not.toHaveClass(/below/)
  const c4 = (await right.locator('td[data-svgrid-row="3"][data-svgrid-col="2"]').boundingBox())!
  const box2 = (await tag.boundingBox())!
  expect(Math.abs(box2.y + box2.height - c4.y)).toBeLessThanOrEqual(2)
})

test('Ctrl+T inside a table opens the dialog on that table, and says so', async ({ page }) => {
  await open(page, '491-sheet-tables')
  await cell(page, 2, 2).click()
  await page.keyboard.press('Control+T')
  const modal = page.locator('.sv-modal:has(.sv-sheet-dialog)').last()
  await expect(modal).toBeVisible()
  await expect(modal.locator('.sv-modal__header')).toContainText('Table')
  await expect(modal.locator('.sv-modal__header')).not.toContainText('Create')
  await expect(modal.locator('input[type="text"]').nth(1)).toHaveValue('Orders')
  await modal.locator('button', { hasText: /^Cancel$/ }).click()
  // On a plain block it is a new one.
  await cell(page, 1, 6).click()
  await page.keyboard.press('Control+T')
  await expect(page.locator('.sv-modal:has(.sv-sheet-dialog)').last().locator('.sv-modal__header')).toContainText('Create Table')
})
