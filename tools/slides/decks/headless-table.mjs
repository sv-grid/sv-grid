/**
 * "A headless table in Svelte 5" - targets "svelte headless table", the best
 * non-branded query in Search Console (position 19).
 *
 * Code is excerpted from the runnable doc snippet help-headless-overview--1
 * (docs/help/headless/overview.md); slide 6 screenshots that same file
 * running. Excerpts drop comments and the type import and wrap long lines;
 * nothing else is changed. The <tbody> is left off slide 5 rather than shown
 * with the snippet's template `as` cast, which the repo's own rules flag.
 *
 * 9.8 KB: `node packages/grid/scripts/measure-size.mjs` on 2026-10-11,
 * "headless subpath (@svgrid/grid/core): base JS gzip 9.8 KB". Re-measure
 * before reusing the number.
 */
import { demo, stageSnippet } from '../lib/shots.mjs'

const SNIPPET = 'help-headless-overview--1'

export default {
  id: 'headless-table',
  caption:
    'Headless table in Svelte 5: createSvGrid sorts and filters, your markup renders. No grid CSS, no wrapper component; the whole @svgrid/grid/core entry is 9.8 KB gzipped. Full guide: svgrid.com/docs/help/headless/overview',
  hashtags: ['svelte', 'sveltejs', 'svelte5', 'headlessui', 'webdev', 'javascript', 'typescript', 'frontend'],
  slides: [
    {
      kind: 'title',
      title: 'A ==headless== table in Svelte 5.',
      body: 'The engine sorts and filters. You write the `<table>`.',
      shot: demo('186-headless-table', { width: 760, height: 900, waitFor: 'table tbody tr', trim: true }),
    },
    {
      kind: 'shot',
      title: '9.8 KB gzipped.',
      body: 'That is the whole headless entry, `@svgrid/grid/core`. Features you do not register do not ship.',
      after: 'Your markup, your CSS: Tailwind, a design system, or plain `<table>` tags. There is no grid stylesheet to fight.',
    },
    {
      kind: 'code',
      title: 'Create the engine.',
      file: 'Table.svelte',
      code: [
        "import { createSvGrid, createCoreRowModel,",
        "  createSortedRowModel, tableFeatures,",
        "  rowSortingFeature } from '@svgrid/grid/core'",
        '',
        'const features = tableFeatures({ rowSortingFeature })',
        "let sorting = $state([{ id: 'stars', desc: true }])",
        '',
        'const table = createSvGrid({',
        '  _features: features,',
        '  _rowModels: {',
        '    coreRowModel: createCoreRowModel<Repo>(),',
        '    sortedRowModel: createSortedRowModel<Repo>(),',
        '  },',
        '  data,',
        '  columns,',
        '  state: { sorting },',
        '  onSortingChange: (u) => (sorting =',
        "    typeof u === 'function' ? u(sorting) : u),",
        '})',
      ].join('\n'),
    },
    {
      kind: 'code',
      title: 'Read the rows.',
      body: 'The engine store is plain JavaScript, not a rune. Read the state you own inside the derived and it re-runs when that state changes.',
      code: ['const rows = $derived.by(() => {', '  sorting', '  return table.getRowModel().rows', '})'].join('\n'),
    },
    {
      kind: 'code',
      title: 'Write your own markup.',
      body: 'The headers come from the engine; the click handler is its sort toggle. The `<tbody>` is the same loop over `rows`.',
      code: [
        '<thead>',
        '  {#each table.getHeaderGroups() as hg (hg.id)}',
        '    <tr>',
        '      {#each hg.headers as h (h.id)}',
        '        <th onclick={h.column',
        '          .getToggleSortingHandler()}>',
        '          {h.column.columnDef.header}',
        '        </th>',
        '      {/each}',
        '    </tr>',
        '  {/each}',
        '</thead>',
      ].join('\n'),
    },
    {
      kind: 'shot',
      title: 'That is a sortable table.',
      body: 'This is the same file running, before any styling. Click a header and the engine sorts.',
      shot: stageSnippet(SNIPPET, { width: 520, selector: '.br-page-snippet table', trim: false }),
    },
    {
      kind: 'end',
      title: 'svgrid.com/docs',
      lines: ['Help, then Headless: Build a table', 'Or `<SvGrid>` when you want it drawn for you'],
    },
  ],
}
