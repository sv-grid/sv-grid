/**
 * Tutorial: the grid's chart panel. Recorded on demo 353-built-in-charting,
 * where one `charting` prop gives the grid a docked panel that charts the
 * displayed rows, cross-filters on a click, and opens the builder.
 */

/**
 * Categories the panel's chart shows. The grid is virtualized, so its row
 * count is the viewport's, not the filter's; the chart re-derives from the
 * displayed rows, so a cross filter by region leaves it one bar.
 */
const categoriesShown = (page) => page.evaluate(() => document.querySelectorAll('.sv-grid-chart-panel .sv-grid-chart-cat-hit').length)
let before = 0
let after = 0

export default {
  id: 'chart-from-the-grid',
  title: 'Chart the grid with one prop',
  description: 'Add charting to SvGrid and a panel charts the rows on screen: pick a type and a group-by, click a bar to filter the grid, open the builder.',
  demo: '353-built-in-charting',
  docsPage: 'docs/help/charts/from-the-grid.md',
  anchorAfter: '<div data-docs-demo="353-built-in-charting"',
  tags: ['svelte chart from grid', 'data grid chart panel', 'chart builder', 'cross filter chart'],
  hideIntro: 'The whole grid below',
  gif: { beats: [1, 2] },
  // The demo is 620px tall with the panel docked below the grid; the default
  // 1.25 zoom would push the panel out of the 720px frame.
  zoom: 1,

  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await page.locator('.sv-grid-chart-panel .sv-grid-chart-cat-hit').first().waitFor({ timeout: 30_000 })
    await h.pause(1200)
  },

  beats: [
    {
      say: 'Add the charting prop and the grid grows a chart panel. It charts the rows on screen, so filtering or sorting redraws it.',
      lead: 500,
      async do(page, h) {
        await h.hover('.sv-grid-chart-panel .sv-grid-chart-svg', { ms: 700 })
      },
    },
    {
      say: 'Pick a type, a group-by column and the aggregate.',
      lead: 200,
      async do(page, h) {
        await h.selectOption({ label: /^type$/i }, 'bar')
        await h.selectOption({ label: /^group by$/i }, 'region')
        await h.pause(500)
        await h.selectOption({ label: /^aggregate$/i }, 'avg')
        await h.pause(700)
        before = await categoriesShown(page)
      },
      hold: 300,
    },
    {
      say: 'Click a bar and the grid filters to that category. Clear filter brings the rows back.',
      lead: 200,
      async do(page, h) {
        await h.click(page.locator('.sv-grid-chart-panel .sv-grid-chart-cat-hit').nth(1), { ms: 600 })
        await h.pause(1400)
        after = await categoriesShown(page)
        await h.clickChip('Clear filter', { within: '.sv-grid-chart-panel' })
        await h.pause(900)
      },
      hold: 300,
    },
    {
      say: 'Build opens a gallery with a live thumbnail per type, and a Format tab for titles, axes and series.',
      lead: 200,
      async do(page, h) {
        await h.click('.sv-grid-chart-build-btn')
        await page.locator('.sv-grid-chart-builder-card .sv-grid-chart-svg').first().waitFor({ timeout: 30_000 })
        await h.pause(1600)
        await h.clickChip('Format', { within: '.sv-grid-chart-builder', selector: '[role="tab"]' })
        await h.pause(1400)
      },
      hold: 300,
    },
    {
      say: 'Everything here is a config field or an API call, and it round-trips through the saved view.',
      lead: 300,
      async do(page, h) {
        await page.keyboard.press('Escape')
        await h.pause(500)
        await h.park(undefined, undefined, { ms: 700 })
      },
      hold: 500,
    },
  ],

  async verify(page) {
    if (!(after < before)) throw new Error(`the cross filter did not narrow the chart (${before} -> ${after} categories)`)
    const now = await categoriesShown(page)
    if (now !== before) throw new Error(`Clear filter did not restore the chart (${now} of ${before} categories)`)
    return `cross filter ${before} -> ${after} categories, then cleared`
  },
}
