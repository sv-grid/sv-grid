import { test, expect, type Page } from '@playwright/test'

/**
 * Touch row dragging (#66), driven with real touch input.
 *
 * The unit tests for this path run in jsdom, which dispatches synthetic
 * PointerEvents into a layout engine that has no compositor. That cannot tell
 * you whether the browser stole the gesture to scroll, whether `touch-action`
 * is set correctly, or whether the long press actually elapses before a move
 * arrives - which are the ways this feature breaks on a phone.
 *
 * So these go through `Input.dispatchTouchEvent` over CDP rather than
 * `dispatchEvent`. That enters Chromium's real input pipeline: the same path a
 * finger takes, including touch-action handling and compositor scrolling.
 *
 * The contract under test, from packages/grid/src/row-drag-touch.ts:
 *   - LONG_PRESS_MS  = 350   drag begins only after this much hold
 *   - SCROLL_SLOP_PX = 10    moving further than this first hands the gesture
 *                            back to the browser, so the grid still scrolls
 *
 * What this still does NOT cover, and why the device checklist in
 * docs/help/rows/row-dragging.md stays: Chromium is not iOS Safari. Momentum
 * scrolling, rubber-banding, back-swipe arbitration at the left screen edge and
 * the way iOS resolves a page gesture against an element gesture are all
 * WebKit-on-hardware behaviours that no emulator reproduces.
 *
 * Demo 180 is the target because it uses `rowDragManaged`, the built-in path
 * this module serves. Demo 105 reorders with its own HTML5 drag handlers and
 * would exercise none of it.
 */

const DEMO = 'http://localhost:5174/#/180-row-dragging'
const LONG_PRESS_MS = 350

/** Real touch input, through the browser's own event pipeline. */
async function touchDriver(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: string, points: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })),
    })
  return {
    start: (x: number, y: number) => send('touchStart', [{ x, y }]),
    move: (...points: { x: number; y: number }[]) => send('touchMove', points),
    /** A second finger arriving while the first is still down. */
    startSecond: (a: { x: number; y: number }, b: { x: number; y: number }) => send('touchStart', [a, b]),
    end: () => send('touchEnd', []),
    /** What the OS sends when it takes the gesture over. */
    cancel: () => send('touchCancel', []),
  }
}

/**
 * The task titles of the first grid, top to bottom.
 *
 * Titles rather than whole rows: the demo shows row numbers, so a reorder
 * changes the leading digit of every row it moved past. Comparing raw row text
 * would report a difference for rows that only shifted position.
 */
const TITLES = [
  'Design empty states',
  'Keyboard nav audit',
  'Dark theme polish',
  'CSV export edge cases',
  'Virtualization stress test',
]

async function backlogOrder(page: Page): Promise<string[]> {
  const rows = await page.locator('[role="grid"]').first().getByRole('row').allInnerTexts()
  return rows.map((text) => TITLES.find((t) => text.includes(t))).filter(Boolean) as string[]
}

