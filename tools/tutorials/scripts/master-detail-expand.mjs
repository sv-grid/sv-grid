/**
 * Tutorial: master/detail rows. Recorded on demo 181-master-detail-grid.
 */
export default {
  id: 'master-detail-expand',
  title: 'Master detail rows in SvGrid',
  description: 'Expand a row into a nested detail grid with two props, isDetailRow and renderDetailRow: the detail is a real row, so scrolling and virtualization still apply.',
  demo: '181-master-detail-grid',
  docsPage: 'docs/help/rows/master-detail.md',
  anchorAfter: '<div data-docs-demo="181-master-detail-grid"',
  tags: ['master detail', 'nested grid', 'expandable rows', 'svelte data grid'],
  gif: { beats: [1, 1] },

  async setup(page, h) {
    await h.gridReady(3)
    await h.focusGrid()
    await h.pause(700)
  },

  beats: [
    {
      say: 'Master detail in SvGrid is two props. isDetailRow marks a row as a detail, and renderDetailRow draws whatever you like inside it.',
      lead: 600,
      async do(page, h) {
        await h.hover(page.locator('.sv-grid-detail-toggle[aria-expanded="false"]').first())
      },
    },
    {
      say: 'Click the chevron on an account to expand its call records, a nested grid with its own sorting.',
      lead: 200,
      async do(page, h) {
        await h.click(page.locator('.sv-grid-detail-toggle[aria-expanded="false"]').first())
      },
      hold: 700,
    },
    {
      say: 'Expand as many as you like. Each detail is a real row in the grid, so keyboard navigation and virtualization keep working.',
      lead: 400,
      async do(page, h) {
        await h.click(page.locator('.sv-grid-detail-toggle[aria-expanded="false"]').first())
      },
      hold: 600,
    },
    {
      say: 'Click the chevron again to collapse. The expanded set is plain state, so you can save and restore it.',
      lead: 300,
      async do(page, h) {
        await h.click(page.locator('.sv-grid-detail-toggle[aria-expanded="true"]').first())
      },
      hold: 600,
    },
  ],

  async verify(page) {
    const open = await page.locator('.sv-grid-detail-toggle[aria-expanded="true"]').count()
    if (open < 1) throw new Error('no expanded rows remain')
    return `${open} expanded row(s)`
  },
}
