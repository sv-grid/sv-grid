/**
 * E2E: what a person working fast meets on a real base (demo 512, the sales CRM):
 * adding a record in a grouped view, undo across tabs, the labels on Undo, and the
 * small keys and panels around them.
 */
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, height = 900) {
  // A dev server's reload mid-test would take the records away.
  await page.routeWebSocket(/token=/, () => {})
  await page.setViewportSize({ width: 1800, height })
  await page.goto('/sv-grid/#/demos/512-base-sales-crm', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}
async function view(page: Page, from: string, to: string) {
  await page.locator('button', { hasText: from }).first().click()
  await page.getByText(to, { exact: true }).first().click()
}
const tab = (page: Page, name: string) => page.locator('.sv-btabs').getByRole('tab', { name, exact: true }).first().click()
const rowOf = (page: Page, text: string) => page.locator('.sv-grid-table tbody tr', { hasText: text }).first()
/** The record count the view bar shows. */
const count = async (page: Page) => Number((await page.locator('.sv-fvb-count').innerText()).replace(/\D/g, ''))

async function tick(page: Page, text: string) {
  const b = (await rowOf(page, text).boundingBox())!
  await page.mouse.move(b.x + 22, b.y + b.height / 2)
  await expect.poll(async () => page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('input, label, button'), [b.x + 22, b.y + b.height / 2])).toBe(true)
  await page.mouse.click(b.x + 22, b.y + b.height / 2)
}

test('Add record in a grouped view goes to the new record: what is typed is its name, and one record is made', async ({ page }) => {
  await open(page)
  await view(page, 'All deals', 'Open deals by owner')
  await expect(page.locator('.sv-fvb-view')).toContainText('Open deals by owner')
  const was = await count(page)
  await page.locator('button', { hasText: 'Add deal' }).last().click()
  await expect(page.locator('.sv-grid-cell-editor')).toBeFocused()
  await page.keyboard.type('My new deal')
  await page.keyboard.press('Enter')
  await expect(page.locator('.sv-grid-table tbody tr', { hasText: 'My new deal' })).toHaveCount(1)
  expect(await count(page)).toBe(was + 1)
})

test('undoing a delete after a restore on another tab leaves both sides of the link whole', async ({ page }) => {
  await open(page)
  await tab(page, 'Accounts')
  const figures = async () => {
    const text = (await rowOf(page, 'Contoso').innerText()).replace(/\s+/g, ' ')
    return { deals: text.match(/Contoso: /g)?.length, total: /\$[\d,]+/.exec(text)?.[0] }
  }
  const was = await figures()
  await tab(page, 'Deals')
  const deals = page.locator('.sv-grid-table tbody tr', { hasText: 'Contoso:' })
  const first = (await deals.nth(0).locator('[data-col-id="deal"]').innerText()).trim()
  const second = (await deals.nth(1).locator('[data-col-id="deal"]').innerText()).trim()
  await tick(page, first)
  await tick(page, second)
  await page.locator('.sv-selbar-btn', { hasText: 'Delete' }).click()
  await page.locator('.sv-selbar-btn.is-danger.is-solid').click()
  await expect(page.locator('.sv-grid-table tbody tr', { hasText: first })).toHaveCount(0)

  await tab(page, 'Accounts')
  await page.locator('.sv-btabs-trash').click()
  await page.locator('.sv-btrash-btn', { hasText: 'Restore' }).first().click()
  await page.keyboard.press('Escape')
  await tab(page, 'Deals')
  await page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ }).click()
  await expect(page.locator('.sv-grid-table tbody tr', { hasText: first })).toHaveCount(1)
  await expect(page.locator('.sv-grid-table tbody tr', { hasText: second })).toHaveCount(1)

  await tab(page, 'Accounts')
  await expect.poll(figures).toEqual(was)
})

test('Enter in the name of a new view closes the menu over it', async ({ page }) => {
  await open(page)
  await page.locator('.sv-fvb-view').click()
  await page.locator('.sv-fviews-add, .sv-fviews button', { hasText: 'Grid' }).first().click()
  const name = page.locator('.sv-fviews-field input')
  await name.fill('My view')
  await name.press('Enter')
  await expect(page.locator('.sv-fvb-view')).toContainText('My view')
  await expect(name).toHaveCount(0)
  await expect(page.locator('.sv-fvb-view')).toHaveAttribute('aria-expanded', 'false')
})

