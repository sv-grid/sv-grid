/**
 * E2E: the virtualized SvListBox must not blank out on the FIRST scroll.
 *
 * User report: "when I first start to scroll, the items disappear for ~1 second
 * and then start showing." jsdom can't measure paint/scroll or main-thread
 * blocking, so this runs in a real browser. We measure the longest long-task
 * triggered by the first wheel scroll (the stall the user sees as a blank) and
 * assert the window stays populated across the scroll.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/323-list-virtualization'

async function firstVirtualList(page: Page) {
  const list = page.locator('.sv-listbox.is-virtual').first()
  await list.locator('.sv-listbox__opt').first().waitFor({ timeout: 30_000 })
  return list
}

test('first scroll on the 50k list neither blanks nor stalls the main thread', async ({ page }) => {
  await page.goto(DEMO)
  const list = await firstVirtualList(page)

  // Arm a long-task observer, then do the very first wheel scroll over the list.
  await page.evaluate(() => {
    ;(window as any).__lt = 0
    const po = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) (window as any).__lt = Math.max((window as any).__lt, e.duration)
    })
    po.observe({ entryTypes: ['longtask'] })
  })

  const box = await list.boundingBox()
  if (!box) throw new Error('no list box')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)

  // Sample, across frames, both the DOM row count AND whether the center of the
  // list is painted over a real option (hit-test). A compositor blank leaves the
  // rows in the DOM but hit-tests to the ul/spacer for a frame or more.
  await page.evaluate(() => {
    ;(window as any).__blankFrames = 0
    ;(window as any).__minRows = Infinity
    ;(window as any).__sampling = true
    const el = document.querySelector('.sv-listbox.is-virtual') as HTMLElement
    const r = el.getBoundingClientRect()
    const px = r.left + r.width / 2
    const py = r.top + r.height / 2
    const tick = () => {
      if (!(window as any).__sampling) return
      ;(window as any).__minRows = Math.min((window as any).__minRows, el.querySelectorAll('.sv-listbox__opt').length)
      const hit = document.elementFromPoint(px, py)
      const overRow = !!hit && !!(hit as Element).closest('.sv-listbox__opt')
      if (!overRow) (window as any).__blankFrames++
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  // A real wheel scroll: several ticks down, as a user flicks the list.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(120)

  const { blankFrames, minRows } = await page.evaluate(() => {
    ;(window as any).__sampling = false
    return { blankFrames: (window as any).__blankFrames as number, minRows: (window as any).__minRows as number }
  })
  const maxLongTask = await page.evaluate(() => (window as any).__lt as number)
  // eslint-disable-next-line no-console
  console.log(`[list-virtualization] wheel-scroll maxLongTask=${maxLongTask.toFixed(1)}ms minRows=${minRows} blankFrames=${blankFrames}`)

  // There used to be a fourth assertion here: that the off-screen
  // `.sv-listbox__spacer` elements paint a gradient row skeleton. SvListBox
  // dropped top/bottom spacer <li>s for absolutely-positioned transformed rows,
  // so the element no longer exists and the check was throwing on a null
  // getComputedStyle argument. The blank it guarded against is covered directly
  // by minRows / blankFrames below, which measure the rendered result rather
  // than the mechanism.

  // Rows must never vanish from the DOM, the center must stay painted over a row
  // (no compositor blank), and the first scroll must not stall the main thread.
  expect(minRows).toBeGreaterThan(0)
  expect(blankFrames).toBeLessThanOrEqual(1)
  expect(maxLongTask).toBeLessThan(200)
})
