/**
 * E2E: the base's "All tables" menu gives every item its own room (demo 512, the sales CRM).
 *  - with jszip missing, the Excel item that says why it is off does not run into "Download as SQL",
 *  - a list of tables longer than the menu scrolls, and no item or line is squeezed.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/512-base-sales-crm'

async function open(page: Page, zip: boolean) {
  // The base without jszip: its dynamic import of it fails, as in an app that never installed it.
  // The site itself imports jszip, so the module stays; only the base's import of it is cut.
  if (!zip) {
    await page.route(/base-export\.ts/, async (route) => {
      const res = await route.fetch()
      const body = (await res.text()).replace(/import\(\s*["'][^"']*jszip[^"']*["']\s*\)/g, 'Promise.reject(new Error("no jszip"))')
      await route.fulfill({ response: res, body })
    })
  }
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(DEMO)
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}

/** Add tables until the All tables menu is taller than the room it has, and open it. */
async function overflowing(page: Page, more = 0) {
  const menu = page.locator('.sv-btabs-menu').last()
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: 'All tables' }).click()
    await menu.waitFor()
    const over = await menu.evaluate((el) => el.scrollHeight > el.clientHeight)
    if (over && more-- <= 0) return menu
    await page.keyboard.press('Escape')
    const before = await page.getByRole('tab').count()
    await page.locator('.sv-btabs-add').click()
    await expect.poll(() => page.getByRole('tab').count()).toBeGreaterThan(before)
    await page.keyboard.press('Escape')
  }
  throw new Error('the menu never grew past its room')
}

/** Each item and line of the open menu: its box, and the height its content needs. */
const rooms = (page: Page) =>
  page.locator('.sv-btabs-menu').last().locator(':scope > [role^="menuitem"], :scope > [role="separator"]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { text: (el.textContent ?? '').trim().slice(0, 40), top: r.top, bottom: r.bottom, height: r.height, needs: el.scrollHeight, line: el.getAttribute('role') === 'separator' }
    }),
  )

/** What has too little room, once the menu has finished opening (it scales in). */
async function cramped(page: Page): Promise<string[]> {
  const items = await rooms(page)
  const out: string[] = []
  for (const it of items) {
    if (it.line && it.height < 0.5) out.push('a line between items is gone')
    if (!it.line && it.height < 31.5) out.push(`"${it.text}" is squeezed to ${it.height}px`)
    if (!it.line && it.height + 0.5 < it.needs) out.push(`"${it.text}" needs ${it.needs}px and has ${it.height}px`)
  }
  for (let i = 1; i < items.length; i++) if (items[i]!.top + 0.5 < items[i - 1]!.bottom) out.push(`"${items[i]!.text}" overlaps "${items[i - 1]!.text}"`)
  return out
}
const expectRoom = (page: Page) => expect.poll(() => cramped(page), { timeout: 5000 }).toEqual([])

test.describe('SvGrid Base: the All tables menu (real browser)', () => {
  test('the Excel item that says why it is off keeps its own room in a menu that scrolls', async ({ page }) => {
    await open(page, false)
    await overflowing(page)
    const why = page.getByRole('menuitem', { name: /cannot write Excel files yet/ })
    await expect(why).toBeAttached()
    await expectRoom(page)
    const sql = page.getByRole('menuitem', { name: 'Download as SQL' })
    const [w, q] = [await why.boundingBox(), await sql.boundingBox()]
    expect(q!.y + 0.5, 'Download as SQL starts inside the Excel item').toBeGreaterThanOrEqual(w!.y + w!.height)
  })

  test('a list of tables much longer than the menu, with Excel on, squeezes nothing', async ({ page }) => {
    await open(page, true)
    await overflowing(page, 4)
    await expect(page.getByRole('menuitem', { name: 'Download this view as Excel' })).toBeAttached()
    await expectRoom(page)
  })
})
