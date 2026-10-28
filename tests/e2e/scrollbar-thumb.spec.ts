/**
 * E2E: the custom scrollbar's thumb moves in the same frame as the rows.
 *
 * The thumb used to learn the scroll position from a rAF read on the frame
 * after the scroll flush: one frame behind the rows, and a second style pass
 * and paint for every scroll step. The flush now hands the position it
 * already has to the scrollbar (applyKnownScrollPosition), and the scrollbar
 * keeps its measured track instead of measuring it inside that flush, which
 * would force a layout of the whole table.
 *
 * jsdom has no layout or rAF ordering, so this runs in a real browser.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/06-large-dataset'

async function waitForGrid(page: Page) {
  await page.locator('sv-grid-scrollbar.sv-grid-scrollbar-vertical').waitFor({ timeout: 60_000 })
  await page.locator('td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
}

/**
 * Scroll the body to `top` from a task, as input does, and read the grid in
 * the first animation frame after the `scroll` event: the frame whose rAF
 * flush wrote the rows. Returns the scrollbar's state and the first body row
 * at that moment, plus where the thumb should be.
 */
async function scrollAndReadSameFrame(page: Page, top: number) {
  return await page.evaluate(async (target) => {
    const sc = document.querySelector('.sv-grid-container') as HTMLElement
    const bar = sc.parentElement!.querySelector('sv-grid-scrollbar.sv-grid-scrollbar-vertical') as HTMLElement
    const read = () => {
      const thumb = bar.shadowRoot!.querySelector('.thumb') as HTMLElement
      const track = bar.shadowRoot!.querySelector('.track') as HTMLElement
      const offset = Number(/translateY\(([-\d.]+)px\)/.exec(thumb.style.transform)?.[1] ?? NaN)
      const value = Number(bar.getAttribute('value'))
      const max = Number(bar.getAttribute('content-size')) - Number(bar.getAttribute('viewport-size'))
      const travel = track.getBoundingClientRect().height - thumb.getBoundingClientRect().height
      const firstRow = Math.min(
        ...Array.from(sc.querySelectorAll('tbody.sv-grid-body td[data-svgrid-row]'))
          .filter((td) => td.getBoundingClientRect().bottom > sc.getBoundingClientRect().top + 40)
          .map((td) => Number(td.getAttribute('data-svgrid-row'))),
      )
      return { scrollTop: sc.scrollTop, value, offset, expected: max > 0 ? (value / max) * travel : 0, firstRow }
    }
    return await new Promise<ReturnType<typeof read>>((resolve) => {
      // The grid's own scroll listener is registered first, so its rAF flush
      // is queued ahead of this one and has run by the time this reads.
      sc.addEventListener('scroll', () => requestAnimationFrame(() => resolve(read())), { once: true })
      setTimeout(() => { sc.scrollTop = target }, 0)
    })
  }, top)
}

test.describe('custom scrollbar thumb', () => {
  test('follows a scroll in the frame that writes the rows', async ({ page }) => {
    await page.goto(DEMO)
    await waitForGrid(page)
    for (const top of [1_200, 6_000, 2_400]) {
      const r = await scrollAndReadSameFrame(page, top)
      expect(r.value, `scrollbar value at scrollTop ${r.scrollTop}`).toBe(r.scrollTop)
      expect(Math.abs(r.offset - r.expected), `thumb at ${r.offset}px, expected ${r.expected}px`).toBeLessThan(1)
      expect(r.firstRow, 'the rows under the viewport moved too').toBeGreaterThan(0)
    }
  })

  test('Ctrl+End puts the thumb at the end of the track', async ({ page }) => {
    await page.goto(DEMO)
    await waitForGrid(page)
    await page.locator('td[data-svgrid-row="0"]').first().click()
    await page.keyboard.press('Control+End')
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const sc = document.querySelector('.sv-grid-container') as HTMLElement
          const bar = sc.parentElement!.querySelector('sv-grid-scrollbar.sv-grid-scrollbar-vertical') as HTMLElement
          const thumb = bar.shadowRoot!.querySelector('.thumb') as HTMLElement
          const track = bar.shadowRoot!.querySelector('.track') as HTMLElement
          const end = track.getBoundingClientRect().bottom - thumb.getBoundingClientRect().bottom
          return Math.round(end)
        }),
      )
      .toBe(0)
  })
})
