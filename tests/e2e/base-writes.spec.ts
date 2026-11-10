/**
 * E2E: writes over many rows in a sorted view (demo 512, sales CRM, sorted by
 * Value): each value goes to the record it was meant for, however the rows move as
 * it lands, and one Ctrl+Z takes the whole action back.
 */
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.setViewportSize({ width: 1800, height: 900 })
  await page.goto('/sv-grid/#/demos/512-base-sales-crm', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  // The first visit compiles the demo on the dev server: give it time.
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}

/** Every record on screen, by deal, as header -> cell text. */
async function records(page: Page): Promise<Record<string, Record<string, string>>> {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll('.sv-grid-column')].map((h) => (h.textContent ?? '').trim())
    const out: Record<string, Record<string, string>> = {}
    for (const tr of document.querySelectorAll('.sv-grid-table tbody tr')) {
      const cells = [...tr.querySelectorAll('.sv-grid-cell')].map((c) => (c.textContent ?? '').trim())
      const row = Object.fromEntries(heads.map((h, i) => [h, cells[i] ?? '']))
      if (row.Deal) out[row.Deal] = row
    }
    return out
  })
}

const row = (page: Page, deal: string) => page.locator('.sv-grid-table tbody tr', { hasText: deal }).first()
async function cell(page: Page, deal: string, header: string) {
  const at = await page.$$eval('.sv-grid-column', (els, h) => els.findIndex((el) => (el.textContent ?? '').trim().startsWith(h)), header)
  return row(page, deal).locator('.sv-grid-cell').nth(at)
}
/** A plain click selects the cell. The middle of it can hold a link or a chip: its corner does not. */
async function select(page: Page, deal: string, header: string) {
  const b = (await (await cell(page, deal, header)).boundingBox())!
  await page.mouse.click(b.x + b.width - 6, b.y + b.height - 4)
}
async function tick(page: Page, deal: string) {
  const b = (await row(page, deal).boundingBox())!
  // The box shows under the pointer: it is there to click once the pointer has arrived.
  await page.mouse.move(b.x + 22, b.y + b.height / 2)
  await expect.poll(async () => page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('input, label, button'), [b.x + 22, b.y + b.height / 2])).toBe(true)
  await page.mouse.click(b.x + 22, b.y + b.height / 2)
}

test('Edit fields writes every value on the ticked records, and one Ctrl+Z takes it all back', async ({ page }) => {
  await open(page)
  const was = await records(page)
  await tick(page, 'Fabrikam: Renewal')
  await tick(page, 'Tailspin Toys: Pilot')
  await page.getByRole('button', { name: 'Edit fields' }).click()
  const form = page.locator('.sv-form')
  await form.getByLabel('Value', { exact: true }).fill('abc')
  await page.getByRole('button', { name: /^Apply to/ }).click()
  await expect(form.locator('.sv-form__error').first()).toContainText('cannot hold this value')
  await form.getByLabel('Value', { exact: true }).fill('134500')
  await page.getByRole('button', { name: /^Apply to/ }).click()
  await expect(form).toBeHidden()
  // Both move down the sorted list, past records nobody ticked, and stay on screen.
  const now = await records(page)
  expect(now['Fabrikam: Renewal']!.Value).toBe('$134,500')
  expect(now['Tailspin Toys: Pilot']!.Value).toBe('$134,500')
  for (const deal of Object.keys(was)) {
    if (deal === 'Fabrikam: Renewal' || deal === 'Tailspin Toys: Pilot' || !now[deal]) continue
    expect(now[deal]!.Value, deal).toBe(was[deal]!.Value)
  }
  await page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ }).click()
  await expect.poll(async () => (await records(page))['Fabrikam: Renewal']?.Value).toBe(was['Fabrikam: Renewal']!.Value)
  expect((await records(page))['Tailspin Toys: Pilot']!.Value).toBe(was['Tailspin Toys: Pilot']!.Value)
})

test('Delete twice on a sorted field clears one record, and the row holds until the cursor moves', async ({ page }) => {
  await open(page)
  const was = await records(page)
  const [first, second, third] = Object.keys(was)
  await select(page, second!, 'Value')
  await page.keyboard.press('Delete')
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await records(page))[second!]?.Value).toBe('')
  const now = await records(page)
  expect(now[first!]!.Value).toBe(was[first!]!.Value)
  expect(now[third!]!.Value).toBe(was[third!]!.Value)
  expect(Object.keys(now).slice(0, 3)).toEqual([first, second, third])
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => Object.keys(await records(page)).indexOf(second!)).not.toBe(1)
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await records(page))[second!]?.Value).toBe(was[second!]!.Value)
})

test('a paste past the last row adds records, and an unknown link name keeps the link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
  const was = await records(page)
  const deal = Object.keys(was)[0]!
  await select(page, deal, 'Account')
  await page.evaluate(() => navigator.clipboard.writeText('No such account'))
  await page.keyboard.press('Control+v')
  await expect(page.locator('.sv-toast', { hasText: 'does not fit Account' })).toBeVisible()
  expect((await records(page))[deal]!.Account).toBe(was[deal]!.Account)
  await page.getByText('30 records').first().waitFor()
  await page.locator('.sv-grid-root').first().focus()
  await page.keyboard.press('Control+End')
  await page.evaluate(() => navigator.clipboard.writeText('Pasted one\nPasted two\nPasted three'))
  // Into Next step, a text field. Source next to it is a select, and a word it has no
  // option for leaves the cell as it is (and adds no empty record).
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Control+v')
  await expect(page.getByText('32 records').first()).toBeVisible()
  await page.keyboard.press('Control+z')
  await expect(page.getByText('30 records').first()).toBeVisible()
})
