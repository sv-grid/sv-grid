/**
 * Tutorial: scrolling a million rows. Recorded on demo 78-million-rows.
 */
export default {
  id: 'million-rows-scroll',
  title: 'One million rows in SvGrid',
  description: 'Scroll a one million row Svelte data grid: row virtualization draws only the rows in view, with sorting, filtering and editing still on.',
  demo: '78-million-rows',
  docsPage: 'docs/help/benchmarks.md',
  anchor: '## Sort, filter, group',
  tags: ['virtualization', 'one million rows', 'svelte data grid performance', 'large dataset'],
  gif: { beats: [1, 2] },

  async setup(page, h) {
    await h.gridReady(10)
    await h.settleRowCount()
    await h.focusGrid()
    await h.pause(800)
  },

  beats: [
    {
      say: 'This SvGrid holds one million rows, generated in the browser, with sorting, filtering and inline editing switched on.',
      lead: 600,
      async do(page, h) {
        await h.park(undefined, undefined, { ms: 400 })
      },
    },
    {
      say: 'Rows are virtualized, so only the ones in view are drawn. Scroll, and the frame rate stays flat.',
      lead: 300,
      async do(page, h) {
        await h.easedScroll(0.35, 5200)
      },
    },
    {
      say: 'Jump anywhere in the set. The row numbers show the scale, and the grid keeps every row reachable.',
      lead: 300,
      async do(page, h) {
        await h.easedScroll(0.82, 4200)
      },
    },
    {
      say: 'Row and column virtualization are the same machinery, so wide grids get the same treatment. Nothing to configure.',
      lead: 300,
      async do(page, h) {
        await h.easedScroll(0.7, 2500)
      },
      hold: 500,
    },
  ],

  async verify(page) {
    const top = await page.evaluate(() => document.querySelector('.sv-grid-container')?.scrollTop ?? 0)
    if (top < 1000) throw new Error(`grid did not scroll (scrollTop ${top})`)
    return `scrollTop ${Math.round(top).toLocaleString()} px`
  },
}
