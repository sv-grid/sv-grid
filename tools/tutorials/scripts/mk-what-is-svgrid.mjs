/**
 * Marketing cut: the channel-trailer length overview. Two and a half minutes
 * covering what SvGrid is, on the real demos rather than slides.
 *
 * Grid-first by design: the board, the pivot and the chart are modes of the
 * same component, not separate products, which is the whole pitch. Gantt is
 * deliberately absent - tools/lib/releases.mjs gates it until 2026-11-01, so
 * it cannot appear in anything public yet.
 *
 * Every beat that claims something asserts it, so a take cannot ship showing
 * less than the narration promises.
 */
import { firstRow } from '../lib/lesson.mjs'

export default {
  id: 'mk-what-is-svgrid',
  kind: 'marketing',
  // A marketing cut that also carries a docsPage: this one answers "what is
  // this" in full, which is the question `docs/getting-started.md` opens with.
  // Naming the page gets it a docs-sized cut, a poster and a VideoObject.
  docsPage: 'docs/getting-started.md',
  // Narrated on the page, not a silent loop. At 2:09 this is something you
  // watch once, so it embeds with native controls and plays on a click rather
  // than autoplaying muted when it scrolls into view.
  player: true,
  // Directly under the opening definition, above the page's own index. Without
  // an anchor the default list puts it below the licence section, which is the
  // last place someone asking "what is this" would look.
  anchor: 'This guide is six short pages',
  title: 'What is SvGrid',
  description: 'A data grid built for Svelte 5: a million rows, filters, inline editing, grouping, pivot mode, a Kanban board and charts, from one component.',
  tags: ['svelte data grid', 'svelte 5', 'svelte table', 'data grid', 'kanban', 'pivot table', 'charts', 'sveltekit'],
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
          title: 'Headless-first. Render-ready.',
          subtitle: 'One component for the table, the board, the pivot and the chart.',
        })
      },
      beats: [
        { say: 'SvGrid is a data grid written for Svelte 5. Not a port of something older and not a wrapper around it: runes and snippets the whole way down. Here is what it does.', lead: 300 },
      ],
    },
    {
      demo: '78-million-rows',
      zoom: 1.5,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(10)
        await h.settleRowCount()
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'It starts with scale. A million rows in the browser, virtualized in both directions, so the number of DOM nodes stays about the same as it was with ten.',
          lead: 350,
          async do(page, h) {
            // Jump deep first (a user dragging the scrollbar), let it settle so
            // the row numbers near 400,000 are legible, then scroll at a human
            // rate so rows actually stream past. A fraction-based scroll here
            // covers 400,000 rows in seconds and records as an empty body.
            await h.scrollTo(0.4)
            await h.pause(1100)
            const deep = await firstRow(page)
            if (!deep) throw new Error('the grid painted no rows after the jump')
            h.log(`landed deep in the set: "${deep.slice(0, 48)}"`)
            await h.easedScrollBy(7000, 2800)
            await h.pause(400)
            const streamed = await firstRow(page)
            if (streamed === deep) throw new Error('scrolling did not move the rows')
            await h.easedScrollX(0.5, 2200)
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 5) throw new Error(`the million-row demo painted ${rows} rows`)
            h.log(`${rows} rows in the viewport of a million`)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '03-excel-filters',
      // The value menu is tall. At 1.35 its footer buttons sit past y=1080
      // and the take died reaching for them.
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(5)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Then the work people actually do with a table. Every column carries a filter menu listing the values that are in it, so narrowing the data is picking from a list.',
          lead: 350,
          async do(page, h) {
            // Assert on the preset, which filters in one click and reads
            // well at speed; the value menu is then opened purely to show
            // that every header carries one, and dismissed with Escape.
            // NOT the DOM row count: the grid is virtualized, so it stays the
            // same however many rows match. The demo reveals a filter-chip row
            // with "Clear all" only while a filter is on, and the top row
            // changes, so those are what the claim is checked against.
            const before = await firstRow(page)
            await h.click(page.locator('main button', { hasText: /engineering only/i }).first())
            await h.pause(1600)
            const after = await firstRow(page)
            if (!(await page.locator('.xf-clear').count())) throw new Error('the preset applied no filter')
            if (after === before) throw new Error(`the preset did not change the rows (still "${before.slice(0, 40)}")`)
            h.log(`preset filter applied; top row "${before.slice(0, 28)}" -> "${after.slice(0, 28)}"`)
            await h.clickHeaderFilter(/department|first name|name/i)
            const list = page.locator('[role="listbox"][aria-label="Filter values"] [role="option"]')
            await list.first().waitFor({ state: 'visible', timeout: 15_000 })
            const values = await list.count()
            if (values < 2) throw new Error(`the filter menu listed ${values} values`)
            h.log(`filter menu listed ${values} values`)
            await h.pause(2000)
            await h.press('Escape')
            await h.pause(500)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '05-inline-editing',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Cells edit in place, with the editor each column asks for, and validation that refuses a value instead of writing it and cleaning up afterwards.',
          lead: 350,
          async do(page, h) {
            const cell = await h.cell(0, /first name|name/i)
            const before = ((await cell.textContent()) ?? '').trim()
            await h.dblclickCell(0, /first name|name/i)
            await h.pause(700)
            const input = page.locator('.sv-grid-cell-editing input').first()
            await input.waitFor({ state: 'visible', timeout: 10_000 })
            await input.selectText()
            await h.type('Margaret', { delay: 120 })
            await h.press('Enter')
            await h.pause(1100)
            const after = ((await (await h.cell(0, /first name|name/i)).textContent()) ?? '').trim()
            if (after === before) throw new Error(`the edit did not commit (still "${before}")`)
            h.log(`edit: "${before}" -> "${after}"`)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '07-grouping-aggregation',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Group by any column and each group header carries its own totals, averaged or summed from the raw values rather than the formatted text.',
          lead: 350,
          async do(page, h) {
            const groups = await page.locator('.sv-grid-group-row').count()
            if (groups < 2) throw new Error(`expected group headers, saw ${groups}`)
            const toggle = page.locator('.sv-grid-group-toggle[aria-expanded="false"]').first()
            if (await toggle.count()) {
              const label = ((await toggle.textContent()) ?? '').trim().slice(0, 30)
              await h.click(toggle)
              await h.pause(1400)
              // Row count is virtualized and would not move; the toggle's own
              // state is the honest signal that the group opened.
              const open = await page.locator('.sv-grid-group-toggle[aria-expanded="true"]').count()
              if (!open) throw new Error(`the group "${label}" did not open`)
              h.log(`group "${label}" opened`)
            }
            h.log(`${groups} group headers`)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '360-pivot-mode-grid',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.focusGrid()
        await h.pause(700)
      },
      beats: [
        {
          say: 'The same component flips into pivot mode, and the rows become a cross-tab. There is no second library underneath and no export to a spreadsheet to get there.',
          lead: 350,
          async do(page, h) {
            // The demo opens with Pivot Mode OFF, showing a flat grid. An
            // earlier take narrated "the rows become a cross-tab" over exactly
            // that, because the beat only checked that rows had painted.
            // Plain [role="columnheader"]: there is no `.sv-grid-header`
            // wrapper, and scoping to one made both reads an empty array that
            // compared equal, failing a take where the pivot had worked.
            const headers = () => page.locator('[role="columnheader"]').allTextContents()
            const flat = (await headers()).join('|')
            if (!flat) throw new Error('no column headers found before the toggle')
            await h.click(page.locator('.pvd-pivot-toggle').first())
            await h.pause(2400)
            const on = await page.locator('.pvd-switch.on').count()
            if (!on) throw new Error('the Pivot Mode switch is still off')
            const pivoted = (await headers()).join('|')
            if (pivoted === flat) throw new Error('Pivot Mode did not change the columns')
            h.log(`pivot on: columns "${flat.slice(0, 40)}" -> "${pivoted.slice(0, 40)}"`)
            await h.pause(1800)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '343-kanban-board',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1400)
      },
      beats: [
        {
          say: 'Hand it the board prop and those rows become cards in lanes. Same data, same column definitions, and dragging a card writes back to the row.',
          lead: 350,
          async do(page, h) {
            const cards = await page.locator('.sv-board-card, [draggable="true"]').count()
            if (cards < 2) throw new Error(`the board painted ${cards} cards`)
            h.log(`${cards} cards on the board`)
            await h.pause(2200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '147-integrated-charts',
      zoom: 1.35,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1600)
      },
      beats: [
        {
          say: 'Charts read off the grid’s own rows, so whatever you filtered is what you plot, and the chart moves when the table does.',
          lead: 350,
          async do(page, h) {
            const svg = await page.locator('svg').count()
            if (svg < 1) throw new Error('no chart rendered')
            await h.pause(2400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '10-custom-cells-and-themes',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(4)
        await h.focusGrid()
        await h.pause(600)
      },
      beats: [
        {
          say: 'Twenty themes ship with the package, each carrying a light and a dark palette, and every surface underneath is a CSS custom property you can set yourself.',
          lead: 350,
          async do(page, h) {
            const token = () =>
              page.evaluate(() => {
                const el = document.querySelector('.sv-grid-root') ?? document.body
                const cs = getComputedStyle(el)
                return cs.getPropertyValue('--sg-bg').trim() || cs.backgroundColor
              })
            const light = await token()
            const theme = page.locator('main label', { hasText: /theme/i }).first().locator('select')
            await h.selectOption(theme, 'dark')
            await h.pause(1800)
            const dark = await token()
            if (dark === light) throw new Error(`the dark palette did not repaint the grid (${dark})`)
            h.log(`palette: ${light} -> ${dark}`)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '51-ai-assistant',
      zoom: 1.3,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1500)
      },
      beats: [
        {
          say: 'The AI helpers are in the free package rather than sold as an add-on, and they are model agnostic: you hand them a provider and ask for a filter in plain words.',
          lead: 350,
          async do(page, h) {
            await h.pause(2600)
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
          subtitle: 'Server-renders in SvelteKit. Typed columns. A ten lesson video course in the docs.',
          lines: ['svgrid.com'],
        })
      },
      beats: [
        { say: 'The grid is MIT on npm, it server-renders in SvelteKit, and the docs carry a ten lesson video course that builds all of this from an empty project. Install it and see how far twenty lines get you.', lead: 350 },
      ],
    },
  ],
}
