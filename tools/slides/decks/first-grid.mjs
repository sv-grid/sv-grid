/**
 * "Stop hand-rolling tables in Svelte" - install, the smallest grid, then
 * features as props. Targets "svelte data grid" / "svelte table component".
 *
 * Slides 3-5 are runnable doc snippets: the code shown is the file whose
 * output is screenshotted next to it (docs/getting-started/2-first-grid.md).
 * Slide 5's <SvGrid> line is wrapped for a phone; whitespace only.
 */
import { demo, snippetSource, stageSnippet } from '../lib/shots.mjs'

const FIRST = 'getting-started-2-first-grid--0'
const FEATURES = 'getting-started-2-first-grid--2'

export default {
  id: 'first-grid',
  caption:
    'A Svelte 5 data grid you install instead of build. Rows and typed columns in, a grid out; sorting, filtering, paging, pinning and grouping are props. MIT, on npm as @svgrid/grid. Docs: svgrid.com/docs',
  hashtags: ['svelte', 'sveltejs', 'svelte5', 'webdev', 'javascript', 'typescript', 'frontend', 'datagrid'],
  slides: [
    {
      kind: 'title',
      title: 'Stop hand-rolling ==tables== in Svelte.',
      body: 'One component. Sorting, filtering, paging, pinning and grouping are props.',
      shot: demo('02-sort-filter-paginate', { width: 820, height: 980 }),
    },
    {
      kind: 'code',
      title: 'Install it.',
      code: 'npm install @svgrid/grid',
      body: 'Svelte 5 and runes. MIT licensed. Twenty themes ship with it, each with a dark palette.',
    },
    {
      kind: 'code',
      title: 'Rows in, columns in.',
      file: 'App.svelte',
      // The one-line type is 67 characters, 21px on the slide. Reflowed only.
      code: snippetSource(FIRST).replace(
        '  type Person = { firstName: string; age: number; status: string }',
        '  type Person = {\n    firstName: string\n    age: number\n    status: string\n  }',
      ),
    },
    {
      kind: 'shot',
      title: 'That is the whole grid.',
      body: '`GridColumns<Person>` types `field` as a key of your row, so TypeScript catches a typo in a column name.',
      shot: stageSnippet(FIRST, { width: 520 }),
      after: 'No CSS framework needed: the grid ships its own stylesheet.',
    },
    {
      kind: 'shot',
      title: 'Features are props.',
      code: "<SvGrid data={seed} {columns}\n  sortable filterable pageable\n  pageSize={2} />",
      shot: stageSnippet(FEATURES, { width: 660 }),
    },
    {
      kind: 'shot',
      title: 'Pin columns.',
      code: "initialColumnPinning={{\n  left: ['company'],\n  right: ['price'],\n}}",
      shot: demo('25-column-pinning', { width: 860, height: 900 }),
    },
    {
      kind: 'shot',
      title: 'Group rows by a column.',
      code: "groupBy={['department']}",
      // The demo's totals footer counts group header rows (it aggregates the
      // visible row list), so it stays out of the shot until that is fixed.
      shot: demo('07-grouping-aggregation', {
        width: 860,
        height: 720,
        waitFor: '.sv-grid-body [role="row"]',
        trim: true,
        css: '.sv-grid-foot { display: none !important; }',
      }),
    },
    {
      kind: 'end',
      title: 'svgrid.com/docs',
      lines: ['`npm install @svgrid/grid`', 'Svelte 5 only. MIT.'],
    },
  ],
}
