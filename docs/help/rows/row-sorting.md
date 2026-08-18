# Row sorting

Sorting is a feature you opt into. Try it live - click any column
header to cycle `none → asc → desc → none`; shift-click adds the
column to the sort key list (multi-sort):

<div data-docs-demo="02-sort-filter-paginate" data-height="440"></div>



```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', editorType: 'text' },
    { field: 'age',       header: 'Age',        editorType: 'number' },
    { field: 'joinedAt',  header: 'Joined',     editorType: 'date' },
  ]
</script>

<SvGrid {data} {columns} features={features} />
```

Clicking a sortable header toggles `none → asc → desc → none`. Shift-click
adds the column to the sort key list (multi-sort).

## Sort functions

`sortFns` exposes the built-in comparators:

```ts
import { sortFns } from '@svgrid/grid'
// sortFns.auto    - lexical (default for unknown types)
// sortFns.number  - numeric, NaN-safe
// sortFns.date    - Date-parsed
```

The grid picks the comparator based on the column's `editorType`:

| editorType | comparator |
| ---------- | ---------- |
| `'number'` | `sortFns.number` |
| `'date'` \| `'datetime'` | `sortFns.date` |
| anything else | `sortFns.auto` |

If your column has a non-trivial type, set `editorType` even if you do not
want inline editing - it is what tells sort and filter how to behave.

## Programmatic sort

```ts
api.setSort('age', 'desc')   // sort by age descending
api.setSort('age', null)     // clear sort on this column
api.clearSort()              // clear all sort
```

`setSort` replaces any existing sort with a single clause. For
multi-column sort, the user clicks the second column header with
**Shift** held (the in-grid affordance). A multi-sort setter on the API
is tracked in [Missing features](../missing-features.md).

To observe sort changes from outside the grid:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onSortingChange={(next) => (sorting = next)}
/>
```

## Disable sort per column

Not yet first-class - there is no `enableSorting: false` field. To
prevent a column from being sortable, omit `rowSortingFeature` from
`tableFeatures(...)`, or render a custom header via `header: () =>
renderSnippet(...)` that doesn't bind to the sort button.

## Sorting + server-side data

When sort happens on the backend, pair `externalSort={true}` with
`onSortingChange` and round-trip the sort clauses through your
fetcher. See the [`09-server-side` demo](../../../examples/src/demos/09-server-side.svelte).

## See also

- [Filter API](../filtering/filter-api.md)
- [Server-side guide](../../getting-started.md#11-server-side-data)
