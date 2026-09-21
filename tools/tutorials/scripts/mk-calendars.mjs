/** Marketing cut: the scheduler views. YouTube only, 1920x1080. */
export default {
  id: 'mk-calendars',
  kind: 'marketing',
  title: 'A calendar view for grid rows',
  description: 'The SvGrid scheduler prop: month, week, day and agenda over the same rows, resource timelines, and a full calendar client built from the parts.',
  tags: ['svelte calendar', 'scheduler', 'timeline', 'resource scheduling', 'svelte data grid', 'svelte 5'],
  poster: { beat: 1 },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'scheduler prop', title: 'A calendar view for grid rows.', subtitle: 'Events are rows with a start and an end. The calendar is a view.' })
      },
      beats: [{ say: 'Events are rows with a start and an end. The calendar is one more view of the grid.', lead: 200 }],
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
          say: 'Month, week, day and agenda over the same rows, with drag to move and resize, and every change flowing back to the row.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Week$/ }).first())
            await h.pause(1400)
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Agenda$/ }).first())
            await h.pause(1000)
          },
          hold: 500,
        },
      ],
    },
    {
      demo: '371-scheduler-timeline',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-sched-toolbar', { timeout: 60_000 })
        await h.focusGrid()
        await h.pause(800)
      },
      beats: [
        {
          say: 'Timelines put resources in rows and time across: teams, rooms, machines.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-sched-btn', { hasText: /Day/ }).first())
            await h.pause(1500)
            await h.click(page.locator('.sv-sched-btn', { hasText: /Week/ }).first())
          },
          hold: 700,
        },
      ],
    },
    {
      demo: '381-scheduler-app-calendar',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-sched-toolbar', { timeout: 90_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Compose it with the dock layout and a navigation pane, and you have a full calendar client.',
          lead: 400,
          async do(page, h) {
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Month$/ }).first())
            await h.pause(1400)
            await h.click(page.locator('.sv-sched-btn', { hasText: /^Week$/ }).first())
          },
          hold: 700,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.6,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'SvGrid enterprise', title: 'Recurrence, drafts, ICS, resources.', subtitle: 'One row model behind the table, the board and the calendar.', lines: ['scheduler={{ startField, endField, titleField }}', 'svgrid.com/docs/help/rows/scheduler'] })
      },
      beats: [{ say: 'Recurring events, drafts, ICS import and export, resource views. Calendars at svgrid.com.', lead: 200 }],
    },
  ],
}
