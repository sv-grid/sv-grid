/**
 * Tutorial: building a pivot by drag and drop. Recorded on demo 168-pivot-designer.
 */
export default {
  id: 'pivot-designer-drag',
  title: 'Pivot designer in SvGrid',
  description: 'Drag fields into the Rows, Columns and Values wells of SvPivotDesigner and watch the pivot grid recompute: a self-contained pivot builder for Svelte.',
  demo: '168-pivot-designer',
  docsPage: 'docs/help/pivot.md',
  anchorAfter: '<div data-docs-demo="168-pivot-designer"',
  tags: ['pivot table', 'pivot designer', 'svelte pivot grid', 'drag and drop fields'],
  hideIntro: 'self-contained pivot authoring',
  gif: { beats: [1, 2] },

  async setup(page, h) {
    await page.waitForSelector('.pvd-field', { timeout: 60_000 })
    await h.gridReady(3)
    await h.focusGrid()
    await h.pause(1000)
  },

  beats: [
    {
      say: 'SvPivotDesigner is a pivot builder in one component: a field list on the left and drop wells for filters, columns, rows and values.',
      lead: 600,
      async do(page, h) {
        await h.hover(page.locator('.pvd-field', { hasText: /salesperson/i }).first())
      },
    },
    {
      say: 'Drag Salesperson into the Rows well.',
      lead: 200,
      async do(page, h) {
        await h.dragHtml5({ selector: '.pvd-field', text: /salesperson/i }, { selector: '.pvd-well', text: /^\s*rows\b/i }, { ms: 1100 })
      },
      hold: 600,
    },
    {
      say: 'The pivot grid recomputes at once, one row per salesperson, with the measures summed across the columns.',
      lead: 300,
      async do(page, h) {
        await h.park(undefined, undefined, { ms: 600 })
      },
    },
    {
      say: 'Measures work the same way. Drop Profit into Values, and click its chip to switch the aggregator between sum, average, count and more.',
      lead: 300,
      async do(page, h) {
        await h.dragHtml5({ selector: '.pvd-field', text: /profit/i }, { selector: '.pvd-well', text: /^\s*values\b/i }, { ms: 1100 })
      },
      hold: 700,
    },
  ],

  async verify(page) {
    const ok = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.pvd-well')].find((w) => /rows/i.test(w.querySelector('.pvd-well-head')?.textContent ?? ''))
      return /salesperson/i.test(rows?.textContent ?? '')
    })
    if (!ok) throw new Error('Salesperson did not land in the Rows well')
    return 'Rows well holds Salesperson'
  },
}
