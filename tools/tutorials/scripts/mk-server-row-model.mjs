/** Marketing cut: the Server-Side Row Model. YouTube only, 1920x1080. */
export default {
  id: 'mk-server-row-model',
  kind: 'marketing',
  title: 'The Server-Side Row Model',
  description: 'A million rows that stay on the server: SvGrid turns scrolling, grouping, tree expansion and pivoting into requests your backend answers.',
  tags: ['server side row model', 'svelte data grid', 'server side grouping', 'lazy loading', 'enterprise grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Server-Side Row Model', title: 'A million rows that stay on the server.', subtitle: 'One rowModel prop. Scroll, group, expand and pivot become requests.' })
      },
      beats: [{ say: 'When the data cannot fit in the browser, the grid asks the server for exactly what it shows.', lead: 200 }],
    },
    {
      demo: '467-server-row-model-1m',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'Scrolling fetches blocks on demand. Grouping is a request too: the server returns the groups, and each opens lazily.',
          lead: 300,
          async do(page, h) {
            await h.easedScroll(0.3, 3200)
            await h.pause(400)
            await h.click(page.locator('[aria-label="Grouping"] button', { hasText: /^Region$/ }).first())
            await h.pause(1400)
            await h.click(page.locator('[aria-label="Grouping"] button', { hasText: /Country/ }).first())
            await h.pause(1200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '469-server-tree-data',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(2)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'A file tree the grid never holds whole. Expanding a folder is one call with the folder as the parent.',
          lead: 300,
          async do(page, h) {
            await h.click(page.locator('.sv-grid-body .sv-group-cell[aria-expanded="false"]:visible').first())
            await h.pause(1200)
            await h.click(page.locator('.sv-grid-body .sv-group-cell[aria-expanded="false"]:visible').first())
            await h.pause(900)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '468-server-pivot',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(2)
        await h.focusGrid()
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Even the pivot runs on the server: one request per layout. Expand a region and the pivot repeats per country beneath it.',
          lead: 300,
          async do(page, h) {
            await h.click(page.locator('.sv-grid-body .sv-group-cell[aria-expanded="false"]:visible').first())
            await h.pause(1800)
            await h.click(page.locator('.sv-grid-body .sv-group-cell[aria-expanded="false"]:visible').nth(1))
            await h.pause(1400)
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
        await h.stage.show('end', { kicker: 'One contract', title: 'You implement getRows. The grid does the rest.', subtitle: 'Sort, filter, group, pivot, tree, selection and transactions, all through one request shape.', lines: ['rowModel={createServerRowModel({ getRows })}', 'svgrid.com/docs/help/server-side-data'] })
      },
      beats: [{ say: 'One getRows function against any backend, and a planner that turns each request into SQL. Details at svgrid.com.', lead: 200 }],
    },
  ],
}
