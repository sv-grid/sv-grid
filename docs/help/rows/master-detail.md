# Master / detail (nested grids)

Master/detail is the pattern where each **master** row expands to reveal
a **detail** panel - most often a nested grid of the row's child records. SvGrid
builds it from two props on `<SvGrid>`:

- `isDetailRow(row, rowIndex)` - return `true` for the rows that should render as
  a full-width detail row (a real `colspan` row spanning every column),
- `renderDetailRow` - a snippet that renders that row's content. Put another
  `<SvGrid>` inside it and you have a nested grid.

![An expanded master row reveals a full-width detail region beneath it, where isDetailRow marks the sentinel row and renderDetailRow draws its nested content.](/docs-media/grid-master-detail.svg)

<div data-docs-demo="181-master-detail-grid" data-height="560"></div>

## Pattern

Keep an `expanded` set, and splice a "detail" sentinel row into the data right
after each expanded master row. `isDetailRow` recognises the sentinels;
`renderDetailRow` renders the child grid.

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

```svelte
<script lang="ts">
  type Row = Account | { kind: 'detail'; parentId: string; children: Call[] }

  let expanded = $state(new Set<string>())
  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    expanded = next
  }

  // Master rows + a detail sentinel after each expanded one.
  const visible = $derived.by(() => {
    const out: Row[] = []
    for (const a of accounts) {
      out.push(a)
      if (expanded.has(a.id)) out.push({ kind: 'detail', parentId: a.id, children: a.callRecords })
    }
    return out
  })
</script>

{#snippet DetailGrid(p: { row: Row })}
  {#if p.row.kind === 'detail'}
    <div style="height: 200px;">
      <SvGrid data={p.row.children} columns={detailColumns} containerHeight="100%" />
    </div>
  {/if}
{/snippet}

<SvGrid
  data={visible}
  {columns}
  isDetailRow={(row) => row.kind === 'detail'}
  renderDetailRow={DetailGrid}
/>
```

The first master column typically renders a chevron whose click calls
`toggle(row.id)`.

## Notes

- The detail row is a genuine full-width `colspan` cell, so the nested grid gets
  the full width regardless of the master's column layout.
- Give the detail container a fixed height (e.g. `200px`) so the nested grid
  scrolls internally instead of pushing the master layout around.
- Set `virtualization={false}` on the master when detail rows have variable
  height, so the fixed-row-height virtualizer doesn't fight them.
- The detail content is arbitrary - a nested grid, a form, timelines, charts.
  See [detail rows](../../../examples/src/demos/106-detail-rows.svelte) for a
  multi-panel (non-grid) detail.

## More examples

### Tree + master/detail

Hierarchical file-system rows and an order/line-item master-detail view.

<div data-docs-demo="08-tree-and-master-detail" data-height="460"></div>

## Try it

A detail row is an ordinary row that `isDetailRow` identifies and
`renderDetailRow` draws. Because it is a row, virtualization and scrolling treat
it like any other - which is also why a variable-height panel wants
`virtualization={false}`.

```svelte {runnable}
<script lang="ts">
  type Row = { kind: 'master' | 'detail'; name?: string; city?: string; note?: string }

  const rows: Row[] = [
    { kind: 'master', name: 'Ada Lovelace', city: 'London' },
    { kind: 'detail', note: 'Joined 2021. Works on the compiler team.' },
    { kind: 'master', name: 'Grace Hopper', city: 'New York' },
    { kind: 'detail', note: 'Joined 2019. Owns the release process.' },
  ]

  const cols: GridColumns<Row> = [
    { field: 'name', header: 'Name', width: 200 },
    { field: 'city', header: 'City', width: 160 },
  ]
</script>

<SvGrid
  data={rows}
  columns={cols}
  virtualization={false}
  isDetailRow={(row) => row.kind === 'detail'}
>
  {#snippet renderDetailRow(p)}
    <div class="detail">{p.row.note}</div>
  {/snippet}
</SvGrid>

<style>
  .detail { padding: 10px 16px; font-size: 13px; opacity: 0.85; }
</style>
```

## See also

- [Full-width rows](./full-width-rows.md)
- [Tree rows](./tree-rows.md) - for hierarchy within a single grid
