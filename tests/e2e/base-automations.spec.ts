/**
 * E2E: automations in SvGrid Base (demo 504, the project tracker).
 *  - pressing Start in the Kick off column moves the task to In progress;
 *  - setting a task to Done ticks Done and sets Progress to 100%;
 *  - the Automations dialog lists both runs.
 */
import { expect, test, type Page } from '@playwright/test'

const row = (page: Page, task: string) => page.locator('.sv-grid-row', { hasText: task }).first()

test.describe('SvGrid Base automations (real browser)', () => {
  test('a button and a status change run their automations, listed under Runs', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 })
    await page.goto('/sv-grid/#/demos/504-project-tracker')
    await page.locator('.sv-grid-row').first().waitFor({ timeout: 90_000 })
    await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
    await expect(page.locator('.sv-fvb button', { hasText: 'automations' })).toHaveText('5 automations')

    await row(page, 'Docs page').locator('.sv-fbt').click()
    await expect(row(page, 'Docs page')).toContainText('In progress')

    // Status is the third cell: Task, No, Status.
    await row(page, 'Lightbox preview').locator('[role="gridcell"]').nth(2).dblclick()
    await page.locator('[role="option"]', { hasText: 'Done' }).first().click()
    await expect(row(page, 'Lightbox preview')).toContainText('100%')

    await page.locator('.sv-fvb button', { hasText: 'automations' }).click()
    await page.locator('.sv-bauto-runs-btn').click()
    const runs = page.locator('.sv-bauto-run')
    await expect(runs).toHaveCount(2)
    await expect(runs.first()).toContainText('Done closes the task')
    await expect(runs.first()).toContainText('Done: checked, Progress: 100%')
    await expect(runs.nth(1)).toContainText('Start a task')
  })
})
