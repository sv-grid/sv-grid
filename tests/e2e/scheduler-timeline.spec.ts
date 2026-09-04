/**
 * E2E: timeline views - horizontal axis, resources as rows.
 *  - demo 371: Day / Week zoom; drag a bar to re-time it / reassign; click + drag
 *    empty space to select a range, arrow keys to navigate/extend it.
 *  - demo 373: Month / Year roadmap zoom (month ticks + quarter majors).
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/371-scheduler-timeline'
const ROADMAP = '/sv-grid/#/demos/384-scheduler-app-roadmap'
const bar = (page: Page, title: string) => page.locator('.sv-sched-tl-bar', { hasText: title })
const pickView = (page: Page, frag: string) => page.locator('.sv-sched-views button', { hasText: frag }).click()

/**
 * A point inside a timeline lane that no event bar covers.
 *
 * The range-selection tests used to hard-code "3% across the first row, 12px
 * down", on the assumption that early hours are always empty because blocks
 * start at 9am. That stopped holding once a multi-day bar spanned the whole
 * visible Day window: the click landed on the bar, the bar's own handler took
 * it, and no range marker was ever created. Scan for real empty space instead.
 */
async function emptyLanePoint(page: Page) {
  const lanes = await page.locator('.sv-sched-tl-row:not(.sv-sched-tl-filler) .sv-sched-tl-lanes').all()
  for (const lane of lanes) {
    const box = await lane.boundingBox()
    if (!box) continue
    for (let frac = 0.03; frac < 0.95; frac += 0.04) {
      const x = box.x + box.width * frac
      const y = box.y + box.height / 2
      const onBar = await page.evaluate(
        ([px, py]) => !!(document.elementFromPoint(px!, py!) as HTMLElement | null)?.closest('.sv-sched-tl-bar'),
        [x, y],
      )
      if (!onBar) return { x, y }
    }
  }
  throw new Error('no empty spot in any timeline lane')
}

async function drag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(fromX + ((toX - fromX) * i) / 8, fromY + ((toY - fromY) * i) / 8)
  await page.mouse.up()
}

test.describe('scheduler timeline (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-sched-tl').first().waitFor()
  })

  test('renders one row per resource with event bars + a 2-row axis', async ({ page }) => {
    await expect(page.locator('.sv-sched-tl-row:not(.sv-sched-tl-filler)')).toHaveCount(5) // 5 teams
    await expect(page.locator('.sv-sched-tl-bar').first()).toBeVisible()
    await expect(page.locator('.sv-sched-tl-major').first()).toBeVisible() // major header (month)
    await expect(page.locator('.sv-sched-tl-tick').first()).toBeVisible() // minor ticks
  })

  test('the timeline shows a current-time line on today', async ({ page }) => {
    // "now" is within this week's axis, so a vertical now-line renders per row.
    expect(await page.locator('.sv-sched-tl-nowline').count()).toBeGreaterThan(0)
  })

  test('the Day zoom shows hourly ticks', async ({ page }) => {
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    await expect(page.locator('.sv-sched-tl-tick', { hasText: '7 AM' })).toBeVisible()
    await expect(page.locator('.sv-sched-tl-tick', { hasText: '6 PM' })).toBeVisible()
  })


  test('dragging a bar sideways re-times it', async ({ page }) => {
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    const b = bar(page, 'Release 4.2').first()
    await expect(b).toContainText('9am')
    const box = (await b.boundingBox())!
    await drag(page, box.x + box.width / 2, box.y + box.height / 2, box.x + box.width / 2 + 140, box.y + box.height / 2)
    // Re-timed: no longer starts at 9am (moved a couple of hours later).
    await expect(bar(page, 'Release 4.2').first()).not.toContainText('9am')
  })

  test('resizing a bar edge grows it live and stays fully visible', async ({ page }) => {
    // "Auth refactor" is a multi-day span in the Week timeline.
    const b = bar(page, 'Auth refactor').first()
    const box = (await b.boundingBox())!
    await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width - 3 + (200 * i) / 6, box.y + box.height / 2)
    // Mid-resize: the bar is marked resizing (not the dimmed move-source) and grew.
    await expect(page.locator('.sv-sched-bar-resizing')).toHaveCount(1)
    await expect(page.locator('.sv-sched-bar-source')).toHaveCount(0)
    const mid = (await bar(page, 'Auth refactor').first().boundingBox())!
    expect(mid.width).toBeGreaterThan(box.width + 40)
    await page.mouse.up()
  })

  test('dragging across rows shows a destination preview + row highlight', async ({ page }) => {
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    const b = bar(page, 'Release 4.2').first()
    const box = (await b.boundingBox())!
    const platform = (await page.locator('.sv-sched-tl-row', { hasText: 'Platform' }).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + ((platform.y + platform.height / 2 - (box.y + box.height / 2)) * i) / 8)
    // Mid-drag: dimmed source, a preview bar, and the target row highlighted.
    await expect(page.locator('.sv-sched-bar-source')).toHaveCount(1)
    await expect(page.locator('.sv-sched-drag-preview')).toHaveCount(1)
    await expect(page.locator('.sv-sched-tl-row-drop')).toHaveCount(1)
    await page.mouse.up()
    await expect(page.locator('.sv-sched-tl-row-drop')).toHaveCount(0)
  })

  test('dragging a bar to another row reassigns the resource', async ({ page }) => {
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    const mobileRow = page.locator('.sv-sched-tl-row', { hasText: 'Mobile' })
    const platformRow = page.locator('.sv-sched-tl-row', { hasText: 'Platform' })
    // "Release 4.2" starts in Mobile.
    await expect(mobileRow.locator('.sv-sched-tl-bar', { hasText: 'Release 4.2' })).toHaveCount(1)
    const b = bar(page, 'Release 4.2').first()
    const box = (await b.boundingBox())!
    const target = (await platformRow.boundingBox())!
    await drag(page, box.x + box.width / 2, box.y + box.height / 2, box.x + box.width / 2, target.y + target.height / 2)
    await expect(platformRow.locator('.sv-sched-tl-bar', { hasText: 'Release 4.2' })).toHaveCount(1)
    await expect(mobileRow.locator('.sv-sched-tl-bar', { hasText: 'Release 4.2' })).toHaveCount(0)
  })

  test('clicking empty space marks a cell; arrows navigate + Shift extends; Enter creates', async ({ page }) => {
    // Day zoom + an early hour is empty regardless of the weekday (blocks start 9am).
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    const before = await page.locator('.sv-sched-tl-bar').count()
    const spot = await emptyLanePoint(page)
    await page.mouse.click(spot.x, spot.y)
    // A click marks a single cell (one continuous timeline band), nothing created.
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(1)
    await expect(page.locator('.sv-sched-tl-bar')).toHaveCount(before)
    // Arrow keys keep it a single marker; Shift+ArrowLeft extends it (still one band).
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(1)
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.up('Shift')
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(1)
    // Enter confirms -> exactly one new bar.
    await page.keyboard.press('Enter')
    await expect.poll(() => page.locator('.sv-sched-tl-bar').count()).toBe(before + 1)
  })

  test('Escape cancels a pending timeline range', async ({ page }) => {
    await pickView(page, 'Day')
    await page.waitForTimeout(200)
    const before = await page.locator('.sv-sched-tl-bar').count()
    const spot = await emptyLanePoint(page)
    await page.mouse.click(spot.x, spot.y)
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-sched-select-mirror')).toHaveCount(0)
    await expect(page.locator('.sv-sched-tl-bar')).toHaveCount(before)
  })

  test('Ctrl-click bars multi-selects; Delete removes them', async ({ page }) => {
    const before = await page.locator('.sv-sched-tl-bar').count()
    const bars = await page.locator('.sv-sched-tl-bar').all()
    await bars[0]!.click({ modifiers: ['Control'] })
    await bars[1]!.click({ modifiers: ['Control'] })
    await expect(page.locator('.sv-sched-bar-selected')).toHaveCount(2)
    await expect(page.locator('footer')).toContainText('2 selected')
    await page.keyboard.press('Delete')
    await expect.poll(() => page.locator('.sv-sched-tl-bar').count()).toBe(before - 2)
  })
})

