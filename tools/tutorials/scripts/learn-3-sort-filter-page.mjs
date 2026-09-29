/**
 * Course lesson 3: sorting, filtering and paging, and why they are off until
 * you ask. The code is the runnable block from docs/getting-started/4-features.md.
 *
 * That block has five rows, which is enough to show sorting and a header
 * filter and not enough to show paging: the pager reads "Page 1 of 1" and the
 * page-size options start at 10. So paging and the filter ROW (which needs
 * `filterMode="row"`, not plain `filterable`) are shown on demo
 * 02-sort-filter-paginate, which has 5,000 rows and sets both. The filter MENU
 * is named but never opened on camera: inside the stage frame its popover
 * positions against the unzoomed layout and lands off-screen. An earlier take
 * narrated all of this over the five-row snippet and showed none of it.
 */
import { typeLines, reveal, SNIPPET_ROW } from '../lib/lesson.mjs'

const SNIPPET = 'getting-started-4-features--1'
/**
 * The Name column's text, top to bottom, for asserting an order changed.
 * Read per row rather than by nth-child, because the selection column is a
 * cell too and would shift every index by one.
 */
async function namesIn(page) {
  const rows = page.locator(SNIPPET_ROW)
  const out = []
  for (let i = 0; i < (await rows.count()); i += 1) {
    const cell = rows.nth(i).locator('.sv-grid-cell:not(.sv-grid-selection-cell)').first()
    out.push(((await cell.textContent()) ?? '').trim())
  }
  return out
}

export default {
  id: 'learn-3-sort-filter-page',
  kind: 'course',
  title: 'Learn SvGrid 3: sorting, filtering and paging',
  description: 'Lesson three of the SvGrid course: switch on sorting, filtering, grouping and pagination with boolean props, and see what each one does to the same table.',
  docsPage: 'docs/getting-started/4-features.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'sorting', 'filtering', 'pagination', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 4 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 3', title: 'Sorting, filtering, paging.', subtitle: 'Off by default, on with one word each, and here is why.' })
      },
      beats: [
        { say: 'Your grid renders. It does not sort, filter or page yet, and that is deliberate. This lesson turns those on and explains the trade the library is making for you.', lead: 300 },
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
          say: 'Here is a wider row type and a realistic set of records, the kind of table you would actually ship. Nothing new yet.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SNIPPET, 0, 16, 120)
          },
          hold: 250,
        },
        {
          say: 'Columns, with a currency format on salary from the last lesson.',
          lead: 250,
          async do(page, h) {
            await typeLines(h, SNIPPET, 16, 33, 120)
          },
          hold: 250,
        },
        {
          say: 'And now the part that matters. Sortable, filterable, editable, groupable, pageable. Each is one boolean, and each one pulls in only the code that feature needs, which is why a grid you never configured stays small.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 33, 60, 55)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'That is the whole file: the row type, the records, the columns, and the component with those five words on it. Nothing else is configured, and nothing is hidden above the fold.',
          lead: 300,
          async do(page, h) {
            // Typing follows the caret, so the top of a 43-line file has
            // scrolled away by the last line and the viewer has never seen it
            // whole. Read it back at full width, where the long data rows fit.
            await h.stage.editor.pan(0, { ms: 900 })
            await h.pause(700)
            await h.stage.editor.pan(1, { ms: 5200 })
            await h.pause(500)
          },
          hold: 300,
        },
        {
          say: 'Click a header and it sorts. Click again for descending, and a third time to clear it and get your original order back.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SNIPPET, { focus: "sortable" })
            await page.waitForSelector(SNIPPET_ROW, { timeout: 30_000 })
            await h.pause(900)
            const head = page.locator('.br-page-snippet [role="columnheader"]')
            const original = await namesIn(page)
            await h.click(head.nth(1))
            await h.pause(1100)
            const ascending = await namesIn(page)
            if (ascending.join() === original.join()) throw new Error('first header click did not sort')
            await h.click(head.nth(1))
            await h.pause(1100)
            const descending = await namesIn(page)
            if (descending.join() === ascending.join()) throw new Error('second header click did not reverse the sort')
            await h.click(head.nth(1))
            await h.pause(1000)
            const cleared = await namesIn(page)
            if (cleared.join() !== original.join()) throw new Error('third header click did not clear the sort')
            h.log('sort: ascending, descending, cleared')
          },
          hold: 300,
        },
        {
          say: 'Shift-click a second header to sort by two columns at once: department first, then name inside each department.',
          lead: 250,
          async do(page, h) {
            const head = page.locator('.br-page-snippet [role="columnheader"]')
            const before = await namesIn(page)
            await h.click(head.nth(1))
            await h.pause(1000)
            await h.click(head.nth(0), { modifiers: ['Shift'] })
            await h.pause(1400)
            const after = await namesIn(page)
            if (after.join() === before.join()) throw new Error('shift-click did not add a second sort')
            h.log(`multi-sort: ${after.join(', ')}`)
          },
          hold: 300,
        },
        {
          say: 'The funnel next to each header is filtering, switched on by that same one word. How it looks is a choice, and the next screen has the version most people want.',
          lead: 250,
          async do(page, h) {
            await h.park(undefined, undefined, { ms: 700 })
          },
          hold: 300,
        },
      ],
      async verify(page) {
        const rows = await page.locator(SNIPPET_ROW).count()
        if (rows < 1) throw new Error(`the snippet rendered ${rows} rows`)
        return `${rows} rows, sorted by two columns`
      },
    },
    {
      demo: '02-sort-filter-paginate',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'Five rows will not show you paging, so here is the same set of props over five thousand. Filterable on its own gives you a menu per header; filter mode row puts an input under each header instead, and it narrows the table as you type.',
          lead: 400,
          async do(page, h) {
            const input = page.locator('.sv-grid-filter-row-control input').first()
            await page.waitForSelector('.sv-grid-filter-row-control input', { timeout: 15_000 })
            const total = async () =>
              ((await page.locator('.sv-grid-pagination-range').first().textContent()) ?? '').trim()
            const before = await total()
            await h.click(input)
            await h.type('an', { delay: 150 })
            await h.pause(1800)
            const after = await total()
            if (after === before) throw new Error(`the filter row changed nothing (${before})`)
            h.log(`filter row: ${before} -> ${after}`)
          },
          hold: 300,
        },
        {
          say: 'And the pager cuts what is left into pages, with the range and the count kept honest as the filter changes them. None of this needed a callback from you.',
          lead: 300,
          async do(page, h) {
            const range = page.locator('.sv-grid-pagination-range').first()
            const before = (await range.textContent())?.trim() ?? ''
            await h.click(page.locator('button[aria-label="Next page"]').first())
            await h.pause(1500)
            const after = (await range.textContent())?.trim() ?? ''
            if (!before || after === before) throw new Error(`pager did not advance: "${before}" -> "${after}"`)
            h.log(`pager: "${before}" -> "${after}"`)
            await h.click(page.locator('button[aria-label="Next page"]').first())
            await h.pause(1400)
          },
          hold: 400,
        },
      ],
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 3 complete', title: 'Next: editing rows.', subtitle: 'Cell editors per column, and refusing input that should not land.', lines: ['svgrid.com/docs/getting-started/4-features'] })
      },
      beats: [
        {
          say: 'Those five booleans are a shorthand. When you need finer control, register the features explicitly with tableFeatures and pass them in, which is the same machinery with the wiring exposed; the docs page below shows both forms side by side. Lesson four lets people change the table.',
          lead: 300,
        },
      ],
    },
  ],
}
