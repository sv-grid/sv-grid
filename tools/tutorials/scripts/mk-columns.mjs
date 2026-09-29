/** Marketing cut: column control. YouTube only, 1920x1080. */
export default {
  id: 'mk-columns',
  kind: 'marketing',
  title: 'Columns your users can rearrange',
  description: 'Pin, reorder, resize and group columns in SvGrid, and dock a tool panel so users can show, hide and group them without you writing a settings screen.',
  tags: ['column pinning', 'column groups', 'tool panel', 'svelte data grid', 'resizable columns', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Column control', title: 'Columns your users can rearrange.', subtitle: 'Pinned, reordered, resized and grouped, without a settings screen.' })
      },
      beats: [{ say: 'A wide table is only useful if the columns that matter stay put. SvGrid gives that control to the user.', lead: 200 }],
    },
    {
      demo: '25-column-pinning',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Pin a column left or right and it stays while the rest slide under it. Pinning is a column option, or a choice in the header menu.',
          lead: 400,
          async do(page, h) {
            await h.easedScrollX(0.55, 2600)
            await h.pause(600)
            await h.easedScrollX(0.05, 1800)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '109-column-reorder-engine',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Drag a header to reorder, drag its edge to resize, and both land in the column state you can save and restore.',
          lead: 400,
          async do(page, h) {
            await h.dragHtml5(
              { selector: '[role="columnheader"]', text: /sector/i },
              { selector: '[role="columnheader"]', text: /symbol/i },
              { ms: 1100 },
            )
            await h.pause(1200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '146-tool-panel',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Switch on the tool panel and users get the whole thing themselves: show and hide columns, reorder them, group by one, all from a docked sidebar.',
          lead: 400,
          async do(page, h) {
            const checks = page.locator('.sv-grid-tool-panel input[type="checkbox"]')
            if (await checks.count()) {
              await h.click(checks.nth(2))
              await h.pause(900)
              await h.click(checks.nth(3))
              await h.pause(900)
              await h.click(checks.nth(2))
            }
            await h.pause(800)
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
        await h.stage.show('end', { kicker: 'Column state', title: 'Save the layout. Restore it on load.', subtitle: 'Pinning, order, width, visibility and groups are one serializable object.', lines: ['api.getColumnState() / setColumnState()', 'svgrid.com/docs/help/columns/column-state'] })
      },
      beats: [{ say: 'The whole layout is one object you can store per user and restore on load. Columns at svgrid.com.', lead: 200 }],
    },
  ],
}
