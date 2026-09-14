/**
 * Tutorial: the Kanban board view. Recorded on demo 343-kanban-board.
 */
export default {
  id: 'kanban-board-drag',
  title: 'Kanban board mode in SvGrid',
  description: 'Render the same SvGrid as a Kanban board with one board prop: lanes from a status field, drag and drop between lanes, WIP limits, and a table view.',
  demo: '343-kanban-board',
  docsPage: 'docs/help/rows/kanban-board.md',
  anchorAfter: '<div data-docs-demo="343-kanban-board"',
  tags: ['kanban board', 'svelte kanban', 'drag and drop cards', 'board view'],
  gif: { beats: [1, 1] },

  async setup(page, h) {
    await page.waitForSelector('.sv-board-card', { timeout: 60_000 })
    await h.focusGrid()
    await h.pause(800)
  },

  beats: [
    {
      say: 'One board prop turns the grid into a Kanban board. Lanes come from the status field, and every card is a row.',
      lead: 600,
      async do(page, h) {
        await h.hover(page.locator('.sv-board-card').first())
      },
    },
    {
      say: 'Drag a card from Backlog into Review.',
      lead: 200,
      async do(page, h) {
        await h.dragHtml5(
          { selector: '.sv-board-card', within: { selector: '.sv-board-lane', text: /backlog/i } },
          { selector: '.sv-board-lane-body', within: { selector: '.sv-board-lane', text: /review/i } },
          { ms: 1200 },
        )
      },
      hold: 700,
    },
    {
      say: 'The drop writes the new status back to the row, so the data and the board never disagree. In progress carries a WIP limit and refuses a card past it.',
      lead: 300,
      async do(page, h) {
        await h.hover(page.locator('.sv-board-lane', { hasText: /in progress/i }).locator('.sv-board-lane-head').first())
      },
    },
    {
      say: 'Switch to Table, and the same rows show as a grid, with the card you moved already in Review.',
      lead: 300,
      async do(page, h) {
        await h.click(page.getByRole('button', { name: /^table$/i }).first())
        await h.gridReady(3)
      },
      hold: 800,
    },
  ],

  async verify(page) {
    const rows = await page.locator('.sv-grid-body [role="row"]').count()
    if (rows < 3) throw new Error(`table view shows ${rows} rows`)
    return `table view shows ${rows} rows`
  },
}
