/** Marketing cut: real-time grids. YouTube only, 1920x1080. */
export default {
  id: 'mk-live-data',
  kind: 'marketing',
  title: 'Live data without the flicker',
  description: 'Real-time on SvGrid: a ticking price feed that flashes what moved, sensor rows regrouped on the fly, and a server-side transaction stream applied in batches.',
  tags: ['real time data grid', 'live updates', 'websocket grid', 'transactions', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Real-time grids', title: 'Live data, without the flicker.', subtitle: 'Prices, sensors, transactions: rows that change every second.' })
      },
      beats: [{ say: 'Prices, sensors, transactions. Rows that change every second, in a grid that does not blink.', lead: 200 }],
    },
    {
      demo: '11-stock-market',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'A ticking feed updates cells in place and flashes what moved, while sorting and filtering stay applied.',
          lead: 400,
          async do(page, h) {
            await h.hover(page.locator('.sv-grid-body [role="row"]').nth(3).locator('[role="gridcell"]').nth(2))
            await h.pause(2500)
            await h.click(page.locator('[role="columnheader"]', { hasText: /change|last/i }).first())
            await h.pause(1500)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '14-industrial',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        // The demo opens grouped by line: four collapsed group rows.
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Sensor rows with thresholds driving the colours and sparklines tracking the trend, regrouped by status on the fly.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.iot-btn', { hasText: /^None$/ }).first())
            await h.pause(2200)
            await h.click(page.locator('.iot-btn', { hasText: /^Status$/ }).first())
            await h.pause(1200)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '470-server-transactions',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Server-side too: a transaction stream applies inserts, updates and removes to a row model the browser does not own, in batches.',
          lead: 400,
          async do(page, h) {
            await h.hover(page.locator('.sv-grid-body [role="row"]').nth(2))
            await h.pause(2500)
            await h.easedScroll(0.2, 2000)
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
        await h.stage.show('end', { kicker: 'Transactions', title: 'Batched updates. Sixty frames.', subtitle: 'applyTransaction for the browser, a transaction stream for the server.', lines: ['api.applyTransactionAsync({ update })', 'svgrid.com/docs/help/rows/transactions'] })
      },
      beats: [{ say: 'Batched transactions keep the frame rate whatever the feed does. Real-time at svgrid.com.', lead: 200 }],
    },
  ],
}
