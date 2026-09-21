/**
 * Marketing cut: SvGrid in 60 seconds. Title card, six features on the real
 * demos, end card. Published on YouTube only (kind: 'marketing'), recorded at
 * 1920x1080; every demo segment names its own zoom because the demos are laid
 * out for ~1000-1300 css px.
 */
export default {
  id: 'svgrid-in-60-seconds',
  kind: 'marketing',
  title: 'SvGrid in 60 seconds',
  description: 'The Svelte 5 data grid: a million rows, Excel-style filters, inline editing, pivot mode, a Kanban board and charts, all from one component.',
  tags: ['svelte data grid', 'svelte 5', 'svelte table', 'data grid', 'kanban', 'pivot table', 'charts'],
  gif: { beats: [1, 2] },
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Svelte 5 native', title: 'The data grid that is also a board, a pivot and a chart.', subtitle: 'SvGrid, in sixty seconds.' })
      },
      beats: [
        { say: 'This is SvGrid, a data grid written for Svelte 5. One component, sixty seconds.', lead: 200 },
      ],
    },
    {
      demo: '78-million-rows',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(10)
        await h.settleRowCount()
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'It starts with scale. A million rows in the browser, virtualized, sorted, filtered and edited in place.',
          lead: 300,
          async do(page, h) {
            await h.easedScroll(0.4, 4200)
          },
          hold: 300,
        },
      ],
    },
    {
      demo: '03-excel-filters',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Filters work the way spreadsheet users expect: a menu on every column with a searchable value list.',
          lead: 600,
          async do(page, h) {
            await h.clickHeaderFilter(/department/i)
            await page.waitForSelector('[role="listbox"][aria-label="Filter values"] [role="option"]', { timeout: 10_000 })
            await h.pause(700)
            const options = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
            await h.click(options.nth(1))
            await h.pause(600)
            await h.click(options.nth(2))
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '05-inline-editing',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Editing is one prop. Double-click, type, Enter. Text, numbers, dropdowns, dates and checkboxes each get the right editor.',
          lead: 500,
          async do(page, h) {
            await h.dblclickCell(1, /first name/i)
            await h.type('Margaret', { delay: 90 })
            await h.pause(300)
            await h.press('Enter')
            await h.pause(700)
            await h.dblclickCell(2, /department/i)
            await page.waitForSelector('.sv-grid-dropdown-option', { timeout: 10_000 })
            await h.pause(600)
            await h.click(page.locator('.sv-grid-dropdown-option', { hasText: /sales/i }).first())
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
          say: 'Flip pivot mode and the same rows become a pivot table, with the designer docked beside them.',
          lead: 400,
          async do(page, h) {
            await h.toggle('.pvd-pivot-toggle, .pvd-toggle')
            await h.pause(2200)
            await h.park(undefined, undefined, { ms: 500 })
          },
          hold: 600,
        },
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
          say: 'Or a Kanban board. Lanes come from a status field, and a drop writes the row back.',
          lead: 500,
          async do(page, h) {
            await h.dragHtml5(
              { selector: '.sv-board-card', within: { selector: '.sv-board-lane', text: /backlog/i } },
              { selector: '.sv-board-lane-body', within: { selector: '.sv-board-lane', text: /review/i } },
              { ms: 1100 },
            )
          },
          hold: 700,
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
          say: 'Charts read the rows on screen. Click a bar to filter the grid to that category.',
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
        await h.stage.show('end', { kicker: 'MIT core, enterprise pack', title: 'One grid. Every view.', subtitle: 'Headless-first. Render-ready.', lines: ['npm install @svgrid/grid', 'svgrid.com'] })
      },
      beats: [
        { say: 'The core is MIT. The pivot, board, charts and spreadsheet ship in the enterprise pack. Start at svgrid.com.', lead: 200 },
      ],
    },
  ],
}
