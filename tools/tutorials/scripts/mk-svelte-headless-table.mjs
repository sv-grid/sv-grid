/**
 * C5 from the plan: "A headless table in Svelte."
 *
 * Targets "svelte headless table", which sits at position 19 in
 * marketing/gsc/Queries.csv - the best non-branded position the site has, and
 * the only one already within reach of page 2.
 *
 * Goes deeper than the existing 36 s `mk-headless` cut (which only shows demos
 * 186 and 187): this one types the real runnable blocks out of
 * docs/help/headless/*.md and mounts those same files, so the code on screen
 * is the code that produced the table beside it.
 *
 * NOTE the selectors. A headless table is a hand-written <table>; there is no
 * `.sv-grid-body` and no `[role="row"]`, so the shared SNIPPET_ROW from
 * lesson.mjs matches nothing here.
 */
import { typeLines, reveal } from '../lib/lesson.mjs'

const BUILD = 'help-headless-build-a-table--2'
const SORTED = 'help-headless-build-a-table--3'
const PAGED = 'help-headless-row-models--4'

/** Rows of the hand-written table the snippet renders. */
const ROW = '.br-page-snippet table tbody tr'
/** First cell of each row, top to bottom, for asserting an order changed. */
const namesIn = (page) => page.locator(`${ROW} td:first-child`).allTextContents()

