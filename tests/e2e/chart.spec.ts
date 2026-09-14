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

test.describe('chart axes, frame and decimation (demo 434)', () => {
  test('draws the title, the side legend, the band and the vertical reference line', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    await expect(page.locator('text.sv-grid-chart-title').first()).toHaveText('Latency by payload size')
    await expect(page.locator('.sv-grid-chart.is-legend-right').first()).toBeVisible()
    await expect(page.locator('.sv-grid-chart.is-legend-right .sv-grid-chart-legend-item')).toHaveCount(3)
    await expect(page.locator('.sv-grid-chart-refband').first()).toBeVisible()
    // The x reference line is vertical: it spans the plot height, not the width.
    const v = page.locator('.sv-grid-chart-refline').first()
    const [y1, y2] = await Promise.all([v.getAttribute('y1'), v.getAttribute('y2')])
    expect(Number(y2) - Number(y1)).toBeGreaterThan(50)
  })

  test('a numeric x axis spreads the categories by value', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    // Payload sizes 1, 2, 5, 10, 20, 50, 100: the first two points sit close,
    // the last two far apart. On a category axis every gap would be equal.
    const xs = await page.locator('.sv-grid-chart-svg').first().locator('.sv-grid-chart-dot').evaluateAll((els) =>
      els.slice(0, 7).map((e) => Number(e.getAttribute('cx') ?? (e as SVGPathElement).getBBox().x)),
    )
    expect(xs.length).toBeGreaterThanOrEqual(3)
    const sorted = [...xs].sort((a, b) => a - b)
    expect(sorted[1]! - sorted[0]!).toBeLessThan((sorted[sorted.length - 1]! - sorted[sorted.length - 2]!) / 4)
  })

  test('the custom tooltip snippet renders on hover, in single-series mode', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const main = page.locator('.sv-grid-chart').first()
    await main.locator('.sv-grid-chart-cat-hit').nth(3).hover()
    const tip = main.locator('.sv-grid-chart-tooltip.is-custom')
    await expect(tip).toBeVisible()
    await expect(tip.locator('.tip b')).not.toHaveText('All series')
  })

  test('a log x axis spaces the decades evenly, and the toggle goes back', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const main = page.locator('.sv-grid-chart').first()
    // The payload sizes 1, 10 and 100 KB are the p95 line's 1st, 4th and 7th points.
    const xs = async () => main.locator('.sv-grid-chart-dot').evaluateAll((els) =>
      els.slice(0, 7).map((e) => Number(e.getAttribute('cx') ?? (e as SVGPathElement).getBBox().x)),
    )
    const linear = await xs()
    expect(linear[3]! - linear[0]!).toBeLessThan((linear[6]! - linear[3]!) / 4)
    await page.getByLabel('Log x').check()
    await expect.poll(async () => { const v = await xs(); return Math.abs((v[3]! - v[0]!) - (v[6]! - v[3]!)) }).toBeLessThan(3)
    await expect(main.locator('.sv-grid-chart-axis.is-x').first()).toHaveText(/1 KB/)
    await page.getByLabel('Log x').uncheck()
    await expect.poll(async () => { const v = await xs(); return v[3]! - v[0]! < (v[6]! - v[3]!) / 4 }).toBe(true)
  })

  test('hovering near one line dims the others, and leaving restores them', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const main = page.locator('.sv-grid-chart').first()
    const opacities = () => main.locator('.sv-grid-chart-linepath').evaluateAll((els) => els.map((e) => (e.parentElement as HTMLElement).style.opacity))
    // Hover exactly on the p95 line's fourth point.
    const dot = main.locator('.sv-grid-chart-dot').nth(3)
    const box = (await dot.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(opacities).toContain('0.18')
    const after = await opacities()
    expect(after.filter((o) => o === '0.18').length).toBeGreaterThanOrEqual(1)
    expect(after.filter((o) => o === '1' || o === '').length).toBeGreaterThanOrEqual(1)
    await page.mouse.move(0, 0)
    await expect.poll(opacities).not.toContain('0.18')
  })

  test('the crosshair reads off both axes: a category pill below and a value pill on the left', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const main = page.locator('.sv-grid-chart').first()
    const hit = main.locator('.sv-grid-chart-cat-hit').nth(3)
    const box = (await hit.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.4)
    const pills = main.locator('.sv-grid-chart-crosshair-label text')
    await expect(pills).toHaveCount(2)
    const texts = await pills.allTextContents()
    // The category pill names the hovered payload size; the value pill is a
    // number off the latency axis, formatted like its ticks (a unit suffix).
    expect(texts[0]).toMatch(/^\d+/)
    expect(texts[1]).toMatch(/\d/)
    // The value pill sits left of the plot, level with the pointer.
    const plot = (await main.locator('.sv-grid-chart-cat-hit').first().boundingBox())!
    const pill = (await main.locator('.sv-grid-chart-crosshair-label').nth(1).boundingBox())!
    expect(pill.x + pill.width).toBeLessThanOrEqual(plot.x + 2)
    await page.mouse.move(0, 0)
    await expect(pills).toHaveCount(0)
  })

  test('decimation keeps a 50,000-point line at about a point per pixel, and can be switched off', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const points = () =>
      page.locator('.demo-dense .sv-grid-chart-linepath').first().evaluate((p) => (p.getAttribute('d') ?? '').split(/[ML]/).length - 1)
    const thinned = await points()
    expect(thinned).toBeGreaterThan(100)
    expect(thinned).toBeLessThan(5000)
    await page.locator('.demo-dense input[type=checkbox]').first().uncheck()
    await expect.poll(points, { message: 'the full series never laid out' }).toBeGreaterThan(40_000)
  })
})

