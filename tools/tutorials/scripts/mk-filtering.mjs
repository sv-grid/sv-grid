/** Marketing cut: filtering depth. YouTube only, 1920x1080. */
export default {
  id: 'mk-filtering',
  kind: 'marketing',
  title: 'Four ways to filter a Svelte data grid',
  description: 'Filtering in SvGrid: a quick filter row under the headers, the Excel-style value list, a visual condition builder, and set filters over large value lists.',
  tags: ['svelte data grid filtering', 'excel style filter', 'filter builder', 'floating filters', 'svelte 5'],
  poster: { beat: 2 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Filtering', title: 'Four ways to narrow a table.', subtitle: 'A filter row, a value list, a condition builder, and set filters.' })
      },
      beats: [{ say: 'Every team filters differently, so SvGrid ships four ways to do it on the same columns.', lead: 200 }],
    },
    {
      demo: '179-floating-filters',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'The filter row sits under the headers. Each cell knows its column type, and the funnel picks the operator.',
          lead: 400,
          async do(page, h) {
            const input = page.locator('.sv-grid-filter-row-control input').first()
            await h.click(input)
            await h.type('a', { delay: 140 })
            await h.pause(1200)
            await h.click(page.locator('.sv-grid-filter-operator-btn').first())
            await h.pause(1300)
            await h.press('Escape')
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '03-excel-filters',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'The column menu is the Excel-style one: a searchable value list with counts, ticked and unticked.',
          lead: 400,
          async do(page, h) {
            await h.clickHeaderFilter(/department/i)
            await page.waitForSelector('[role="listbox"][aria-label="Filter values"] [role="option"]', { timeout: 10_000 })
            await h.pause(700)
            const options = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
            await h.click(options.nth(1))
            await h.pause(700)
            await h.click(options.nth(2))
            await h.pause(600)
            await h.click(page.locator('.sv-grid-menu-btn-primary', { hasText: /done/i }).first())
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '98-advanced-filter-builder',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'For the hard questions there is a visual builder: nested AND and OR conditions across columns, saved as a query your users can reuse.',
          lead: 400,
          async do(page, h) {
            const presets = page.locator('button.preset')
            await h.click(presets.nth(0))
            await h.pause(1500)
            await h.click(presets.nth(3))
            await h.pause(1600)
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
        await h.stage.show('end', { kicker: 'Client or server', title: 'Same filters. Either side of the wire.', subtitle: 'The filter model serializes, so the server row model sends it as a query.', lines: ['filterMode="menu" · floatingFilter · setAdvancedFilter()', 'svgrid.com/docs/help/filtering/overview'] })
      },
      beats: [{ say: 'The same filter model serializes to the server when the data is too big for the browser. Filtering at svgrid.com.', lead: 200 }],
    },
  ],
}
