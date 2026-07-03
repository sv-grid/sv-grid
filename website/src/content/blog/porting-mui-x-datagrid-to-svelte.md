---
title: Porting a React MUI X DataGrid Screen to Svelte
description: A practical mapping from MUI X DataGrid to SvGrid - columns, cell renderers, server-side data, and the hooks that disappear when you switch to Svelte runes.
date: 2026-08-25
updated: "2026-07-02"
category: Comparisons
tags: migration, mui x datagrid, react, comparison, svelte data grid
author: Kamelia M
---

MUI X DataGrid is a solid grid for React apps. When teams migrate to Svelte 5, the grid screen is usually what they dread most - partly because of the Pro tier's API surface, partly because `renderCell` looks entangled with JSX in ways that seem hard to untangle. In practice, the porting work is more mechanical than it looks. The column model maps almost one-to-one, and a chunk of the React boilerplate just evaporates.

## The column model, renamed

The biggest conceptual change is small in practice. `GridColDef` becomes `ColumnDef`, `headerName` becomes `header`, and that's mostly it for the basic fields.

```ts
// MUI X DataGrid (React)
import { GridColDef } from '@mui/x-data-grid'

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'name', headerName: 'Full Name', width: 200 },
  {
    field: 'salary',
    headerName: 'Salary',
    width: 130,
    type: 'number',
    valueFormatter: ({ value }) => `$${Number(value).toLocaleString()}`,
  },
  {
    field: 'department',
    headerName: 'Department',
    width: 160,
    valueGetter: (params) => params.row.dept?.name ?? '-',
  },
]
```

```ts
// SvGrid (Svelte 5)
import type { ColumnDef } from '@svgrid/grid'

const columns: ColumnDef<typeof features, Row>[] = [
  { id: 'id', field: 'id', header: 'ID', width: 80 },
  { id: 'name', field: 'name', header: 'Full Name', width: 200 },
  {
    id: 'salary',
    field: 'salary',
    header: 'Salary',
    width: 130,
    type: 'number',
    format: { type: 'currency', currency: 'USD' },
  },
  {
    id: 'department',
    header: 'Department',
    width: 160,
    accessorFn: (row) => row.dept?.name ?? '-',
  },
]
```

`valueGetter` becomes `accessorFn`. `valueFormatter` becomes `format` for standard cases (currency, date, number precision) or a `formatter` function when you need custom logic. The `id` field is required in SvGrid - it drives keyed rendering under virtualization.

Here is the full concept map:

| MUI X DataGrid | SvGrid |
| --- | --- |
| `rows` prop | `data` prop |
| `columns: GridColDef[]` | `columns: ColumnDef[]` |
| `headerName` | `header` |
| `valueGetter` | `accessorFn` |
| `valueFormatter` | `format` / `formatter` |
| `renderCell` | `cell` snippet |
| `renderEditCell` | `editorType` or custom editor |
| `sortingMode="server"` | `createServerDataSource` |
| `paginationModel` + `onPaginationModelChange` | `pageable` + `createServerDataSource` |
| DataGridPro pivot, Excel export | `@svgrid/enterprise` |

## Cell renderers: JSX to snippets

MUI X uses `renderCell` returning JSX. SvGrid uses Svelte 5 snippets. The mental model is the same; the syntax is different, and frankly cleaner once you have written a few.

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import {
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Row = { id: number; name: string; status: 'active' | 'inactive' | 'pending'; score: number }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const data: Row[] = [
    { id: 1, name: 'Alice', status: 'active', score: 92 },
    { id: 2, name: 'Bob', status: 'pending', score: 41 },
    { id: 3, name: 'Carol', status: 'inactive', score: 67 },
  ]

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'name', field: 'name', header: 'Name', width: 180 },
    { id: 'status', field: 'status', header: 'Status', width: 120, cell: statusCell },
    {
      id: 'score',
      field: 'score',
      header: 'Score',
      width: 100,
      type: 'number',
      conditionalFormat: [
        { condition: ({ value }) => value < 50, style: { color: '#c0392b', fontWeight: 'bold' } },
        { condition: ({ value }) => value >= 90, style: { color: '#27ae60' } },
      ],
    },
  ]
