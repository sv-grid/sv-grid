/**
 * E2E: a range of cells on demo 723, a table of a million records. Real keys and a
 * real clipboard: a block lands in every column, a range past the loaded rows goes
 * through the job's dialog and says how many, a copy too big for a tab says so, and Esc
 * ends a drag of the fill handle. Delete empties a range of selects, and Delete in an open
 * select empties it. A clear past what is loaded is asserted on real databases in
 * base-range.live.dom.test.ts.
 */
import { expect, test, type Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/sv-grid/#/demos/723-base-million-orders')
  await page.locator('text=SO-100010').first().waitFor({ timeout: 120_000 })
  await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
}
// Columns of the demo, in its order: Order, Customer, Tier, Status, Region.
const ORDER = 0
const STATUS = 3
const at = (page: Page, row: number, c: number) => page.locator(`td[data-svgrid-row="${row}"][data-svgrid-col="${c}"]`)
const setClipboard = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text)

test.describe('SvGrid Base: a range on a million records (real browser)', () => {
  test.setTimeout(180_000)

  test('a block lands in every column of every row', async ({ page }) => {
    await open(page)
    await at(page, 2, STATUS).click()
    await setClipboard(page, 'New\tLATAM\nReturned\tAPAC\n')
    await page.keyboard.press('Control+v')
    await expect(at(page, 2, STATUS)).toContainText('New')
    await expect(at(page, 2, STATUS + 1)).toContainText('LATAM')
    await expect(at(page, 3, STATUS)).toContainText('Returned')
    await expect(at(page, 3, STATUS + 1)).toContainText('APAC')

  })

  test('a paste past what is loaded reaches every line, says how many, and one Undo takes it back', async ({ page }) => {
    await open(page)
    await at(page, 1, STATUS).click()
    await setClipboard(page, Array.from({ length: 2000 }, () => 'Returned\tLATAM').join('\n'))
    await page.keyboard.press('Control+v')
    // A line that holds what the record holds is no change, so the count is under 2,000.
    await expect(page.getByText(/^Changed 1,\d{3} of 1,\d{3} records$/).first()).toBeVisible({ timeout: 60_000 })
    await expect(at(page, 1, STATUS)).toContainText('Returned')
    await expect(at(page, 1, STATUS + 1)).toContainText('LATAM')
    await page.keyboard.press('Control+z')
    await expect(at(page, 1, STATUS)).not.toContainText('Returned', { timeout: 30_000 })
  })

  test('a copy too big for a tab copies nothing, and says the number', async ({ page }) => {
    await open(page)
    await at(page, 1, STATUS).click()
    await setClipboard(page, 'kept')
    await page.keyboard.press('Control+Shift+End')
    await page.keyboard.press('Control+c')
    await expect(page.getByText(/more than the 2,000,000 a copy can hold/).first()).toBeVisible({ timeout: 20_000 })
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('kept')
  })

  test('Esc during a drag of the fill handle: the release writes nothing', async ({ page }) => {
    await open(page)
    const from = at(page, 1, ORDER)
    await from.click()
    const was = await at(page, 4, ORDER).innerText()
    const box = (await from.boundingBox())!
    await page.mouse.move(box.x + box.width - 1, box.y + box.height - 1)
    await page.mouse.down()
    const target = (await at(page, 4, ORDER).boundingBox())!
    await page.mouse.move(target.x + 20, target.y + 10, { steps: 6 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await at(page, 4, ORDER).innerText()).toBe(was)
  })

  test('Delete empties a range of selects, and Delete in an open select empties it too', async ({ page }) => {
    await open(page)
    await at(page, 5, ORDER).click()
    // A range made with the keys: Delete empties every cell of it.
    await at(page, 2, STATUS).click()
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Delete')
    for (const [r, c] of [[2, STATUS], [2, STATUS + 1], [3, STATUS], [3, STATUS + 1]]) await expect(at(page, r!, c!)).toHaveText(/^\s*$/)
    // A click on the selected cell opens its editor; Delete there empties it, as on the cell.
    await at(page, 6, STATUS).click()
    const was = (await at(page, 6, STATUS).innerText()).trim()
    expect(was).not.toBe('')
    await at(page, 6, STATUS).click()
    await expect(page.locator('input.sv-fse-search')).toBeVisible()
    await page.keyboard.press('Delete')
    await expect(page.locator('input.sv-fse-search')).toHaveCount(0)
    await expect(at(page, 6, STATUS)).toHaveText(/^\s*$/)
  })
})
