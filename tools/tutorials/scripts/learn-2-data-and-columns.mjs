/**
 * Course lesson 2: your own rows (and they stay reactive), then the column
 * options people reach for first.
 *
 * Both halves are runnable blocks from docs/getting-started/3-data-and-columns.md:
 * --0 is the reactive row array, --3 is the formatted column set. The editor
 * types or displays each file's own source and the frame mounts that same file.
 */
import { typeLines, reveal, SNIPPET_ROW, SNIPPET_CELL } from '../lib/lesson.mjs'

const ROWS = 'getting-started-3-data-and-columns--0'
const FORMATS = 'getting-started-3-data-and-columns--3'

export default {
  id: 'learn-2-data-and-columns',
  kind: 'course',
  title: 'Learn SvGrid 2: your data, your columns',
  description: 'Lesson two of the SvGrid course: put your own row type in, keep it reactive, then set headers, widths and currency, percent and date formats.',
  docsPage: 'docs/getting-started/3-data-and-columns.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'column definitions', 'cell formatting', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 6 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 2', title: 'Your data, your columns.', subtitle: 'Your row type, reactive rows, and the formats users expect.' })
      },
      beats: [
        { say: 'In lesson one the rows were made up. In this one they are yours, they stay reactive, and the columns start looking like a real application.', lead: 300 },
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
          say: 'Start from your own row type. The grid never asks you to convert anything: whatever shape your records have, that is the shape it takes. Declare the array with the state rune and it stays reactive.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, ROWS, 0, 11)
          },
          hold: 300,
        },
        {
          say: 'Columns map a field to a header, and width fixes one that would otherwise stretch. Then a plain function that pushes a record onto the array.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, ROWS, 11, 40, 85)
          },
          hold: 300,
        },
        {
          say: 'Watch what happens when that button runs. Pushing onto the array is all it does, and the grid follows, because the rows are a rune and not a copy the grid took at startup.',
          lead: 300,
          async do(page, h) {
            await reveal(h, ROWS)
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(900)
            // The narration promises the grid follows a push, so the take
            // fails if it does not. A grid that ignored `rows.push(...)`
            // shipped in this lesson once, because nothing here looked.
            const before = await page.locator(SNIPPET_ROW).count()
            const add = page.locator('.br-page-snippet button', { hasText: /add row/i }).first()
            await h.click(add)
            await h.pause(900)
            await h.click(add)
            await h.pause(1100)
            const after = await page.locator(SNIPPET_ROW).count()
            if (after !== before + 2) {
              throw new Error(`Add row: ${before} rows -> ${after}, expected ${before + 2}`)
            }
            h.log(`add row: ${before} -> ${after} rows`)
          },
          hold: 400,
        },
        {
          say: 'Now formatting. This is the same page of the docs, a few blocks further down, and it is the thing people most often do by hand and regret.',
          lead: 300,
          async do(page, h) {
            await reveal(h, FORMATS, { loadMs: 600, focus: "format: { type: 'percent' }" })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(1200)
            // This file is revealed rather than typed, so a pass down it is
            // the only chance the viewer gets to read the whole thing.
            await h.stage.editor.pan(0, { ms: 800 })
            await h.pause(600)
            await h.stage.editor.pan(1, { ms: 4200 })
            await h.pause(600)
          },
          hold: 300,
        },
        {
          say: 'A currency format, a percent, a date. Each one renders the value for the reader and leaves your data alone, which matters because sorting and exporting both use the raw number underneath, not the string on screen.',
          lead: 300,
          async do(page, h) {
            await h.hover(page.locator(SNIPPET_CELL).nth(1))
            await h.pause(1200)
            await h.hover(page.locator(SNIPPET_CELL).nth(2))
            await h.pause(1200)
          },
          hold: 400,
        },
        {
          say: 'One habit worth forming: type the column array as GridColumns of your row type. The compiler then checks every field name against the row, so a typo is a build error instead of an empty column nobody notices.',
          lead: 300,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 600 })
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator(SNIPPET_ROW).count()
        if (rows < 2) throw new Error(`the formats snippet rendered ${rows} rows`)
        return `${rows} rows from the formats snippet`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 2 complete', title: 'Next: sorting, filtering, paging.', subtitle: 'The three features every table needs, and the two ways to switch them on.', lines: ['svgrid.com/docs/getting-started/3-data-and-columns'] })
      },
      beats: [
        { say: 'Both files are on the page below, and they run there too. See you in lesson three.', lead: 300 },
      ],
    },
  ],
}