test('Undo names a fill by its cells, and what is said after it is one sentence', async ({ page }) => {
  await open(page)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const cellAt = (i: number) => page.locator('.sv-grid-table tbody tr').nth(i).locator('[data-col-id="value"]')
  const b = (await cellAt(0).boundingBox())!
  await page.mouse.click(b.x + 20, b.y + b.height - 5)
  const handle = page.locator('.sv-grid-fill-handle')
  await handle.waitFor()
  const h = (await handle.boundingBox())!
  const to = (await cellAt(4).boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
  const undo = page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })
  await expect(undo).toHaveAccessibleName(/4 cells/)
  await undo.click()
  await expect(page.locator('[aria-live]').filter({ hasText: 'Undone: 4 cells changed' }).first()).toBeAttached()
  const redo = page.locator('.sv-btabs').getByRole('button', { name: /^Redo/ })
  await redo.click()
  await expect(page.locator('[aria-live]').filter({ hasText: 'Redone: 4 cells changed' }).first()).toBeAttached()
})

test('Apply stays in reach in Edit fields on a short screen', async ({ page }) => {
  await open(page, 800)
  const first = (await page.locator('.sv-grid-table tbody tr').nth(1).locator('[data-col-id="deal"]').innerText()).trim()
  await tick(page, first)
  await page.getByRole('button', { name: 'Edit fields' }).click()
  const apply = page.getByRole('button', { name: /^Apply to/ })
  await apply.waitFor()
  const box = (await apply.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(800)
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('button')?.textContent?.trim() ?? '', [box.x + box.width / 2, box.y + box.height / 2])
  expect(hit).toMatch(/^Apply to/)
})

test('nothing shows below the Apply row of Edit fields, at any scroll', async ({ page }) => {
  await open(page, 980)
  const first = (await page.locator('.sv-grid-table tbody tr').nth(1).locator('[data-col-id="deal"]').innerText()).trim()
  await tick(page, first)
  await page.getByRole('button', { name: 'Edit fields' }).click()
  await page.getByRole('button', { name: /^Apply to/ }).waitFor()
  const under = () => page.evaluate(() => {
    const body = document.querySelector('.sv-drawer__body')!
    const row = document.querySelector('.sv-form__actions')!.getBoundingClientRect()
    const box = body.getBoundingClientRect()
    const x = box.left + box.width / 2
    const hits: string[] = []
    for (let y = row.bottom + 1; y < box.bottom; y += 2) {
      const at = document.elementFromPoint(x, y)
      if (at && !at.closest('.sv-form__actions') && at.closest('.sv-form')) hits.push(at.className || at.tagName)
    }
    return { gap: box.bottom - row.bottom, hits, overflow: body.scrollHeight - body.clientHeight }
  })
  for (const top of [0, 40, 100000]) {
    await page.evaluate((y) => { document.querySelector('.sv-drawer__body')!.scrollTop = y }, top)
    expect((await under()).hits).toEqual([])
  }
})

test("a press beside the number in a record's editor keeps the edit, and what was typed", async ({ page }) => {
  await open(page)
  const name = (await rowOf(page, 'Contoso:').locator('[data-col-id="deal"]').boundingBox())!
  await page.mouse.click(name.x + name.width - 16, name.y + name.height - 5)
  await page.keyboard.press('Space')
  const box = page.locator('.sv-frv-field', { hasText: 'Probability' }).locator('.sv-frv-box')
  await box.click()
  const input = page.locator('.sv-fne-input')
  await expect(input).toBeFocused()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('6')
  const b = (await box.boundingBox())!
  await page.mouse.click(b.x + b.width - 60, b.y + b.height / 2)
  await expect(input).toBeFocused()
  await page.keyboard.type('5')
  await page.keyboard.press('Enter')
  await expect(box).toContainText('65%')
})
