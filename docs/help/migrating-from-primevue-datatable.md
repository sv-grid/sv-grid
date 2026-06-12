# Migrating from PrimeVue / PrimeNG / PrimeReact DataTable

The Prime DataTable is the grid in the Prime UI suites for Vue, Angular,
and React. Its columns are declared as `<Column>` children with `field`
/ `header` props - a shape that maps cleanly onto SvGrid's `ColumnDef`
array. The port is mostly translating columns and events into a Svelte 5
component.

> Estimated effort: **2-4 hours** per grid.

## Vocabulary cheat sheet

| Prime DataTable                          | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `<DataTable :value="rows">`              | `<SvGrid data={rows}>`                     |
| `<Column field="name" header="Name" />`  | `{ field: 'name', header: 'Name' }`        |
| `sortable`                               | `rowSortingFeature`                        |
| `:filters` / filter display             | `columnFilteringFeature`                   |
| `<template #body>` cell slot             | `cell: (c) => renderSnippet(...)`          |
| `editMode` + cell editor template       | `editorType` (+ custom `cellEditor`)       |
| `:expandedRows` / row expansion          | `rowExpandingFeature`                      |
| `lazy` + `@page` / `@sort` / `@filter`  | `externalSort` / `externalFilter` + events |
| `paginator` + `:rows`                    | `showPagination` (+ page size)             |

## Before / after

```diff
- <DataTable :value="rows" paginator :rows="25" sortMode="multiple">
-   <Column field="name"   header="Name" sortable />
-   <Column field="amount" header="Amount" sortable>
-     <template #body="{ data }">{{ fmt(data.amount) }}</template>
-   </Column>
- </DataTable>

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from 'sv-grid-community'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination />
```

## What changes

- **`<Column>` children → a `ColumnDef[]` array.**
- **`#body` slots → `cell` snippets** via `renderSnippet`.
- **Prime theming → `--sg-*` tokens / Tailwind** - no Prime theme
  dependency.
- **`lazy` → `externalSort` / `externalFilter`** with refetch on events.

## See also

- [SvGrid vs Prime DataTable](https://svgrid.com/compare/primevue-datatable) - the side-by-side comparison
- [Tailwind integration](./tailwind.md) - match your design system
- [Cell components](./cells/cell-components.md) - snippet cells + editors

## Frequently asked questions

### How do Prime `<Column>` definitions map to SvGrid?

Each `<Column field header />` becomes a `{ field, header }` object in SvGrid's
`columns` array, and `#body` templates become `renderSnippet` cells. Sorting and
filtering move from per-column props to the `rowSortingFeature` /
`columnFilteringFeature` registration.

### Is SvGrid open-source like the Prime grid core?

Yes. `sv-grid-community` is MIT, like the Prime component cores. The difference
is framework: SvGrid is Svelte 5, not Vue / Angular / React.

### Do I lose Prime theming?

You re-create the look with `--sg-*` tokens (optionally driven by your Tailwind
theme), so the grid matches your design system without a Prime theme dependency.
