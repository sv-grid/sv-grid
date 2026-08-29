# Headless virtualization

`<SvGrid>` virtualizes rows and columns for you. When you render your own
markup, you virtualize yourself with the same engine SvGrid uses -
`createSvelteVirtualizer` (reactive) or `createVirtualizer` (framework-agnostic).
Only the rows in view get DOM nodes, so 100k rows stay smooth.

<div data-docs-demo="187-headless-virtual" data-height="500"></div>

## The idea

A virtualizer answers two questions as the user scrolls: **which items are
visible**, and **how far to offset them**. You give it the item `count`, an
`estimateSize` (row height), and the `viewportHeight`; it gives you the virtual
items to render plus the total size to reserve. You feed it the live scroll
position with `setScrollOffset`, and read `version` so your derived values
recompute.

```svelte
<script lang="ts">
  import {
    createSvGrid,
    createCoreRowModel,
    createSvelteVirtualizer,
    tableFeatures,
    type ColumnDef,
  } from '@svgrid/grid'

  type Row = { id: number; name: string; score: number }
  const data: Row[] = Array.from({ length: 100_000 }, (_, i) => ({
    id: i, name: `Item ${i}`, score: (i * 37) % 1000,
  }))
  const features = tableFeatures({})   // core only - nothing to sort or filter
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Name' },
    { field: 'score', header: 'Score' },
  ]

  const table = createSvGrid({
    _features: features,
    _rowModels: { coreRowModel: createCoreRowModel<Row>() },
    data, columns,
  })
  const rows = table.getRowModel().rows

  const ROW_H = 34
  const VIEWPORT_H = 420
  const virtualizer = createSvelteVirtualizer({
    count: rows.length,       // a number (call setOptions({ count }) when it changes)
    estimateSize: ROW_H,      // number, or (index) => px for variable heights
    overscan: 8,
    viewportHeight: VIEWPORT_H,
  })

  // Reading `version` makes these recompute whenever the virtualizer updates.
  const items = $derived.by(() => { virtualizer.version; return virtualizer.getVirtualItems() })
  const totalSize = $derived.by(() => { virtualizer.version; return virtualizer.getTotalSize() })

  const onScroll = (e: Event) =>
    virtualizer.setScrollOffset((e.currentTarget as HTMLElement).scrollTop)
</script>
```

## Render only what's visible

Reserve the full scroll height with a spacer, then absolutely-position each
visible row at its `start` offset:

```svelte
<div style={`height: ${VIEWPORT_H}px; overflow: auto; position: relative;`} onscroll={onScroll}>
  <!-- Spacer reserves the full height so the scrollbar is correct. -->
  <div style={`height: ${totalSize}px; position: relative;`}>
    {#each items as vi (vi.key)}
      {@const row = rows[vi.index].original as Row}
      <div style={`position: absolute; top: 0; left: 0; width: 100%;
                   height: ${ROW_H}px; transform: translateY(${vi.start}px);`}>
        {row.name} - {row.score}
      </div>
    {/each}
  </div>
</div>
```

`getVirtualItems()` returns only the ~20 rows in view (plus `overscan`), each
with `index`, `start` (px offset), `size`, and `key`. As the user scrolls,
`setScrollOffset` bumps `version` and the list re-computes; the other 99,980
rows never touch the DOM.

## Columns too

For very wide grids, `createColumnVirtualizer` does the same across leaf columns
(horizontal). Drive it with `setScrollOffset(scrollLeft)` on the container's
horizontal scroll:

```ts
const colVirtualizer = createColumnVirtualizer({
  count: leafColumns.length,
  viewportWidth: containerWidth,
  estimateSize: (i) => leafColumns[i].getSize(),
  overscan: 3,
})
```

## Which one to use

| Export | Use when |
| --- | --- |
| `createSvelteVirtualizer` | Inside a Svelte component - exposes a reactive `version` to re-derive from. |
| `createVirtualizer` | Framework-agnostic - a non-Svelte custom layer / worker (subscribe manually). |
| `createColumnVirtualizer` | Horizontal (column) virtualization. |

`VirtualItem`, `VirtualizerOptions`, and `VirtualizerState` are exported for
type annotations.

## See also

- [Build a table from scratch](./build-a-table.md) - render non-virtualized first
- [Row models](./row-models.md)
- [Benchmarks](../benchmarks.md) - the 1M-row numbers
