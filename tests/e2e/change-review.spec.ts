import { expect, test, type Page } from '@playwright/test'

/**
 * Change review (`@svgrid/enterprise/review`) on demo 702, in a real browser.
 *
 * The DOM suites in enterprise cover the model and the panel in jsdom. What
 * this adds: the proposal drawn inside a laid-out cell, an accept written to
 * the grid the page shows, Ctrl+Z from the grid's own keyboard handling, and
 * a cell edited through the real editor making its proposal stale.
 */

const DEMO = '/sv-grid/#/demos/702-change-review'

async function setup(page: Page) {
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Run cleanup agent' }).click()
  await expect(page.locator('.sv-review-ghost').first()).toBeVisible()
}

const group = (page: Page, label: string | RegExp) =>
  page.locator('.sv-review-group').filter({ has: page.locator('.sv-review-label', { hasText: label }) })
const live = (page: Page) => page.locator('.sv-review-live')
const companyCell = (page: Page, row: number) => page.locator(`td[data-svgrid-row="${row}"][data-col-id="company"]`)

test.describe('change review', () => {
  test('the agent proposes; nothing is written until a group is accepted', async ({ page }) => {
    await setup(page)
    await expect(page.locator('.sv-review-count')).toContainText('pending in')
    // Row 0 is "Acme Corp  ": the cell shows it struck through, with the trim beside it.
    await expect(companyCell(page, 0).locator('.sv-review-ghost-before')).toBeVisible()
    await expect(companyCell(page, 0).locator('.sv-review-ghost-after')).toHaveText('Acme Corp')

    await group(page, 'Trim spaces in Company').getByRole('button', { name: /^Accept/ }).click()
    await expect(live(page)).toContainText('accepted')
    await expect(companyCell(page, 0).locator('.sv-review-ghost')).toHaveCount(0)
    await expect(companyCell(page, 0)).toHaveText(/^\s*•?\s*Acme Corp\s*$/)
  })

  test('one Ctrl+Z in the grid undoes the accept and the proposals come back', async ({ page }) => {
    await setup(page)
    const trim = group(page, 'Trim spaces in Company')
    await trim.getByRole('button', { name: /^Accept/ }).click()
    await expect(trim).toHaveCount(0)
    await page.locator('td[data-svgrid-row="1"][data-col-id="region"]').click()
    await page.keyboard.press('Control+z')
    await expect(trim).toHaveCount(1)
    await expect(companyCell(page, 0).locator('.sv-review-ghost-after')).toHaveText('Acme Corp')
  })

  test('a cell edited before accepting keeps the edit; its proposal goes stale', async ({ page }) => {
    await setup(page)
    const cell = companyCell(page, 0)
    await cell.dblclick()
    const editor = page.locator('.sv-grid-root input:focus, .sv-grid-root textarea:focus').first()
    await editor.fill('Acme Corporation')
    await page.keyboard.press('Enter')
    await group(page, 'Trim spaces in Company').getByRole('button', { name: /^Accept/ }).click()
    await expect(live(page)).toContainText('not written: the cell changed')
    await expect(cell).toContainText('Acme Corporation')
  })

  test('an import that disagrees with the agent is a conflict to resolve', async ({ page }) => {
    await setup(page)
    await page.getByRole('button', { name: 'Import crm-update.csv' }).click()
    const conflicts = page.locator('.sv-review-conflicts')
    await expect(conflicts).toContainText('Two sources disagree')
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeDisabled()
    const keeps = conflicts.locator('.sv-review-keep')
    const before = await keeps.count()
    expect(before).toBe(4) // two cells, two sources each
    await keeps.first().click()
    await expect(keeps).toHaveCount(2)
  })
})
