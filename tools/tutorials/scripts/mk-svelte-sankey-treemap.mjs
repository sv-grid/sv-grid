/**
 * C3 from the plan: "Sankey, treemap and the chart types nobody ships."
 *
 * Targets "svelte sankey diagram" - 22 impressions at position 46.9, the
 * largest single component signal in marketing/gsc/Queries.csv - and carries
 * the C8 positioning point with it: `SvChart` is a standalone component that
 * renders a plain `ChartSpec` as inline SVG, needs no grid, and pulls in no
 * charting dependency. We currently describe charting as a grid feature.
 *
 * No runnable doc block renders a sankey or a treemap, so those two come from
 * the gallery demos; the typed code is the sunburst block from
 * docs/help/charts/types.md, which is 19 lines and standalone.
 */
import { typeLines, reveal } from '../lib/lesson.mjs'

const SPEC = 'help-charts-types--14'
const SVG = '.br-page-snippet svg'

export default {
  id: 'mk-svelte-sankey-treemap',
  kind: 'marketing',
  title: 'Sankey, treemap and 29 chart types in Svelte',
  description: 'A chart component for Svelte 5 with no charting dependency: hand it a plain spec and it draws inline SVG, from a bar chart to a sankey, treemap or sunburst.',
  tags: ['svelte sankey diagram', 'svelte chart component', 'svelte treemap', 'svelte charts', 'sunburst chart', 'svelte 5', 'data visualization'],
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
          title: 'Sankey. Treemap. Sunburst.',
          subtitle: 'A chart component with no charting dependency.',
        })
      },
      beats: [
        { say: 'Most Svelte component libraries stop before charts, and the ones that do charts usually wrap a large JavaScript charting library, which you then carry in your bundle, configure in its own vocabulary, and theme separately from everything else. This is neither. It is one component that takes a plain object describing what you want and draws inline SVG. Twenty nine types share that one object, including the three or four shapes that normally send people looking for a second dependency: the sankey, the treemap, the sunburst.', lead: 300 },
      ],
    },
    {
      stage: true,
      introHold: 0.4,
      async setup(page, h) {
        await h.stage.show('editor', { file: 'src/Revenue.svelte', code: '' })
      },
      beats: [
        {
          say: 'Here is the whole API. Import the chart component, describe the chart as data: a type, and the values it needs. This one is a sunburst, so the values are a hierarchy. There is no chart builder to learn and no plugin to register.',
          lead: 400,
          async do(page, h) {
            await typeLines(h, SPEC, 0, 22, 85)
            await h.stage.editor.cursor(false)
          },
          hold: 300,
        },
        {
          say: 'Nineteen lines, and no grid anywhere in it. The chart is a component in its own right, so it works on a dashboard, in a card, or beside a table you happen to have.',
          lead: 300,
          async do(page, h) {
            await reveal(h, SPEC, { file: 'src/Revenue.svelte', focus: 'SvChart' })
            await page.waitForSelector(SVG, { timeout: 30_000 })
            const svg = await page.locator(SVG).count()
            if (svg < 1) throw new Error('the chart snippet rendered no SVG')
            h.log(`${svg} svg element(s) from a 19 line spec`)
            await h.pause(2600)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '165-chart-sankey',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'A sankey is the one people give up on. It takes a list of nodes and a list of links, works out the depth of each node by its longest path, and sizes every band by the value flowing through it. Change the data and the whole layout recomputes; there is nothing to position by hand and no coordinates in your source. That is the actual reason flow diagrams end up as a screenshot pasted into a slide: the drawing is the hard part, not the numbers. Here the numbers are the input and the drawing is the output.',
          lead: 350,
          async do(page, h) {
            const svg = await page.locator('svg').count()
            if (svg < 1) throw new Error('no sankey rendered')
            const paths = await page.locator('svg path, svg rect').count()
            if (paths < 5) throw new Error(`the sankey drew ${paths} shapes`)
            h.log(`sankey: ${paths} shapes`)
            await h.pause(3000)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '164-chart-treemap',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'A treemap is the same idea for a hierarchy: revenue by region, then category, then product, with area standing in for size. It is the chart that answers what is big and what is inside it in one picture, and it is the other one people reach for a separate library to get.',
          lead: 350,
          async do(page, h) {
            const rects = await page.locator('svg rect').count()
            if (rects < 5) throw new Error(`the treemap drew ${rects} rectangles`)
            h.log(`treemap: ${rects} rectangles`)
            await h.pause(3000)
          },
          hold: 400,
        },
      ],
    },
    {
      demo: '147-integrated-charts',
      zoom: 1.25,
      introHold: 0.4,
      async setup(page, h) {
        await h.pause(1800)
      },
      beats: [
        {
          say: 'And when there is a grid in the picture, the chart can read its rows rather than a copy of them. That matters more than it sounds. The usual arrangement is a chart fed by its own query, which drifts from the table beside it the moment someone filters: two numbers on one screen that disagree, and an afternoon spent working out which one lied. Here the filter narrows the rows and the chart is drawing those rows, so the two cannot disagree.',
          lead: 350,
          async do(page, h) {
            const svg = await page.locator('svg').count()
            if (svg < 1) throw new Error('no chart rendered beside the grid')
            h.log(`${svg} chart element(s) bound to the grid`)
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
          subtitle: 'Twenty nine chart types from one spec. Inline SVG, no charting dependency, and it works with or without a grid.',
          lines: ['svgrid.com/docs/help/charts/types'],
        })
      },
      beats: [
        { say: 'Twenty nine types share that one spec, from the ordinary bar and line through to pareto, bullet, stream, nightingale and dumbbell. They render as inline SVG, so they print, they scale, and they carry text a screen reader can read. And when you do have a grid, the chart can read its rows directly, so filtering the table filters the chart. The types page below has a live example of every one.', lead: 350 },
      ],
    },
  ],
}
