/**
 * E2E: scheduler CRUD - add / update / delete events dynamically.
 *
 * Drives demo 363 (Week view, full CRUD wired to `rows`). Verifies that the
 * toolbar Add button, the drawer editor, and the drawer Delete button all flow
 * back to the underlying data (event count + title change in the DOM).
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/363-scheduler-intro'

const events = (page: Page) => page.locator('.sv-sched-event')

test.describe('scheduler CRUD (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await events(page).first().waitFor()
  })

  test('Add event button appends a new event', async ({ page }) => {
    const before = await events(page).count()
    await page.getByRole('button', { name: '+ Add event' }).click()
    await expect.poll(() => events(page).count()).toBe(before + 1)
    await expect(events(page).filter({ hasText: 'New event' }).first()).toBeVisible()
  })

  test('clicking an event opens a drawer that can update the title', async ({ page }) => {
    await events(page).filter({ hasText: 'Sprint planning' }).first().click()
    const drawer = page.locator('.sv-drawer, [role="dialog"]').first()
    await expect(drawer).toBeVisible()
    // The Title field is the first SvForm control (the leading When editor uses
    // Sv date pickers / checkbox, which live outside the .sv-form).
    const title = drawer.locator('.sv-form input.sv-form__control').first()
    await title.fill('Sprint planning EDITED')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(events(page).filter({ hasText: 'Sprint planning EDITED' }).first()).toBeVisible()
  })

  test('clicking outside the drawer saves the current edits', async ({ page }) => {
    await events(page).filter({ hasText: 'Sprint planning' }).first().click()
    const drawer = page.locator('.sv-drawer').first()
    await expect(drawer).toBeVisible()
    await drawer.locator('.sv-form input.sv-form__control').first().fill('Saved by outside click')
    await page.mouse.click(200, 400) // click the backdrop, left of the panel
    await expect(drawer).toBeHidden()
    await expect(events(page).filter({ hasText: 'Saved by outside click' }).first()).toBeVisible()
  })

  test('the Cancel button discards the edits', async ({ page }) => {
    await events(page).filter({ hasText: 'Sprint planning' }).first().click()
    const drawer = page.locator('.sv-drawer').first()
    await expect(drawer).toBeVisible()
    await drawer.locator('.sv-form input.sv-form__control').first().fill('Should not persist')
    await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(events(page).filter({ hasText: 'Should not persist' })).toHaveCount(0)
    await expect(events(page).filter({ hasText: 'Sprint planning' }).first()).toBeVisible()
  })

  test('the drawer Delete button removes the event', async ({ page }) => {
    const before = await events(page).count()
    await events(page).filter({ hasText: 'Sprint planning' }).first().click()
    const drawer = page.locator('.sv-drawer, [role="dialog"]').first()
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Delete event' }).click()
    await expect.poll(() => events(page).count()).toBe(before - 1)
    await expect(events(page).filter({ hasText: 'Sprint planning' })).toHaveCount(0)
  })

  test('every scheduler demo offers a Calendar / Table toggle', async ({ page }) => {
    for (const id of [
      '363-scheduler-intro',
      '364-scheduler-timegrid',
      '365-scheduler-resources',
      '366-scheduler-recurring',
      '367-scheduler-agenda',
      '368-scheduler-unified-views',
      '369-scheduler-content-calendar',
      '370-scheduler-shift-roster',
    ]) {
      await page.goto(`/sv-grid/#/demos/${id}`)
      await expect(page.getByRole('button', { name: 'Table', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Table', exact: true }).click()
      // Table view renders the grid header row instead of the calendar.
      await expect(page.locator('.sv-sched')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible()
    }
  })

  test('the unified demo switches between Table, Calendar and Kanban', async ({ page }) => {
    await page.goto('/sv-grid/#/demos/368-scheduler-unified-views')
    // Calendar is the default view.
    await expect(page.locator('.sv-sched')).toHaveCount(1)
    // Kanban -> a board with lanes, no calendar.
    await page.getByRole('button', { name: 'Kanban', exact: true }).click()
    await expect(page.locator('.sv-board')).toHaveCount(1)
    await expect(page.locator('.sv-sched')).toHaveCount(0)
    // Table -> neither board nor calendar.
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(page.locator('.sv-board')).toHaveCount(0)
    await expect(page.locator('.sv-sched')).toHaveCount(0)
    // Back to Calendar.
    await page.getByRole('button', { name: 'Calendar', exact: true }).click()
    await expect(page.locator('.sv-sched')).toHaveCount(1)
  })
})