test.describe('responsive rules and autosize (charts doc, runnable example)', () => {
  /**
   * The docs' responsive example: a width slider round a plain-block
   * `autosize` chart with a side legend and three size rules. A plain block
   * is the case the autosize maths has to get exactly right, because the
   * host's height is the plot's own: any byte over-counted grows the plot
   * every measurement (the side legend's phantom grid gaps did), and any
   * chrome still subtracted after it is gone shrinks it (a hidden legend
   * did). Neither shows in a fixed-height parent.
   */
  async function openExample(page: Page) {
    await page.goto('/sv-grid/#/docs/help/charts/axes-and-styling')
    await page.locator('.docs-code').first().waitFor({ timeout: 30_000 })
    const card = page.locator('.docs-code', { hasText: 'responsive: [' }).first()
    await card.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    const frame = card.locator('.docs-snippet-frame')
    await frame.locator('.sv-grid-chart-svg').first().waitFor({ timeout: 30_000 })
    return frame
  }
  const setWidth = (frame: ReturnType<Page['locator']>, w: number) =>
    frame.locator('input[type=range]').evaluate((el, w) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(el, String(w))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, w)
  const svgHeight = (frame: ReturnType<Page['locator']>) =>
    frame.locator('.sv-grid-chart-svg').first().evaluate((el) => Math.round(el.getBoundingClientRect().height))

  test('a side legend in a plain block settles instead of growing forever', async ({ page }) => {
    const frame = await openExample(page)
    await expect(frame.locator('.sv-grid-chart.is-legend-right')).toBeAttached()
    await page.waitForTimeout(600)
    const h1 = await svgHeight(frame)
    await page.waitForTimeout(900)
    const h2 = await svgHeight(frame)
    expect(h2).toBe(h1)
    expect(h2).toBeLessThan(600)
  })

  test('the rules patch the drawn spec by width, the legend follows, and hiding it does not shrink the plot', async ({ page }) => {
    const frame = await openExample(page)
    const chart = frame.locator('.sv-grid-chart')
    // Wide: subtitle, axis title, end labels, legend on the right.
    await expect(frame.locator('.sv-grid-chart-serieslabel')).toHaveCount(2)
    await expect(frame.locator('text.sv-grid-chart-subtitle')).toBeAttached()
    await expect(frame.locator('.sv-grid-chart-axis-title')).toHaveCount(1)
    // Under 560: no subtitle, no axis title, no end labels, legend below.
    await setWidth(frame, 500)
    await expect(frame.locator('.sv-grid-chart-serieslabel')).toHaveCount(0)
    await expect(frame.locator('text.sv-grid-chart-subtitle')).toHaveCount(0)
    await expect(frame.locator('.sv-grid-chart-axis-title')).toHaveCount(0)
    await expect(chart).not.toHaveClass(/is-legend-right/)
    await expect(frame.locator('.sv-grid-chart-legend')).toBeAttached()
    // Under 400: no title, no legend at all, and the plot keeps its height.
    await setWidth(frame, 360)
    await expect(frame.locator('text.sv-grid-chart-title')).toHaveCount(0)
    await expect(frame.locator('.sv-grid-chart-legend')).toHaveCount(0)
    await page.waitForTimeout(700)
    expect(await svgHeight(frame)).toBeGreaterThan(200)
    // And back: everything returns.
    await setWidth(frame, 720)
    await expect(frame.locator('.sv-grid-chart-serieslabel')).toHaveCount(2)
    await expect(chart).toHaveClass(/is-legend-right/)
  })
})

