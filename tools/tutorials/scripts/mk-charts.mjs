/** Marketing cut: built-in charting. YouTube only, 1920x1080. */
export default {
  id: 'mk-charts',
  kind: 'marketing',
  title: 'Charts that read the grid',
  description: 'SvGrid charting: a panel that draws the rows on screen and filters the grid on click, thirty chart types from one dataset, financial panes with synced zoom.',
  tags: ['svelte charts', 'data grid charts', 'candlestick chart', 'chart gallery', 'svelte 5'],
  poster: { beat: 2 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Built-in charting', title: 'Charts that read the grid.', subtitle: 'Not a second library. The chart draws the rows on screen.' })
      },
      beats: [{ say: 'The chart is not a second library. It reads the rows the grid is showing.', lead: 200 }],
    },
    {
      demo: '353-built-in-charting',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await page.waitForSelector('.sv-grid-chart-panel', { timeout: 30_000 })
        await h.pause(1000)
      },
      beats: [
        {
          say: 'Add the charting prop and pick a type. Click a bar and the grid filters to that category.',
          lead: 400,
          async do(page, h) {
            await h.selectOption({ label: /^type$/i }, 'bar')
            await h.selectOption({ label: /^group by$/i }, 'region')
            await h.pause(700)
            await h.click(page.locator('.sv-grid-chart-panel .sv-grid-chart-cat-hit').nth(1), { ms: 600 })
            await h.pause(1000)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '435-chart-type-gallery',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.thumb', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(1000)
      },
      beats: [
        {
          say: 'Thirty chart types from one dataset: bars, lines, areas, pies, funnels, candlesticks, heat maps and more.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.thumb').nth(3))
            await h.pause(1100)
            await h.click(page.locator('.thumb').nth(8))
            await h.pause(1100)
            await h.click(page.locator('.thumb').nth(14))
          },
          hold: 700,
        },
      ],
    },
    {
      demo: '437-chart-financial-workbench',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await page.waitForSelector('.demo-workbench .sv-chart-pane.is-main .sv-grid-chart-svg', { timeout: 60_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Financial panes with indicators, and a zoom that keeps every pane in step.',
          lead: 400,
          async do(page, h) {
            await h.hover('.demo-workbench .sv-chart-pane.is-main .sv-grid-chart-svg', { ms: 500 })
            await page.keyboard.down('Control')
            for (let i = 0; i < 4; i += 1) {
              await page.mouse.wheel(0, -120)
              await h.pause(180)
            }
            await page.keyboard.up('Control')
            await h.moveTo(1200, 30, { ms: 300 })
            await h.pause(900)
          },
          hold: 500,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'SvGrid enterprise', title: 'Chart the grid. Chart the pivot. Chart the sheet.', subtitle: 'PNG and SVG export, dashboards, one spec everywhere.', lines: ['<SvGrid charting />', 'svgrid.com/docs/help/charts'] })
      },
      beats: [{ say: 'Export to PNG or SVG, drop a chart on a dashboard, or chart a pivot or a sheet range. Charts at svgrid.com.', lead: 200 }],
    },
  ],
}
