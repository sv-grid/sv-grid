/**
 * E2E: a freshly mounted grid must never paint an UNMEASURED frame.
 *
 * `hasMeasured` gates the custom scrollbars, the 16px scrollbar gutter on a
 * trailing right-aligned column, and the top pager (which carries a
 * `border-top`). It used to flip only inside `observeSizeRaf`'s callback, and
 * that callback is deliberately deferred by a `requestAnimationFrame` - so the
 * browser was guaranteed to paint at least one frame with the scrollbars
 * missing and the geometry 16px off, then correct it on the next frame.
 *
 * On a first load that reads as the "flashing scrollbar" the controller's own
 * comment describes. In an app that RECREATES the grid per navigation (a
 * `{#key}` around it, a route that remounts), it reads as the grid flashing on
 * every sort / filter / page change, sometimes leaving a stray border line.
 *
 * jsdom cannot catch this: it has no layout, so `clientHeight` is always 0 and
 * there is no paint to miss. Hence a real browser, sampling every animation
 * frame across a demo switch (which remounts the whole grid).
 */
import { expect, test } from '@playwright/test'

const DEMO_A = '/sv-grid/#/demos/01-quick-start'
const DEMO_B = '/sv-grid/#/demos/02-sort-filter-paginate'

type Frame = { present: boolean; overflowing: boolean; measured: boolean }

/** Sample the grid's measured-vs-overflowing state on every animation frame. */
const SAMPLER = `
  window.__frames = []
  const t0 = performance.now()
  function tick() {
    const c = document.querySelector('.sv-grid-container')
    if (c) {
      window.__frames.push({
        present: true,
        // Real vertical overflow means the scrollbar (and gutter) BELONG on
        // this frame; if they are absent, the frame is the unmeasured one.
        overflowing: c.scrollHeight > c.clientHeight + 1,
        measured: c.classList.contains('sv-grid-has-vscroll'),
      })
    }
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
`

test.describe('mount does not paint an unmeasured frame', () => {
  test('switching demos remounts the grid without a scrollbar-less frame', async ({ page }) => {
    await page.addInitScript(SAMPLER)
    await page.goto(DEMO_A)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
    await page.waitForTimeout(600)

    // A hash change to another demo tears the grid down and builds a new one -
    // the same lifecycle a SvelteKit page hits when it recreates the grid.
    await page.goto(DEMO_B)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
    await page.waitForTimeout(1200)

    const frames: Frame[] = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)
    expect(frames.length).toBeGreaterThan(10)

    // Every painted frame where the grid overflows must already show it as
    // measured. Before the fix, the frames right after each mount had
    // `overflowing: true, measured: false`.
    const unmeasured = frames.filter((f) => f.overflowing && !f.measured)
    expect(
      unmeasured.length,
      `${unmeasured.length} painted frame(s) had vertical overflow but no ` +
        `sv-grid-has-vscroll - the grid flashed its scrollbar/gutter on mount`,
    ).toBe(0)
  })

  test('the measured state never flips back off while mounted', async ({ page }) => {
    await page.addInitScript(SAMPLER)
    await page.goto(DEMO_A)
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
    await page.waitForTimeout(1500)

    const frames: Frame[] = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)
    const measuredAt = frames.findIndex((f) => f.measured)
    expect(measuredAt, 'the grid never reached its measured state').toBeGreaterThanOrEqual(0)
    // Once measured, it must stay measured: a flip back is the visible flash.
    const flipped = frames.slice(measuredAt).filter((f) => f.overflowing && !f.measured)
    expect(flipped.length, 'the grid lost its measured state after reaching it').toBe(0)
  })
})