</script>

{#snippet statusCell({ value }: { value: string })}
  <span class="badge badge--{value}">{value}</span>
{/snippet}

<SvGrid {data} {columns} {features} sortable filterable rowHeight={36} />

<style>
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.8em; text-transform: capitalize; }
  .badge--active { background: #d4edda; color: #155724; }
  .badge--inactive { background: #f8d7da; color: #721c24; }
  .badge--pending { background: #fff3cd; color: #856404; }
</style>
```

The snippet is defined in the same file and referenced directly in the column def. No callback wrapper, no import from a separate component. Svelte's snippet scoping means the badge class logic stays where you can see it.

## Server-side data and the hooks that disappear

The React version of a server-side MUI X DataGrid typically involves `useState` for pagination and sort, `useEffect` to trigger fetches when those state values change, and a `rowCount` prop to tell the grid the true total. It ends up being 30-40 lines of wiring before you even write the fetch call.

SvGrid wraps this with `createServerDataSource`:

```ts
import { createServerDataSource } from '@svgrid/grid'

const ds = createServerDataSource({
  fetch: async ({ page, pageSize, sort, filters }) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })

    if (sort.length) {
      params.set('sortField', sort[0].field)
      params.set('sortDir', sort[0].direction)
    }

    for (const f of filters) {
      params.set(`filter_${f.field}`, f.value)
    }

    const res = await fetch(`/api/employees?${params}`)
    const json = await res.json()
    return { rows: json.data, total: json.total }
  },
})
```

Then the component is:

```svelte
<SvGrid data={ds} {columns} {features} sortable filterable pageable rowHeight={36} />
```

The `useEffect` dependency array, the `rowCount` state sync, the three separate model-change callbacks - none of that exists. The data source handles it. When sort or filter changes, the data source re-fetches automatically.

## Editable cells

MUI X editable columns use `editable: true` on the column def and optionally `renderEditCell` for custom editors. SvGrid follows the same pattern: `editable: true` on the column and `editorType` for overriding the default editor.

```ts
const editableColumns: ColumnDef<typeof features, Row>[] = [
  { id: 'name', field: 'name', header: 'Name', width: 180, editable: true },
  {
    id: 'salary',
    field: 'salary',
    header: 'Salary',
    width: 130,
    type: 'number',
    editable: true,
  },
  {
    id: 'status',
    field: 'status',
    header: 'Status',
    width: 140,
    editable: true,
    editorType: 'select',
    editorOptions: { items: ['active', 'inactive', 'pending'] },
  },
]
```

MUI X's `processRowUpdate` becomes SvGrid's `onCellEdit` callback or a reactive `$effect` on the data. Undo/redo (a MUI Premium feature) ships in SvGrid's free tier via `api.undo()` and `api.redo()`.

## What transfers and what does not

Most MUI X DataGrid functionality has a direct equivalent in SvGrid. The two cases that do not translate cleanly are the built-in tree data view and the column reorder animation. If your app relies heavily on either, factor that into the migration timeline.

Everything else transfers faster than expected. Svelte reactivity eliminates an entire class of state synchronization bugs that come from keeping pagination, sort, and filter state in separate `useState` calls that have to stay in sync. The server-side data source removes that problem at the source. Cell snippets are genuinely easier to read than `renderCell` callbacks once you stop expecting JSX syntax.

For apps with custom MUI X slot overrides deep in the theme layer, that part won't translate directly. You will need to rebuild those pieces with SvGrid's CSS custom properties (`--sg-bg`, `--sg-accent`, `--sg-header-bg`, `--sg-border`) and the `headerCell` snippet API. That is the part I would budget extra time for - not the column defs, not the cell renderers, but the theme customization layer if your design system relies on it heavily.

Pro and Premium features like pivot tables and Excel export map to [@svgrid/enterprise](/pricing). The free community tier covers sorting, filtering, grouping, virtualization, editing, and pagination - which handles the majority of real-world grid screens.
