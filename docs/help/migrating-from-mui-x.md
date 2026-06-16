# Migrating from MUI X DataGrid

MUI X DataGrid is the most common starting point for teams already
on Material UI. It's a closed-source-Pro / open-source-Community
split very similar to sv-grid's. The port is mostly mechanical.

> Estimated effort: **1-3 hours** per grid, depending on how heavily
> you've leant on `apiRef.current.*` calls.

## Package map

| MUI X                                | sv-grid                                  |
| ------------------------------------ | ---------------------------------------- |
| `@mui/x-data-grid`                   | `@svgrid/grid`                      |
| `@mui/x-data-grid-pro`               | `@svgrid/enterprise` (export, import, pivot, AI) |
| `@mui/x-data-grid-premium`           | All of `@svgrid/enterprise` ships in one tier   |

## Imports

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
| `selectRow(id)`                              | Toggle the row checkbox via the wrapper's UI; programmatic select is `api.setRowSelection({id: true})` |
| `getSelectedRows()`                          | `api.getDisplayedRows().filter((r) => ...)` |
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
sv-grid's `externalSort + externalFilter`:

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
.grid-host { --sg-accent: #db2777; --sg-row-height: 40px; }
```

For full theme presets (Ant, MUI, Fluent, Base Web, shadcn) see
[demo 74](https://svgrid.com/#/demos/74-theme-integrations).

## What you get for free vs MUI X

- **No Emotion / no Material theme dependency.** ~50 kB gzip total
  vs MUI X DataGrid Community's ~270 kB.
- **All Enterprise features in one tier.** No DataGrid Pro vs Premium split.
- **CSP-clean.** No `eval`.

## What you give up

- **The Material Design look out of the box.** Sv-grid ships
  unstyled-by-token; the [MUI preset in demo 74](https://svgrid.com/#/demos/74-theme-integrations)
  is one drop-in.
- **MUI form-field integration.** Bind directly to your own MUI
  inputs in custom cell components if you want them.

## See also

- [SvGrid vs MUI X DataGrid](https://svgrid.com/compare/mui-x-datagrid) - the side-by-side comparison
- [Migrating from AG Grid](./migrating-from-ag-grid.md)
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md)
- [Design tokens](./tokens.md)

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
is priced per developer ($599 single-app / $999 multi-app) rather than
per seat with Premium add-ons. Compare your team size and feature needs against
the [pricing page](https://sv-grid.dev/#/pricing).
