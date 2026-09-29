/**
 * Course lesson 5: selecting rows and acting on them.
 * Code and result are the runnable block from docs/help/rows/selection-bar.md.
 */
import { typeLines, reveal, SNIPPET_ROW } from '../lib/lesson.mjs'

const SNIPPET = 'help-rows-selection-bar--1'

/**
 * The key cell of every ticked row, sorted. The lesson claims a sort keeps
 * the same ROWS selected rather than the same slots, and the grid exposes no
 * row id in the DOM, so the visible key is what that claim is checked against.
 */
async function selectedKeys(page) {
  const rows = page.locator('.br-page-snippet .sv-grid-body [role="row"]')
  const out = []
  for (let i = 0; i < (await rows.count()); i += 1) {
    const row = rows.nth(i)
    const box = row.locator('.sv-grid-checkbox').first()
    if (!(await box.count())) continue
    if ((await box.getAttribute('aria-checked')) !== 'true') continue
    const cell = row.locator('.sv-grid-cell:not(.sv-grid-selection-cell)').first()
    out.push(((await cell.textContent()) ?? '').trim())
  }
  return out.sort()
}

export default {
  id: 'learn-5-selection',
  kind: 'course',
  title: 'Learn SvGrid 5: selection and bulk actions',
  description: 'Lesson five of the SvGrid course: add row checkboxes, give the grid a stable row id, and float a bulk-action bar over the rows the user picked.',
  docsPage: 'docs/help/rows/selection-bar.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'row selection', 'bulk actions', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 4 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 5', title: 'Pick rows. Act on them.', subtitle: 'Checkboxes, a stable row id, and a bar that appears when it is useful.' })
      },
      beats: [
        { say: 'Selecting rows is easy. Knowing which rows are selected after a sort, a filter or a refresh is the part that catches people out, and it comes down to one prop.', lead: 300 },
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
          say: 'A small backlog of tasks and the columns to show them.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SNIPPET, 0, 26, 130)
          },
          hold: 250,
        },
        {
          say: 'Three things on the component. showRowSelection adds the checkbox column. selectionBar floats the action bar. And getRowId is the one that matters: it tells the grid what identifies a row, so a selection survives sorting, filtering and new data arriving. Without it the grid falls back to position, and position changes.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 26, 40, 45)
          },
          hold: 300,
        },
        {
          say: 'Tick a couple of rows and the bar appears with a live count and the actions you defined. It stays out of the way until there is something to act on.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SNIPPET, { focus: 'showRowSelection' })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(900)
            const boxes = page.locator('.br-page-snippet .sv-grid-body .sv-grid-checkbox')
            await h.click(boxes.nth(0))
            await h.pause(800)
            await h.click(boxes.nth(2))
            await h.pause(800)
            await h.click(boxes.nth(3))
            await h.pause(1200)
            const picked = await selectedKeys(page)
            if (picked.length !== 3) throw new Error(`ticked 3 rows, ${picked.length} are selected: ${picked.join(', ')}`)
            if (!(await page.locator('.br-page-snippet').getByText(/selected/i).count())) {
              throw new Error('the selection bar never appeared')
            }
            h.log(`selected: ${picked.join(', ')}`)
          },
          hold: 400,
        },
        {
          say: 'Now sort the table while those rows are ticked. The same three stay selected, because the grid is tracking ids rather than row numbers.',
          lead: 300,
          async do(page, h) {
            const before = await selectedKeys(page)
            await h.click(page.locator('.br-page-snippet [role="columnheader"]').nth(2))
            await h.pause(1800)
            const after = await selectedKeys(page)
            // The whole point of the beat: the same rows, not the same slots.
            if (after.join('|') !== before.join('|')) {
              throw new Error(`sorting changed the selection: ${before.join(', ')} -> ${after.join(', ')}`)
            }
            h.log(`selection survived the sort: ${after.join(', ')}`)
          },
          hold: 400,
        },
        {
          say: 'Over server data the same idea scales: select-all becomes a rule, every row except these, rather than a list of ids the browser would have to hold. Lesson six groups the rows and adds totals.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const checked = await page.locator('.br-page-snippet .sv-grid-body .sv-grid-checkbox[aria-checked="true"]').count()
        if (checked < 2) throw new Error(`only ${checked} rows stayed selected after sorting`)
        return `${checked} rows still selected after the sort`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 5 complete', title: 'Next: grouping and totals.', subtitle: 'Group by a column, sum and average per group, and a summary row.', lines: ['svgrid.com/docs/help/rows/selection-bar'] })
      },
      beats: [
        { say: 'The file is on the page below. See you in lesson six.', lead: 300 },
      ],
    },
  ],
}
