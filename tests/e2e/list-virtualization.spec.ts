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

  // The off-screen spacers must paint a row skeleton, so a fast scrollbar-thumb
  // drag (which can outrun JS re-windowing by many rows in a frame) reveals
  // placeholder rows instead of blank white. Headless' software compositor can't
  // reproduce the thumb-drag blank itself, so we assert the skeleton is present.
  const spacerHasSkeleton = await page.evaluate(() => {
    const sp = document.querySelector('.sv-listbox.is-virtual .sv-listbox__spacer') as HTMLElement
    const bg = getComputedStyle(sp).backgroundImage
    return bg !== 'none' && /gradient/.test(bg)
  })

  // eslint-disable-next-line no-console
  console.log(`[list-virtualization] spacerHasSkeleton=${spacerHasSkeleton}`)

  // Rows must never vanish from the DOM, the center must stay painted over a row
  // (no compositor blank), and the first scroll must not stall the main thread.
  expect(minRows).toBeGreaterThan(0)
  expect(blankFrames).toBeLessThanOrEqual(1)
  expect(maxLongTask).toBeLessThan(200)
  expect(spacerHasSkeleton).toBe(true)
})
