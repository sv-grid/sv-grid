/**
 * V3 from marketing/video-plan-2026-10.md: "A Kanban board in Svelte, from an
 * array of objects."
 *
 * Targets "svelte kanban", which sits at 73 impressions / position 32 on
 * Google and is near-empty on YouTube. Longer than the 30-60 s cuts (about
 * three minutes) because the query is a build intent, not a feature lookup:
 * someone searching it wants to see a board appear from data they recognise.
 *
 * The pitch is that the board is the SAME component as the table, so the
 * opening beat shows the two views of one grid before anything else.
 */
import { firstRow } from '../lib/lesson.mjs'

// SvGridBoard.svelte renders the grid's board prop and uses single-dash
// classes. SvBoard.svelte is a different, standalone component whose BEM
// classes (sv-board__card) match nothing here.
const CARD = '.sv-board-card'
const LANE = '.sv-board-lane'

export default {
  id: 'mk-svelte-kanban-board',
  kind: 'marketing',
  title: 'A Kanban board in Svelte, from an array of objects',
  description: 'Give the Svelte 5 data grid a board prop and your rows become cards in lanes: drag to change a field, swimlanes, WIP limits, and the same data as a table.',
  tags: ['svelte kanban', 'kanban board', 'svelte 5', 'svelte board', 'drag and drop', 'svelte data grid', 'sveltekit'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 2 },
  gif: { beats: [2, 3] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Svelte 5 native',
          title: 'A Kanban board, from an array of objects.',
          subtitle: 'The same component that draws your table, with one more prop.',
        })
      },
      beats: [
        { say: 'Most board libraries ask you to model a board: lanes, cards, an order per lane. This one does not. You already have rows, and a lane is just a field on them.', lead: 300 },
      ],
    },
    {
      demo: '343-kanban-board',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1500)
      },
      beats: [
        {
          say: 'Here is the same grid twice. As a table it is rows and columns. Switch it to board and each row becomes a card, grouped into lanes by whichever field you name.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator(CARD).count()
            if (cards < 3) throw new Error(`the board painted ${cards} cards`)
            h.log(`${cards} cards on the board`)
            // Show the Table side of the toggle, which is the whole point.
            const table = page.locator('main button', { hasText: /^\s*table\s*$/i }).first()
            await table.waitFor({ state: 'visible', timeout: 10_000 })
            await h.click(table)
            await h.pause(1800)
            const row = await firstRow(page)
            if (!row) throw new Error('the Table view painted no rows')
            h.log(`table view: "${row.slice(0, 40)}"`)
            await h.click(page.locator('main button', { hasText: /^\s*board\s*$/i }).first())
            await h.pause(1600)
          },
          hold: 400,
        },
        {
          say: 'Move a card and the row behind it changes. You can drag it, or focus it and move it from the keyboard: Space to pick it up, arrows to move it, Space to drop. The board is a view of the data, so there is no second copy to keep in step.',
          lead: 300,
          async do(page, h) {
            // Keyboard DnD rather than dispatched HTML5 drag events: it is what
            // SvGridBoard implements for assistive tech, it is deterministic to
            // drive, and an earlier take's synthetic drag moved nothing while
            // the narration said it did.
            const counts = async () =>
              (await page.locator('.sv-board-lane-count').allTextContents()).map((s) => s.trim()).join(' ')
            const before = await counts()
            await h.click(page.locator(CARD).first())
            await h.pause(700)
            await h.press('Space')
            await h.pause(900)
            await h.press('ArrowRight')
            await h.pause(900)
            await h.press('Space')
            await h.pause(1600)
            const after = await counts()
            if (after === before) throw new Error(`the card never moved lane (counts still ${before})`)
            h.log(`keyboard move: lane counts ${before} -> ${after}`)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '345-kanban-pipeline',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'The card is yours. This is a sales pipeline: the lanes are deal stages, the card is a snippet you wrote, and the lane header totals the deals inside it as they move.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator(CARD).count()
            if (cards < 3) throw new Error(`the pipeline board painted ${cards} cards`)
            h.log(`${cards} deal cards`)
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '347-kanban-support',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'Cross the lanes with a swimlane and you get a grid of both: status across, priority down. Search filters the cards in place, and a lane can refuse work past a limit.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator(CARD).count()
            if (cards < 3) throw new Error(`the triage board painted ${cards} cards`)
            const search = page.locator('main input[type="search"], main input[placeholder*="search" i]').first()
            if (await search.count()) {
              await h.click(search)
              await h.type('a', { delay: 150 })
              await h.pause(1600)
            }
            h.log(`${cards} triage cards`)
            await h.pause(1400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '352-kanban-epics',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'Point it at a child field and a card carries its own children, so an epic shows its stories without a second board underneath.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator(CARD).count()
            if (cards < 2) throw new Error(`the epics board painted ${cards} cards`)
            await h.pause(2400)
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
          subtitle: 'The board is a prop on the grid you already have. Docs, demos and a ten lesson course on the site.',
          lines: ['svgrid.com/docs/help/rows/kanban-board'],
        })
      },
      beats: [
        { say: 'It is one prop on a grid that is MIT on npm, it keeps your row type the whole way through, and the board, the table and the chart are the same component. The docs page below has the code from all of this.', lead: 350 },
      ],
    },
  ],
}
