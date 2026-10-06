/**
 * C2 from the plan: "A pivot table / OLAP cube in Svelte."
 *
 * Targets "javascript pivot table olap" (position 62) and "svelte pivot
 * table". Nothing in the free Svelte UI libraries ships a pivot engine, so
 * this is uncontested ground.
 *
 * Goes beyond the existing 42 s `mk-pivot-tables` cut: that one only drags
 * fields in the designer. This builds the pivot from the runnable blocks in
 * docs/help/pivot/start.md first, so the viewer sees the API before the UI.
 *
 * Competitor names stay out of the narration. Demo 124's own header comment
 * names other vendors; nothing from it is quoted here.
 */
import { typeLines, reveal } from '../lib/lesson.mjs'

const START = 'help-pivot-start--1'
const SHAPED = 'help-pivot-start--3'

/** Rows of the mounted snippet's pivot grid. */
const ROW = '.br-page-snippet .sv-grid-body [role="row"]'

export default {
  id: 'mk-svelte-pivot-olap',
  kind: 'marketing',
  title: 'A pivot table and an OLAP cube in Svelte',
  description: 'Cross-tab your rows without a second library: a pivot from four lines, a drag-and-drop designer, pivot mode on the grid you already have, and a cube browser.',
  tags: ['svelte pivot table', 'javascript pivot table olap', 'olap cube', 'pivot grid', 'svelte 5', 'data analysis'],
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
          title: 'A pivot table. And a cube.',
          subtitle: 'Cross-tab your rows without exporting them anywhere.',
        })
      },
      beats: [
        { say: 'A pivot table used to mean exporting to a spreadsheet. The data is already in the browser, in a grid that knows the shape of every row, so the sensible place to pivot it is right there. This is what that looks like in Svelte, starting from the smallest version and ending at a cube browser.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/Sales.svelte', code: '' })
      },
      beats: [
        {
          say: 'Here is the smallest pivot there is. The same rows you would put in a table, and one more prop describing the shape you want: which fields go down the side, which go across the top, and what to aggregate in the middle.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, START, 0, 40, 95)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'That is the whole configuration. Rows, columns, values, and an aggregation per value. The engine groups, aggregates and lays out the cross-tab, and the result is still a grid, so it sorts, scrolls and exports like one.',
          lead: 300,
          async do(page, h) {
            await reveal(h, START, { file: 'src/Sales.svelte', focus: 'pivot' })
            await page.waitForSelector(ROW, { timeout: 30_000 })
            const rows = await page.locator(ROW).count()
            if (rows < 2) throw new Error(`the pivot snippet rendered ${rows} rows`)
            h.log(`${rows} rows in the cross-tab`)
            await h.pause(2200)
          },
          hold: 400,
        },
        {
          say: 'Change the shape and the numbers follow. Add a second field down the side and you get a nested cross-tab, with subtotals at each level, because the aggregation is computed per group rather than summed from the cells above it.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SHAPED, { file: 'src/Sales.svelte', focus: 'pivot' })
            await page.waitForSelector(ROW, { timeout: 30_000 })
            const rows = await page.locator(ROW).count()
            if (rows < 2) throw new Error(`the nested pivot rendered ${rows} rows`)
            await h.pause(2400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '168-pivot-designer',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await page.waitForSelector('.pvd-field', { timeout: 60_000 })
        await h.pause(900)
      },
      beats: [
        {
          say: 'Most of the time the person who wants the pivot is not the person who wrote the code, so there is a designer. Fields down one side, three wells on the other: rows, columns and values. Tick a field and it joins the layout in the well that suits its type, and the cross-tab recomputes on the spot.',
          lead: 350,
          async do(page, h) {
            // The checkbox, not a dispatched drag. Each field carries a real
            // `<input type="checkbox" aria-label="Toggle ...">` wired to the
            // same toggleFieldDefault the drag ends up calling, and synthetic
            // HTML5 drags have now silently no-opped three times in this
            // pipeline. This is also what most users actually click.
            const chips = () => page.locator('.pvd-well .pvd-chip').count()
            const before = await chips()
            const box = page.locator('.pvd-field input[type="checkbox"]:not(:checked)').first()
            await box.waitFor({ state: 'visible', timeout: 15_000 })
            await h.click(box)
            await h.pause(1800)
            const after = await chips()
            if (after <= before) throw new Error(`ticking a field added nothing to a well (${before} -> ${after})`)
            h.log(`designer: wells went from ${before} to ${after} fields`)
            await h.pause(1400)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '360-pivot-mode-grid',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.gridReady(3)
        await h.pause(900)
      },
      beats: [
        {
          say: 'And you do not need a separate component for it. A grid you already have flips into pivot mode with one switch: the flat rows become the cross-tab, the designer docks beside it, and flipping back returns the table you started with.',
          lead: 350,
          async do(page, h) {
            const headers = () => page.locator('[role="columnheader"]').allTextContents()
            const flat = (await headers()).join('|')
            if (!flat) throw new Error('no column headers before the toggle')
            await h.click(page.locator('.pvd-pivot-toggle').first())
            await h.pause(2400)
            if (!(await page.locator('.pvd-switch.on').count())) throw new Error('the Pivot Mode switch is still off')
            const pivoted = (await headers()).join('|')
            if (pivoted === flat) throw new Error('Pivot Mode did not change the columns')
            h.log(`pivot mode: "${flat.slice(0, 36)}" -> "${pivoted.slice(0, 36)}"`)
            await h.pause(1800)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '124-pivot-olap',
      zoom: 1.15,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'Push it further and you get a cube browser: dimensions nested down the side, measures across the top, and a tabular layout an analyst recognises immediately. Expand a dimension and the level below it appears with its own subtotals. Every number here is computed in the browser from the rows you handed it. There is no cube server behind this, no query language to learn, and no second dependency in the bundle. The practical consequence is that the thing your users asked for, the one that normally means a BI tool and a nightly job, is a prop on a component in your own app, against data you already loaded, behind your own auth.',
          lead: 350,
          async do(page, h) {
            const rows = await page.locator('.sv-grid-body [role="row"]').count()
            if (rows < 3) throw new Error(`the cube browser painted ${rows} rows`)
            h.log(`${rows} rows in the cube`)
            await h.pause(3200)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '125-pivot-charts',
      zoom: 1.2,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'A cross-tab is already the shape a chart wants: categories down one axis, series across the other, a number in each cell. So the same layout drives a chart without you restating any of it. Re-pivot and the chart follows, because it is reading the pivot result rather than a copy of it.',
          lead: 350,
          async do(page, h) {
            const svg = await page.locator('svg').count()
            if (svg < 1) throw new Error('no chart rendered from the pivot')
            h.log(`${svg} chart elements from the pivot layout`)
            await h.pause(2800)
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
          title: 'Pivot, in the grid you already have.',
          subtitle: 'The pivot engine and the designer are part of @svgrid/enterprise. The grid underneath is MIT.',
          lines: ['svgrid.com/docs/help/pivot'],
        })
      },
      beats: [
        { say: 'The pivot engine and the designer are an Enterprise feature; the grid they sit on is MIT on npm. The same engine drives pivot over server data, where the server returns the aggregates and the browser never sees the detail rows, and it drives the pivot table inside the spreadsheet too. The docs page below has the configuration from all of this.', lead: 350 },
      ],
    },
  ],
}
