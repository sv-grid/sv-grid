# Status bar

The status bar is the strip under the grid that shows live aggregates of the
**selected cell range** - count, sum, average, min, max - the way Excel does at
the bottom-right when you select a block of numbers.

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

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

  let rows = $state<Person[]>(people)
  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<SvGrid {data} {columns} {features} enableCellSelection statusBar />
```

It needs `enableCellSelection` (the bar aggregates the selected rectangle).
Drag a range across numeric cells and the bar updates instantly.

## Choosing aggregates

`statusBar={true}` shows the default set (`count`, `sum`, `avg`, `min`, `max`).
Pass an object to pick which:

```svelte
<SvGrid enableCellSelection statusBar={{ aggregates: ['count', 'sum', 'avg'] }} />
```

| Aggregate      | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| `count`        | Cells in the selection (non-group).                  |
| `numericCount` | How many of those hold a finite number.              |
| `sum`          | Sum of the numeric cells.                            |
| `avg`          | Mean of the numeric cells.                           |
| `min` / `max`  | Smallest / largest numeric value.                    |

## Row count (Enterprise)

With `@svgrid/enterprise`, `rows: true` adds a count on the left of the bar
that is always there, with or without a selection: "250 rows", or "12 of 250
rows" while filters hide some. It needs no `enableCellSelection`. To show the
count alone, pass no aggregates. It is drawn once `enableRowCount()` has run
([setup](../enterprise/README.md#grid-filter-and-sort-additions)):

```svelte
<SvGrid {data} {columns} statusBar={{ rows: true, aggregates: [] }} />
```

The count leaves out group banners and ignores pagination. For a header or a
count of your own, `getRowCounts(api)` from `@svgrid/enterprise` returns
`{ total, filtered }`; with grouping on, its `filtered` counts the group rows
too. Under `externalFilter` or `externalPagination` the grid holds one page,
so the bar shows the `rowCount` you pass.

The count is not announced to screen readers on each change; the grid already
announces filter results. Without the module, `rows: true` shows nothing.

## Behavior

- The numeric aggregates (`sum`, `avg`, `min`, `max`) only appear when the
  selection actually contains numbers - selecting text cells shows just the
  count.
- A single-cell selection shows nothing; the bar appears once a range of two
  or more cells is selected.
- Edited values are respected: the aggregates read the displayed value, so an
  in-progress edit is reflected.
- Group rows are skipped.

See the live [Status bar](https://svgrid.com/demos/144-status-bar/) demo.

## Try it

Drag a rectangle across the Age or Salary column and watch the bar total it.

```svelte {runnable}
<SvGrid {data} {columns} enableCellSelection statusBar />
```
