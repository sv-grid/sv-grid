# Migrating from React Data Grid (adazzle)

`react-data-grid` is a fast, Excel-like React grid with a clean column
API. SvGrid mirrors its shape - virtualized DOM, typed columns, inline
editing, custom cells - on Svelte 5 runes instead of React, so the port
is mostly a column rename pass.

> Estimated effort: **2-4 hours** per grid, more if you lean on custom
> editors.

<!-- facts:start react-data-grid -->
> **Facts, checked 12 Sep 2026.** `react-data-grid` 7.0.0-beta.61, MIT, last published 14 Jul 2026, 2,180,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.4 97.6 KB JS + 10.5 KB CSS (measured 22 Sep 2026); `react-data-grid` 7.0.0-beta.61 15.7 KB JS + 2.1 KB CSS, react + react-dom external (measured 12 Sep 2026). React Data Grid pricing, as its site states it: react-data-grid is MIT on npm and free; no licence is sold (https://github.com/adazzle/react-data-grid, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs React Data Grid (adazzle)](https://svgrid.com/compare/react-data-grid/).
<!-- facts:end -->

## Vocabulary cheat sheet

| react-data-grid                          | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `<DataGrid columns rows />`              | `<SvGrid columns data />`                  |
| `{ key: 'name', name: 'Name' }`          | `{ field: 'name', header: 'Name' }`        |
| `renderCell: (p) => <Badge .../>`        | `cell: (c) => renderSnippet(Badge, {...})` |
| `renderEditCell` / `editor`              | `editorType` (+ custom `cellEditor`)       |
| `rowKeyGetter={(r) => r.id}`             | `getRowId={(r) => r.id}`                   |
| `onRowsChange={setRows}`                 | `onCellValueChange` (+ your state)         |
| `sortColumns` / `onSortColumnsChange`    | `rowSortingFeature` + `onSortingChange`    |
| `<DataGrid className=...>` theming       | `--sg-*` tokens / Tailwind                 |

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
- import DataGrid, { textEditor } from 'react-data-grid'
- const columns = [
-   { key: 'name',   name: 'Name' },
-   { key: 'amount', name: 'Amount', renderEditCell: textEditor },
- ]
- <DataGrid columns={columns} rows={rows} rowKeyGetter={(r) => r.id} onRowsChange={setRows} />

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', editorType: 'text' },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features}
+   getRowId={(r) => r.id} enableInlineEditing
+   onCellValueChange={(e) => save(e)} />
```

## What changes

- **React → Svelte 5.** `renderCell` / `renderEditCell` become
  `renderSnippet` snippets and `editorType`.
- **`onRowsChange` → `onCellValueChange`.** SvGrid writes to its own
  working copy; subscribe to commits and persist where you like.
- **Filtering UI is built in.** react-data-grid leaves the filter row to
  you; SvGrid ships the Excel-style menu.

## Frequently asked questions

### How do react-data-grid columns map to SvGrid?

`key` becomes `field`, `name` becomes `header`, `renderCell` becomes a
`renderSnippet` cell, and editors map to `editorType` (or a custom `cellEditor`
snippet). `rowKeyGetter` becomes `getRowId`.

### Is SvGrid free like react-data-grid?

Yes - `@svgrid/grid` is MIT-licensed, like react-data-grid. SvGrid adds an
optional paid Enterprise pack for export, import, pivot, and AI.

### Does SvGrid have built-in filtering?

Yes. react-data-grid asks you to build the filter UI; SvGrid ships an
Excel-style column filter menu and a global filter out of the box.

## What you end up with

Inline editing with cell-range selection, which is the reason most people picked it.

```svelte {runnable}
<SvGrid data={rows} {columns} editable enableCellSelection sortable />
```

## See also

- [SvGrid vs React Data Grid](https://svgrid.com/compare/react-data-grid/) - the side-by-side comparison
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - sibling React-to-Svelte guide
- [Cell components](./cells/cell-components.md) - custom cells + editors
