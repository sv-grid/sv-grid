# Row height

Row height is a single integer in pixels.
<div data-docs-demo="10-custom-cells-and-themes" data-height="540"></div>

```svelte
<SvGrid {data} {columns} features={{}} rowHeight={36} />
```

The default is 30 px. The virtualizer reads `rowHeight` and uses it to
compute the visible window and total scroll height.

Because the virtualizer needs the height as a number up front, row
height is a prop rather than a CSS token, and the grid writes it as an
inline style on each row. A stylesheet rule cannot set it.

## Density

A density toggle is just a derived `rowHeight`:

```svelte
<script lang="ts">
  let density = $state<'compact' | 'normal' | 'comfortable'>('normal')
  const px = $derived(density === 'compact' ? 28 : density === 'comfortable' ? 48 : 30)
</script>

<SvGrid {data} {columns} features={{}} rowHeight={px} />
```

The example gallery's
[demos/10-custom-cells-and-themes.svelte](../../../examples/src/demos/10-custom-cells-and-themes.svelte)
shows the density toggle in full.

## Auto row height (size each row to its content)

`autoRowHeight` lets cell text wrap and sizes every row to its tallest cell:

```svelte
<SvGrid {data} {columns} autoRowHeight />
```

Rows are measured after they render, so this works with virtualization. Before
a row has been measured the grid uses `rowHeight` (or 30) as its estimate, which
keeps the scrollbar stable as you scroll into rows for the first time:

```svelte
<!-- 44px is the starting guess; each row settles to its real height -->
<SvGrid {data} {columns} autoRowHeight rowHeight={44} />
```

Things worth knowing:

- It costs a measurement pass per row. With uniform content a fixed `rowHeight`
  is cheaper - reach for `autoRowHeight` when you have free text, notes, or
  wrapped addresses.
- Passing a **function** `rowHeight` turns it off. You are already supplying
  per-row heights, so measuring would fight you.
- Rows re-measure when their content reflows, e.g. after a column resize.
- Measurements are dropped when the row set changes, so filtering or replacing
  `data` never sizes a new row by the old one's content.

## Variable row height (you supply the numbers)

Pass a function to size rows yourself, without measuring:

```svelte
<SvGrid {data} {columns} rowHeight={(i) => (data[i].tall ? 80 : 36)} />
```

The virtualizer handles the variable-size case natively (cumulative offsets), so
scrolling and the total height stay correct. The same engine is available
headless if you are building your own row layout:

```ts
import { createSvelteVirtualizer } from '@svgrid/grid'

const virtualizer = createSvelteVirtualizer({
  count: rows.length,
  estimateSize: (index) => rows[index]!.tall ? 80 : 36,
  viewportHeight: scrollEl.clientHeight,
  overscan: 6,
})

// It owns no DOM. Feed it your scroller's numbers as they change:
virtualizer.setScrollOffset(scrollEl.scrollTop)
virtualizer.setViewportHeight(scrollEl.clientHeight)
```

See [`packages/grid/src/virtualization/`](../../../packages/grid/src/virtualization/).

## Header height

Header height is independent of row height. See
[Column headers](../columns/column-headers.md) for how to size it.

## Row-number column width

When `showRowNumbers={true}`, the leading row-number column defaults
to **56 px**, which fits up to `99,999`. For larger datasets, bump
the width via `rowNumberWidth`:

```svelte
<!-- One million rows: "1,000,000" needs ~ 92 px to stay fully visible -->
<SvGrid
  {data}
  {columns}
  features={{}}
  showRowNumbers={true}
  rowNumberWidth={92}
  rowHeight={18}
  virtualization={true}
  containerHeight="100%"
/>
```

Rule of thumb: budget ~ 8 px per digit plus 14 px of padding. So:

| Row count    | Largest number | Suggested `rowNumberWidth` |
|--------------|----------------|----------------------------|
| < 1 000      | "999"          | `40`                       |
| < 100 000    | "99,999"       | `56` (default)             |
| < 10 000 000 | "9,999,999"    | `92`                       |

Demo 78 ("1 million rows") uses 92 px so the millionth row's index
stays legible at the bottom of the scroll.

## See also

- [Row pinning](./row-pinning.md)
- [Styling rows](./styling-rows.md)
- [Demo 78 - 1 million rows](../../../examples/src/demos/78-million-rows.svelte)
