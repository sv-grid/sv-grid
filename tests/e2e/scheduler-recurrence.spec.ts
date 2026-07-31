/**
 * E2E: editing + adding recurrence patterns (demo 366, Week view).
 *
 * The drawer carries a recurrence editor (Repeat / Every / weekdays / Until).
 * Changing it re-expands the series; recurring events are also drag-editable.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/366-scheduler-recurring'

const instances = (page: Page, title: string) =>
  page.locator('.sv-sched-event', { hasText: title })
const drawer = (page: Page) => page.locator('.sv-sched-recur')

// The Repeat control is an SvDropDownList (a themed button + portalled panel),
// not a native <select>. Read its label from the trigger, pick from the panel.
const repeatValue = (page: Page) => page.locator('.sv-sched-recur-repeat .sv-ddl__value')
async function selectRepeat(page: Page, label: string) {
  await page.locator('.sv-sched-recur-repeat .sv-ddl').click()
  await page.locator('.sv-ddl__opt', { hasText: label }).first().click()
}
// Generic: pick an option from the SvDropDownList inside a labelled recur row.
async function selectRecur(page: Page, wrapperClass: string, label: string) {
  await page.locator(`.${wrapperClass} .sv-ddl`).click()
  await page.locator('.sv-ddl__opt', { hasText: label }).first().click()
}

async function openEvent(page: Page, title: string) {
  await instances(page, title).first().click()
  await expect(drawer(page)).toBeVisible()
}

test.describe('scheduler recurrence editing (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-sched-event').first().waitFor()
  })

  test('the drawer shows the current pattern of a recurring event', async ({ page }) => {
    await openEvent(page, 'Daily standup')
    await expect(repeatValue(page)).toHaveText('Weekly')
    // weekdays Mon-Fri active (5 chips lit).
    await expect(page.locator('.sv-sched-recur-day-on')).toHaveCount(5)
  })

  test('adding a weekday to the pattern adds an occurrence', async ({ page }) => {
    // Daily standup shows Mon-Fri = 5 in the week view.
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(5)
    await openEvent(page, 'Daily standup')
    // weekStartsOn=1 -> chip order Mon,Tue,Wed,Thu,Fri,Sat,Sun; index 5 = Saturday.
    await page.locator('.sv-sched-recur-day').nth(5).click()
    await page.locator('.sv-sched-recur-day-on') // ensure state applied
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(6)
  })

  test('adding a pattern to a one-off event makes it repeat', async ({ page }) => {
    // Quarterly planning is a single event.
    await expect.poll(() => instances(page, 'Quarterly planning').count()).toBe(1)
    await openEvent(page, 'Quarterly planning')
    await expect(repeatValue(page)).toHaveText('Does not repeat') // no pattern yet
    await selectRepeat(page, 'Daily')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Daily -> now appears every visible day (>1).
    await expect.poll(() => instances(page, 'Quarterly planning').count()).toBeGreaterThan(1)
  })

  test('ending after N occurrences limits the series (count)', async ({ page }) => {
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(5)
    await openEvent(page, 'Daily standup')
    await selectRecur(page, 'sv-sched-recur-end', 'After a number of times')
    const count = page.locator('.sv-sched-recur-count .sv-num__input')
    await count.fill('2')
    await count.blur()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Anchored at the series start (Monday); only the first 2 weekday occurrences
    // (Mon, Tue) survive in the visible week.
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(2)
  })

  test('a positional monthly pattern (weekday of month) round-trips', async ({ page }) => {
    await openEvent(page, 'Quarterly planning')
    await selectRepeat(page, 'Monthly')
    await selectRecur(page, 'sv-sched-recur-monthmode', 'On a weekday of the month')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Reopen from Month view: the single monthly occurrence is always in the
    // month grid. Filter to it via search so it never hides behind a "+N more"
    // overflow (viewport-dependent), then click its bar to reopen the drawer.
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await page.getByPlaceholder(/Search/).fill('Quarterly')
    await page.locator('.sv-sched-bar', { hasText: 'Quarterly planning' }).first().click()
    await expect(page.locator('.sv-sched-recur')).toBeVisible()
    await expect(repeatValue(page)).toHaveText('Monthly')
    await expect(page.locator('.sv-sched-recur-monthmode .sv-ddl__value')).toHaveText('On a weekday of the month')
  })

  test('removing the pattern collapses a series to a single event', async ({ page }) => {
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(5)
    await openEvent(page, 'Daily standup')
    await selectRepeat(page, 'Does not repeat')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(1)
  })

  test('the Table view shows the recurrence as a readable Repeat column', async ({ page }) => {
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    const row = (title: string) => page.getByRole('row').filter({ hasText: title })
    await expect(row('Daily standup')).toContainText('Weekly on weekdays')
    await expect(row('Sprint review')).toContainText('Every 2 weeks on Fri')
    await expect(row('Quarterly planning')).not.toContainText(/Weekly|Every|Monthly/) // a one-off
  })

  test('resizing a recurring event resizes the whole series (editable recurring)', async ({ page }) => {
    const first = () => instances(page, 'Daily standup').first()
    const heightOf = () => first().evaluate((el) => parseFloat((el as HTMLElement).style.height))
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(5)
    const before = await heightOf()
    const box = await first().boundingBox()
    if (!box) throw new Error('no event')
    // Grab the bottom grip and drag down to lengthen the series.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2 + (70 * i) / 6)
    await page.mouse.up()
    // Still 5 occurrences, and every one is now taller (same series duration).
    await expect.poll(() => instances(page, 'Daily standup').count()).toBe(5)
    await expect.poll(heightOf).toBeGreaterThan(before + 1)
  })
})
