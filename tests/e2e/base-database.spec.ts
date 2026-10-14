/**
 * E2E: SvGrid Base on a database.
 *  - demo 516 (Postgres in the page): a status change runs an UPDATE of that
 *    one column, an automation's change is written the same way, and a write
 *    the database refuses puts the cell back and says why in the tab bar;
 *  - demo 517 (Supabase, two windows): a change in one window shows in the
 *    other through realtime.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page, id: string, ready: string) {
  await page.setViewportSize({ width: 1500, height: 1000 })
  await page.goto(`/sv-grid/#/demos/${id}`)
  // The first visit compiles the demo on the dev server, and PGlite loads its WASM.
  await page.locator(ready).first().waitFor({ timeout: 90_000 })
  // The evaluation notice sits over the bottom right corner.
  await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
}

async function setStatus(scope: Locator | Page, page: Page, task: string, status: string) {
  await scope.locator('.sv-grid-row', { hasText: task }).first().locator('[role="gridcell"]').nth(1).dblclick()
  await page.locator('[role="option"]', { hasText: status }).first().click()
}

const statusOf = (scope: Locator | Page, task: string) => scope.locator('.sv-grid-row', { hasText: task }).first().locator('[role="gridcell"]').nth(1)

test.describe('SvGrid Base on a database (real browser)', () => {
  test('writes a change as SQL and puts back a write the database refuses', async ({ page }) => {
    await open(page, '516-base-postgres', '.pgbase .sv-grid-row')
    await setStatus(page, page, 'Launch email', 'In progress')
    await expect(page.locator('.pgbase-log li[data-who="base"]').first()).toContainText('UPDATE "tasks" SET "status" = $1 WHERE "id" = $2')
    await expect(page.locator('.pgbase-log li[data-who="base"]').first()).toContainText("'In progress', 't3'")
    await expect(page.locator('.sv-btabs-status')).toHaveText('All changes saved')

    // An automation's change is written like an edit: Done ticks the box.
    await setStatus(page, page, 'Launch email', 'Done')
    await expect(page.locator('.pgbase-log li[data-who="base"]').first()).toContainText('UPDATE "tasks" SET "done" = $1 WHERE "id" = $2')
    // The server automation for Done hears the write and emails the lead.
    await expect(page.locator('.pgbase-sent')).toContainText('Launch email is done')

    await page.fill('#pgbase-sql', "alter table tasks add constraint not_blocked check (status <> 'Blocked') not valid")
    await page.locator('.pgbase-run button').click()
    await expect(page.locator('.pgbase-result')).toHaveText('Done')
    await setStatus(page, page, 'Card retries', 'Blocked')
    await expect(page.locator('.sv-btabs-status')).toContainText('not_blocked')
    await expect(statusOf(page, 'Card retries')).toHaveText('Todo')
  })

  test('shows a change made in one window in the other', async ({ page }) => {
    await open(page, '517-base-supabase', '.sbase-win .sv-grid-row')
    const ana = page.locator('.sbase-win').nth(0)
    const ben = page.locator('.sbase-win').nth(1)
    await expect(ben.locator('.sv-grid-row').first()).toBeVisible()
    await setStatus(ana, page, 'CMS migration', 'Blocked')
    await expect(statusOf(ben, 'CMS migration')).toHaveText('Blocked', { timeout: 10_000 })
    await expect(ana.locator('.sbase-req code', { hasText: 'PATCH /rest/v1/tasks?id=eq.t3' })).toBeVisible()
  })
})

test.describe('SvGrid Base from a database (real browser)', () => {
  test('makes an app from plain SQL tables in one call', async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1100 })
    await page.goto('/sv-grid/#/demos/519-base-from-database')
    await page.locator('.dbapp-make').waitFor({ timeout: 90_000 })
    await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
    await page.locator('.dbapp-pick button', { hasText: 'Shop' }).click()
    await page.locator('.dbapp-make').click()
    await expect(page.locator('.sv-btabs [role="tab"]')).toHaveText(['Orders', 'Customers', 'Products'], { timeout: 30_000 })
    await expect(page.locator('.dbapp-took')).toContainText('Read 3 tables')
    // Status repeats a few values: a select. The customer foreign key: a link.
    await expect(page.locator('.dbapp-app .sv-grid-row', { hasText: 'A-1001' }).first()).toContainText('Maria Anders')
    await page.locator('.sv-fvb-view').click()
    await expect(page.locator('.sv-pop__panel')).toContainText('By status')
  })
})
