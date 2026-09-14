/**
 * Tutorial: the Excel-style fill handle. Recorded on demo 95-fill-handle.
 */
export default {
  id: 'fill-handle',
  title: 'Excel-style fill handle in SvGrid',
  description: 'Select a range, drag the corner fill handle, and SvGrid continues the series: numbers, weekdays and dates, or a plain copy for a single cell.',
  demo: '95-fill-handle',
  docsPage: 'docs/help/editing/overview.md',
  anchorAfter: '<div data-docs-demo="95-fill-handle"',
  tags: ['fill handle', 'autofill', 'spreadsheet grid', 'svelte data grid editing'],
  hideIntro: 'hover the bottom-right corner',
  // The table is ~980 css px wide; 1.25 overflows the frame and a drag toward
  // the right edge auto-scrolls it, clipping the first column.
  zoom: 1.15,
  gif: { beats: [0, 1] },

  async setup(page, h) {
    await h.gridReady(5)
    await h.focusGrid()
    await h.pause(700)
  },

  beats: [
    {
      say: 'With cell selection on, every range gets a fill handle at its corner. Select the two seed cells of the numeric series.',
      lead: 1200,
      async do(page, h) {
        await h.clickCell(1, /source 1/i)
        await h.pause(250)
        await h.clickCell(1, /source 2/i, { modifiers: ['Shift'] })
      },
      hold: 300,
    },
    {
      say: 'Drag the handle to the right. Ten and twenty become a series in steps of ten, filled as far as you drag.',
      lead: 300,
      async do(page, h) {
        await h.dragFillHandle({ cells: 6 })
      },
      hold: 500,
    },
    {
      say: 'Weekdays and dates continue the same way. A single seed switches to copy mode and repeats the value.',
      lead: 300,
      async do(page, h) {
        await h.clickCell(4, /source 1/i)
        await h.pause(250)
        await h.clickCell(4, /source 2/i, { modifiers: ['Shift'] })
        await h.pause(300)
        await h.dragFillHandle({ cells: 5 })
      },
      hold: 500,
    },
    {
      say: 'Every filled cell goes through the normal edit pipeline, so validation and change tracking still apply.',
      lead: 300,
      async do(page, h) {
        await h.park()
      },
      hold: 300,
    },
  ],

  async verify(page) {
    const filled = await page.evaluate(() => {
      const row = document.querySelectorAll('.sv-grid-body [role="row"]')[1]
      return [...(row?.querySelectorAll('[role="gridcell"]') ?? [])].map((c) => c.textContent.trim()).filter(Boolean).length
    })
    if (filled < 6) throw new Error(`series row has only ${filled} non-empty cells`)
    return `${filled} filled cells on the series row`
  },
}
