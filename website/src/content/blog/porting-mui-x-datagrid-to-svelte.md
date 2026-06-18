---
title: Porting a React MUI X DataGrid Screen to Svelte
description: Moving a React MUI X DataGrid to Svelte 5 with SvGrid - mapping GridColDef, valueGetter, renderCell, and the Pro server-side features.
date: 2026-08-25
category: Comparisons
tags: migration, mui x datagrid, react, comparison, svelte data grid
author: Kamelia M
---

If your team is drifting from React to Svelte, the MUI X DataGrid screens are usually the scariest-looking thing to port, and usually the most mechanical once you start. The column model and data flow have direct equivalents, and Svelte reactivity deletes most of the hooks.

![The SvGrid AI assistant.](/blog-media/ai-assistant.png)
*The SvGrid AI assistant.*

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
| DataGridPro/Premium (pivot, export) | @svgrid/enterprise |

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

## Enterprise features

MUI X Pro/Premium features like pivoting and Excel export map to [@svgrid/enterprise](/pricing); the free tier covers sorting, filtering, grouping, virtualization, and editing.
