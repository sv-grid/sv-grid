# Migrating from MUI X DataGrid

MUI X DataGrid is the most common starting point for teams already
on Material UI. Its MIT Community edition plus paid Pro and Premium
tiers is a split similar to sv-grid's, except that column pinning,
master/detail, tree data, row grouping, aggregation and cell selection
are paid in MUI X and free here. The port is mostly mechanical.

> Estimated effort: **1-3 hours** per grid, depending on how heavily
> you've leant on `apiRef.current.*` calls.

<!-- facts:start mui-x-datagrid -->
> **Facts, checked 12 Sep 2026.** `@mui/x-data-grid` 9.13.0, MIT, last published 4 Sep 2026, 11,800,000 npm downloads in the 30 days to 10 Sep 2026. `@svgrid/grid` 3.0.3, MIT, last published 11 Sep 2026, 16,900 npm downloads in the same window. Bundle, minified and gzipped, each package built alone with Svelte external: SvGrid 3.0.3 84.5 KB JS + 9.5 KB CSS (measured 12 Sep 2026); `@mui/x-data-grid` 9.13.0 155.0 KB JS, no separate stylesheet, @emotion/react + @emotion/styled + @mui/material + @mui/system + react + react-dom external (measured 12 Sep 2026). MUI X DataGrid pricing, as its site states it: MUI X Community is free under MIT. mui.com lists Pro at $299 per year per developer, Premium at $599 per year per developer and Enterprise at $1,399 per year per developer, with perpetual and annual licence models (https://mui.com/pricing/, read 12 Sep 2026). SvGrid: MIT core; @svgrid/enterprise from $599 per developer per year. Side by side, with sources: [SvGrid vs MUI X DataGrid](https://svgrid.com/compare/mui-x-datagrid/).
<!-- facts:end -->

## Package map

| MUI X                                | sv-grid                                  |
| ------------------------------------ | ---------------------------------------- |
| `@mui/x-data-grid`                   | `@svgrid/grid`                      |
| `@mui/x-data-grid-pro`               | `@svgrid/enterprise` (export, import, pivot, AI) |
| `@mui/x-data-grid-premium`           | All of `@svgrid/enterprise` ships in one tier   |

## Imports

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
- import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid'

+ import { SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+          type ColumnDef } from '@svgrid/grid'
```

## Column defs

```diff
- const columns: GridColDef[] = [
-   { field: 'id',       headerName: 'ID',       width: 90 },
-   { field: 'lastName', headerName: 'Last',     width: 150, editable: true },
-   { field: 'age',      headerName: 'Age',      type: 'number', width: 110, editable: true },
- ]

+ const columns: ColumnDef<typeof features, Row>[] = [
+   { field: 'id',       header: 'ID',   width: 90  },
+   { field: 'lastName', header: 'Last', width: 150 },
+   { field: 'age',      header: 'Age',  width: 110, editorType: 'number' },
+ ]
```

- `headerName` → `header`
- `type: 'number'` → `editorType: 'number'`
- `editable: true` → omit (every column is editable by default; set
  `editable: false` to OPT OUT)

## Mounting

```diff
- <DataGrid rows={rows} columns={columns} pageSize={25} checkboxSelection />

+ <SvGrid
+   data={rows} columns={columns} features={features}
+   showPagination={true} pageSize={25}
+   selectionMode="row" />
```

`tableFeatures({ rowSortingFeature, columnFilteringFeature,
rowSelectionFeature })` registers what you'd implicitly get from
MUI X.

## `apiRef` translation

| MUI X (`apiRef.current.*`)                   | sv-grid (`api.*`)                          |
| -------------------------------------------- | ------------------------------------------ |
| `setRows(rows)`                              | mutate the `$state` array you bound to `data` |
| `updateRows([{id, ...patch}])`               | `api.setCellValue(rowIndex, field, value)` |
| `setSortModel([{field, sort}])`              | `api.setSort(field, sort)`                  |
| `setFilterModel({items: [...]})`             | `api.setFilter(field, {operator, value})`   |
| `setPage(0)` / `setPageSize(50)`             | Use the built-in pager; for headless control register `pageSize` prop |
| `selectRow(id)`                              | Toggle the row checkbox via the wrapper's UI; programmatic select is `api.selectRows([id])` (`api.toggleRowSelected(id)` to flip one) |
| `getSelectedRows()`                          | `api.getSelectedRows()` (ids via `api.getSelectedRowIds()`) |
| `exportDataAsExcel()`                        | `api.exportData({ format: 'xlsx' })` (Enterprise)  |
| `setColumnVisibilityModel({field: false})`   | `api.setColumnVisible('field', false)`     |

## Custom cells

```diff
- {
-   field: 'status',
-   renderCell: ({ row }) => <Chip label={row.status} color={row.status === 'active' ? 'success' : 'default'} />,
- }

+ {
+   field: 'status',
+   cell: (ctx) => renderSnippet(StatusChip, { status: ctx.row.original.status }),
+ }
```

## Selection

```diff
- <DataGrid checkboxSelection
-   onRowSelectionModelChange={(ids) => setSelected(ids)} />

+ <SvGrid
+   {data} {columns} features={features}
+   selectionMode="row"
+   onRowSelectionChange={(selection, rows) => setSelected(rows)} />
```

`selectionMode` values: `'row'` (the MUI X equivalent), `'cell'`
(spreadsheet-style range), `'both'`, `'none'`.

## Inline editing

MUI X had `processRowUpdate(newRow, oldRow)` returning the new row.
Sv-grid's equivalent is `onCellValueChange`:

```diff
- <DataGrid processRowUpdate={async (newRow) => {
-   await api.savePatch(newRow)
-   return newRow
- }} />

+ <SvGrid
+   onCellValueChange={async (e) => {
+     await api.savePatch({ id: e.row.id, [e.columnId]: e.newValue })
+   }}
+ />
```

For full-row editing (one Save button per row), see
[Full-row editing](./editing/full-row.md).

## Server-side data

MUI X's `pagination + serverSideMode + filterMode='server'` maps to
sv-grid's `externalSort + externalFilter`, or to the server-side row
model when the server also groups and pages; the demo below runs that
model against a fake API with sort, filter and infinite scroll:

<div data-docs-demo="148-server-row-model" data-height="520"></div>

```svelte
<SvGrid
  data={rows} columns={columns} features={features}
  externalSort={true}
  externalFilter={true}
  onSortingChange={async (s) => { rows = await fetchPage({ sort: s }) }}
  onFiltersChange={async (f) => { rows = await fetchPage({ filters: f.columns }) }}
/>
```

## Slots / customisation

MUI X exposes a `slots` object. Sv-grid doesn't - instead, every
visual piece is a CSS custom property (`--sg-*`); see
[design tokens](./tokens.md). Override at any DOM level:

```css
.grid-host { --sg-accent: #db2777; --sg-radius: 10px; }
```

Row height is the exception: it is the `rowHeight` prop rather than a
token, because the virtualizer needs it as a number.

For full theme presets (Ant, MUI, Fluent, Base Web, shadcn) see
[demo 74](https://svgrid.com/demos/74-theme-integrations/).

## What you get for free vs MUI X

- **No Emotion / no Material theme dependency.** The facts box at the
  top of the page has both packages measured the same way; the MUI X
  figure excludes React, Material UI, Emotion and the MUI system, which
  it needs and sv-grid does not.
- **Pro and Premium features in the MIT core.** Column pinning, master/detail,
  tree data, row grouping, aggregation and cell selection carry Pro or
  Premium badges on mui.com; they are free here. Excel export and pivot
  are paid on both sides.
- **In-grid AI helpers against your own model.** MUI X's AI assistant is a
  Premium feature that routes prompts through MUI's hosted service unless
  you build your own; sv-grid's natural-language filter, smart fill and
  summarise helpers are free and run against a provider you register.
- **CSP-clean.** No `eval`.

## What you give up

- **The Material Design look out of the box.** Sv-grid ships
  unstyled-by-token; the [MUI preset in demo 74](https://svgrid.com/demos/74-theme-integrations/)
  is one drop-in.
- **MUI form-field integration.** Bind directly to your own MUI
  inputs in custom cell components if you want them.
- **The rest of MUI X in one design system.** Date pickers, charts and
  the tree view share MUI X's theme; sv-grid ships its own date and time
  editors and charts, themed through the same `--sg-*` tokens.
- **A hosted AI assistant with starter credits.** Premium licence holders
  get MUI's service; sv-grid's helpers need a model provider you host or
  pay for yourself.

## Frequently asked questions

### How hard is it to migrate from MUI X DataGrid to SvGrid?

Mostly mechanical - typically 1-3 hours per grid, depending on how heavily you
relied on `apiRef.current.*`. The Community/Enterprise split mirrors MUI X's, so the
licensing mental model carries over directly.

### Can SvGrid keep the Material Design look?

Yes. SvGrid ships unstyled-by-token and re-themes through `--sg-*` CSS
variables; the MUI preset in demo 74 is a drop-in starting point. You can also
bind your own MUI inputs inside custom cell components.

### Is SvGrid cheaper than MUI X Pro/Premium?

SvGrid's Community tier is MIT and free for commercial use, and `@svgrid/enterprise`
is priced per developer ($599 single-app / $999 multi-app). MUI X Pro and
Premium are also per developer per year; the prices mui.com listed on the
date we read it are in the facts box at the top of this page. The difference
is what the free tier holds: most of what MUI X sells in Pro and Premium is
in SvGrid's MIT core, so compare feature needs before prices on the
[pricing page](https://svgrid.com/pricing/).

## What you end up with

Sorting, filtering, pagination and inline editing - the MUI X DataGrid feature set.

```svelte {runnable}
<SvGrid data={rows} {columns} sortable filterable editable pageable pageSize={3} />
```

## See also

- [SvGrid vs MUI X DataGrid](https://svgrid.com/compare/mui-x-datagrid/) - the side-by-side comparison, with a source and date for every claim
- [Server-side data](./server-side-data.md) - the row model the demo above uses
- [AI assistant](./ai.md) - the free in-grid helpers
- [Migrating from AG Grid](./migrating-from-ag-grid.md)
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md)
- [Design tokens](./tokens.md)
