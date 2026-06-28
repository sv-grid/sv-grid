/**
 * E2E: reaching the bottom of a 1,000,000-row grid.
 *
 * The user report was "I can't reach the bottom when I scroll on mobile with
 * many rows". Root cause: mobile / high-DPR browsers cap element height lower
 * than desktop, so past that cap the scroll container clamps its scrollHeight
 * and the tail rows fall out of reach unless the grid's "scroll scaling" kicks
 * in with the RIGHT cap. jsdom can't measure layout or scroll, so this has to
 * run in a real browser.
 *
 * Two cases:
 *   1. Real desktop cap - the demo's 18px rows total 18M px, under Chrome's
 *      ~33.5M cap, so scaling is INERT. Proves the plain path reaches row 1M.
 *   2. Forced low cap (window.__svgridMaxDomHeight = 4M) - reproduces a phone:
 *      18M content over a 4M cap, so scaling is ACTIVE. Proves the scaled path
 *      still reaches row 1M. This is the path the fix is about.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/78-million-rows'
const LAST_INDEX = 999_999 // rows are 0-based; row number cell shows index + 1

async function waitForGridBuilt(page: Page) {
  await page.locator('.sv-grid-container').waitFor({ timeout: 60_000 })
  // The demo generates 1M rows chunked across frames; wait until body cells
  // actually mount (the progress bar clears and rows render).
  await page.locator('td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
}

/**
 * Drive the native scroll container to its end and let the rAF-batched
 * virtualizer settle, repeating until the rendered window stops advancing.
 * Returns the highest row index mounted at the bottom plus the raw metrics.
 */
async function scrollToBottom(page: Page) {
  return await page.evaluate(async (lastIndex) => {
    const sc = document.querySelector('.sv-grid-container') as HTMLElement
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    let lastMax = -1
    for (let i = 0; i < 240; i++) {
      sc.scrollTop = sc.scrollHeight
      await frame()
      await frame()
      let max = -1
      sc.querySelectorAll('td[data-svgrid-row]').forEach((td) => {
        const n = Number(td.getAttribute('data-svgrid-row'))
        if (n > max) max = n
      })
      if (max >= lastIndex) {
        lastMax = max
        break
      }
      if (max === lastMax) break // stalled before the end - report it
      lastMax = max
    }
    return {
      maxRowIndex: lastMax,
      scrollTop: sc.scrollTop,
      scrollHeight: sc.scrollHeight,
      clientHeight: sc.clientHeight,
    }
  }, LAST_INDEX)
}

test.describe('1,000,000 rows - the last row is reachable', () => {
  test('real desktop cap (scaling inert): scrolls to row 1,000,000', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(DEMO)
    await waitForGridBuilt(page)

    const result = await scrollToBottom(page)
    expect(result.maxRowIndex).toBe(LAST_INDEX)

    // The very last row's number cell reads 1,000,000.
    const lastRowNumber = page.locator('td.sv-grid-row-number-cell').last()
    await expect(lastRowNumber).toHaveText('1000000')
  })

  test('forced low cap (scaling active, mobile path): scrolls to row 1,000,000', async ({ page }) => {
    test.setTimeout(120_000)
    // Pin the element-height cap below the 18M content BEFORE any grid mounts,
    // so scroll scaling engages exactly as it would on a phone.
    await page.addInitScript(() => {
      ;(window as unknown as { __svgridMaxDomHeight: number }).__svgridMaxDomHeight =
        4_000_000
    })
    await page.goto(DEMO)
    await waitForGridBuilt(page)

    // Sanity: the DOM scrollHeight must be capped near 4M, not the full 18M -
    // i.e. scaling really is active (otherwise this test proves nothing).
    const scrollHeight = await page.evaluate(
      () => (document.querySelector('.sv-grid-container') as HTMLElement).scrollHeight,
    )
    expect(scrollHeight).toBeLessThan(8_000_000)

    const result = await scrollToBottom(page)
    expect(result.maxRowIndex).toBe(LAST_INDEX)

    const lastRowNumber = page.locator('td.sv-grid-row-number-cell').last()
    await expect(lastRowNumber).toHaveText('1000000')
  })
})
