/**
 * E2E: scheduler resources work in every time-grid view (demo 365).
 *
 * Resources group the Week / Day columns into resource x day, add a spanning
 * group-header row, and a legend/filter that hides a resource in any view.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/365-scheduler-resources'
const ROOMS = 4 // Aurora, Borealis, Cosmos, Delta

const cols = (page: Page) => page.locator('.sv-sched-col[data-col-key]')
const groups = (page: Page) => page.locator('.sv-sched-groupcell')
const chips = (page: Page) => page.locator('.sv-sched-reschip')

test.describe('scheduler resources (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-sched').first().waitFor()
  })

  test('Day view splits into one column per resource with a group header each', async ({ page }) => {
    // initialView is Day -> resources x 1 day.
    await expect.poll(() => cols(page).count()).toBe(ROOMS)
    await expect.poll(() => groups(page).count()).toBe(ROOMS)
    await expect(chips(page)).toHaveCount(ROOMS)
  })

  test('Week view groups every resource across all 7 days (resource x day columns)', async ({ page }) => {
    await page.getByRole('button', { name: 'Week', exact: true }).click()
    await expect.poll(() => groups(page).count()).toBe(ROOMS) // one group header per resource
    await expect.poll(() => cols(page).count()).toBe(ROOMS * 7) // resource x day
    // The group header shows the resource label.
    await expect(page.locator('.sv-sched-groupcell', { hasText: 'Aurora' }).first()).toBeVisible()
  })

  test('the resource legend filters events in the current view', async ({ page }) => {
    const before = await page.locator('.sv-sched-event').count()
    expect(before).toBeGreaterThan(0)
    // Hide "Aurora": its chip goes off and its events disappear.
    const aurora = chips(page).filter({ hasText: 'Aurora' }).first()
    await aurora.click()
    await expect(aurora).toHaveClass(/sv-sched-reschip-off/)
    await expect.poll(() => page.locator('.sv-sched-event').count()).toBeLessThan(before)
    // Re-enabling restores them.
    await aurora.click()
    await expect.poll(() => page.locator('.sv-sched-event').count()).toBe(before)
  })
})