export default {
  id: 'mk-svelte-headless-table',
  kind: 'marketing',
  title: 'A headless table in Svelte',
  description: 'Use the grid engine without its renderer: createSvGrid gives you rows, headers, sorting and pagination, and you write the table markup and the CSS yourself.',
  tags: ['svelte headless table', 'headless ui svelte', 'svelte table', 'createSvGrid', 'svelte 5', 'headless data grid'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [3, 4] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Svelte 5 native',
          title: 'A headless table.',
          subtitle: 'You write the markup and the CSS. It does the rows, the headers and the sorting.',
        })
      },
      beats: [
        { say: 'Sometimes you want the logic and not the look. You have a design system already, or the markup has to be a particular shape, and a component that renders its own table is the wrong tool. This is the other half of SvGrid: the engine on its own, with no renderer attached.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/RepoTable.svelte', code: '' })
      },
      beats: [
        {
          say: 'It comes from a separate entry point, slash core, so none of the rendering code is in your bundle. You describe the data and the columns the same way you would for the component: a row type, an array of plain objects, and a column per field.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, BUILD, 0, 24, 120)
          },
          hold: 250,
        },
        {
          say: 'Then createSvGrid builds the table instance. The row models are the part worth understanding: a model is a stage in the pipeline, and you opt into each one. Here there is only the core model, so the engine hands back your rows in order and does nothing else to them.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, BUILD, 24, 34, 70)
          },
          hold: 300,
        },
        {
          say: 'And this is the part a rendering component would never let you write. Your own table element, your own classes, your own cells. The engine gives you header groups and rows; what they look like is entirely yours.',
          lead: 300,
          async do(page, h) {
            await typeLines(h, BUILD, 34, 60, 60)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'Sixty lines, and the result is a plain HTML table. No grid stylesheet, no wrapper divs, no class names you did not choose. If your design system has a table component already, this is how you keep it and still get sorting, filtering, grouping and pagination underneath.',
          lead: 300,
          async do(page, h) {
            await reveal(h, BUILD, { file: 'src/RepoTable.svelte', focus: '<table>' })
            await page.waitForSelector(ROW, { timeout: 30_000 })
            const rows = await page.locator(ROW).count()
            if (rows < 3) throw new Error(`the headless table rendered ${rows} rows`)
            h.log(`${rows} rows in a hand-written table`)
            await h.pause(2000)
          },
          hold: 400,
        },
        {
          say: 'Sorting is a second row model and a piece of state you own. Add the sorted model, keep the sorting array in a rune, and put an onclick on your own header. Clicking cycles that column: ascending, descending, then back to the order your data arrived in. And because the state is an array rather than a single column, clicking a second header adds to the sort instead of replacing it, so multi-column sorting falls out of the same three lines.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SORTED, { file: 'src/RepoTable.svelte', focus: 'createSortedRowModel' })
            await page.waitForSelector(ROW, { timeout: 30_000 })
            await h.pause(1200)
            // Click the column that IS sorted. getToggleSortingHandler APPENDS
            // a clause for an unsorted column, so clicking a different header
            // first gives multi-sort with the original column still primary and
            // the visible order unchanged - which failed an earlier take that
            // assumed a click replaces the sort.
            const stars = page.locator('.br-page-snippet table thead th').nth(2)
            const desc = await namesIn(page)
            await h.click(stars)
            await h.pause(1300)
            const cleared = await namesIn(page)
            if (cleared.join() === desc.join()) throw new Error('the third click did not clear the sort')
            await h.click(stars)
            await h.pause(1300)
            const asc = await namesIn(page)
            if (asc.join() === cleared.join()) throw new Error('clicking again did not sort ascending')
            h.log(`sort cycle: ${desc[0]} -> ${cleared[0]} -> ${asc[0]}`)
            await h.pause(900)
          },
          hold: 400,
        },
        {
          say: 'Pagination is the same move again. Add the paginated model and the engine hands back one page at a time, with the page count and the controls left to you. And notice this one is not a table at all. It is a list, because nothing in the engine knows or cares what you draw: it gives you rows, and the markup is a decision you make per screen.',
          lead: 300,
          async do(page, h) {
            // This snippet renders a <ul>, not a <table>: the point it makes is
            // that the row model does not care what you draw.
            const ITEM = '.br-page-snippet li'
            await reveal(h, PAGED, { file: 'src/RepoTable.svelte', focus: 'createPaginatedRowModel' })
            await page.waitForSelector(ITEM, { timeout: 30_000 })
            const rows = await page.locator(ITEM).count()
            if (rows < 1) throw new Error(`the paginated list rendered ${rows} items`)
            h.log(`${rows} items on a page`)
            await h.pause(2400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '187-headless-virtual',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'Virtualization is separate too, and it is the reason this is worth doing rather than writing the loop by hand. The virtualizer tells you which rows are in view and the offset to put them at. You still write the row markup; you just write fifty of them instead of fifty thousand. Scroll it and the DOM node count holds steady while the data under it does not. Doing that yourself is where most hand-rolled tables quietly fall over, because it is not the first thousand rows that hurt, it is the scroll position arithmetic when the rows are different heights.',
          lead: 350,
          async do(page, h) {
            await h.pause(1200)
            await h.easedScrollBy(6000, 2600, '.hv-scroll')
            await h.pause(900)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '276-headless-calendar',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'The table is not the only thing with a headless half. There are around twenty more: a calendar, a combobox, an autocomplete, a tags input, a slider, a tree. Each one is a function that owns the state and the keyboard behaviour and hands you the parts to render. That is the part people underestimate. A date picker is two days of work if you write the markup, and two weeks if you also have to get arrow keys, page up and down, home and end, the month roll-over and the screen reader announcements right. This gives you the second part and leaves you the first.',
          lead: 350,
          async do(page, h) {
            await h.pause(3000)
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
          kicker: 'MIT on npm',
          title: 'npm i @svgrid/grid',
          subtitle: 'Import from @svgrid/grid/core for the engine alone, or @svgrid/grid when you want the renderer too.',
          lines: ['svgrid.com/docs/help/headless/build-a-table'],
        })
      },
      beats: [
        { say: 'Same package either way. Import from slash core and you get the engine with none of the renderer; import from the package root and you get a grid that draws itself, with the same row models underneath. You can start headless and switch later, or use both in one app. The docs page below builds this table from scratch.', lead: 350 },
      ],
    },
  ],
}
