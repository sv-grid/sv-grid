# Bento grid blocks

Feature sections laid out as a bento grid: a CSS grid where some tiles span
two columns or two rows. The tile art is inline SVG or CSS drawn from the
`--sg-*` tokens, so it follows the theme. Each block is one `.svelte` file built
from `SvButton`, `SvBadge` and `SvToaster`.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/bento"></div>

See them first with `npx @svgrid/ui try blocks/bento`. No project needed.

## Feature bento

One large tile with a mini results table and a query pill, next to four
smaller tiles: a bar chart, a line crossing an alert threshold, team avatars
and two export files. Every tile has a title, one line and a "Read the guide"
link; the large one carries a "New" badge. Four columns on desktop, two below
900 px and one below 560 px.

<div data-docs-demo="642-block-bento-features" data-height="700"></div>

`npx @svgrid/ui add bento-features`

## Changing the layout from the tile data

The grid shape lives in the tile data, not in the CSS. Each tile can carry
`col` and `row` (how many columns and rows it spans on desktop, default 1) and
`order` (its position in the one-column phone layout, default its place in
the list). `tileProps()` writes them onto the tile as `--sv-bf-col`,
`--sv-bf-row` and `--sv-bf-order`, and the stylesheet reads those variables.
`columns` sets the desktop column count (default 4); a `col` larger than it is
clamped.

To put the large tile on the right:

```ts
const bento = createBentoFeatures({
  columns: 4,
  tiles: [
    { id: 'dashboards', title: 'Dashboards that refresh', line: '...' },
    { id: 'exports', title: 'CSV and PDF export', line: '...' },
    { id: 'query', title: 'Ask in plain English', line: '...', col: 2, row: 2, order: -1 },
    { id: 'sharing', title: 'Shared workspaces', line: '...' },
    { id: 'alerts', title: 'Threshold alerts', line: '...' },
  ],
  onOpen: (tile) => goto(`/docs/${tile.id}`),
})
```

The tiles fill the grid in list order with the browser's normal placement, so
keep the spans adding up to whole rows (here 1 + 1 + 2 in the first row, then
two single tiles beside the large tile's second row) or the grid leaves a gap.
On a phone the spans are dropped and `order: -1` moves the large tile above
the others, whose order defaults to their list index. The art is chosen by tile `id` in the markup; a tile with a new `id`
falls through to the export-files drawing until you add a branch for it.

`onOpen` gets the whole tile object when its "Read the guide" link is pressed,
so routing, analytics or opening a side panel all happen there. The core keeps
the last opened id in `opened`.

## Headless

The block is a styled render of the core in its `<script module>`. To draw
your own markup, take the core alone with `npx @svgrid/ui add bento-features
--headless` (it writes `bento-features.svelte.ts`) and spread its prop-getters
on plain elements. Your stylesheet reads the span variables:

```svelte
<script lang="ts">
  import { createBentoFeatures } from './bento-features.svelte.js'

  const bento = createBentoFeatures({ onOpen: (t) => console.log('open', t.id) })
</script>

<ul class="bento" {...bento.gridProps()}>
  {#each bento.tiles as t, i (t.id)}
    <li {...bento.tileProps(t, i)}>
      <h3 id={bento.titleId(t)}>{t.title}</h3>
      <p>{t.line}</p>
      <button {...bento.openProps(t)}>Read the guide</button>
    </li>
  {/each}
</ul>

<style>
  .bento { display: grid; grid-template-columns: repeat(var(--sv-bf-cols), 1fr); gap: 12px; }
  .bento li { grid-column: span var(--sv-bf-col); grid-row: span var(--sv-bf-row); }
  @media (max-width: 560px) {
    .bento { grid-template-columns: 1fr; }
    .bento li { grid-column: auto; grid-row: auto; order: var(--sv-bf-order); }
  }
</style>
```

## See also

- [UI blocks overview](./index.md)
- [SvBadge](../ui-components/sv-badge.md)
- [SvButton](../ui-components/sv-button.md)