test.describe('sticky and corner tooltips (demo 436, volume chart)', () => {
  test('a click pins the tooltip in the chosen corner, the pointer can leave, Escape lets go', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const chart = page.locator('.demo-volume .sv-grid-chart').first()
    await chart.scrollIntoViewIfNeeded()
    // Two years of days is dense: one hit zone. Aim a third of the way in.
    const zone = (await chart.locator('.sv-grid-chart-cat-hit').first().boundingBox())!
    const box = { x: zone.x + zone.width * 0.3, y: zone.y, width: 4, height: zone.height }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const tip = chart.locator('.sv-grid-chart-tooltip')
    await expect(tip).toBeVisible()
    await expect(tip).toHaveClass(/is-fixed/)
    // Parked at the plot's top-right corner: right of the pointer, near the top.
    const tipBox = (await tip.boundingBox())!
    expect(tipBox.x).toBeGreaterThan(box.x)
    expect(tipBox.y).toBeLessThan(box.y + zone.height / 2)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(tip).toHaveClass(/is-pinned/)
    await page.mouse.move(0, 0)
    await expect(tip).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tip).toHaveCount(0)
  })
})

test.describe('streaming chart (demo 159)', () => {
  test('the window slides with appendPoints and the chart never replays its enter effect', async ({ page }) => {
    test.setTimeout(60_000)
    await open(page, '159-chart-streaming')
    const chart = page.locator('.sv-grid-chart').first()
    const marks = chart.locator('.sv-grid-chart-marks').first()
    await expect(marks).toHaveClass(/is-enter-none/)
    const firstTick = () => chart.locator('.sv-grid-chart-axis.is-x').first().textContent()
    // The line is smoothed (one M and cubic segments), so count the markers.
    const points = () => chart.locator('.sv-grid-chart-dot').count()
    const before = await points()
    const startTick = await firstTick()
    await page.getByRole('button', { name: /start streaming/i }).click()
    // At 4 Hz the window of 60 fills within a few seconds and then slides:
    // the point count settles at the window while the first tick moves on.
    await expect.poll(points, { timeout: 25_000 }).toBe(60)
    await expect.poll(firstTick, { timeout: 25_000 }).not.toBe(startTick)
    await page.waitForTimeout(1200)
    expect(await points()).toBe(60)
    expect(before).toBeLessThanOrEqual(60)
    await expect(marks).toHaveClass(/is-enter-none/)
    await page.locator('.ic-btn', { hasText: 'Stop' }).click()
  })
})

test.describe('chart type gallery (demo 435)', () => {
  test('renders a live thumbnail per card and switches the big chart on click', async ({ page }) => {
    await page.goto('/sv-grid/#/demos/435-chart-type-gallery')
    const cards = page.locator('.thumb')
    await expect(cards).toHaveCount(30)
    // Every card holds a rendered chart, not an empty frame.
    const svgs = page.locator('.thumb .sv-grid-chart-svg')
    await expect(svgs).toHaveCount(30)
    await cards.filter({ hasText: 'Sunburst' }).click()
    const pane = page.locator('.pane')
    await expect(pane.locator('.sv-grid-chart-title')).toHaveText('Sunburst')
    await expect(pane.locator('.sv-grid-chart-arc').first()).toBeVisible()
    // Hovering an arc raises the tooltip with the node's path.
    await pane.locator('.sv-grid-chart-arc').nth(2).hover()
    await expect(pane.locator('.sv-grid-chart-tooltip')).toBeVisible()
  })

  test('the variants change the drawn shape', async ({ page }) => {
    await page.goto('/sv-grid/#/demos/435-chart-type-gallery')
    await page.locator('.thumb').filter({ hasText: 'Candlestick' }).click()
    const pane = page.locator('.pane')
    const fills = () => pane.locator('.sv-grid-chart-candle').evaluateAll((els) => els.map((e) => e.getAttribute('fill')))
    const classic = await fills()
    await pane.locator('select').selectOption('heikin-ashi')
    await expect.poll(fills, { message: 'Heikin-Ashi never changed the candles' }).not.toEqual(classic)
    await page.locator('.thumb').filter({ hasText: 'Funnel' }).click()
    const d = () => pane.locator('.sv-grid-chart-funnel-seg').first().getAttribute('d')
    const trapezoid = await d()
    await pane.locator('select').selectOption('cone')
    await expect.poll(d).not.toBe(trapezoid)
  })
})

