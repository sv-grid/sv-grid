/**
 * Tutorial: pivot mode on a flat grid. Recorded on demo 360-pivot-mode-grid.
 */
export default {
  id: 'pivot-mode-toggle',
  title: 'Pivot mode in SvGrid',
  description: 'Dock the pivot designer beside a flat SvGrid with panelPosition right and flip Pivot mode: the same rows become a pivot table with heat-mapped measures.',
  demo: '360-pivot-mode-grid',
  docsPage: 'docs/help/pivot.md',
  anchorAfter: '<div data-docs-demo="360-pivot-mode-grid"',
  tags: ['pivot mode', 'pivot table', 'svelte pivot grid', 'docked tool panel'],
  hideIntro: 'enterprise pivot panel',
  gif: { beats: [1, 2] },

  async setup(page, h) {
    await h.gridReady(3)
    await h.focusGrid()
    await page.locator('.pvd-pivot-toggle, .pvd-toggle').first().waitFor({ timeout: 30_000 })
    await h.pause(1500)
  },

  beats: [
    {
      say: 'With panelPosition set to right, the pivot designer docks beside the grid. The flat rows stay editable, sortable and filterable.',
      lead: 600,
      async do(page, h) {
        await h.hover('.pvd-pivot-toggle, .pvd-toggle')
      },
    },
    {
      say: 'Flip the Pivot mode switch.',
      lead: 200,
      async do(page, h) {
        await h.toggle('.pvd-pivot-toggle, .pvd-toggle')
        await h.pause(2200)
        const pivoted = await page.evaluate(() =>
          ![...document.querySelectorAll('[role="columnheader"]')].some((el) => /^\s*Name\s*$/.test(el.textContent ?? '')),
        )
        if (!pivoted) throw new Error('the grid did not switch into pivot layout')
      },
      hold: 300,
    },
    {
      say: 'The same grid becomes a pivot table. Rows and columns come from the wells, and the measures are heat-mapped by value.',
      lead: 300,
      async do(page, h) {
        await h.park(undefined, undefined, { ms: 700 })
      },
    },
    {
      say: 'Flip it back, and the flat rows return with their state intact. One grid, two views, no second data source.',
      lead: 400,
      async do(page, h) {
        await h.toggle('.pvd-pivot-toggle, .pvd-toggle')
        await h.pause(1800)
      },
      hold: 500,
    },
  ],

  async verify(page) {
    const flat = await page.evaluate(() =>
      [...document.querySelectorAll('[role="columnheader"]')].some((el) => /^\s*Name\s*$/.test(el.textContent ?? '')),
    )
    if (!flat) throw new Error('the grid did not return to the flat layout')
    return 'flat layout restored'
  },
}
