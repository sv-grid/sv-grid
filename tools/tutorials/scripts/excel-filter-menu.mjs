/**
 * Tutorial: the Excel-style filter menu. Recorded on demo 03-excel-filters.
 */
export default {
  id: 'excel-filter-menu',
  title: 'Excel-style filter menu in SvGrid',
  description: 'Set filterMode to menu and every column gets an Excel-style filter: a searchable value list with checkboxes that re-filters the grid as you tick.',
  demo: '03-excel-filters',
  docsPage: 'docs/help/filtering/overview.md',
  anchorAfter: '<div data-docs-demo="03-excel-filters"',
  tags: ['excel filter', 'column filter menu', 'svelte data grid filtering', 'filter by value'],
  gif: { beats: [0, 1] },

  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await h.pause(700)
  },

  beats: [
    {
      say: 'Set filterMode to menu, and each column header shows a filter button on hover. Click it to open the menu.',
      lead: 1400,
      async do(page, h) {
        await h.clickHeaderFilter(/department/i)
        await page.waitForSelector('[role="listbox"][aria-label="Filter values"] [role="option"]', { timeout: 10_000 })
      },
      hold: 300,
    },
    {
      say: 'The menu lists every distinct value. Untick one, and the grid re-filters right away.',
      lead: 300,
      async do(page, h) {
        const options = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
        await h.click(options.nth(1))
        await h.pause(900)
        await h.click(options.nth(2))
      },
      hold: 400,
    },
    {
      say: 'Long value lists have a search box. Type a few letters to narrow the choices.',
      lead: 300,
      async do(page, h) {
        await h.click('.sv-grid-menu-search')
        await h.type('sa', { delay: 140 })
      },
      hold: 600,
    },
    {
      say: 'Done closes the menu. The filtered column keeps its marker, and Clear filter in the same menu resets it.',
      lead: 300,
      async do(page, h) {
        await h.click(page.locator('.sv-grid-menu-btn-primary', { hasText: /done/i }).first())
      },
      hold: 500,
    },
  ],

  async verify(page) {
    const rows = await page.locator('.sv-grid-body [role="row"]').count()
    if (rows < 1) throw new Error('grid is empty after filtering')
    return `${rows} rows rendered after the filter`
  },
}