test.describe('scheduler roadmap timeline - Month / Year (demo 384)', () => {
  test.beforeEach(async ({ page }) => {
    // The app has a KPI strip above the timeline; give it height so the squad
    // rows are on-screen for the drag-reassign test.
    await page.setViewportSize({ width: 1400, height: 1040 })
    await page.goto(ROADMAP)
    await page.locator('.sv-sched-tl').first().waitFor()
  })

  test('the Month zoom shows one tick per day of the month', async ({ page }) => {
    // Default view is Month - ticks are the days of the current month.
    await expect(page.locator('.sv-sched-tl-row:not(.sv-sched-tl-filler)')).toHaveCount(4) // 4 squads
    const ticks = await page.locator('.sv-sched-tl-tick').count()
    expect(ticks).toBeGreaterThanOrEqual(28)
    expect(ticks).toBeLessThanOrEqual(31)
  })

  test('the Year zoom shows 12 month ticks + quarter majors', async ({ page }) => {
    await pickView(page, 'Year')
    await page.waitForTimeout(200)
    await expect(page.locator('.sv-sched-tl-tick')).toHaveCount(12)
    await expect(page.locator('.sv-sched-tl-major')).toHaveCount(4)
  })

  test('dragging an initiative to another squad reassigns it', async ({ page }) => {
    const growthRow = page.locator('.sv-sched-tl-row', { hasText: 'Growth' })
    const coreRow = page.locator('.sv-sched-tl-row', { hasText: 'Core Platform' })
    await expect(growthRow.locator('.sv-sched-tl-bar', { hasText: 'Referral program' })).toHaveCount(1)
    const b = bar(page, 'Referral program').first()
    // Bring the bar into the timeline's own scroll viewport first. `.sv-sched-tl`
    // is a scroll container and `boundingBox()` reports geometry whether or not
    // the element is clipped, so on a short calendar pane this used to grab a
    // point below the fold - the page section underneath took the pointerdown
    // and no drag ever started. A user scrolls to the bar before dragging it.
    await b.scrollIntoViewIfNeeded()
    const box = (await b.boundingBox())!
    const target = (await coreRow.boundingBox())!
    // Grab a point that is inside the bar, on screen, and not behind the sticky
    // resource gutter. Three things make `box.x + 40` wrong on its own: the bar
    // spans several weeks so its centre is off-screen; a horizontal scroll can
    // put the bar's own left edge behind the gutter; and the gutter is
    // `position: sticky`, so it paints over the lane area rather than sitting
    // beside it - a point can be inside the lanes' box and still hit the gutter.
    const gutter = (await growthRow.locator('.sv-sched-tl-resgutter').boundingBox())!
    const tl = (await page.locator('.sv-sched-tl').first().boundingBox())!
    const grabX = Math.min(
      Math.max(box.x + 40, gutter.x + gutter.width + 20),
      Math.min(box.x + box.width, tl.x + tl.width) - 20,
    )
    await drag(page, grabX, box.y + box.height / 2, grabX, target.y + target.height / 2)
    await expect(coreRow.locator('.sv-sched-tl-bar', { hasText: 'Referral program' })).toHaveCount(1)
    await expect(growthRow.locator('.sv-sched-tl-bar', { hasText: 'Referral program' })).toHaveCount(0)
  })
})
