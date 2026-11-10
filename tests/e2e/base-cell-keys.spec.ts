/**
 * E2E: the keys of a SvGrid Base cell, with a real keyboard (demo 504, project
 * tracker): Enter opens a cell's editor, a key typed on a date or a link starts
 * editing, Space ticks a checkbox, and a typed date reads in the forms people type
 * it, or says it is not one.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const year = new Date().getFullYear()

async function open(page: Page) {
  await page.setViewportSize({ width: 2600, height: 900 })
  await page.goto('/sv-grid/#/demos/504-project-tracker', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  // The first visit compiles the demo on the dev server: give it time.
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}

/** The cell of a field in the record at `row`, by the column's header. */
async function cell(page: Page, header: string, row = 1): Promise<Locator> {
  const at = await page.$$eval('.sv-grid-column', (els, h) => els.findIndex((el) => (el.textContent ?? '').trim().startsWith(h)), header)
  expect(at).toBeGreaterThan(-1)
  return page.locator('.sv-grid-table tbody tr').nth(row).locator('.sv-grid-cell').nth(at)
}

/** A plain click selects the cell. The middle of it can hold a link or a chip: its corner does not. */
async function select(page: Page, c: Locator) {
  const b = (await c.boundingBox())!
  await page.mouse.click(b.x + b.width - 6, b.y + b.height - 4)
}

test.describe('SvGrid Base cell keys (real browser)', () => {
  test('Enter on a selected cell opens its editor, and leaving it changes nothing', async ({ page }) => {
    await open(page)
    const c = await cell(page, 'Due')
    const before = await c.textContent()
    await select(page, c)
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fde-input')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fde-input')).toHaveCount(0)
    await expect(c).toHaveText(before!)
    // The keyboard is still in the grid: the next Enter opens the cell below.
    await expect(page.locator('body')).not.toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fde-input')).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test('a key typed on a date cell starts editing, and every usual form is read', async ({ page }) => {
    await open(page)
    const c = await cell(page, 'Due')
    const typed = async (text: string, shows: string) => {
      await select(page, c)
      await page.keyboard.type(text, { delay: 10 })
      await expect(page.locator('.sv-fde-input')).toHaveValue(text)
      await page.keyboard.press('Enter')
      await expect(c).toHaveText(shows)
    }
    await typed('12/24/2026', 'December 24, 2026')
    await typed('2026-12-23', 'December 23, 2026')
    await typed('Dec 22, 2026', 'December 22, 2026')
    await typed('12/21', `December 21, ${year}`)
  })

  test('a date that cannot be read says so, and Escape leaves the cell as it was', async ({ page }) => {
    await open(page)
    const c = await cell(page, 'Due')
    const before = await c.textContent()
    await select(page, c)
    await page.keyboard.type('13/45/2026', { delay: 10 })
    await expect(page.locator('.sv-fde-note.is-error')).toContainText('Not a date')
    await page.keyboard.press('Enter')
    // Still open, still saying so.
    await expect(page.locator('.sv-fde-input')).toHaveValue('13/45/2026')
    await expect(page.locator('.sv-fde-note.is-error')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-fde-input')).toHaveCount(0)
    await expect(c).toHaveText(before!)
  })

  test('a day picked in the calendar is stored', async ({ page }) => {
    await open(page)
    const c = await cell(page, 'Due')
    await select(page, c)
    await page.keyboard.press('Enter')
    await page.locator('.sv-fde-panel').waitFor()
    await page.locator('.sv-fde-panel .sv-cal__daynum', { hasText: /^15$/ }).first().click()
    await expect(page.locator('.sv-fde-input')).toHaveCount(0)
    await expect(c).toContainText('15,')
  })

  test('every field: a cell opened and left changes nothing, so there is nothing to undo', async ({ page }) => {
    await open(page)
    const undo = page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })
    await expect(undo).toBeDisabled()
    const cells = page.locator('.sv-grid-table tbody tr').nth(1).locator('.sv-grid-cell')
    const count = await cells.count()
    const away = (await page.locator('.sv-btabs').boundingBox())!
    for (let i = 1; i < count; i += 1) {
      const b = await cells.nth(i).boundingBox()
      if (!b || b.width < 2) continue
      await page.mouse.dblclick(b.x + b.width - 6, b.y + b.height - 4)
      await page.waitForTimeout(150)
      await page.mouse.click(away.x + away.width - 4, away.y + away.height / 2)
      await page.waitForTimeout(100)
      // A dialog takes that press on its backdrop or not at all.
      await page.keyboard.press('Escape')
      await expect(undo, `column ${i}`).toBeDisabled()
    }
  })

  test('the date editor works in an open record too', async ({ page }) => {
    await open(page)
    const row = page.locator('.sv-grid-table tbody tr').nth(1)
    await row.locator('.sv-grid-cell').nth(1).hover()
    await page.keyboard.press('Escape')
    const name = await cell(page, 'Task')
    await select(page, name)
    await page.keyboard.press('Space')
    const dialog = page.locator('[role=dialog]').first()
    await dialog.waitFor()
    await dialog.getByRole('button', { name: /^Due/ }).click()
    const box = page.locator('.sv-fde-input')
    await box.waitFor()
    await box.fill('Dec 22, 2026')
    await page.keyboard.press('Enter')
    await expect(box).toHaveCount(0)
    await expect(dialog).toContainText('December 22, 2026')
    // The record redraws as its save settles.
    await page.waitForTimeout(600)
    await dialog.getByRole('button', { name: /^Due/ }).click()
    await page.locator('.sv-fde-panel .sv-cal__daynum', { hasText: /^15$/ }).first().click()
    await expect(box).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('December 15, 2026')
  })

  test('a key typed on a link cell opens the picker with that key in its search', async ({ page }) => {
    await open(page)
    const c = await cell(page, 'Milestone')
    await select(page, c)
    await page.keyboard.press('b')
    await expect(page.locator('.sv-flp-search')).toHaveValue('b')
  })

  test('Space and Enter tick a checkbox cell, and undo takes it back', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 900 })
    await page.goto('/sv-grid/#/demos/521-base-event-planning', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.locator('.sv-btabs').getByText('Attendees', { exact: true }).click({ timeout: 60_000 })
    await page.locator('.sv-fcb').first().waitFor()
    const c = page.locator('.sv-grid-cell', { has: page.locator('.sv-fcb') }).first()
    const on = () => c.locator('[aria-checked="true"]').count()
    await select(page, c)
    const was = await on()
    await page.keyboard.press('Space')
    await expect.poll(on).not.toBe(was)
    await page.keyboard.press('Enter')
    await expect.poll(on).toBe(was)
    await page.keyboard.press('Space')
    await expect.poll(on).not.toBe(was)
    await page.keyboard.press('Control+z')
    await expect.poll(on).toBe(was)
    // No row got selected on the way: Space was the checkbox's.
    await expect(page.locator('.sv-grid-selection-bar')).toHaveCount(0)
  })
})
