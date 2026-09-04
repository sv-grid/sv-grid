# Tool panel (Columns + Filters)

The tool panel is the docked sidebar - standard in enterprise grids - for
managing columns and filters without hunting through a right-click menu. Turn it
on with the `toolPanel` prop:

<div data-docs-demo="146-tool-panel" data-height="480"></div>

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
<SvGrid {data} {columns} {features} toolPanel />
```

A **Columns & Filters** button appears in a toolbar above the grid. Clicking it
opens a panel docked on the right edge with two tabs. Pass `toolPanelDefaultOpen`
to have it open on first render, and `toolPanelDefaultTab="filters"` to start on
the Filters tab:

```svelte
<SvGrid {data} {columns} {features} toolPanel toolPanelDefaultOpen />
```

## Columns tab

For every column:

- a **visibility** checkbox (show / hide the column),
- **↑ / ↓** to reorder the column,
- **⊞** to group / ungroup by that column (when grouping is enabled).

## Filters tab

For every filterable column, an inline filter control:

- an **operator** select (the same operators the column menu offers - text
  columns get `contains` / `equals` / …, number and date columns get
  `greaterThan` / `between` / …; drive these with
  [`cellDataType`](../cells/cell-data-types.md)),
- a **value** input matched to the column type, plus a second **To** input for
  `between`,
- a **✕** to clear that column's filter.

The Filters tab writes the **same** filter state as the column menu and the
filter row, so all three surfaces stay in sync - filter from whichever is handy.
It works whenever `columnFilteringFeature` is enabled.

## Notes

- The panel lists **all** columns, including hidden ones, in the current
  display order, so you can bring a hidden column back.
- Visibility, order, and grouping changes go through the same engine state as
  the column menu and the imperative API (`setColumnVisible`,
  `setColumnOrder`, `setGroupBy`) - so they round-trip with `getState()` /
  `setState()` and [named views](../state/named-views.md).
- Grouping a column whose other columns declare an
  [`aggregate`](../grouping/aggregators.md) rolls those values up in the group
  header automatically.

See the live [Columns tool panel](https://svgrid.com/demos/146-tool-panel/)
demo.

## Try it

`toolPanel` adds the side panel that lists every column with a visibility
toggle, so users can hide what they do not need without you building the UI.

```svelte {runnable}
<SvGrid data={people} {columns} toolPanel />
```

## With the rest of the chrome

The tool panel sits alongside the other opt-in chrome rather than replacing it:
here it runs with a filter row and pagination on the same grid.

```svelte {runnable}
<SvGrid data={people} {columns} toolPanel filterable filterMode="row" pageable pageSize={3} sortable />
```
