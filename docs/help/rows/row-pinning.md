# Row pinning (top / bottom)

Pin specific rows to the **top** or **bottom** of the grid so they stay visible while the rest of the data scrolls. Typical use cases:

- A **totals** or **aggregate** row anchored at the top of a long ledger.
- An **industry benchmark** or **target** row for at-a-glance comparison.
- A **page totals** row at the bottom that recomputes as filters narrow the visible set.
- A **headline metric** (e.g. "Closing balance") that should never scroll out of view.

<div data-docs-demo="108-pinned-rows-engine" data-height="540"></div>

## Props

`<SvGrid>` accepts two props:

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 190 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 130 },
    { field: 'age',        header: 'Age',        width: 80 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```ts
pinnedTopRows?:    ReadonlyArray<TData>
pinnedBottomRows?: ReadonlyArray<TData>
```

Each is an array of your own row objects (same `TData` type as `data`). The grid renders them inside the same table as the regular rows, with `position: sticky` so they track the scroll. They share the column schema (widths, pinning, `format`, `cellClass`) - you do not redefine columns.

## Quick start

```ts
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Row = { id: string; account: string; arr: number; seats: number }

  let rows = $state<Row[]>([ /* ...200 accounts... */ ])

  // Pinned-top: a single "totals" row computed from `rows`.
  const totals = $derived<Row[]>([
    {
      id: '⌃ TOTALS',
      account: `All ${rows.length} accounts`,
      arr:   rows.reduce((s, r) => s + r.arr, 0),
      seats: rows.reduce((s, r) => s + r.seats, 0),
    },
  ])

  const features = tableFeatures({ rowSortingFeature })
  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',      header: 'Account', width: 130, editable: false },
    { field: 'account', header: 'Name',    width: 240, editable: false },
    { field: 'arr',     header: 'ARR',     width: 140, align: 'right',
      format: { type: 'number', options: { style: 'currency', currency: 'USD' } } },
    { field: 'seats',   header: 'Seats',   width: 100, align: 'right' },
  ]
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  pinnedTopRows={totals}
/>
```

The totals row sticks under the header and stays in view while the user scrolls.

## Filter-aware "page totals" at the bottom

The grid exposes `api.getDisplayedRows()` - the post-filter / post-sort / post-pagination row set. Combine it with `pinnedBottomRows` for a "page total" that updates as filters narrow the data.

```ts
<script lang="ts">
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let snapshot = $state<readonly Row[]>([])

  // Resync the snapshot whenever filters / sorts likely changed. A
  // 400 ms poll keeps the demo simple; production code can hook the
  // `onFiltersChange` / `onSortingChange` events instead.
  $effect(() => {
    const id = setInterval(() => { snapshot = api?.getDisplayedRows() ?? rows }, 400)
    return () => clearInterval(id)
  })

  const pageTotals = $derived<Row[]>([{
    id: '⌄ PAGE',
    account: `Visible page (n = ${snapshot.length})`,
    arr:   snapshot.reduce((s, r) => s + r.arr, 0),
    seats: snapshot.reduce((s, r) => s + r.seats, 0),
  }])
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  pinnedBottomRows={pageTotals}
  onApiReady={(next) => (api = next)}
/>
```

## Multiple pinned rows

Pass more than one row in either array; the grid stacks them. The first row sticks closest to the header (top) or to the bottom edge (bottom).

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  pinnedTopRows={[totals, benchmark, target]}
  pinnedBottomRows={[pageTotals, runningBalance]}
/>
```

The built-in CSS supports stacking up to 4 rows per side. For larger stacks, override the CSS variables yourself:

```css
.sv-grid-pinned-row-top[data-pinned-index="4"] td {
  top: calc(var(--sg-thead-h, 36px) + var(--sg-pinned-row-h, 32px) * 4);
}
```

## How pinned rows behave

| Behavior | Regular rows | Pinned rows |
| --- | --- | --- |
| Inline editing | Yes (when `enableInlineEditing`) | No |
| Selection checkbox | Yes (when enabled) | No (cell rendered empty) |
| Cell selection rectangle | Yes | No (cells skipped) |
| Sorting | Yes | No (pinned rows are in a separate `<tbody>`) |
| Filtering | Yes | No (pinned rows are not filtered) |
| Fill handle | Yes | No |
| `cellClass` | Yes | Yes |
| `format` | Yes | Yes |
| Column pinning (left/right) | Yes | Yes |

Pinned rows are **read-only by design** - they represent aggregates or annotations, not transactional data. If you need an editable row at the top, render it OUTSIDE the grid as a separate toolbar, or use a regular row with `data` and filter it to always sort first.

## Styling

Pinned rows expose two CSS variables on the grid shell that you can override:

```css
.sv-grid-shell {
  --sg-pinned-bg:     color-mix(in oklab, #6366f1 4%, #ffffff);
  --sg-pinned-border: color-mix(in oklab, #6366f1 24%, transparent);
}
```

For per-row styling, target the row's class directly:

```css
.sv-grid-pinned-row-top    { font-weight: 700; }
.sv-grid-pinned-row-bottom { background: #ecfdf5; }
```

Each row also carries `data-pinned-row="top" | "bottom"` and `data-pinned-index="0..N"` so you can paint distinct ranks differently.

## More examples

### Pinned rows (top / bottom)

Frozen "Account totals" row at the top + sticky "Page totals" at the bottom that reacts to filters. Right-click any row to pin it.

<div data-docs-demo="107-pinned-rows" data-height="460"></div>

## Pinned rows and row numbers

Pinned rows sit outside the scrolling body, so they survive sorting and paging.
Row numbers count the scrolling rows only, which is what makes a pinned total
read as a total rather than as row 6.

```svelte {runnable}
<SvGrid data={people} {columns} showRowNumbers sortable pageable pageSize={3} />
```

## See also

- Demo 108: Pinned rows (engine prop)
- Demo 107: Pinned rows (stacked-grids user-land pattern)
- `api.getDisplayedRows()` - drives filter-aware page totals.
