/**
 * E2E: what a person sees in the views of a SvGrid Base, with a real mouse and
 * keyboard.
 *  - a select option renamed in the field editor reaches the records and the
 *    board, and undo takes it back; one removed says what it clears, next to Save,
 *  - a board, calendar and timeline follow undo and a record edit,
 *  - a sorted grid holds a row only while it is active, and the count stays right,
 *  - ticking records gives the bulk bar, not a developer note,
 *  - a field that drives a view asks first; a view asks in its row and comes back,
 *  - columns resize and move by drag, and Hide fields keeps its rows still,
 *  - a form is built in a dialog and refuses to send nothing.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

const crm = '/sv-grid/base/sales-crm/'
const roadmap = '/sv-grid/base/product-roadmap/'

async function open(page: Page, url: string) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.locator('.sv-fvb-view').waitFor({ timeout: 90_000 })
  await page.locator('tbody .sv-grid-row, .sv-board-card').first().waitFor({ timeout: 90_000 })
  // The view settles on load: a menu opened before that closes again.
  await page.waitForTimeout(1000)
}
async function view(page: Page, name: string) {
  await page.locator('.sv-fvb-view').click()
  await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
  await page.waitForTimeout(500)
}
const lanes = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.sv-board-lane')].map((l) => `${l.querySelector('.sv-board-lane-title')?.textContent}:${l.querySelectorAll('.sv-board-card').length}`).join(' '))
const rowText = (page: Page, i: number) => page.locator('tbody .sv-grid-row').nth(i).innerText()
const cell = (page: Page, r: number, c: number) => page.locator('tbody .sv-grid-row').nth(r).locator('td[role="gridcell"]').nth(c)

/** Open a field's menu from its header. */
async function fieldMenu(page: Page, id: string) {
  const head = page.locator(`[data-svgrid-header-col="${id}"]`)
  await head.hover()
  await page.waitForTimeout(200)
  await head.locator('.sv-grid-col-menu-btn:not(.sv-grid-col-filter-btn)').click()
}
async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2 + 2, { steps: 3 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(400)
}