test.describe('synchronized charts, zoom gestures, menu, motion and drilldown (demo 436)', () => {
  /** How many rows the grid under the charts reports: the size of the window. */
  const daysShown = async (page: Page) => {
    const text = (await page.locator('.grid-title').textContent()) ?? ''
    return Number(/(\d+) of 730 days/.exec(text)?.[1] ?? NaN)
  }
  const windowText = (page: Page) => page.locator('.grid-title .muted').textContent()

  test('the hidden data table takes no layout space, so the demo does not scroll into emptiness', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    // 730 categories: the screen-reader table has 730 rows. Before the fix
    // it stood 17,000px tall inside each chart and the demo's scroll
    // container let the wheel run through 17,000px of nothing.
    const charts = page.locator('.sv-grid-chart')
    expect(await charts.count()).toBeGreaterThanOrEqual(2)
    for (const chart of await charts.all()) {
      const geo = await chart.evaluate((el) => {
        const sr = el.querySelector('.sv-grid-chart-sr-only')!.getBoundingClientRect()
        return { scrollH: el.scrollHeight, clientH: el.clientHeight, sr: [Math.round(sr.width), Math.round(sr.height)] }
      })
      expect(geo.sr).toEqual([1, 1])
      expect(geo.scrollH).toBeLessThanOrEqual(geo.clientH + 1)
    }
    const wrap = page.locator('section.wrap').first()
    const overflow = await wrap.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(overflow).toBeLessThan(1000)
  })

  test('a range preset narrows both charts and the grid to the window', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    expect(await daysShown(page)).toBe(730)
    const presets = page.locator('.demo-price .sv-grid-chart-preset')
    await expect(presets).toHaveText(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'All'])
    await presets.filter({ hasText: '1M' }).click()
    await expect.poll(() => daysShown(page)).toBeLessThan(40)
    // The volume chart is in the same group, so it shows the same month.
    await expect.poll(() => page.locator('.demo-volume .sv-grid-chart-bar').count()).toBeLessThan(40)
    await presets.filter({ hasText: 'All' }).click()
    await expect.poll(() => daysShown(page)).toBe(730)
    await expect.poll(() => page.locator('.demo-volume .sv-grid-chart-bar').count()).toBe(730)
  })

  test('Ctrl + wheel zooms around the pointer and Shift + drag pans the window', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const svg = page.locator('.demo-price .sv-grid-chart-svg')
    const box = (await svg.boundingBox())!
    const cx = box.x + box.width * 0.6
    const cy = box.y + box.height * 0.5
    await page.mouse.move(cx, cy)
    // A plain wheel is the page's; only Ctrl + wheel is the chart's.
    await page.mouse.wheel(0, -300)
    expect(await daysShown(page)).toBe(730)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -300)
    await page.mouse.wheel(0, -300)
    await page.keyboard.up('Control')
    await expect.poll(() => daysShown(page)).toBeLessThan(730)
    const zoomed = await daysShown(page)
    const before = await windowText(page)
    // Shift + drag slides the window without changing its size.
    await page.keyboard.down('Shift')
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 140, cy, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await expect.poll(() => windowText(page)).not.toBe(before)
    expect(await daysShown(page)).toBe(zoomed)
  })

  test('one hover raises a crosshair on both charts', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const box = (await page.locator('.demo-price .sv-grid-chart-svg').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
    // A vertical line has a zero-width box, so "visible" is the wrong
    // question; attached is the one that fails when the sync breaks.
    await expect(page.locator('.demo-price .sv-grid-chart-crosshair').first()).toBeAttached()
    await expect(page.locator('.demo-volume .sv-grid-chart-crosshair').first()).toBeAttached()
    await expect(page.locator('.demo-volume .sv-grid-chart-tooltip')).toHaveCount(1)
    await page.mouse.move(box.x - 20, box.y - 20)
    await expect(page.locator('.demo-volume .sv-grid-chart-crosshair')).toHaveCount(0)
  })

  test('right-click opens the context menu with the built-in items and the custom one', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const svg = page.locator('.demo-price .sv-grid-chart-svg')
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5, { button: 'right' })
    const menu = page.locator('.sv-grid-chart-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Download PNG' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Range' })).toBeVisible()
    await menu.getByRole('menuitem', { name: /^Explain 20/ }).click()
    await expect(page.locator('.chrome .note')).toHaveText(/closed at \$/)
    await expect(menu).toHaveCount(0)
  })

  test('bars grow in, slide on new data, and select on click', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const orders = page.locator('.demo-orders')
    await expect(orders.locator('.sv-grid-chart-marks').first()).toHaveClass(/is-enter-grow/)
    const bars = orders.locator('.sv-grid-chart-bar')
    await expect(bars).toHaveCount(7)
    // The category hit zones sit above the bars, so this is where a click on
    // a bar really lands; the chart resolves it to the bar underneath.
    const hits = orders.locator('.sv-grid-chart-cat-hit')
    await hits.nth(1).click()
    await hits.nth(2).click({ modifiers: ['Control'] })
    await expect(orders.locator('.note')).toHaveText('Selected: Tue, Wed')
    await expect(orders.locator('.sv-grid-chart-bar.is-selected')).toHaveCount(2)
    const heights = () => bars.evaluateAll((els) => els.map((e) => e.getAttribute('height')))
    const before = await heights()
    await orders.getByRole('button', { name: 'New data' }).click()
    await expect.poll(heights, { message: 'the bars never moved' }).not.toEqual(before)
  })

  test('reduced motion draws the bars in place', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '436-chart-sync-zoom')
    const marks = page.locator('.demo-orders .sv-grid-chart-marks').first()
    await expect(marks).toHaveClass(/is-enter-none/)
    expect(await marks.evaluate((g) => g.getAnimations({ subtree: true }).length)).toBe(0)
  })

  test('a sunburst drills down on click and the breadcrumb climbs back', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const sb = page.locator('.demo-sunburst')
    const arcs = sb.locator('.sv-grid-chart-arc')
    const all = await arcs.count()
    expect(all).toBeGreaterThan(10)
    await sb.locator('.sv-grid-chart-arc[aria-label^="EMEA"]').first().click()
    await expect(sb.locator('.sv-grid-chart-crumb.is-current')).toHaveText('EMEA')
    await expect(sb.locator('.note')).toHaveText('Drilled into EMEA')
    await expect.poll(() => arcs.count()).toBeLessThan(all)
    await sb.locator('.sv-grid-chart-crumb').first().click()
    await expect.poll(() => arcs.count()).toBe(all)
  })
})

