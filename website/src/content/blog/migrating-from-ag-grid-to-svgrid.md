---
title: Migrating from AG Grid to SvGrid
description: A practical guide to moving an AG Grid screen to SvGrid in Svelte 5 - mapping columnDefs, row data, events, and the server-side row model.
date: 2026-06-27
category: Comparisons
tags: migration, ag grid, comparison, svelte data grid
author: Kamelia M
---

AG Grid is excellent, this is not a hit piece. But in a Svelte app it always sits behind an integration layer, and if you have decided you want a native Svelte 5 grid instead, the happy news is that almost every concept maps over one-to-one.

## Concept mapping

| AG Grid | SvGrid |
| --- | --- |
| `rowData` | `data` |
| `columnDefs` | `columns` |
| `field` / `headerName` | `field` / `header` |
| `valueFormatter` | `format` or `formatter` |
| `cellRenderer` | `cell` via `renderSnippet` |
| `valueGetter` | `accessorFn` |
| `editable` + `cellEditor` | `editorType` |
| `onCellValueChanged` | `onCellValueChange` |
| Client-side row model | default (in-memory) |
| Server-side row model | external mode (callbacks + `rowCount`) |
| Enterprise (pivot, export) | @svgrid/enterprise |

## Columns: before and after

```ts
// AG Grid
const columnDefs = [
  { field: 'name', headerName: 'Name' },
  { field: 'salary', valueFormatter: p => `$${p.value}` },
]

// SvGrid
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' } },
]
```

Note the format change: AG Grid's `valueFormatter` returns a string; SvGrid's `format` keeps the raw value so sorting stays numeric. Move formatting off accessors and onto `format`.

## Cell renderers

AG Grid `cellRenderer` components become Svelte snippets:

```svelte
{#snippet StatusCell(p: { value: string })}<span class="badge">{p.value}</span>{/snippet}
// column: { field: 'status', header: 'Status', cell: (c) => renderSnippet(StatusCell, { value: c.getValue() }) }
```

## Editing

AG Grid mutates `rowData` by default; SvGrid never mutates your data, it emits an event and you decide:

```ts
function onCellValueChange(e) {
  rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue }
}
```

## Server-side

AG Grid's Server-Side Row Model maps to SvGrid's external mode: read sort/filter/page from callbacks, fetch the page, return it with a total `rowCount`. See [Server-Side Data](server-side-data).

## What to check

- Enterprise features (pivot, Excel export, range selection) live in [@svgrid/enterprise](/pricing).
- Replace AG Grid theme classes with `--sg-*` CSS variables, see [Theming](theming-and-dark-mode).
- The full feature matrix is at [SvGrid vs AG Grid](/compare/ag-grid).

## Frequently asked questions

### Is migrating from AG Grid to SvGrid hard?

Usually not. `rowData`, `columnDefs`, events, and the server-side row model all have direct SvGrid equivalents. The main adjustments are moving formatting onto the column's `format` option and adopting event-based editing instead of row mutation.

### Does SvGrid have AG Grid Enterprise features?

Many of them - pivot, export, range selection, and more - are in the @svgrid/enterprise pack, while sorting, filtering, grouping, virtualization, and editing are in the free MIT core.
