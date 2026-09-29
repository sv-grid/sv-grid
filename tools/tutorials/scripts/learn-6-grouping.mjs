/**
 * Course lesson 6: grouping rows and totalling them.
 * Code and result are the runnable block from docs/help/grouping-aggregation.md.
 */
import { typeLines, reveal, SNIPPET_ROW } from '../lib/lesson.mjs'

const SNIPPET = 'help-grouping-aggregation--11'

export default {
  id: 'learn-6-grouping',
  kind: 'course',
  title: 'Learn SvGrid 6: grouping and totals',
  description: 'Lesson six of the SvGrid course: group rows by a column, average and sum per group with the aggregate option, and add a summary row for the whole table.',
  docsPage: 'docs/help/grouping-aggregation.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'row grouping', 'aggregation', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 6', title: 'Group it. Total it.', subtitle: 'One prop to group, one option per column to aggregate.' })
      },
      beats: [
        { say: 'Once a table has more than a screenful of rows, people stop reading it and start asking it questions. Grouping and totals are how it answers.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/App.svelte', code: '' })
      },
      beats: [
        {
          say: 'The same people as before, with a department and a city to group by, and a salary worth adding up.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SNIPPET, 0, 27, 130)
          },
          hold: 250,
        },
        {
          say: 'Two options do the work here. Aggregate says what a group header shows for that column: an average age, a summed salary. Summary does the same thing for the whole table at the bottom. Both read the raw value, so a formatted currency still adds up correctly.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 27, 36, 60)
          },
          hold: 250,
        },
        {
          say: 'Then groupBy on the component names the starting grouping, and groupable lets the user change it later.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 36, 45, 45)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'Read it back whole: the same people, one column list with the aggregate and summary options on it, and groupBy on the component. That is everything this needs.',
          lead: 300,
          async do(page, h) {
            await h.stage.editor.pan(0, { ms: 900 })
            await h.pause(700)
            await h.stage.editor.pan(1, { ms: 4800 })
            await h.pause(500)
          },
          hold: 300,
        },
        {
          say: 'Every department is a group header carrying its own totals, and the row at the bottom totals the table. Open one and the people inside are ordinary rows: still sortable, still editable, still yours.',
          lead: 300,
          async do(page, h) {
            // Point the editor at the aggregate options: they are near the end
            // of a 37-line file, and the half-width pane starts at line 1, so
            // an earlier take narrated them while they sat off screen.
            await reveal(h, SNIPPET, { focus: "aggregate: 'sum'" })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(1200)
            const groups = await page.locator('.br-page-snippet .sv-grid-group-row').count()
            const summary = await page.locator('.br-page-snippet .sv-grid-summary-row').count()
            if (groups < 2) throw new Error(`expected group headers, saw ${groups}`)
            if (summary < 1) throw new Error('no summary row rendered')
            h.log(`${groups} group headers, ${summary} summary row`)
            // `.sv-grid-group-toggle` is the client group expander;
            // `.sv-group-cell` is the server-side row model's, which this
            // snippet does not use, and waiting for it timed out a take.
            const toggle = page.locator('.br-page-snippet .sv-grid-group-toggle')
            await toggle.first().waitFor({ state: 'visible', timeout: 15_000 })
            const shut = () => page.locator('.br-page-snippet .sv-grid-group-toggle[aria-expanded="false"]').first()
            // The narration says "open one", so there has to be a closed one.
            if (!(await shut().count())) {
              await h.click(toggle.first())
              await h.pause(900)
            }
            const collapsed = await page.locator(SNIPPET_ROW).count()
            await h.click(shut())
            await h.pause(1500)
            const opened = await page.locator(SNIPPET_ROW).count()
            if (opened <= collapsed) throw new Error(`opening a group added no rows (${collapsed} -> ${opened})`)
            h.log(`group opened: ${collapsed} -> ${opened} rows`)
          },
          hold: 400,
        },
        {
          say: 'Grouping is part of the row model rather than a display trick, which is why the same thing works over server data: the server returns the groups and the grid asks for a group’s rows only when someone opens it. Lesson seven makes all of this look like your product.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator(SNIPPET_ROW).count()
        if (rows < 2) throw new Error(`the snippet rendered ${rows} rows`)
        return `${rows} rows including group headers`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 6 complete', title: 'Next: themes and density.', subtitle: 'A preset, dark mode as an attribute, and your own tokens.', lines: ['svgrid.com/docs/help/grouping-aggregation'] })
      },
      beats: [
        { say: 'The file is on the page below. See you in lesson seven.', lead: 300 },
      ],
    },
  ],
}
