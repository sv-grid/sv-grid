---
title: Porting a React MUI X DataGrid Screen to Svelte
description: Moving a React MUI X DataGrid to Svelte 5 with SvGrid - mapping GridColDef, valueGetter, renderCell, and the Pro server-side features.
date: 2026-07-31
category: Comparisons
tags: migration, mui x datagrid, react, comparison, svelte data grid
author: SvGrid Team
---

Teams adopting Svelte often have React screens built on MUI X DataGrid. Porting one to SvGrid is mostly mechanical: the column model and data flow have direct equivalents, and Svelte's reactivity replaces React hooks. Here is the mapping.

## Concept mapping

| MUI X DataGrid (React) | SvGrid (Svelte) |
| --- | --- |
| `rows` | `data` |
| `columns: GridColDef[]` | `columns: ColumnDef[]` |
| `field` / `headerName` | `field` / `header` |
| `valueGetter` | `accessorFn` |
| `valueFormatter` | `format` / `formatter` |
| `renderCell` | `cell` via `renderSnippet` |
| `editable` + `renderEditCell` | `editorType` |
| `sortingMode="server"` etc. | external mode |
| `paginationModel` state | `onPaginationChange` + `pageSize` |
| DataGridPro/Premium (pivot, export) | sv-grid-pro |

## Columns

```tsx
// React MUI X
const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'salary', headerName: 'Salary', valueFormatter: ({ value }) => `$${value}` },
]
```

```svelte
<!-- Svelte SvGrid -->
{#snippet ... }
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' } },
]
```

## renderCell to snippets

MUI's `renderCell` returns JSX; SvGrid's `cell` returns a Svelte snippet via `renderSnippet`:

```svelte
{#snippet StatusCell(p: { value: string })}<span class="badge">{p.value}</span>{/snippet}
// { field: 'status', header: 'Status', cell: (c) => renderSnippet(StatusCell, { value: c.getValue() }) }
```

## Hooks to runes

React state (`useState`, `useMemo`) becomes Svelte runes (`$state`, `$derived`). The server-side modes (`sortingMode`, `filterMode`, `paginationMode` set to `"server"`) become SvGrid's external mode with callbacks and a total `rowCount`.

## Pro features

MUI X Pro/Premium features like pivoting and Excel export map to [sv-grid-pro](/pricing); the free tier covers sorting, filtering, grouping, virtualization, and editing.

## Frequently asked questions

### How do I port a React MUI X DataGrid to Svelte?

Map `rows` to `data`, `GridColDef` to `ColumnDef` (`headerName` to `header`, `valueGetter` to `accessorFn`, `valueFormatter` to `format`, `renderCell` to a `renderSnippet` cell), and replace React state and server modes with Svelte runes and SvGrid's external mode.

### Is there a Svelte equivalent of DataGridPro features?

Yes - sv-grid-pro provides pivot tables, export/import, and more, while the MIT core covers the standard DataGrid feature set.
