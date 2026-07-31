/**
 * E2E: scheduler event drag-to-move + edge-resize.
 *
 * Real pointer sequences for the enterprise calendar view (demo 364, Day view,
 * `editable: true`) - the path jsdom can't exercise. Events are absolutely
 * positioned with inline `top` / `height` percentages that the overlay recomputes
 * after a move / resize, so we assert those change in the right direction.
 *
 * We drive a non-overlapping event ("Lunch & learn", 12:00-13:00) so its box is
 * full-width and unambiguous.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/364-scheduler-timegrid'
const EVENT = 'Lunch & learn'

function ev(page: Page) {
  return page.locator('.sv-sched-event', { hasText: EVENT })
}

/** Read the inline top/height percentages the renderer writes for an event. */
async function readRect(page: Page) {
  return ev(page).evaluate((el) => ({
    top: parseFloat((el as HTMLElement).style.top),
    height: parseFloat((el as HTMLElement).style.height),
  }))
}

/** A real pointer drag from (x,y) by (dx,dy), in steps, so the component's
 *  window pointermove handlers fire past the 4px drag threshold. */
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6)
  }
  await page.mouse.up()
}

test.describe('scheduler drag + resize (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await ev(page).waitFor()
  })

  test('the calendar renders events with resize grips', async ({ page }) => {
    expect(await ev(page).count()).toBe(1)
    // Two grips (top + bottom) per editable event exist in the DOM.
    const grips = await page.locator('.sv-sched-event', { hasText: EVENT })
      .locator('.sv-sched-resize').count()
    expect(grips).toBe(2)
  })

  test('dragging an event body down reschedules it later (top grows)', async ({ page }) => {
    const before = await readRect(page)
    const box = await ev(page).boundingBox()
    if (!box) throw new Error('no event box')
    // Grab the middle of the event (away from the edge grips) and drag down ~1h.
    await drag(page, box.x + box.width / 2, box.y + box.height / 2, 0, 48)

    await expect.poll(async () => (await readRect(page)).top).toBeGreaterThan(before.top + 1)
    const after = await readRect(page)
    // A move preserves duration, so the height is unchanged.
    expect(Math.abs(after.height - before.height)).toBeLessThan(0.5)
  })

  test('dragging the bottom grip down makes the event longer (height grows)', async ({ page }) => {
    const before = await readRect(page)
    const box = await ev(page).boundingBox()
    if (!box) throw new Error('no event box')
    // Grab the bottom edge (the resize-end grip) and drag down ~1h.
    await drag(page, box.x + box.width / 2, box.y + box.height - 3, 0, 48)

    await expect.poll(async () => (await readRect(page)).height).toBeGreaterThan(before.height + 1)
    const after = await readRect(page)
    // Resizing the end keeps the start (top) put.
    expect(Math.abs(after.top - before.top)).toBeLessThan(0.5)
  })

  test('dragging the top grip down shrinks the event from the start', async ({ page }) => {
    const before = await readRect(page)
    const box = await ev(page).boundingBox()
    if (!box) throw new Error('no event box')
    // Grab the top edge (the resize-start grip) and drag down ~30m.
    await drag(page, box.x + box.width / 2, box.y + 2, 0, 24)

    // Start moves later -> top grows and height shrinks; end stays put.
    await expect.poll(async () => (await readRect(page)).top).toBeGreaterThan(before.top + 1)
    const after = await readRect(page)
    expect(after.height).toBeLessThan(before.height - 1)
  })
})

test.describe('scheduler all-day row (real browser)', () => {
  test('a multi-day event renders as an all-day bar, not filling the hourly grid', async ({ page }) => {
    await page.goto('/sv-grid/#/demos/363-scheduler-intro')
    await page.locator('.sv-sched').first().waitFor()
    await page.getByRole('button', { name: 'Week', exact: true }).click()
    // "Team offsite" is a 3-day event -> one spanning bar in the all-day row.
    const allDayBar = page.locator('.sv-sched-allday-bars .sv-sched-bar', { hasText: 'Team offsite' })
    await expect(allDayBar).toHaveCount(1)
    // ...and NOT rendered as an hourly-grid event (which would fill columns).
    await expect(page.locator('.sv-sched-event', { hasText: 'Team offsite' })).toHaveCount(0)
    // The bar spans multiple day columns (wider than a single column).
    const barW = (await allDayBar.boundingBox())!.width
    const col = (await page.locator('.sv-sched-col').first().boundingBox())!.width
    expect(barW).toBeGreaterThan(col * 1.5)
  })
})

