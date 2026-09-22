# Migrating from Tabulator

Tabulator is a feature-rich vanilla-JS table you instantiate against a
DOM element and drive imperatively (`table.setData(...)`,
`table.on('cellEdited', ...)`). SvGrid covers a similar feature surface
but as a Svelte 5 component: data is a reactive `$state` array, custom
cells are snippets, and there is no manual mount / teardown.

> Estimated effort: **2-4 hours** per grid - column translation plus
> swapping imperative `setData` for reactive state.

<!-- facts:start tabulator -->
> **Facts, checked 12 Sep 2026.** `tabulator-tables` 6.5.2, MIT, last published 23 Jun 2026, 672,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 97.6 KB JS + 10.5 KB CSS (measured 22 Sep 2026); `tabulator-tables` 6.5.2 106.9 KB JS + 3.8 KB CSS (measured 12 Sep 2026). Tabulator pricing, as its site states it: Tabulator is MIT and free; no licence or support plan is sold (https://github.com/olifolkerd/tabulator, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs Tabulator](https://svgrid.com/compare/tabulator/).
<!-- facts:end -->

## Vocabulary cheat sheet

| Tabulator                              | sv-grid                                   |
| -------------------------------------- | ----------------------------------------- |
| `new Tabulator(el, { data, columns })` | `<SvGrid data={...} columns={...} />`      |
| `{ title: 'Name', field: 'name' }`     | `{ header: 'Name', field: 'name' }`        |
| `formatter: fn` / `formatter: 'money'` | `cell: (c) => renderSnippet(...)` or `format` |
| `editor: 'input' / 'number' / ...`     | `editorType: 'text' / 'number' / ...`      |
| `headerFilter: true`                   | `columnFilteringFeature`                   |
| `dataTree: true`                       | `rowExpandingFeature` + tree row shape     |
| `table.setData(rows)`                  | reassign the `$state` data array           |
| `table.on('cellEdited', ...)`          | `onCellValueChange`                        |
| `table.setSort(field, dir)`            | `api.setSort(field, dir)`                  |
| `layout: 'fitColumns'`                 | `fitColumns` prop                          |

## Before / after

The example at the end of this page runs against these rows:

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

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200, editorType: 'text' },
    { field: 'department', header: 'Department', width: 150, editorType: 'text' },
    { field: 'city',       header: 'City',       width: 140, editorType: 'text' },
    { field: 'age',        header: 'Age',        width: 90,  editorType: 'number' },
    { field: 'salary',     header: 'Salary',     width: 130, editorType: 'number', format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```diff
- import { TabulatorFull as Tabulator } from 'tabulator-tables'
-
- const table = new Tabulator('#grid', {
-   data: rows,
-   layout: 'fitColumns',
-   columns: [
-     { title: 'Name',   field: 'name' },
-     { title: 'Amount', field: 'amount', formatter: 'money', editor: 'number' },
-   ],
- })
- table.on('cellEdited', (cell) => save(cell.getData()))

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' }, editorType: 'number' },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} fitColumns enableInlineEditing
+   onCellValueChange={(e) => save(e)} />
```

## What changes

- **Imperative → reactive.** No `setData()` - reassign the `$state`
  array and the grid updates.
- **String formatters → snippets.** Custom cells are Svelte snippets /
  components, not HTML-string formatters.
- **Mount / teardown disappears.** No `new Tabulator(el)` and no manual
  destroy on unmount.

## Frequently asked questions

### Is migrating from Tabulator to SvGrid hard?

It is a configuration translation plus one mindset shift: you stop calling
`setData()` and instead let a reactive `$state` array drive the grid. Budget
2-4 hours per grid.

### Is SvGrid free like Tabulator?

Yes. `@svgrid/grid` is MIT-licensed like Tabulator. The optional
`@svgrid/enterprise` pack (export, import, pivot, AI) is the only paid piece.

### Can I keep Tabulator's custom formatters?

You re-create them as Svelte snippets via `renderSnippet`. Any Svelte
component or markup works, not just an HTML string.

## What you end up with

Sort, filter and edit, with pagination underneath.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable editable pageable pageSize={3} />
```

## See also

- [SvGrid vs Tabulator](https://svgrid.com/compare/tabulator/) - the side-by-side comparison
- [Cell components](./cells/cell-components.md) - snippet-based custom cells
- [Architecture](./architecture.md) - engine + render-component split
