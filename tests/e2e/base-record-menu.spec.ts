/**
 * E2E: a SvGrid Base grid around its records.
 *  - right-click a record: its menu duplicates it, and Delete record asks
 *    first (demo 523, expense approvals),
 *  - "+ Add row" sits under the summary row, and rows scrolling behind the
 *    sticky footer do not paint their pinned cells over it,
 *  - "Comment" opens the record at its comment box; the comment count then
 *    shows by the row number and on the card (demo 504, project tracker),
 *  - group rows are taller than records (demo 522, OKRs).
 */
import { expect, test, type Page } from '@playwright/test'

const demo = (id: string) => `/sv-grid/#/demos/${id}`
const row = (page: Page, text: string) => page.locator('.sv-grid-row', { hasText: text }).first()
const count = (page: Page) => page.locator('.sv-fvb-count')

async function open(page: Page, id: string, height = 1000) {
  await page.setViewportSize({ width: 1400, height })
  await page.goto(demo(id))
  // The first visit compiles the demo on the dev server: give it time.
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}

/** Bring the base's bottom edge (footer, "+ Add row", selection bar) on screen: at
 *  700px high it can start below the fold where the demo header wraps taller. */
async function showBottom(page: Page) {
  await page.locator('.sv-fbase').first().evaluate((el) => el.scrollIntoView({ block: 'end' }))
}

async function menuOn(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().click({ button: 'right' })
  await expect(page.locator('.sv-grid-context-menu')).toBeVisible()
}

test.describe('SvGrid Base record menu (real browser)', () => {
  test('duplicates a record, and asks before deleting one', async ({ page }) => {
    await open(page, '523-base-expenses')
    await expect(count(page)).toHaveText('10 records')
    await menuOn(page, 'Taxi to the airport')
    await expect(page.locator('.sv-grid-context-menu .sv-grid-menu-item')).toHaveText([
      'Expand record', 'Comment', 'Insert record above', 'Insert record below', 'Duplicate record', 'Copy', 'Paste', 'Delete record',
    ])
    await page.getByRole('menuitem', { name: 'Duplicate record' }).click()
    await expect(count(page)).toHaveText('11 records')
    await expect(page.locator('.sv-grid-row', { hasText: 'Taxi to the airport' })).toHaveCount(2)

    await menuOn(page, 'Client dinner')
    await page.getByRole('menuitem', { name: 'Delete record' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete record?' })
    await expect(dialog).toContainText('Client dinner is deleted')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(count(page)).toHaveText('11 records')
    await menuOn(page, 'Client dinner')
    await page.getByRole('menuitem', { name: 'Delete record' }).click()
    await page.getByRole('dialog', { name: 'Delete record?' }).getByRole('button', { name: 'Delete record' }).click()
    await expect(count(page)).toHaveText('10 records')
    await expect(page.locator('.sv-grid-row', { hasText: 'Client dinner' })).toHaveCount(0)
  })

  test('puts "+ Add row" under the summary row, over the pinned cells that scroll behind', async ({ page }) => {
    // Short enough that the records scroll under the footer.
    await open(page, '523-base-expenses', 700)
    const rows = page.locator('.sv-grid-foot > tr')
    await expect(rows.nth(0)).toHaveClass(/sv-grid-summary-row/)
    await expect(rows.nth(1)).toHaveClass(/sv-field-row-adder/)
    // What is drawn at the adder's left end, over the pinned column, is the adder.
    const button = page.locator('.sv-grid-foot .sv-field-row-adder-button')
    await showBottom(page)
    const box = (await button.boundingBox())!
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('.sv-field-row-adder') != null, [box.x + 10, box.y + box.height / 2])
    expect(hit).toBe(true)
  })

  test('keeps the summary row and "+ Add row" last while the selection bar is up', async ({ page }) => {
    await open(page, '504-project-tracker', 700)
    const target = row(page, 'Upload hook + adapters')
    await target.hover()
    await target.locator('.sv-frh-check').click()
    await expect(page.locator('.sv-grid-root[data-selbar$="bottom"]')).toHaveCount(1)
    // Rows scrolled part way would pass under the footer; the strip below it is the bar's.
    await page.evaluate(() => { document.querySelector('.sv-fbase .sv-grid-container')!.scrollTop = 60 })
    await showBottom(page)
    const foot = (await page.locator('.sv-fbase .sv-grid-foot').boundingBox())!
    // The strip is painted (a shadow), so hit-testing still finds the rows: read the pixels.
    // Under the Task column a body row would show its name; the strip is one color. Left of
    // the centered bar, whose edge and shadow slide in there.
    const shot = await page.screenshot({ clip: { x: foot.x + 80, y: foot.y + foot.height + 6, width: 150, height: 4 } })
    const colors = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      const seen = new Set<string>()
      for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`)
      return seen.size
    }, shot.toString('base64'))
    expect(colors).toBe(1)
  })

  test('comments from the menu, and counts them on the row and the card', async ({ page }) => {
    await open(page, '504-project-tracker')
    await menuOn(page, 'Attachment cell')
    await page.getByRole('menuitem', { name: 'Comment' }).click()
    const box = page.locator('.sv-frv-comment textarea')
    await expect(box).toBeFocused()
    await box.fill('Can we ship this Friday?')
    await page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(page.locator('.sv-frv-item.is-comment')).toContainText('Can we ship this Friday?')
    await page.keyboard.press('Escape')
    await expect(row(page, 'Attachment cell').locator('.sv-frh-comments')).toHaveText('1')
    // It stays under the pointer, in the expand button's place, and opens the discussion.
    await row(page, 'Attachment cell').hover()
    await row(page, 'Attachment cell').locator('.sv-frh-comments').click()
    await expect(page.locator('.sv-frv-comment textarea')).toBeFocused()
    await page.keyboard.press('Escape')

    // The board shows it on the card; its badge opens the discussion.
    await page.locator('.sv-fvb-view').click()
    await page.locator('.sv-fviews-pick', { hasText: 'By status' }).click()
    const card = page.locator('.sv-board-card', { hasText: 'Attachment cell' })
    await expect(card.locator('.sv-board-badge.is-btn')).toHaveText('1')
    await card.locator('.sv-board-badge.is-btn').click()
    await expect(page.locator('.sv-frv-comment textarea')).toBeFocused()
  })

  test('draws group rows taller than records', async ({ page }) => {
    await open(page, '522-base-okrs')
    const group = page.locator('.sv-grid-group-row').first()
    await expect(group).toBeVisible()
    const groupHeight = (await group.boundingBox())!.height
    const recordHeight = (await page.locator('tbody .sv-grid-row:not(.sv-grid-group-row)').first().boundingBox())!.height
    expect(groupHeight).toBeGreaterThan(recordHeight)
  })
})
