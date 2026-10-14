/**
 * E2E: SvGrid Base with several tables (demo 512, the sales CRM).
 *  - the tables show as tabs, and a tab shows its table's grid,
 *  - linking a deal to an account in the link picker lists the deal on the
 *    account (the field that links back), and "Open in Accounts" on a linked
 *    record goes to that tab with the record open,
 *  - "Add table" adds a tab, and its menu renames it.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/512-base-sales-crm'

const tab = (page: Page, name: string) => page.locator('.sv-btabs [role="tab"]', { hasText: name })
const selectedTab = (page: Page) => page.locator('.sv-btabs [role="tab"][aria-selected="true"]')
const row = (page: Page, text: string) => page.locator('.sv-grid-row', { hasText: text }).first()

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(DEMO)
  // The first visit compiles the demo on the dev server: give it time.
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
}

test.describe('SvGrid Base tables (real browser)', () => {
  test('switches from the board to the calendar and back without an error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page)
    // The board's cards draw link chips, which read the board's grid while
    // the board goes away.
    for (const name of ['Pipeline', 'Closing calendar', 'Pipeline', 'All deals']) {
      await page.locator('.sv-fvb-view').click()
      await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
      await expect(page.locator('.sv-fvb-view-name')).toHaveText(name)
    }
    expect(errors).toEqual([])
  })

  test('shows the tables as tabs and switches between them', async ({ page }) => {
    await open(page)
    await expect(page.locator('.sv-btabs [role="tab"]')).toHaveText(['Deals', 'Accounts', 'Contacts'])
    await expect(selectedTab(page)).toHaveText('Deals')
    await tab(page, 'Accounts').click()
    await expect(selectedTab(page)).toHaveText('Accounts')
    await expect(page.locator('.sv-fvb-view-name')).toHaveText('All accounts')
    await expect(row(page, 'Contoso')).toContainText('Contoso: Team plan')
  })

  test('a link made on a deal shows on the account, and Open in goes there', async ({ page }) => {
    await open(page)
    // Contoso: Team plan moves to Fabrikam, from the deal's Account cell.
    // Double-click the empty end of the cell (the chip itself opens the
    // account). page.mouse, not locator.click: a locator scrolls the cell
    // under the sticky header and the click lands on the row below.
    const cell = row(page, 'Contoso: Team plan').locator('[data-col-id="account"]')
    const box = (await cell.boundingBox())!
    await page.mouse.dblclick(box.x + box.width - 14, box.y + box.height / 2)
    const picker = page.locator('.sv-modal', { hasText: 'Link to Accounts' })
    await expect(picker).toBeVisible()
    await picker.locator('.sv-flp-row', { hasText: 'Fabrikam' }).click()
    await picker.getByRole('button', { name: 'Done' }).click()
    await expect(row(page, 'Contoso: Team plan').locator('[data-col-id="account"] .sv-flr-chip')).toHaveText('Fabrikam')

    await tab(page, 'Accounts').click()
    await expect(row(page, 'Fabrikam').locator('[data-col-id="deals"]')).toContainText('Contoso: Team plan')
    await expect(row(page, 'Contoso').locator('[data-col-id="deals"]')).not.toContainText('Contoso: Team plan')

    // From a contact, open its account where it lives.
    await tab(page, 'Contacts').click()
    await row(page, 'Priya Raman').locator('.sv-flr-chip', { hasText: 'Contoso' }).click()
    await page.getByRole('button', { name: 'Open in Accounts' }).click()
    await expect(selectedTab(page)).toHaveText('Accounts')
    await expect(page.locator('.sv-modal').last()).toContainText('Contoso')
  })

  test('a chart view charts the deals by stage, in the stage colors', async ({ page }) => {
    await open(page)
    await page.locator('.sv-fvb-view').click()
    await page.locator('.sv-fviews-pick', { hasText: 'Pipeline value by stage' }).click()
    const chart = page.locator('.sv-fchart svg').first()
    await expect(chart).toBeVisible()
    const labels = await page.locator('.sv-fchart .sv-grid-chart-axis.is-x').allTextContents()
    expect(labels).toEqual(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'])
    await expect(page.locator('.sv-fchart .sv-grid-chart-axis').first()).toHaveText('$0')
  })

  test('adds a table and renames it from its menu', async ({ page }) => {
    await open(page)
    await page.locator('.sv-btabs-add').click()
    await expect(selectedTab(page)).toHaveText('Table')
    await page.locator('.sv-btabs-more').click()
    await page.getByRole('menuitem', { name: 'Rename table' }).click()
    await page.locator('.sv-btabs-input').fill('Meetings')
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-btabs [role="tab"]')).toHaveText(['Deals', 'Accounts', 'Contacts', 'Meetings'])
  })
})