test.describe('financial workbench (demo 437)', () => {
  test('stacks the indicator panes under the price and shares one crosshair', async ({ page }) => {
    await open(page, '437-chart-financial-workbench')
    const bench = page.locator('.demo-workbench')
    await expect(bench.locator('.sv-chart-pane.is-indicator')).toHaveCount(3)
    await expect(bench.locator('.sv-chart-pane-title')).toHaveText(['Volume', 'RSI 14', 'MACD 12, 26, 9'])
    // The main chart carries the candles, the last-price pill and the flags.
    await expect(bench.locator('.sv-chart-pane.is-main .sv-grid-chart-candle').first()).toBeAttached()
    await expect(bench.locator('.sv-chart-pane.is-main .sv-grid-chart-refpill')).toHaveCount(1)
    await expect(bench.locator('.sv-chart-pane.is-main .sv-grid-chart-annotation-marker.has-text')).toHaveCount(3)
    await expect(bench.locator('.sv-chart-pane.is-main .sv-grid-chart-overlay-band')).toHaveCount(1)
    await bench.locator('.sv-chart-pane.is-main .sv-grid-chart-svg').scrollIntoViewIfNeeded()
    const box = (await bench.locator('.sv-chart-pane.is-main .sv-grid-chart-svg').boundingBox())!
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5)
    await expect(bench.locator('.sv-chart-pane.is-main .sv-grid-chart-crosshair').first()).toBeAttached()
    await expect(bench.locator('.sv-chart-pane.is-indicator .sv-grid-chart-crosshair')).toHaveCount(3)
    // Weekly bars are a fifth as many.
    const daily = await bench.locator('.sv-chart-pane.is-main .sv-grid-chart-candle').count()
    await page.locator('.chrome select').first().selectOption('week')
    await expect.poll(() => bench.locator('.sv-chart-pane.is-main .sv-grid-chart-candle').count()).toBeLessThan(daily / 3)
  })

  test('the trend tool draws a line from two clicks, stored as data', async ({ page }) => {
    await open(page, '437-chart-financial-workbench')
    const main = page.locator('.demo-workbench .sv-chart-pane.is-main')
    await expect(main.locator('.sv-grid-chart-drawing.is-hray')).toHaveCount(1)
    await main.locator('.sv-grid-chart-drawtool', { hasText: 'Trend' }).click()
    const svg = main.locator('.sv-grid-chart-svg')
    await expect(svg).toHaveClass(/is-drawing/)
    await svg.scrollIntoViewIfNeeded()
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6)
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4)
    await expect(main.locator('.sv-grid-chart-drawing.is-trend')).toHaveCount(1)
    await expect(page.locator('.chrome .note')).toHaveText(/^2 drawings/)
    // The drawing survives the daily / weekly re-layout because it is data.
    await page.locator('.chrome select').first().selectOption('week')
    await expect(main.locator('.sv-grid-chart-drawing.is-trend')).toHaveCount(1)
    // A note is typed into an inline box at the click; Enter keeps it.
    await main.locator('.sv-grid-chart-drawtool', { hasText: 'Text' }).click()
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3)
    const draft = main.locator('.sv-grid-chart-textdraft')
    await expect(draft).toBeFocused()
    await draft.fill('breakout')
    await draft.press('Enter')
    await expect(main.locator('.sv-grid-chart-drawing-text')).toHaveText('breakout')
    await expect(page.locator('.chrome .note')).toHaveText(/^3 drawings/)
    // Escape drops an empty one.
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3)
    await draft.press('Escape')
    await expect(draft).toHaveCount(0)
    await expect(page.locator('.chrome .note')).toHaveText(/^3 drawings/)
  })

  test('the PDF button downloads a chart-*.pdf', async ({ page }) => {
    await open(page, '437-chart-financial-workbench')
    const main = page.locator('.demo-workbench .sv-chart-pane.is-main')
    const download = page.waitForEvent('download')
    await main.getByRole('button', { name: 'PDF', exact: true }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^chart-\d{4}-\d{2}-\d{2}\.pdf$/)
    const path = await file.path()
    expect(path).toBeTruthy()
    const head = (await import('node:fs')).readFileSync(path!).subarray(0, 8).toString('latin1')
    expect(head.startsWith('%PDF-1.4')).toBe(true)
  })

  test('the grid panel builds a candlestick, adds a pane from a chip, opens the builder and unlinks', async ({ page }) => {
    await open(page, '437-chart-financial-workbench')
    const panel = page.locator('.demo-panel .sv-grid-chart-panel')
    await expect(panel.locator('.sv-grid-chart-candle').first()).toBeAttached()
    await panel.getByRole('button', { name: 'RSI' }).click()
    await expect(panel.locator('.sv-chart-pane.is-indicator')).toHaveCount(1)
    // The builder's gallery switches the type.
    await panel.getByRole('button', { name: 'Open the chart builder' }).click()
    const builder = page.locator('.sv-grid-chart-builder')
    await expect(builder).toBeVisible()
    await expect(builder.locator('.sv-grid-chart-builder-card .sv-grid-chart-svg').first()).toBeAttached()
    await builder.locator('.sv-grid-chart-builder-card').filter({ has: page.locator('.sv-grid-chart-builder-card-label', { hasText: /^Line$/ }) }).click()
    await page.keyboard.press('Escape')
    await expect(builder).toHaveCount(0)
    await expect(panel.locator('.sv-grid-chart-linepath').first()).toBeAttached()
    // Unlink: the chart keeps its data while the grid is filtered.
    const link = panel.getByRole('button', { name: 'Unlink the chart from the grid' })
    await link.click()
    await expect(panel.getByRole('button', { name: 'Link the chart back to the grid' })).toHaveAttribute('aria-pressed', 'true')
  })
})
