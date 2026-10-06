/**
 * C1: "A Gantt chart in Svelte", for the query that already shows up in Search
 * Console with nothing good to answer it - "gantt chart svelte" and
 * "customizable gantt chart in svelte" sit at position 39 to 70, and no Svelte
 * library ships one.
 *
 * HELD UNTIL 2026-11-01. tools/lib/releases.mjs gates every Gantt demo, doc and
 * route until that date, and `registry.ts` filters the demos out of the gallery
 * until then, so this could not be recorded in advance at all. The `today`
 * field below is the documented browser override (`globalThis.__SVGRID_TODAY__`,
 * set before the app's modules load), which makes the demos visible to THIS
 * recording context only. Nothing on disk or on the site changes.
 *
 * Recording early is fine; publishing early is not. Do not upload this before
 * 2026-11-01.
 */
export default {
  id: 'mk-svelte-gantt-chart',
  kind: 'marketing',
  title: 'A Gantt chart in Svelte, from the same data grid',
  description: 'Nested phases, dependency arrows, a critical path and 640 tasks: the Gantt is one more renderer behind the SvGrid you already have.',
  tags: ['svelte gantt chart', 'gantt chart svelte', 'svelte project plan', 'critical path', 'svelte 5', 'data grid'],
  view: { width: 1920, height: 1080 },
  // Record the release-gated Gantt demos ahead of their date. See the note above.
  today: '2026-11-01',
  poster: { beat: 2 },
  gif: { beats: [2] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Gantt',
          title: 'A Gantt chart in Svelte.',
          subtitle: 'Not a second library. One more renderer.',
        })
      },
      beats: [
        {
          say: 'If you have gone looking for a Gantt chart in Svelte, you will have found wrappers around something written for another framework, or nothing at all. This is one that is native, and it is not a separate component: it is the data grid you already have, drawing its rows on a timeline.',
          lead: 300,
        },
      ],
    },

    {
      demo: '474-gantt-intro',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-gantt-bar', { timeout: 40_000 })
        await h.pause(1000)
      },
      beats: [
        {
          say: 'Here is a fourteen week release plan. The table on the left is a normal grid, with the normal grid things: a tree of phases, columns you sort and edit. On the right those same rows are bars on a calendar. Phases nest their tasks and draw a rolled up summary bar above them, and the arrows between bars are real finish to start dependencies, not decoration.',
          lead: 350,
          async do(page, h) {
            const bars = await page.locator('.sv-gantt-bar').count()
            const summaries = await page.locator('.sv-gantt-bar-summary').count()
            if (bars < 3) throw new Error(`the Gantt rendered ${bars} bars`)
            // The beat claims phases roll up into a summary bar, so that is the
            // thing to assert, not just that some bars exist.
            if (summaries < 1) throw new Error(`no rolled-up summary bar on screen (${bars} bars, ${summaries} summaries)`)
            h.log(`gantt intro: ${bars} bars, ${summaries} rolled-up phase summaries`)
            await h.callout(page.locator('.sv-gantt-bar-summary').first(), 'a phase, rolled up from its tasks', { hold: 1500 })
            await h.clearCallout()
            await h.pause(600)
          },
          hold: 400,
        },
      ],
    },

    {
      demo: '476-gantt-critical-path',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-gantt-bar', { timeout: 40_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Because the links are real, the chart can work out which chain of tasks has no slack in it. That is the critical path, marked here in red: the tasks where a day lost is a day lost on the whole project. There is a slack column beside it with the number of days each task can move before it starts to matter, and a baseline to compare the plan against what you first said it would be.',
          lead: 350,
          async do(page, h) {
            const critical = page.locator('.sv-gantt-critical')
            const n = await critical.count()
            if (n < 1) throw new Error('no critical-path bars on screen: this beat is about them')
            h.log(`critical path: ${n} bars with no slack`)
            await h.callout(critical.first(), 'no slack: a day lost here is a day lost on the project', { hold: 1700 })
            await h.clearCallout()
            await h.pause(700)
          },
          hold: 400,
        },
      ],
    },

    {
      demo: '480-gantt-program',
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-gantt-bar', { timeout: 60_000 })
        await h.pause(1400)
      },
      beats: [
        {
          say: 'And it holds up at the size real programmes actually are. This is a fibre roll out: forty sites, sixteen linked tasks each, six hundred and forty tasks and six hundred links in one chart, scrolling. The same virtualization that makes the table fast is what is drawing the timeline, so the bars are only built for the rows you can see.',
          lead: 350,
          async do(page, h) {
            // The Gantt scrolls its own pane, not the grid's: the helper
            // defaults to .sv-grid-container, which this demo does not have.
            const bars = () => page.locator('.sv-gantt-bar').count()
            const before = await bars()
            await h.easedScrollBy(1800, 2400, '.sv-gantt-scroll')
            await h.pause(900)
            h.log(`programme scale: ${before} bars built for the visible rows, scrolled through 640 tasks`)
            await h.pause(600)
          },
          hold: 400,
        },
      ],
    },

    {
      demo: '478-gantt-four-views',
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-gantt-bar', { timeout: 40_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Which leads to the part that matters more than any single feature. This is one grid, one array of rows, and four renderers behind a switch: the plain table, the Gantt, a scheduler and a Kanban board. Watch the data stay put while the view changes. Nobody has to pick the right component up front, and nothing has to be kept in sync, because there is one source of rows and the view is a prop.',
          lead: 350,
          async do(page, h) {
            // Actually switch. The sentence is about one dataset behind four
            // renderers, and the only way a frame supports that is to change
            // the view and show the same plan arrive in another shape.
            const seg = page.locator('.sv-seg__opt')
            // Substring, not an anchored regex. The label sits in a nested span
            // with whitespace around it, so /^Kanban$/ matches nothing - the
            // same trap as the ribbon buttons. The four labels are distinct, so
            // a substring is unambiguous.
            const pick = async (label) => {
              await seg.filter({ hasText: label }).first().click()
              await h.pause(1600)
            }
            await h.callout(seg.first().locator('xpath=..'), 'one dataset, four renderers', { hold: 1300 })
            await h.clearCallout()
            await pick('Kanban')
            const cards = await page.locator('.sv-board-card').count()
            if (cards < 2) throw new Error(`switching to Kanban rendered ${cards} cards`)
            h.log(`four views: Kanban shows ${cards} cards`)
            await pick('Grid')
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 2) throw new Error(`switching to Grid rendered ${rows} rows`)
            h.log(`four views: Grid shows ${rows} rows`)
            await h.pause(900)
          },
          hold: 400,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'Enterprise',
          title: 'gantt={...}',
          subtitle: 'The renderer is Enterprise. The grid underneath is MIT on npm.',
          lines: ['svgrid.com/docs/help/gantt'],
        })
      },
      beats: [
        {
          say: 'The Gantt renderer is part of the Enterprise pack, and like the rest of it you can install and run it without a key to see whether it fits. The grid underneath is MIT on npm. If you have been putting off a project plan screen because there was nothing to build it with in Svelte, there is now.',
          lead: 300,
        },
      ],
    },
  ],
}
