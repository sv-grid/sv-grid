/**
 * Marketing cut: the same rows as a table, a board, a calendar, a pivot and a
 * chart. YouTube only, 1920x1080.
 */
export default {
  id: 'one-grid-many-views',
  kind: 'marketing',
  title: 'One grid, five views',
  description: 'SvGrid renders the same rows as a table, a Kanban board, a calendar, a pivot table and a chart. Same data, same columns, one prop per view.',
  tags: ['svelte data grid', 'kanban board', 'calendar view', 'pivot table', 'charts', 'svelte 5'],
  gif: { beats: [1, 2] },
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Same rows, same columns', title: 'One grid. Five views.', subtitle: 'A board, a calendar, a pivot and a chart are props on the same component.' })
      },
      beats: [
        { say: 'Most apps end up with a table, a board and a calendar over the same records, and three components to keep in sync. SvGrid has one.', lead: 200 },
      ],
    },
    {
      demo: '343-kanban-board',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-board-card', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'The board prop turns rows into cards and a status field into lanes. Drag a card, and the row changes.',
          lead: 400,
          async do(page, h) {
            await h.dragHtml5(
              { selector: '.sv-board-card', within: { selector: '.sv-board-lane', text: /backlog/i } },
              { selector: '.sv-board-lane-body', within: { selector: '.sv-board-lane', text: /review/i } },
              { ms: 1100 },
            )
          },
          hold: 400,
        },
        {
          say: 'Switch to Table, and it is the same grid with the same rows, the moved card already in Review.',
          lead: 200,
          async do(page, h) {
            await h.click(page.getByRole('button', { name: /^table$/i }).first())
            await h.gridReady(3)
          },
          hold: 700,
        },
      ],
    },
    {
      demo: '363-scheduler-intro',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-sched-toolbar', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'The scheduler prop renders the rows as a calendar: month, week, day and agenda, with drag to move and resize.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Day$/ }).first())
            await h.pause(1300)
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Week$/ }).first())
          },
          hold: 600,
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
          say: 'Pivot mode summarizes the same rows by any dimension, with a designer docked beside the grid.',
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
      demo: '353-built-in-charting',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await page.waitForSelector('.sv-grid-chart-panel', { timeout: 30_000 })
        await h.pause(1000)
      },
      beats: [
        {
          say: 'And the charting prop draws what is on screen. Filter the grid, the chart follows; click the chart, the grid follows.',
          lead: 400,
          async do(page, h) {
            await h.selectOption({ label: /^type$/i }, 'bar')
            await h.selectOption({ label: /^group by$/i }, 'region')
            await h.pause(700)
            await h.click(page.locator('.sv-grid-chart-panel .sv-grid-chart-cat-hit').nth(1), { ms: 600 })
            await h.pause(1000)
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
        await h.stage.show('end', { kicker: 'One data model', title: 'Table, board, calendar, pivot, chart.', subtitle: 'Sort, filter, select and edit once. Every view agrees.', lines: ['npm install @svgrid/grid', 'svgrid.com/demos'] })
      },
      beats: [
        { say: 'One data model, one set of columns, one component. The views are props. See them all at svgrid.com.', lead: 200 },
      ],
    },
  ],
}
