/**
 * Tutorial: the financial workbench. Recorded on demo
 * 437-chart-financial-workbench: candles with indicator panes on top, the
 * grid's own chart panel drawing the same rows underneath.
 */

/** Indicator panes on the workbench (the panes under the price). */
const panesShown = (page) => page.evaluate(() => document.querySelectorAll('.demo-workbench .sv-chart-pane.is-indicator').length)
let panesBefore = 0
let panesAfter = 0

export default {
  id: 'financial-workbench',
  title: 'A financial chart workbench in Svelte',
  description: 'Candlesticks with volume, RSI and MACD panes and Bollinger bands: indicator chips, Ctrl + wheel zoom every pane follows, range presets, and the grid panel.',
  demo: '437-chart-financial-workbench',
  docsPage: 'docs/help/charts/financial.md',
  anchorAfter: '<div data-docs-demo="437-chart-financial-workbench"',
  tags: ['svelte candlestick chart', 'financial chart indicators', 'rsi macd panes', 'data grid candlestick'],
  gif: { beats: [1, 2] },
  // The page stacks the workbench over the grid pane; at 1.25 the first pane
  // alone would fill the frame.
  zoom: 1,

  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await page.locator('.demo-workbench .sv-chart-pane.is-indicator').nth(2).waitFor({ timeout: 30_000 })
    panesBefore = await panesShown(page)
    await h.pause(1200)
  },

  beats: [
    {
      say: 'A year of sessions as candles, with volume, RSI and MACD panes under the price and Bollinger bands on it.',
      lead: 500,
      async do(page, h) {
        await h.hover('.demo-workbench .sv-chart-pane.is-main .sv-grid-chart-svg', { ms: 700 })
      },
    },
    {
      say: 'Toggle an indicator chip and its pane comes and goes.',
      lead: 200,
      async do(page, h) {
        await h.clickChip('ATR', { within: '.chrome .chips' })
        await page.locator('.demo-workbench .sv-chart-pane.is-indicator').nth(3).waitFor({ timeout: 10_000 })
        await h.pause(900)
        panesAfter = await panesShown(page)
      },
      hold: 300,
    },
    {
      say: 'Ctrl plus wheel zooms the price, and every pane follows.',
      lead: 200,
      async do(page, h) {
        await h.hover('.demo-workbench .sv-chart-pane.is-main .sv-grid-chart-svg', { ms: 400 })
        await page.keyboard.down('Control')
        for (let i = 0; i < 4; i += 1) {
          await page.mouse.wheel(0, -120)
          await h.pause(180)
        }
        await page.keyboard.up('Control')
        // Off the plot, so the tooltip clears and the zoomed candles show.
        await h.moveTo(820, 22, { ms: 300 })
        await h.pause(900)
      },
      hold: 300,
    },
    {
      say: 'A range preset jumps to the last month.',
      lead: 200,
      async do(page, h) {
        await h.clickChip('1M', { within: '.demo-workbench', selector: '.sv-grid-chart-preset' })
        await h.pause(1100)
      },
      hold: 300,
    },
    {
      say: 'The grid\'s own panel draws the same rows: Candlestick picked, indicator chips, the builder, and the link toggle.',
      lead: 200,
      async do(page, h) {
        await h.easedScroll(1, 1600, 'section.wrap')
        await h.pause(500)
        await h.clickChip('RSI', { within: '.demo-panel .sv-grid-chart-panel', selector: '.sv-grid-chart-chip' })
        await page.locator('.demo-panel .sv-chart-pane.is-indicator').first().waitFor({ timeout: 10_000 })
        await h.pause(900)
        await h.click('.demo-panel .sv-grid-chart-link-btn')
        await h.pause(700)
      },
      hold: 500,
    },
  ],

  async verify(page) {
    if (!(panesAfter > panesBefore)) throw new Error(`the ATR chip did not add a pane (${panesBefore} -> ${panesAfter})`)
    const linked = await page.locator('.demo-panel .sv-grid-chart-link-btn').getAttribute('aria-pressed')
    if (linked !== 'true') throw new Error('the grid panel chart is still linked to the grid')
    return `${panesBefore} -> ${panesAfter} panes, grid chart unlinked`
  },
}
