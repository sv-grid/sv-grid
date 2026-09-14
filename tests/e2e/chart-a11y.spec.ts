import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The chart's accessibility, checked in a real browser: an axe audit of the
 * rendered component on three demos that between them draw every family,
 * the keyboard model that jsdom cannot vouch for (real focus, real
 * re-renders), and the forced-colors palette. The audit is scoped to the
 * chart itself so a demo page's own chrome cannot fail or pass it for us.
 */

async function open(page: Page, demo: string) {
  await page.goto(`/sv-grid/#/demos/${demo}`)
  await page.locator('.sv-grid-chart-svg').first().waitFor({ timeout: 30_000 })
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('.sv-grid-chart')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
  }))
}

/** The first x tick's label: the cheapest reading of where the window starts. */
const firstTick = (chart: ReturnType<Page['locator']>) => chart.locator('.sv-grid-chart-axis.is-x').first().textContent()

test.describe('chart accessibility', () => {
  // The gallery demos cover the families the three above do not: callouts,
  // a selectable heat map, a drillable sunburst, gauges and bullets, pins
  // and drawings.
  for (const demo of ['434-chart-axes-styling', '435-chart-type-gallery', '437-chart-financial-workbench', '441-chart-pie-donut', '445-chart-heatmap-calendar', '447-chart-hierarchy', '450-chart-gauge-bullet', '451-chart-annotations']) {
    test(`axe finds no violation inside the charts of ${demo}`, async ({ page }) => {
      // The workbench is a big page (panes, a grid, a builder): the scan needs room.
      test.setTimeout(120_000)
      await open(page, demo)
      // Let every lazy card in the gallery mount before the scan.
      await page.waitForTimeout(800)
      expect(await audit(page)).toEqual([])
    })
  }

  test('a pie is one Tab stop and the arrow keys walk its slices with a tooltip', async ({ page }) => {
    await open(page, '435-chart-type-gallery')
    const card = page.locator('.thumb').filter({ hasText: 'Pie / donut' }).first()
    await card.scrollIntoViewIfNeeded()
    await card.click()
    const big = page.locator('.pane .sv-grid-chart').first()
    const slices = big.locator('.sv-grid-chart-slice')
    await expect(slices.first()).toBeAttached()
    const stops = await slices.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length)
    expect(stops).toBe(1)
    await slices.first().focus()
    await expect(big.locator('.sv-grid-chart-tooltip')).toBeVisible()
    const firstTitle = await big.locator('.sv-grid-chart-tooltip-title').textContent()
    await page.keyboard.press('ArrowRight')
    await expect(slices.nth(1)).toBeFocused()
    await expect(big.locator('.sv-grid-chart-tooltip-title')).not.toHaveText(firstTitle ?? '')
    await page.keyboard.press('End')
    await expect(slices.last()).toBeFocused()
  })

  test('+ and 0 zoom a focused category and reset from the keyboard', async ({ page }) => {
    await open(page, '436-chart-sync-zoom')
    const chart = page.locator('.sv-grid-chart').first()
    const hits = chart.locator('.sv-grid-chart-cat-hit')
    // The demo's series is dense enough for the single hit zone, so the
    // window is read off the first x tick rather than a hit count.
    const start = await firstTick(chart)
    await hits.first().focus()
    await page.keyboard.press('End')
    await page.keyboard.press('+')
    await expect.poll(() => firstTick(chart)).not.toBe(start)
    // Focus stayed on the plot, on a category of the narrower window.
    await expect(page.locator(':focus')).toHaveClass(/sv-grid-chart-cat-hit/)
    const zoomed = await firstTick(chart)
    await page.keyboard.press('Shift+ArrowLeft')
    await expect.poll(() => firstTick(chart)).not.toBe(zoomed)
    await expect(page.locator(':focus')).toHaveClass(/sv-grid-chart-cat-hit/)
    await page.keyboard.press('0')
    await expect.poll(() => firstTick(chart)).toBe(start)
  })

  test('the range brush takes the keyboard: Up narrows, Left pans, 0 resets', async ({ page }) => {
    await open(page, '153-chart-zoom-brush')
    const brush = page.locator('.sv-grid-chart-brush').first()
    await brush.waitFor({ timeout: 30_000 })
    await expect(brush).toHaveAttribute('role', 'slider')
    const chart = page.locator('.sv-grid-chart').first()
    const full = await brush.getAttribute('aria-valuetext')
    const start = await firstTick(chart)
    await brush.focus()
    await page.keyboard.press('ArrowUp')
    await expect(brush).not.toHaveAttribute('aria-valuetext', full ?? '')
    // Narrowed around the middle, so the window's start moved right.
    const startAfterNarrow = Number(await brush.getAttribute('aria-valuenow'))
    expect(startAfterNarrow).toBeGreaterThan(0)
    const narrowed = await brush.getAttribute('aria-valuetext')
    await page.keyboard.press('ArrowRight')
    await expect(brush).not.toHaveAttribute('aria-valuetext', narrowed ?? '')
    const now = Number(await brush.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThan(startAfterNarrow)
    // The plot followed the window.
    await expect.poll(() => firstTick(chart)).not.toBe(start)
    await page.keyboard.press('0')
    await expect(brush).toHaveAttribute('aria-valuetext', full ?? '')
    await expect.poll(() => firstTick(chart)).toBe(start)
  })

  test('forced colors keep the data colours and repaint the chrome with the system palette', async ({ page }) => {
    await open(page, '434-chart-axes-styling')
    const chart = page.locator('.sv-grid-chart').first()
    const bar = chart.locator('.sv-grid-chart-bar, .sv-grid-chart-linepath').first()
    const attrColor = await bar.evaluate((el) => el.getAttribute('fill') ?? el.getAttribute('stroke'))
    await page.emulateMedia({ forcedColors: 'active' })
    await page.waitForTimeout(200)
    const adjust = await chart.locator('.sv-grid-chart-svg').evaluate((el) => getComputedStyle(el).forcedColorAdjust)
    expect(adjust).toBe('none')
    // The mark keeps its own colour ...
    const paint = await bar.evaluate((el) => {
      const cs = getComputedStyle(el)
      return el.getAttribute('fill') ? cs.fill : cs.stroke
    })
    const toRgb = (c: string) => {
      const m = c.match(/^#([0-9a-f]{6})$/i)
      if (!m) return c
      const n = parseInt(m[1]!, 16)
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
    }
    expect(paint).toBe(toRgb(attrColor ?? ''))
    // ... while the axis text takes the system text colour.
    const bodyColor = await page.evaluate(() => getComputedStyle(document.body).color)
    const axisFill = await chart.locator('.sv-grid-chart-axis').first().evaluate((el) => getComputedStyle(el).fill)
    expect(axisFill).toBe(bodyColor)
  })
})
