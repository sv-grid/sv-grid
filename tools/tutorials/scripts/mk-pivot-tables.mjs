/** Marketing cut: pivot tables. YouTube only, 1920x1080. */
export default {
  id: 'mk-pivot-tables',
  kind: 'marketing',
  title: 'Pivot tables in the browser',
  description: 'SvPivotDesigner: drag fields into rows, columns and values, flip the same layout to a chart, or dock the designer beside a flat grid and switch pivot mode.',
  tags: ['pivot table', 'pivot designer', 'svelte pivot grid', 'data analysis', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'SvPivotDesigner', title: 'Pivot tables, without the export.', subtitle: 'Drag fields, read the answer, chart it. In the app.' })
      },
      beats: [{ say: 'A pivot table used to mean exporting to a spreadsheet. Not anymore.', lead: 200 }],
    },
    {
      demo: '168-pivot-designer',
      zoom: 1.4,
      hideIntro: 'self-contained pivot authoring',
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.pvd-field', { timeout: 60_000 })
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'Drag fields into rows, columns and values and the pivot recomputes on the spot.',
          lead: 300,
          async do(page, h) {
            await h.dragHtml5({ selector: '.pvd-field', text: /salesperson/i }, { selector: '.pvd-well', text: /^\s*rows\b/i }, { ms: 1000 })
            await h.pause(900)
            await h.dragHtml5({ selector: '.pvd-field', text: /profit/i }, { selector: '.pvd-well', text: /^\s*values\b/i }, { ms: 1000 })
            await h.pause(700)
          },
        },
        {
          say: 'Flip to Chart and the same layout draws itself.',
          lead: 200,
          async do(page, h) {
            await h.click(page.locator('.pvd-view-btn', { hasText: /chart/i }).first())
            await h.pause(1500)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '360-pivot-mode-grid',
      zoom: 1.4,
      hideIntro: 'enterprise pivot panel',
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.focusGrid()
        await page.locator('.pvd-pivot-toggle, .pvd-toggle').first().waitFor({ timeout: 30_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Or dock the designer beside a flat grid and flip pivot mode: same rows, two views, no second data source.',
          lead: 400,
          async do(page, h) {
            await h.toggle('.pvd-pivot-toggle, .pvd-toggle')
            await h.pause(2200)
            await h.park(undefined, undefined, { ms: 500 })
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
        await h.stage.show('end', { kicker: 'SvGrid enterprise', title: 'Subtotals, presets, export, server mode.', subtitle: 'The same designer over a million server-side rows.', lines: ['<SvPivotDesigner data columns fields />', 'svgrid.com/docs/help/pivot'] })
      },
      beats: [{ say: 'Subtotals and grand totals, saved presets, export, and a server mode for millions of rows. Pivot at svgrid.com.', lead: 200 }],
    },
  ],
}
