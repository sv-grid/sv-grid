/**
 * E2E: all-day row + all-day editing (demo 363, Week view).
 *  - multi-day/all-day events live in the all-day row as spanning bars,
 *  - the drawer has an all-day toggle + datetime (date + time) start/end inputs,
 *  - events can be dragged between the all-day row and the hourly grid.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/363-scheduler-intro'

const hourly = (page: Page, title: string) => page.locator('.sv-sched-event', { hasText: title })
const allDayBar = (page: Page, title: string) => page.locator('.sv-sched-allday-bars .sv-sched-bar', { hasText: title })

async function toWeek(page: Page) {
  await page.goto(DEMO)
  await page.locator('.sv-sched').first().waitFor()
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await page.waitForTimeout(200)
}

async function drag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(fromX + ((toX - fromX) * i) / 8, fromY + ((toY - fromY) * i) / 8)
  await page.mouse.up()
}

test.describe('scheduler all-day (real browser)', () => {
  test('the drawer edits start/end with time and toggles all-day', async ({ page }) => {
    await toWeek(page)
    await hourly(page, 'Sprint planning').first().click()
    // Start is an SvDateTimePicker (a themed text input formatting date + time).
    const start = page.locator('.sv-sched-when-input .sv-dtp__input').first()
    expect(await start.inputValue()).toMatch(/\d\d:\d\d$/) // includes a time
    await expect(page.locator('.sv-sched-when-check')).toBeVisible() // All-day toggle
  })

  test('dragging a timed event into the all-day row makes it all-day', async ({ page }) => {
    await toWeek(page)
    const ev = hourly(page, 'Sprint planning').first()
    const box = (await ev.boundingBox())!
    const row = (await page.locator('.sv-sched-allday').boundingBox())!
    // drag the event body up into the all-day row (same Monday column x).
    await drag(page, box.x + box.width / 2, box.y + box.height / 2, box.x + box.width / 2, row.y + row.height / 2)
    await expect(allDayBar(page, 'Sprint planning')).toHaveCount(1)
    await expect(hourly(page, 'Sprint planning')).toHaveCount(0)
  })

  test('the all-day row is always visible (even with no all-day events)', async ({ page }) => {
    // The clinic (Day view) has no all-day events; the row must still be there as a drop target.
    await page.goto('/sv-grid/#/demos/382-scheduler-app-clinic')
    await page.locator('.sv-sched').first().waitFor()
    await expect(page.locator('.sv-sched-allday')).toHaveCount(1)
  })

  test('dragging an all-day bar shows a ghost + timed drop preview', async ({ page }) => {
    await toWeek(page)
    const box = (await allDayBar(page, 'Team offsite').boundingBox())!
    const body = (await page.locator('.sv-sched-gridbody').boundingBox())!
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 20, box.y + box.height / 2 + ((body.y + 180 - box.y) * i) / 8)
    // Mid-drag feedback: cursor ghost, a timed preview block, dimmed source.
    await expect(page.locator('.sv-sched-month-ghost')).toBeVisible()
    await expect(page.locator('.sv-sched-drag-preview')).toHaveCount(1)
    await expect(page.locator('.sv-sched-bar-source')).toHaveCount(1)
    await page.mouse.up()
    await expect(page.locator('.sv-sched-month-ghost')).toHaveCount(0)
  })

  test('dragging an all-day bar into the hourly grid makes it timed', async ({ page }) => {
    await toWeek(page)
    const bar = allDayBar(page, 'Team offsite')
    await expect(bar).toHaveCount(1)
    const box = (await bar.boundingBox())!
    const body = (await page.locator('.sv-sched-gridbody').boundingBox())!
    // drag the bar down into the hourly grid.
    await drag(page, box.x + 20, box.y + box.height / 2, box.x + 20, body.y + 160)
    await expect(hourly(page, 'Team offsite')).toHaveCount(1)
    await expect(allDayBar(page, 'Team offsite')).toHaveCount(0)
  })

  test('dragging an all-day bar right edge extends it by whole days (wider bar)', async ({ page }) => {
    await toWeek(page)
    const bar = allDayBar(page, 'Team offsite')
    await expect(bar).toHaveCount(1)
    const before = (await bar.boundingBox())!
    // One day column ~= the 7-day grid width / 7.
    const grid = (await page.locator('.sv-sched-gridbody').boundingBox())!
    const dayW = grid.width / 7
    // Grab the right edge grip and drag it two columns to the right.
    await drag(page, before.x + before.width - 3, before.y + before.height / 2, before.x + before.width - 3 + dayW * 2, before.y + before.height / 2)
    // Still one all-day bar, now visibly wider (spans more day columns).
    await expect(allDayBar(page, 'Team offsite')).toHaveCount(1)
    await expect.poll(async () => (await allDayBar(page, 'Team offsite').boundingBox())!.width).toBeGreaterThan(before.width + dayW / 2)
  })
})
