/**
 * Course lesson 8: moving sort, filter and paging to the server.
 *
 * The code typed is the runnable block from
 * docs/getting-started/6-going-to-production.md. It fetches /api/people, an
 * endpoint that exists in your app and not in this gallery, so the proof is a
 * demo that really does talk to a server rather than a staged screenshot.
 */
import { typeLines, firstRow } from '../lib/lesson.mjs'

const SNIPPET = 'getting-started-6-going-to-production--1'

export default {
  id: 'learn-8-server-data',
  kind: 'course',
  title: 'Learn SvGrid 8: data from a server',
  description: 'Lesson eight of the SvGrid course: move sorting, filtering and paging to the backend, send one request per change, and cancel the one that is now stale.',
  docsPage: 'docs/getting-started/6-going-to-production.md',
  tags: ['svelte data grid tutorial', 'learn svgrid', 'server side data', 'pagination', 'svelte 5'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 4 },
  gif: { beats: [4, 5] },

  segments: [
    {
      stage: true,
      introHold: 0.6,
      async setup(page, h) {
        await h.stage.show('title', { kicker: 'Learn SvGrid · lesson 8', title: 'When the table outgrows the browser.', subtitle: 'Sort, filter and page on the server, one request at a time.' })
      },
      beats: [
        { say: 'Everything so far held every row in memory. That works to tens of thousands of rows. Past that, the sorting and filtering have to move to the server, and the grid has to ask for what it needs.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/routes/people/+page.svelte', code: '' })
      },
      beats: [
        {
          say: 'The state the grid hands you is small: which column is sorted, which filters are set, which page you are on. Keep those in runes.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SNIPPET, 0, 40, 150)
          },
          hold: 250,
        },
        {
          say: 'Then one function that turns that state into a request. Notice the abort controller: when the user types another letter, the request already in flight is cancelled, so a slow earlier response cannot overwrite a newer one. That race is the most common bug in a server-backed table.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 40, 64, 80)
          },
          hold: 300,
        },
        {
          say: 'An effect reruns it whenever sort, filters or page change, and the component passes the rows down with the total, so the pager knows how many pages there are without counting rows it never received.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, SNIPPET, 64, 90, 70)
            await h.stage.editor.cursor(false)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '09-server-side',
      zoom: 1.4,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(900)
      },
      beats: [
        {
          say: 'Here is that pattern running against a real endpoint. Sorting goes to the server and comes back sorted; typing in the search box is debounced, so one request goes out rather than one per keystroke.',
          lead: 400,
          async do(page, h) {
            const before = await firstRow(page)
            await h.click(page.locator('[role="columnheader"]').nth(1))
            await h.pause(1600)
            const sorted = await firstRow(page)
            if (sorted === before) throw new Error('the server sort did not change the first row')
            // The demo prints "N matches" from the server's total. Row COUNT
            // is the wrong thing to assert on: the page size does not change,
            // and the first `[role="row"]` is the virtualization spacer, whose
            // text is empty before and after.
            const matches = async () =>
              ((await page.getByText(/[\d,]+ matches/).first().textContent()) ?? '').trim()
            const totalBefore = await matches()
            const search = page.locator('input[placeholder*="name" i]').first()
            await search.waitFor({ state: 'visible', timeout: 15_000 })
            await h.click(search)
            await h.type('an', { delay: 160 })
            await h.pause(2400)
            const totalAfter = await matches()
            if (totalAfter === totalBefore) throw new Error(`the debounced search changed nothing (${totalBefore})`)
            h.log(`server sort + search: ${totalBefore} -> ${totalAfter}`)
          },
          hold: 400,
        },
        {
          say: 'The loading state lives on the rows rather than as a spinner over the page, so the header and the controls stay usable while the next page arrives.',
          lead: 300,
          async do(page, h) {
            const before = await firstRow(page)
            const next = page.locator('main button', { hasText: /next/i }).first()
            await next.waitFor({ state: 'visible', timeout: 15_000 })
            await h.click(next)
            await h.pause(1800)
            const after = await firstRow(page)
            if (after === before) throw new Error('the next page never arrived')
            h.log('next page loaded from the server')
          },
          hold: 400,
        },
      ],
      async verify(page) {
        const rows = await page.locator('.sv-grid-body [role="row"]').count()
        if (rows < 2) throw new Error(`server demo showed ${rows} rows`)
        return `${rows} rows from the server demo`
      },
    },
    {
      stage: true,
      introHold: 0.5,
      outroHold: 1.8,
      async setup(page, h) {
        await h.stage.show('end', { kicker: 'Lesson 8 complete', title: 'Next: SvelteKit, end to end.', subtitle: 'A load function on the server, the page, and real HTML in the response.', lines: ['svgrid.com/docs/help/server-side-data'] })
      },
      beats: [
        { say: 'Past a million rows there is a dedicated row model that lazily loads groups and blocks; it is linked from the page below. Lesson nine puts all of this in a SvelteKit app.', lead: 300 },
      ],
    },
  ],
}
