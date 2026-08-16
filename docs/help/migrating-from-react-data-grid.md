# Migrating from React Data Grid (adazzle)

`react-data-grid` is a fast, Excel-like React grid with a clean column
API. SvGrid mirrors its shape - virtualized DOM, typed columns, inline
editing, custom cells - on Svelte 5 runes instead of React, so the port
is mostly a column rename pass.

> Estimated effort: **2-4 hours** per grid, more if you lean on custom
> editors.

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

## See also

- [SvGrid vs React Data Grid](https://svgrid.com/compare/react-data-grid/) - the side-by-side comparison
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - sibling React-to-Svelte guide
- [Cell components](./cells/cell-components.md) - custom cells + editors

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
