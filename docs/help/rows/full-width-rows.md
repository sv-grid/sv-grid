# Full-width rows

"Full-width rows" are rows whose content takes the entire grid width
instead of being cell-by-cell - useful for inline editors, banner ads,
section dividers, and detail-row expansions.
<div data-docs-demo="08-tree-and-master-detail" data-height="540"></div>

## Detail-row API (shipped)

Full-width rows are built in via `isDetailRow` + `renderDetailRow`: mark a row as
a detail row and it renders as a real full-width `colspan` cell hosting your
snippet - a nested grid, a form, timelines, anything.

```svelte
<SvGrid
  {data} {columns}
  isDetailRow={(row) => row.kind === 'detail'}
  renderDetailRow={DetailPanel}
/>
```

See [Master / detail (nested grids)](./master-detail.md) for the full
expand/collapse pattern, and demo `106-detail-rows` for a multi-panel detail.

A single sticky footer row is also available via `summary` (off by default):

```svelte
<SvGrid {data} {columns} summary />
```

It sums a numeric column and counts the rest. Pick a different aggregate per
column with that column's own `summary` option (`'avg'`, `'min'`, `'max'`,
`'count'`, a custom function), or `summary: false` to leave the cell blank.


## A detail row under its parent

Mark the row, render the panel. `isDetailRow` answers "is this one of them",
`renderDetailRow` is a snippet that gets the row and its index, and the grid
gives it a real `colspan` cell across every column.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  // One flat type, not a union: `field` is `keyof TData`, and `keyof` over a
  // union keeps only the shared keys, so `field: 'customer'` would not type.
  type Row = {
    kind: 'order' | 'detail'
    id: string
    customer?: string
    total?: number
    lines?: string[]
  }

  const rows: Row[] = [
    { kind: 'order',  id: 'A-1',  customer: 'Ada Lovelace', total: 240 },
    { kind: 'detail', id: 'A-1d', lines: ['2 x Cycling cap', '1 x Road bottle'] },
    { kind: 'order',  id: 'A-2',  customer: 'Grace Hopper', total: 96 },
    { kind: 'detail', id: 'A-2d', lines: ['3 x Patch kit'] },
  ]

  const columns: GridColumns<Row> = [
    { field: 'id',       header: 'Order',    width: 110 },
    { field: 'customer', header: 'Customer', width: 190 },
    { field: 'total',    header: 'Total',    width: 120,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

{#snippet DetailPanel(props: { row: Row; rowIndex: number })}
  <div style="padding: 8px 14px; font-size: 12px; opacity: 0.85;">
    {#each props.row.lines ?? [] as line}
      <div>{line}</div>
    {/each}
  </div>
{/snippet}

<SvGrid
  data={rows}
  {columns}
  rowHeight={40}
  isDetailRow={(row) => row.kind === 'detail'}
  renderDetailRow={DetailPanel}
/>
```

## Section dividers are the same mechanism

Nothing says a full-width row has to be a detail panel. Interleave marker
rows into the data and the same two props give you group headers, banners, or an
end-of-list note - no extra API, and sorting still applies to the real rows if
you turn it on for the columns that carry values.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Row = {
    kind: 'person' | 'divider'
    id: number
    name?: string
    city?: string
    label?: string
  }

  const rows: Row[] = [
    { kind: 'divider', id: 100, label: 'Engineering' },
    { kind: 'person',  id: 1, name: 'Ada Lovelace', city: 'London' },
    { kind: 'person',  id: 2, name: 'Grace Hopper', city: 'New York' },
    { kind: 'divider', id: 101, label: 'Platform' },
    { kind: 'person',  id: 3, name: 'Linus Torvalds', city: 'Portland' },
  ]

  const columns: GridColumns<Row> = [
    { field: 'name', header: 'Name', width: 200 },
    { field: 'city', header: 'City', width: 170 },
  ]
</script>

{#snippet Divider(props: { row: Row; rowIndex: number })}
  <div style="padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.65;">
    {props.row.label}
  </div>
{/snippet}

<SvGrid
  data={rows}
  {columns}
  rowHeight={32}
  isDetailRow={(row) => row.kind === 'divider'}
  renderDetailRow={Divider}
/>
```

## See also

- [Master / detail (nested grids)](./master-detail.md)
- [Grouping](./row-data.md)