test.describe('SvGrid Base views (real browser)', () => {
  test.setTimeout(150_000)

  test('a renamed option reaches the records and the board, and undo takes it back', async ({ page }) => {
    await open(page, crm)
    await view(page, 'Pipeline')
    const before = await lanes(page)
    expect(before).toContain('Proposal:8')
    await view(page, 'All deals')
    await fieldMenu(page, 'stage')
    await page.getByText('Edit field', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('.sv-fopt-name').nth(2).fill('Quote')
    await dialog.getByRole('button', { name: 'Save' }).click()
    // The Stage cells only: a next step can say "proposal" too.
    const stages = () => page.evaluate(() => [...document.querySelectorAll('tbody .sv-grid-row')].map((r) => r.querySelectorAll('td[role="gridcell"]')[3]?.textContent?.trim() ?? ''))
    await expect.poll(stages).toContain('Quote')
    expect(await stages()).not.toContain('Proposal')
    await view(page, 'Pipeline')
    expect(await lanes(page)).toBe(before.replace('Proposal:8', 'Quote:8'))
    await page.keyboard.press('Control+z')
    await expect.poll(() => lanes(page)).toBe(before)
  })

  test('removing an option says what it clears next to Save, in sight, and the card stays', async ({ page }) => {
    await open(page, crm)
    await view(page, 'Pipeline')
    const total = await page.locator('.sv-board-card').count()
    await view(page, 'All deals')
    await fieldMenu(page, 'stage')
    await page.getByText('Edit field', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Remove Lost' }).click()
    const warning = dialog.locator('.sv-fed-warning', { hasText: 'Lost' })
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('2 records hold Lost')
    await expect(warning).toBeInViewport()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await view(page, 'Pipeline')
    await expect(page.locator('.sv-board-card')).toHaveCount(total)
    await expect(page.locator('.sv-board-lane-title', { hasText: 'Uncategorized' })).toBeVisible()
  })

  test('a type change that clears cells warns in sight of Save', async ({ page }) => {
    await open(page, crm)
    await fieldMenu(page, 'nextStep')
    await page.getByText('Edit field', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('.sv-fed-current').click()
    await dialog.getByRole('radio', { name: 'Number', exact: true }).click()
    const warning = dialog.locator('.sv-fed-warning')
    await expect(warning).toContainText('cleared or cut short')
    await expect(warning).toBeInViewport()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
  })

  test('a board follows a drag undone and a record edited', async ({ page }) => {
    await open(page, crm)
    await view(page, 'Pipeline')
    const start = await lanes(page)
    await drag(page, page.locator('.sv-board-lane').nth(2).locator('.sv-board-card').first(), page.locator('.sv-board-lane').nth(3).locator('.sv-board-card').first())
    expect(await lanes(page)).not.toBe(start)
    await page.keyboard.press('Control+z')
    await expect.poll(() => lanes(page)).toBe(start)
    await page.locator('.sv-board-lane').nth(1).locator('.sv-board-card').first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Stage/ }).first().click()
    await page.keyboard.type('Won')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    if (await dialog.count()) await page.keyboard.press('Escape')
    await expect.poll(() => lanes(page)).toContain('Won:5')
  })

  test('a timeline is in Create, opens, and follows undo', async ({ page }) => {
    await open(page, roadmap)
    await page.locator('.sv-fvb-view').click()
    await expect(page.locator('.sv-fviews-type', { hasText: 'Timeline' })).toBeVisible()
    await page.keyboard.press('Escape')
    await view(page, 'Timeline')
    await page.locator('.sv-gantt-bar').first().waitFor()
    // A point on a bar that nothing lies over: the task table covers the start of the chart.
    const spot = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.sv-gantt-bar')]
      for (let i = 0; i < bars.length; i += 1) {
        const r = bars[i]!.getBoundingClientRect()
        const y = r.top + r.height / 2
        for (const f of [0.5, 0.7, 0.85]) {
          const x = r.left + r.width * f
          if (x > 0 && x < innerWidth - 100 && y > 0 && y < innerHeight && document.elementFromPoint(x, y)?.closest('.sv-gantt-bar') === bars[i]) return { i, x, y }
        }
      }
      return null
    })
    expect(spot).not.toBeNull()
    const bar = page.locator('.sv-gantt-bar').nth(spot!.i)
    // Where the bar sits in the chart, not on screen: a drag that starts near the
    // chart's edge scrolls it (the edge scroll), and the bar's dates are what undo restores.
    const at = () => bar.evaluate((el) => Math.round(el.getBoundingClientRect().x + el.closest('.sv-gantt-scroll')!.scrollLeft))
    const was = await at()
    await page.mouse.move(spot!.x, spot!.y)
    await page.mouse.down()
    await page.mouse.move(spot!.x + 30, spot!.y, { steps: 4 })
    await page.mouse.move(spot!.x + 80, spot!.y, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Math.abs((await at()) - was)).toBeGreaterThan(10)
    await page.keyboard.press('Control+z')
    await expect.poll(at).toBe(was)
  })

  test('a sorted grid holds the edited row until the person moves on', async ({ page }) => {
    await open(page, crm)
    const first = await cell(page, 0, 0).innerText()
    await cell(page, 0, 5).click()
    await page.keyboard.press('F2')
    await page.keyboard.press('Control+A')
    await page.keyboard.type('1000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)
    expect(await rowText(page, 0)).toContain(first)
    await cell(page, 4, 1).click()
    await expect.poll(() => rowText(page, 0)).not.toContain(first)
    await expect(page.locator('.sv-fvb-count')).toHaveText('30 records')
    await page.keyboard.press('Control+z')
    await expect.poll(() => rowText(page, 0)).toContain(first)
  })

  test('ticking records gives the bulk bar, and no developer note', async ({ page }) => {
    await open(page, roadmap)
    const row = page.locator('.sv-grid-row:has(.sv-frh-check)')
    await row.nth(0).hover()
    await row.nth(0).locator('.sv-frh-check').click()
    await row.nth(1).hover()
    await row.nth(1).locator('.sv-frh-check').click()
    await expect(page.locator('.sv-selbar')).toContainText('Delete')
    await expect(page.locator('.sv-grid-selection-bar-upsell')).toHaveCount(0)
  })

  test('deleting a field that drives a view asks and names it', async ({ page }) => {
    await open(page, crm)
    await fieldMenu(page, 'stage')
    await page.getByText('Delete field', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Pipeline: stacks its cards by it')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('[data-svgrid-header-col="stage"]')).toBeVisible()
  })

  test('a view asks in its row, the list stays still, and the trash brings it back', async ({ page }) => {
    await open(page, crm)
    await page.locator('.sv-fvb-view').click()
    const rows = page.locator('.sv-fviews-item')
    const count = await rows.count()
    await rows.nth(1).hover()
    await rows.nth(1).locator('[title="Delete"]').click()
    await expect(rows).toHaveCount(count)
    await expect(page.locator('.sv-fviews-ask')).toContainText('Delete Pipeline?')
    await page.locator('.sv-fviews-ask').getByRole('button', { name: 'Delete' }).click()
    await expect(rows).toHaveCount(count - 1)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Trash/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /Views/ }).click()
    await dialog.getByRole('button', { name: /Restore/ }).first().click()
    await page.keyboard.press('Escape')
    await page.locator('.sv-fvb-view').click()
    await expect(page.getByRole('button', { name: 'Pipeline', exact: true })).toBeVisible()
  })

  test('columns resize and move by drag, and stay when the view comes back', async ({ page }) => {
    await open(page, crm)
    const head = (id: string) => page.locator(`[data-svgrid-header-col="${id}"]`)
    const wide = (await head('contact').boundingBox())!.width
    const handle = head('contact').locator('[class*="resize"]').first()
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 2 + 60, h.y + h.height / 2, { steps: 6 })
    await page.mouse.up()
    await expect.poll(async () => Math.round((await head('contact').boundingBox())!.width)).toBe(Math.round(wide + 60))
    const order = () => page.evaluate(() => [...document.querySelectorAll('[data-svgrid-header-col]')].map((x) => x.getAttribute('data-svgrid-header-col')))
    expect((await order()).slice(0, 4)).toEqual(['deal', 'account', 'contact', 'stage'])
    await head('stage').dragTo(head('account'))
    await expect.poll(async () => (await order()).indexOf('stage')).toBeLessThan(3)
    // The primary field stays first.
    expect((await order())[0]).toBe('deal')
    await page.waitForTimeout(600)
    const moved = await order()
    await view(page, 'Pipeline')
    await view(page, 'All deals')
    expect(await order()).toEqual(moved)
  })

  test('Hide fields keeps its rows still under the pointer', async ({ page }) => {
    await open(page, crm)
    await page.getByRole('button', { name: /Hide fields/ }).click()
    const names = () => page.locator('.sv-fhide-name').allInnerTexts()
    const before = await names()
    const box = (await page.locator('.sv-fhide-row').nth(2).boundingBox())!
    for (let i = 0; i < 4; i += 1) {
      await page.mouse.click(box.x + 14, box.y + box.height / 2 + i * box.height)
      await page.waitForTimeout(80)
    }
    expect(await names()).toEqual(before)
    await expect(page.getByRole('button', { name: '4 hidden fields' })).toBeVisible()
  })

  test('a form is built in a dialog, and an empty one is not sent', async ({ page }) => {
    await open(page, crm)
    await view(page, 'New lead')
    await page.getByRole('button', { name: 'Customize form' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('Tell us about the deal')
    const first = await dialog.locator('.sv-fformb-name').first().innerText()
    await dialog.getByRole('button', { name: `Move ${first} down` }).click()
    await expect(dialog.locator('.sv-fformb-name').nth(1)).toHaveText(first)
    await dialog.getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('.sv-fform').getByText('Tell us about the deal')).toBeVisible()
    await page.locator('.sv-fform button[type="submit"]').click()
    await expect(page.getByText('The record was added.')).toHaveCount(0)
  })
})