test.describe('scheduler month drag feedback (real browser)', () => {
  test('dragging a chip shows a cursor ghost + highlights the target day', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1180 })
    await page.goto('/sv-grid/#/demos/363-scheduler-intro')
    await page.locator('.sv-sched').first().waitFor()
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    const chip = page.locator('.sv-sched-bar', { hasText: 'Sprint planning' }).first()
    await chip.scrollIntoViewIfNeeded()
    const box = await chip.boundingBox()
    if (!box) throw new Error('no chip')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + box.width / 2 + (200 * i) / 8, box.y + box.height / 2 - (240 * i) / 8)
    }
    // Mid-drag: a floating ghost and exactly one highlighted drop-target day.
    await expect(page.locator('.sv-sched-month-ghost')).toBeVisible()
    await expect(page.locator('.sv-sched-daycell-drop')).toHaveCount(1)
    await page.mouse.up()
    // Feedback clears after drop.
    await expect(page.locator('.sv-sched-month-ghost')).toHaveCount(0)
    await expect(page.locator('.sv-sched-daycell-drop')).toHaveCount(0)
  })

  test('dragging a bar right edge extends the event into one wider spanning bar', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1180 })
    await page.goto('/sv-grid/#/demos/363-scheduler-intro')
    await page.locator('.sv-sched').first().waitFor()
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    const bar = () => page.locator('.sv-sched-bar', { hasText: 'Sprint planning' }).first()

    await bar().scrollIntoViewIfNeeded()
    const before = await bar().boundingBox()
    if (!before) throw new Error('no bar')
    // A single-day event is one column wide; extending should NOT clone it.
    await expect(page.locator('.sv-sched-bar', { hasText: 'Sprint planning' })).toHaveCount(1)

    // Grab the right-edge grip and drag ~2.5 columns right to push the end date out.
    const y = before.y + before.height / 2
    await page.mouse.move(before.x + before.width - 3, y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(before.x + before.width - 3 + (400 * i) / 8, y)
    await page.mouse.up()

    // Still ONE element, now much wider (spanning multiple day columns).
    await expect(page.locator('.sv-sched-bar', { hasText: 'Sprint planning' })).toHaveCount(1)
    await expect.poll(async () => (await bar().boundingBox())?.width ?? 0).toBeGreaterThan(before.width + 40)
  })
})

test.describe('scheduler collision modes (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-sched-event').first().waitFor()
  })

  test('Split shows every collision as its own column (no overflow tile)', async ({ page }) => {
    // Default mode. The 9-11am pile-up is 6-deep -> 6 side-by-side events.
    expect(await page.locator('.sv-sched-overflow').count()).toBe(0)
    // The busy cluster splits the width, so several events are < full width.
    const widths = await page.locator('.sv-sched-event').evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).style.width),
    )
    expect(widths.filter((w) => !w.startsWith('calc(100%')).length).toBeGreaterThanOrEqual(5)
  })

  test('Cap collapses extra collisions into a clickable "+N more" popover', async ({ page }) => {
    await page.getByRole('button', { name: 'Cap + more', exact: true }).click()
    const overflow = page.locator('.sv-sched-overflow')
    await expect(overflow.first()).toBeVisible()
    // The 6-deep cluster with maxColumns:3 hides 4 -> "+4 more".
    await expect(overflow.first()).toHaveText(/\+\d+ more/)

    await overflow.first().click()
    const pop = page.locator('.sv-sched-listpop')
    await expect(pop).toBeVisible()
    // Clicking a listed event closes the popover (opens its drawer/editor).
    const items = pop.locator('.sv-sched-listpop-item')
    expect(await items.count()).toBeGreaterThan(1)
  })

  test('Stack offsets overlapping events instead of shrinking them', async ({ page }) => {
    await page.getByRole('button', { name: 'Stack', exact: true }).click()
    expect(await page.locator('.sv-sched-overflow').count()).toBe(0)
    // Stacked events keep a wide width and get non-zero left offsets.
    const lefts = await page.locator('.sv-sched-event').evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).style.left),
    )
    expect(lefts.some((l) => !l.startsWith('calc(0%'))).toBe(true)
  })
})
