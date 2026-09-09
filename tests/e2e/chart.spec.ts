import { expect, test, type Page } from '@playwright/test'

/**
 * The chart in a real browser.
 *
 * `SvGridChart.svelte` is ~1700 lines behind a 69-line jsdom test, and the
 * things most likely to break are the ones jsdom cannot answer: hit-testing,
 * drag-to-zoom and anything that depends on layout. jsdom reports zero-sized
 * boxes, so a zoom drag there is a no-op and a test written against it passes
 * whether the code works or not. That was verified, not assumed: the same
 * assertion below passes in jsdom against deliberately broken slicing.
 */

async function open(page: Page, demo: string) {
  await page.goto(`/sv-grid/#/demos/${demo}`)
  await page.locator('.sv-grid-chart-svg').first().waitFor({ timeout: 30_000 })
}

/**
 * Drag a zoom rectangle across the plot.
 *
 * Diagonal on purpose: the component wants a real rubber band and ignores a
 * drag under 4px on EITHER axis, so a flat horizontal sweep sets `is-dragging`
 * and then quietly does nothing.
 */
async function dragZoom(page: Page) {
  const svg = page.locator('.sv-grid-chart-svg').first()
  const box = (await svg.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 12 })
  await page.mouse.up()
}

test.describe('chart', () => {
  test('a confidence band survives the zoom window', async ({ page }) => {
    await open(page, '157-chart-forecast-band')
    const band = page.locator('.sv-grid-chart-band')
    await expect(band.first()).toBeVisible()

    await dragZoom(page)
    // The zoom re-runs buildChart over a sliced spec. If the slice drops the
    // upper/lower envelopes, buildChart's length guard skips the band and the
    // shading disappears with no error anywhere.
    await expect(band.first(), 'band vanished inside the zoom window').toBeVisible()
  })

  test('drag zooms the category axis and double-click resets it', async ({ page }) => {
    await open(page, '153-chart-zoom-brush')
    // Category labels along the x axis; a zoom narrows the window so fewer show.
    const ticks = page.locator('text.sv-grid-chart-axis')
    const before = await ticks.count()

    await dragZoom(page)
    await expect(page.locator('button.sv-grid-chart-tool', { hasText: /reset zoom/i }).first()).toBeVisible()

    await page.locator('.sv-grid-chart-svg').first().dblclick()
    await expect
      .poll(async () => ticks.count(), { message: 'axis did not return to its full range' })
      .toBe(before)
  })

  test('the legend toggles a series off and back on', async ({ page }) => {
    // A demo that always has more than one series: demo 147 defaults to a
    // single measure, so this used to skip every run and prove nothing.
    await open(page, '354-charting-multi-series')
    const items = page.locator('.sv-grid-chart-legend-item')
    await expect(items.nth(1)).toBeVisible()

    const first = items.first()
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
  })

  test('hovering a category raises the crosshair tooltip', async ({ page }) => {
    await open(page, '147-integrated-charts')
    // Hover the invisible per-category band rather than a guessed coordinate:
    // it is the element that actually carries the handler, and it is what a
    // pointer anywhere in that column would hit.
    await page.locator('.sv-grid-chart-cat-hit').nth(1).hover()
    await expect(page.locator('.sv-grid-chart-tooltip').first()).toBeVisible()
  })

  test('every chart exposes its numbers to a screen reader', async ({ page }) => {
    await open(page, '147-integrated-charts')
    const svg = page.locator('.sv-grid-chart-svg').first()
    // The SVG points at a visually-hidden table carrying the same data, which
    // is what a screen reader reads instead of "chart".
    const describedBy = await svg.getAttribute('aria-describedby')
    expect(describedBy, 'chart has no aria-describedby').toBeTruthy()
    const table = page.locator(`#${describedBy}`)
    await expect(table).toHaveCount(1)
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0)
  })

  test('theme tokens recolour the series', async ({ page }) => {
    await open(page, '147-integrated-charts')
    const fills = () =>
      page.locator('.sv-grid-chart-svg rect.sv-grid-chart-bar').evaluateAll((els) =>
        [...new Set(els.map((e) => e.getAttribute('fill')))].slice(0, 3),
      )
    const before = await fills()

    // The palette used to be a hard-coded array in chart.ts, so a theme could
    // restyle everything about a chart except the data.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--sg-chart-1', '#ff00aa')
      document.documentElement.style.setProperty('--sg-chart-2', '#00ddff')
    })
    await expect
      .poll(async () => (await fills()).join(','), { message: 'tokens never reached the series' })
      .not.toBe(before.join(','))
    expect((await fills()).some((c) => (c ?? '').toLowerCase() === '#ff00aa')).toBe(true)
  })
})
