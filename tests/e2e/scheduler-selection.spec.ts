/**
 * E2E: cell + event selection (demo 372).
 *  - rangeSelectable: drag empty slots to create (across days = a rectangle),
 *  - eventSelectable: Ctrl-click multi-select, drag to move together, Delete.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/372-scheduler-selection'
const events = (page: Page) => page.locator('.sv-sched-event')

test.describe('scheduler selection (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await events(page).first().waitFor()
  })

  test('the current-time indicator shows on today', async ({ page }) => {
    // 372 uses a full-day band, so "now" always falls inside it -> one now-line
    // (in today's column) plus a time label in the gutter.
    await expect(page.locator('.sv-sched-nowline')).toHaveCount(1)
    await expect(page.locator('.sv-sched-now-label')).toHaveCount(1)
  })

  test('the drawer offers recurrence even without a recurrenceField', async ({ page }) => {
    // Demo 372 has a drawer but no `recurrenceField` - the recurrence editor
    // must still appear, and choosing a pattern makes the event recur.
    await events(page).filter({ hasText: 'Standup' }).first().click()
    await expect(page.locator('.sv-sched-recur')).toBeVisible()
    const before = await events(page).filter({ hasText: 'Standup' }).count()
    await page.locator('.sv-sched-recur-repeat .sv-ddl').click()
    await page.locator('.sv-ddl__opt', { hasText: 'Daily' }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => events(page).filter({ hasText: 'Standup' }).count()).toBeGreaterThan(before)
  })

  test('double-clicking an empty slot creates an event', async ({ page }) => {
    const before = await events(page).count()
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const c5 = (await page.locator('.sv-sched-col').nth(5).boundingBox())! // Sat (empty)
    await page.mouse.dblclick(c5.x + c5.width / 2, vp.y + 90)
    await expect.poll(() => events(page).count()).toBe(before + 1)
    // Double-click creates directly - no pending selection left behind.
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(0)
  })

  test('right-clicking an event shows Edit and Delete', async ({ page }) => {
    const ev = events(page).filter({ hasText: 'Standup' }).first()
    const box = (await ev.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    const items = page.locator('.sv-menu__item')
    await expect(items.filter({ hasText: 'Edit' })).toBeVisible()
    await expect(items.filter({ hasText: 'Delete' })).toBeVisible()
    // Delete removes the event.
    const before = await events(page).count()
    await items.filter({ hasText: 'Delete' }).click()
    await expect.poll(() => events(page).count()).toBe(before - 1)
    // Edit on another event opens the drawer.
    const ev2 = events(page).filter({ hasText: 'Review' }).first()
    const b2 = (await ev2.boundingBox())!
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2)
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    await items.filter({ hasText: 'Edit' }).click()
    await expect(page.locator('.sv-drawer')).toBeVisible()
  })

  test('dragging empty slots marks a range; Enter creates the event', async ({ page }) => {
    const before = await events(page).count()
    // Use the visible scroll viewport for Y (the grid body is taller than it).
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const col = (await page.locator('.sv-sched-col').first().boundingBox())!
    const x = col.x + col.width / 2
    await page.mouse.move(x, vp.y + 40)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, vp.y + 40 + (100 * i) / 6)
    await page.mouse.up()
    // The drag only marks the range - nothing created yet.
    await expect(page.locator('.sv-sched-select-mirror')).toBeVisible()
    await expect(events(page)).toHaveCount(before)
    // Enter confirms -> one event.
    await page.keyboard.press('Enter')
    await expect.poll(() => events(page).count()).toBe(before + 1)
  })

  test('Escape cancels a pending range without creating anything', async ({ page }) => {
    const before = await events(page).count()
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const col = (await page.locator('.sv-sched-col').first().boundingBox())!
    const x = col.x + col.width / 2
    await page.mouse.move(x, vp.y + 40)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, vp.y + 40 + (100 * i) / 6)
    await page.mouse.up()
    await expect(page.locator('.sv-sched-select-mirror')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(0)
    await expect(events(page)).toHaveCount(before)
  })

  test('right-click -> Add Event creates from a pending range', async ({ page }) => {
    const before = await events(page).count()
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const col = (await page.locator('.sv-sched-col').first().boundingBox())!
    const x = col.x + col.width / 2
    await page.mouse.move(x, vp.y + 40)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, vp.y + 40 + (100 * i) / 6)
    await page.mouse.up()
    await expect(events(page)).toHaveCount(before)
    // Right-click the marked range, then choose "Add Event".
    await page.mouse.click(x, vp.y + 70, { button: 'right' })
    await page.getByRole('menuitem', { name: 'Add Event' }).click()
    await expect.poll(() => events(page).count()).toBe(before + 1)
  })

  test('a drag across days is a continuous range -> one multi-day event', async ({ page }) => {
    const before = await events(page).count()
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const cols = await page.locator('.sv-sched-col').all()
    const c0 = (await cols[0]!.boundingBox())!
    const c2 = (await cols[2]!.boundingBox())!
    await page.mouse.move(c0.x + c0.width / 2, vp.y + 90)
    await page.mouse.down()
    await page.mouse.move(c0.x + c0.width, vp.y + 120)
    await page.mouse.move(c2.x + c2.width / 2, vp.y + 200)
    await page.mouse.up()
    // The range renders as a CONTINUOUS span (start day partial, middle full, end
    // day partial) - more than one mirror segment, but ONE pending range.
    expect((await page.locator('.sv-sched-select-mirror').count())).toBeGreaterThan(1)
    await expect(events(page)).toHaveCount(before)
    await page.keyboard.press('Enter')
    // ONE continuous event spanning the days - a multi-day event renders as a
    // single spanning bar in the all-day row (not one chip per day).
    await expect(page.locator('.sv-sched-allday-bars .sv-sched-bar').filter({ hasText: 'New' })).toHaveCount(1)
  })

  test('clicking a cell then keyboard-navigating + Shift-extending selects a range', async ({ page }) => {
    const _hw = (await page.locator('.sv-sched-headwrap').boundingBox())!; const vp = { y: _hw.y + _hw.height }
    const c4 = (await page.locator('.sv-sched-col').nth(4).boundingBox())! // Fri (empty)
    const mirror = page.locator('.sv-sched-select-mirror')
    const h = () => mirror.first().evaluate((el) => parseFloat((el as HTMLElement).style.height))
    // A click (well within the scroll viewport, on empty Fri) selects a single cell.
    await page.mouse.click(c4.x + c4.width / 2, vp.y + 70)
    await expect(mirror).toHaveCount(1)
    const single = await h()
    // Arrows move it (still a single cell).
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await expect(mirror).toHaveCount(1)
    // Shift + ArrowDown extends the range (taller).
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.up('Shift')
    expect(await h()).toBeGreaterThan(single)
    // Shift + ArrowLeft extends across a day -> a continuous two-segment range.
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.up('Shift')
    await expect(mirror).toHaveCount(2)
    // Escape clears it.
    await page.keyboard.press('Escape')
    await expect(mirror).toHaveCount(0)
  })

  test('dragging the all-day row marks a range; Enter creates all-day events', async ({ page }) => {
    const cells = await page.locator('.sv-sched-allday-colbg').all()
    const allday = (await page.locator('.sv-sched-allday').boundingBox())!
    const c1 = (await cells[1]!.boundingBox())!
    const c3 = (await cells[3]!.boundingBox())!
    const y = allday.y + allday.height / 2
    await page.mouse.move(c1.x + c1.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(c1.x + c1.width, y)
    await page.mouse.move(c3.x + c3.width / 2, y)
    await page.mouse.up()
    // 3 covered all-day cells highlight; nothing created until Enter.
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(3)
    await page.keyboard.press('Enter')
    // ONE continuous all-day event spanning the 3 days (one spanning bar).
    await expect(page.locator('.sv-sched-allday-bars .sv-sched-bar').filter({ hasText: 'New' })).toHaveCount(1)
  })

  test('clicking a single all-day cell then Enter creates one all-day event', async ({ page }) => {
    const bars = () => page.locator('.sv-sched-allday-bars .sv-sched-bar')
    const before = await bars().count()
    const ad = page.locator('.sv-sched-allday-colbg').nth(3)
    const box = (await ad.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect.poll(() => bars().count()).toBe(before + 1)
  })

  test('all-day create works via the onEventAdd fallback (demo 363, no onRangeSelect)', async ({ page }) => {
    await page.goto('/sv-grid/#/demos/363-scheduler-intro')
    await page.locator('.sv-sched').first().waitFor()
    const bars = () => page.locator('.sv-sched-allday-bars .sv-sched-bar')
    const before = await bars().count()
    const ad = page.locator('.sv-sched-allday-colbg').nth(6) // empty Sunday, past the offsite span
    const box = (await ad.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(1)
    await page.keyboard.press('Enter')
    // The new event lands in the all-day row (all-day), not the timed grid.
    await expect.poll(() => bars().count()).toBe(before + 1)
  })

  test('Ctrl-click multi-selects events and Delete removes them', async ({ page }) => {
    const before = await events(page).count()
    const evs = await events(page).all()
    await evs[0]!.click({ modifiers: ['Control'] })
    await evs[1]!.click({ modifiers: ['Control'] })
    await expect(page.locator('footer')).toContainText('2 selected')
    await expect(page.locator('.sv-sched-event-selected')).toHaveCount(2)
    await page.keyboard.press('Delete')
    await expect.poll(() => events(page).count()).toBe(before - 2)
  })

  test('dragging one selected event moves the whole selection together', async ({ page }) => {
    // Select two events, then drag one down; both should shift later in time.
    const evs = await events(page).all()
    await evs[0]!.click({ modifiers: ['Control'] })
    await evs[1]!.click({ modifiers: ['Control'] })
    const tops = async () =>
      Promise.all((await events(page).all()).slice(0, 2).map((e) => e.evaluate((el) => parseFloat((el as HTMLElement).style.top))))
    const before = await tops()
    const box = (await events(page).first().boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + (80 * i) / 6)
    await page.mouse.up()
    await page.waitForTimeout(150)
    const after = await tops()
    // both moved down (top% increased)
    expect(after[0]!).toBeGreaterThan(before[0]!)
    expect(after[1]!).toBeGreaterThan(before[1]!)
  })

  test('keyboard crosses between the all-day row and the timed grid', async ({ page }) => {
    // Click an empty all-day cell -> a whole-day selection (no timed mirror).
    const ad = page.locator('.sv-sched-allday-colbg').nth(2)
    const box = (await ad.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(1)
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(0)
    // ArrowDown crosses into the timed grid (a time-band mirror, no all-day cell).
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(1)
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(0)
    // ArrowUp from the top timed cell crosses back to the all-day row.
    await page.keyboard.press('ArrowUp')
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(1)
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(0)
  })

  test('Month: clicking a day marks it, Shift+arrows extend, Enter creates', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 950 }) // fit all 6 week rows
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await page.locator('.sv-sched-month').waitFor()
    await page.waitForTimeout(300)
    const before = await page.locator('.sv-sched-bar').count()
    // An empty later-month day cell (events sit only in the current week).
    const cell = page.locator('.sv-sched-daycell').nth(22)
    const box = (await cell.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7)
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(1)
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.up('Shift')
    await expect(page.locator('.sv-sched-select-cell')).toHaveCount(3)
    await page.keyboard.press('Enter')
    await expect.poll(() => page.locator('.sv-sched-bar').count()).toBe(before + 1)
  })

  test('Month: Ctrl-click bars multi-selects', async ({ page }) => {
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await page.locator('.sv-sched-month').waitFor()
    await page.waitForTimeout(300)
    const bars = await page.locator('.sv-sched-bar').all()
    await bars[0]!.click({ modifiers: ['Control'] })
    await bars[1]!.click({ modifiers: ['Control'] })
    await expect(page.locator('.sv-sched-bar-selected')).toHaveCount(2)
    await expect(page.locator('footer')).toContainText('2 selected')
  })

  test('Agenda: Ctrl-click rows multi-selects', async ({ page }) => {
    // The content calendar fills the whole current month, so the Agenda list
    // (which runs forward from the anchor) always has rows regardless of "today".
    await page.goto('/sv-grid/#/demos/385-scheduler-app-content')
    await page.locator('.sv-sched').first().waitFor()
    await page.getByRole('button', { name: 'Agenda', exact: true }).click()
    await page.locator('.sv-sched-agenda-row').first().waitFor()
    const rows = await page.locator('.sv-sched-agenda-row').all()
    await rows[0]!.click({ modifiers: ['Control'] })
    await rows[1]!.click({ modifiers: ['Control'] })
    await expect(page.locator('.sv-sched-event-selected')).toHaveCount(2)
    // A plain click clears the multi-selection and opens the event.
    await rows[2]!.click()
    await expect(page.locator('.sv-drawer')).toBeVisible()
  })

  test('undo / redo a drag with Ctrl+Z / Ctrl+Shift+Z (history)', async ({ page }) => {
    const su = () => page.locator('.sv-sched-event', { hasText: 'Standup' }).first()
    const topN = async () => Math.round(await su().evaluate((el) => parseFloat((el as HTMLElement).style.top)))
    const t0 = await topN()
    const box = (await su().boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (96 * i) / 6) // ~2h down
    await page.mouse.up()
    const t1 = await topN()
    expect(t1).not.toBe(t0)
    await page.keyboard.press('Control+z')
    await expect.poll(topN).toBe(t0) // undone
    await page.keyboard.press('Control+Shift+z')
    await expect.poll(topN).toBe(t1) // redone
  })

  test('Duplicate (context menu) creates a copy', async ({ page }) => {
    const before = await events(page).count()
    const box = (await events(page).filter({ hasText: 'Standup' }).first().boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    await page.locator('.sv-menu__item', { hasText: 'Duplicate' }).click()
    await expect.poll(() => events(page).count()).toBe(before + 1)
  })
})
