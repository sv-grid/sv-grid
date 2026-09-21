/** Marketing cut: Kanban boards. YouTube only, 1920x1080. */
export default {
  id: 'mk-kanban-boards',
  kind: 'marketing',
  title: 'Kanban boards on your rows',
  description: 'The SvGrid board prop: cards are rows, lanes are a field, swimlanes cross them with a second field, WIP limits hold, and cards get rich by config.',
  tags: ['kanban board', 'svelte kanban', 'swimlanes', 'wip limits', 'drag and drop', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'board prop', title: 'Kanban, on your rows.', subtitle: 'Cards are rows. Lanes are a field. The board is a prop.' })
      },
      beats: [{ say: 'Cards are rows. Lanes are a field. The board is a prop on the grid you already have.', lead: 200 }],
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
          say: 'Drag a card between lanes and the row behind it changes status.',
          lead: 400,
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
      demo: '344-kanban-sprint',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-board-card', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Swimlanes cross the lanes with a second field, here the assignee, and a WIP limit refuses a card past the line.',
          lead: 400,
          async do(page, h) {
            await h.hover(page.locator('.sv-board-lane-head', { hasText: /in progress/i }).first())
            await h.pause(700)
            await h.dragHtml5(
              { selector: '.sv-board-card', within: { selector: '.sv-board-lane', text: /to do/i } },
              { selector: '.sv-board-lane-body', within: { selector: '.sv-board-lane', text: /done/i } },
              { ms: 1100 },
            )
          },
          hold: 700,
        },
      ],
    },
    {
      demo: '349-kanban-subtasks',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-board-card', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Cards get rich by config alone: labels, avatars, sub-task progress, comments and attachments, no template code.',
          lead: 400,
          async do(page, h) {
            await h.hover(page.locator('.sv-board-card').nth(0))
            await h.pause(700)
            await h.hover(page.locator('.sv-board-card').nth(2))
            await h.pause(700)
            await h.hover(page.locator('.sv-board-card').nth(4))
          },
          hold: 600,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Ten board demos', title: 'Board today. Table tomorrow. Same rows.', subtitle: 'Virtualized lanes, keyboard drag and drop, filters, menus, hierarchy.', lines: ['board={{ groupBy: "status", lanes }}', 'svgrid.com/docs/help/rows/kanban-board'] })
      },
      beats: [{ say: 'Virtualized lanes, keyboard drag and drop, filters and card menus, epics with stories. Ten demos at svgrid.com.', lead: 200 }],
    },
  ],
}
