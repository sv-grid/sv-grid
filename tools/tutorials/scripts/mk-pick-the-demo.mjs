/**
 * D2: the video for /demos/ - 229 impressions at position 20.4 and zero clicks.
 *
 * The gallery's problem is not that it is thin, it is that 437 demos look like
 * a wall. So this is a tour with a shape: start at the gallery and show how you
 * narrow it, then prove the range with four demos that have almost nothing in
 * common except the component underneath.
 *
 * The count is read from `node tools/count-demos.mjs` (437 live = 429
 * first-party + 8 community on 2026-10-06), never typed from memory. The
 * narration says "more than four hundred" so it stays true as the number moves.
 */
import { firstRow } from '../lib/lesson.mjs'

export default {
  id: 'mk-pick-the-demo',
  kind: 'marketing',
  title: 'Four hundred SvGrid demos: how to find the one you need',
  description: 'A tour of the SvGrid demo gallery: how to narrow it down, and four demos that show the range of what one component renders.',
  tags: ['svelte data grid', 'demos', 'examples', 'svelte 5', 'kanban', 'charts', 'spreadsheet'],
  view: { width: 1920, height: 1080 },
  poster: { beat: 3 },
  gif: { beats: [3] },

  segments: [
    {
      stage: true,
      introHold: 0.7,
      async setup(page, h) {
        await h.stage.show('title', {
          kicker: 'Demos',
          title: 'Four hundred demos. Which one is yours?',
          subtitle: 'The gallery, and how to narrow it.',
        })
      },
      beats: [
        {
          say: 'There are more than four hundred live demos, which is useful once you know what you are looking for and a wall of tiles before that. So here is how to narrow it down, and then four of them that have almost nothing in common except the component underneath.',
          lead: 300,
        },
      ],
    },

    {
      site: 'demos',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        // The page opens on the tree nav, where only one category is
        // expanded - 7 visible leaves, which is no backdrop for a sentence
        // about four hundred demos. Switch to the card grid first.
        await page.waitForSelector('.demo-nav-btn', { timeout: 60_000 })
        await page.locator('[title="Card grid view"]').click()
        await page.waitForSelector('.demo-card', { timeout: 30_000 })
        await h.pause(900)
      },
      beats: [
        {
          say: 'The gallery is grouped by what you are trying to build rather than by feature name, and there is a search across every demo title. Type what you actually want. Pivot, Kanban, tree, chart, spreadsheet, server side. You land on a running example, not a documentation page about one.',
          lead: 350,
          async do(page, h) {
            // The card grid, not the sidebar: the sidebar collapses its
            // categories, so it listed 7 leaves and narrowing it to 6 did not
            // support a sentence about four hundred demos.
            const cards = () => page.locator('.demo-card').count()
            const search = page.locator('.demo-grid-search').first()
            const before = await cards()
            await h.callout(search, 'search every demo by what you want to build', { hold: 1300 })
            await h.clearCallout()
            await search.click()
            await page.keyboard.type('pivot', { delay: 90 })
            await h.pause(1200)
            const after = await cards()
            if (!(after < before)) throw new Error(`searching did not narrow the list (${before} -> ${after})`)
            // The narration says there are more than four hundred. A frame
            // showing a handful would undercut it, so a thin list fails here
            // rather than quietly shipping.
            if (before < 20) throw new Error(`only ${before} demo cards on screen: too few for the claim this beat makes`)
            h.log(`gallery search "pivot": ${before} -> ${after} demos listed`)
            await h.pause(900)
          },
          hold: 400,
        },
      ],
    },

    {
      demo: '11-stock-market',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(900)
      },
      beats: [
        {
          say: 'First, the one people check before anything else. A live market feed: prices changing under you, conditional formatting following them, and fifteen columns that stay readable while they update. If your data arrives rather than sits still, this is the demo to open.',
          lead: 350,
          async do(page, h) {
            await h.pause(2600)
          },
          hold: 300,
        },
      ],
    },

    {
      demo: '29-wbs-project-tree',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.pause(700)
      },
      beats: [
        {
          say: 'Second, rows that nest. A work breakdown where every row can open into its own children, with totals that roll up the tree rather than down a flat list. Same grid, a different shape of data.',
          lead: 300,
          async do(page, h) {
            const before = await firstRow(page)
            await h.easedScrollBy(700, 1400)
            h.log(`tree demo: first row "${String(before).slice(0, 40)}"`)
            await h.pause(1400)
          },
          hold: 300,
        },
      ],
    },

    {
      demo: '164-chart-treemap',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        // The treemap cells are <rect> inside the chart's SVG. 30 s was not
        // enough on a cold run - the failure screenshot showed it fully drawn.
        await page.waitForSelector('.sv-grid-chart-treemap-cell', { timeout: 90_000 })
        await h.pause(1200)
      },
      beats: [
        {
          say: 'Third, a chart that is not a bar chart. Treemaps, sankey diagrams, sunbursts, funnels and gauges all render as inline SVG from the grid\'s own rows, with no charting library underneath. Twenty nine types, and whatever you filtered is what you plot.',
          lead: 350,
          async do(page, h) {
            const cells = page.locator('.sv-grid-chart-treemap-cell')
            const n = await cells.count()
            if (n < 10) throw new Error(`the treemap rendered ${n} cells`)
            h.log(`treemap: ${n} cells sized by revenue, drawn from the grid rows`)
            await h.callout(cells.first(), 'each cell sized by its value', { hold: 1400 })
            await h.clearCallout()
            await h.pause(2200)
          },
          hold: 300,
        },
      ],
    },

    {
      demo: '343-kanban-board',
      zoom: 1.45,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.sv-board-card', { timeout: 30_000 })
        await h.pause(800)
      },
      beats: [
        {
          say: 'And fourth, the one that catches people out. This is the same grid with one more prop on it. The rows became cards in lanes, with work in progress limits and a card you can move with the keyboard. Not a second component, and not a second data model to keep in sync.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator('.sv-board-card').count()
            if (cards < 2) throw new Error(`the board rendered ${cards} cards`)
            h.log(`board: ${cards} cards`)
            await h.callout(page.locator('.sv-board-card').first(), 'a row, rendered as a card', { hold: 1400 })
            await h.clearCallout()
          },
          hold: 300,
        },
      ],
    },

    {
      stage: true,
      introHold: 0.5,
      outroHold: 2,
      async setup(page, h) {
        await h.stage.show('end', {
          kicker: 'Every demo runs',
          title: 'svgrid.com/demos',
          subtitle: 'Open one, read its source, copy it into your project.',
          lines: ['npm i @svgrid/grid'],
        })
      },
      beats: [
        {
          say: 'Every one of them runs in the browser with its source next to it, so the way to use the gallery is to find the demo closest to what you are building and start from its code. The grid is MIT on npm.',
          lead: 300,
        },
      ],
    },
  ],
}
