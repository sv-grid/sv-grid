/**
 * E2E: records stay when the view changes (local tables, demos 512, 513, 511).
 * A view switch sets grid options, and each option makes the grid read its `data`
 * prop again. What was added, duplicated, submitted by a form or deleted must be
 * what it reads.
 */
import { expect, test, type Page } from '@playwright/test'

const count = (page: Page) => page.locator('.sv-fvb-count')
const firstCount = async (page: Page) => Number(((await count(page).textContent()) ?? '').replace(/\D/g, ''))

async function open(page: Page, demo: string) {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(`/sv-grid/#/demos/${demo}`, { timeout: 80_000 })
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}
async function pick(page: Page, name: string) {
  await page.locator('.sv-fvb-view').click()
  await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
  await expect(page.locator('.sv-fvb-view-name')).toHaveText(name)
}
async function viewNames(page: Page) {
  await page.locator('.sv-fvb-view').click()
  const names = (await page.locator('.sv-fviews-pick').allTextContents()).map((s) => s.trim())
  await page.keyboard.press('Escape')
  return names
}
/**
 * The rows are virtual: a row exists once the grid has scrolled to it. A new record
 * goes to the end, unless the view sorts: then a blank sort value puts it first.
 */
async function rowAtEnd(page: Page, text: string) {
  const row = page.locator('.sv-grid-row', { hasText: text }).first()
  const box = (await page.locator('.sv-grid-root').first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (const dy of [100_000, -100_000]) {
    await page.mouse.wheel(0, dy)
    // Look only once the grid is at that end: before the scroll lands, the row
    // can still be on screen from where the grid was.
    await page.waitForFunction((down) => {
      const c = document.querySelector('.sv-grid-root .sv-grid-container')
      return !!c && (down ? c.scrollTop >= c.scrollHeight - c.clientHeight - 1 : c.scrollTop <= 0)
    }, dy > 0)
    await page.waitForTimeout(100) // the rows render on the next frame
    if (await row.count()) return row
  }
  return row
}
/** The "+" row at the end of the grid, a name, then a click elsewhere. */
async function addByRow(page: Page, name: string) {
  const add = page.locator('.sv-field-row-adder-button').first()
  await add.scrollIntoViewIfNeeded()
  await add.click()
  await page.keyboard.type(name, { delay: 10 })
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
}

test.describe('records stay when the view changes (real browser)', () => {
  test.setTimeout(90_000)
  for (const [demo, there, back] of [
    ['512-base-sales-crm', 'Pipeline', 'All deals'],
    ['513-base-product-roadmap', 'Board', ''],
    ['511-base-content-calendar', 'Calendar', ''],
    ['520-base-bug-tracker', 'Board', ''],
  ] as const) {
    test(`added and deleted records survive a view switch in ${demo}`, async ({ page }) => {
      await open(page, demo)
      const first = (await page.locator('.sv-fvb-view-name').textContent())!.trim()
      const home = back || first
      const names = await viewNames(page)
      const other = names.find((n) => n.includes(there)) ?? names.find((n) => !n.includes(first))!
      const to = other.replace(/\s*\d+$/, '').trim()
      const start = await firstCount(page)

      await addByRow(page, 'Kept across views')
      await expect(count(page)).toContainText(String(start + 1))
      await pick(page, to)
      await pick(page, home)
      await expect(count(page)).toContainText(String(start + 1))
      const row = await rowAtEnd(page, 'Kept across views')
      await expect(row).toBeAttached()

      // Delete it through the record menu: it stays gone, and in the trash.
      await row.locator('.sv-grid-cell').nth(2).click({ button: 'right' })
      await page.getByRole('menuitem', { name: /Delete/ }).first().click()
      const yes = page.locator('[role="dialog"] button', { hasText: /^Delete/ })
      if (await yes.count()) await yes.last().click()
      await expect(count(page)).toContainText(String(start))
      await pick(page, to)
      await pick(page, home)
      await expect(count(page)).toContainText(String(start))
      await expect(page.locator('.sv-grid-row', { hasText: 'Kept across views' })).toHaveCount(0)
    })
  }

  test('a form record is in the table afterwards (512, Contacts)', async ({ page }) => {
    await open(page, '512-base-sales-crm')
    await page.locator('.sv-btabs [role="tab"]', { hasText: 'Contacts' }).click()
    const home = (await page.locator('.sv-fvb-view-name').textContent())!.trim()
    await expect(count(page)).toBeVisible()
    const start = await firstCount(page)
    await pick(page, 'Add a contact')
    await page.locator('.sv-fform input').first().fill('Form person')
    await page.locator('.sv-fform-submit').click()
    await expect(page.locator('.sv-fform-done')).toBeVisible()
    await pick(page, home)
    await expect(count(page)).toContainText(String(start + 1))
    await expect(await rowAtEnd(page, 'Form person')).toBeAttached()
  })

  test('Duplicate from the record menu survives (512)', async ({ page }) => {
    await open(page, '512-base-sales-crm')
    const start = await firstCount(page)
    await page.locator('.sv-grid-row', { hasText: 'Contoso' }).first().locator('.sv-grid-cell').nth(2).click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Duplicate/ }).first().click()
    await expect(count(page)).toContainText(String(start + 1))
    await pick(page, 'Pipeline')
    await pick(page, 'All deals')
    await expect(count(page)).toContainText(String(start + 1))
  })

  test('a card added on the board survives (512)', async ({ page }) => {
    await open(page, '512-base-sales-crm')
    const start = await firstCount(page)
    await pick(page, 'Pipeline')
    await page.getByText('+ Add a card').first().click()
    await page.keyboard.type('Board card', { delay: 10 })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await pick(page, 'All deals')
    await expect(count(page)).toContainText(String(start + 1))
    await expect(await rowAtEnd(page, 'Board card')).toBeAttached()
  })
})