/** Centre of the row whose text contains `label`, in the first grid. */
async function rowCentre(page: Page, label: string) {
  const row = page.locator('[role="grid"]').first().getByRole('row').filter({ hasText: label }).first()
  const box = await row.boundingBox()
  if (!box) throw new Error(`row "${label}" has no box`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

test.describe('touch row dragging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO)
    // The touch module is imported on the first touch that lands on a
    // draggable row, so the grid has to be real before the gesture starts.
    await expect(page.locator('[role="grid"]').first().getByRole('row').first()).toBeVisible()
  })

  test('a swipe past the slop does not pick a row up', async ({ page }) => {
    const before = await backlogOrder(page)
    const from = await rowCentre(page, 'Design empty states')
    const touch = await touchDriver(page)

    // Move immediately and well past SCROLL_SLOP_PX, without waiting out the
    // long press. This is an ordinary scroll gesture.
    await touch.start(from.x, from.y)
    for (let dy = 6; dy <= 120; dy += 18) await touch.move({ x: from.x, y: from.y - dy })
    await touch.end()

    expect(await backlogOrder(page), 'a swipe must not reorder rows').toEqual(before)
  })

  test('a long press then a move reorders on lift', async ({ page }) => {
    const before = await backlogOrder(page)
    const from = await rowCentre(page, 'Design empty states')
    const to = await rowCentre(page, 'CSV export edge cases')
    const touch = await touchDriver(page)

    await touch.start(from.x, from.y)
    // Hold still past the threshold: any movement over the slop here would
    // hand the gesture back to the browser instead.
    await page.waitForTimeout(LONG_PRESS_MS + 150)
    // Then travel in steps, as a finger does.
    const steps = 8
    for (let i = 1; i <= steps; i += 1) {
      await touch.move({ x: from.x, y: from.y + ((to.y - from.y) * i) / steps })
    }
    await touch.end()

    const after = await backlogOrder(page)
    expect(after, 'the long press should have moved the row').not.toEqual(before)
    expect(after.join(' ')).toContain('Design empty states')
    expect(after, 'no row may be lost or duplicated by a drag').toHaveLength(before.length)
  })

  /**
   * Lifting past the bottom edge commits to the last row the indicator was on,
   * it does not cancel. That is deliberate: `onPointerUp` calls `end(true)`, so
   * the drop lands wherever the indicator was last showing, and dragging to the
   * bottom edge is how you move a row to the end on a phone. Cancelling there
   * would throw away a move the UI was actively promising.
   *
   * Worth knowing that this differs from the desktop HTML5 path, where a drop
   * outside a target cancels. A genuine interruption still aborts - that is
   * `pointercancel`, covered below.
   */
  test('lifting past the bottom edge commits to the last indicated row', async ({ page }) => {
    const before = await backlogOrder(page)
    const from = await rowCentre(page, 'Keyboard nav audit')
    const touch = await touchDriver(page)

    await touch.start(from.x, from.y)
    await page.waitForTimeout(LONG_PRESS_MS + 150)
    const viewport = page.viewportSize()!
    for (let i = 1; i <= 6; i += 1) {
      await touch.move({ x: from.x, y: from.y + ((viewport.height - from.y) * i) / 6 })
    }
    await touch.end()

    const after = await backlogOrder(page)
    expect(after.at(-1), 'the dragged row should land at the end').toBe('Keyboard nav audit')
    expect([...after].sort(), 'no row lost or duplicated').toEqual([...before].sort())
  })

  test('an interrupted gesture aborts instead of dropping', async ({ page }) => {
    const before = await backlogOrder(page)
    const from = await rowCentre(page, 'Keyboard nav audit')
    const touch = await touchDriver(page)

    await touch.start(from.x, from.y)
    await page.waitForTimeout(LONG_PRESS_MS + 150)
    await touch.move({ x: from.x, y: from.y + 80 })
    // What the OS sends when it takes the gesture over - an incoming call, the
    // app switcher, a system edge swipe.
    await touch.cancel()

    expect(await backlogOrder(page), 'a cancelled drag must not reorder').toEqual(before)
  })

  test('a second finger mid-drag does not corrupt the drag', async ({ page }) => {
    const before = await backlogOrder(page)
    const from = await rowCentre(page, 'Design empty states')
    const touch = await touchDriver(page)

    await touch.start(from.x, from.y)
    await page.waitForTimeout(LONG_PRESS_MS + 150)
    await touch.move({ x: from.x, y: from.y + 40 })
    // A second finger lands while the first is still dragging.
    await touch.startSecond({ x: from.x, y: from.y + 40 }, { x: from.x + 60, y: from.y + 90 })
    await touch.end()

    const after = await backlogOrder(page)
    // Whatever it decides to do, the data must stay intact - no lost row, no
    // duplicate, no stuck drag state.
    expect(after).toHaveLength(before.length)
    expect([...after].sort()).toEqual([...before].sort())
  })
})
