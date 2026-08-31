# `<SvGrid>` reference

The render component. One `<SvGrid>` element per grid instance.

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  showPagination={true}
  pageSize={25}
  onApiReady={(api) => (gridApi = api)}
/>
```

## Required props

| Prop       | Type                                       | Notes                                                                  |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `data`     | `ReadonlyArray<TData>`                     | The row source. Re-rendering on `data` reference change is automatic.   |
| `columns`  | `Array<ColumnDef<TFeatures, TData>>`       | See [ColumnDef reference](./ColumnDef.md).                              |
| `features` | `TFeatures`                                | Build with `tableFeatures({...})`. See [features reference](./features.md). |

## Data state

| Prop           | Type                  | Default              | Notes                                                       |
| -------------- | --------------------- | -------------------- | ----------------------------------------------------------- |
| `loading`      | `boolean`             | `false`              | Shows a built-in loading overlay.                           |
| `error`        | `string \| null`      | `null`               | Shows an error banner inside the shell.                     |
| `emptyMessage` | `string`              | `"No data"`          | Replaces the empty-state copy.                              |

## Layout

| Prop                 | Type                 | Default     | Notes                                                                  |
| -------------------- | -------------------- | ----------- | ---------------------------------------------------------------------- |
| `containerHeight`    | `number \| string`   | `520`       | Pixels (number) or any CSS height (string). Use `'100%'` inside a flex parent. |
| `rowHeight`          | `number \| (i) => number` | `30`   | In pixels. Drives virtualizer math when virtualization is on. Pass a function for per-row heights. Not a CSS token - the virtualizer needs a number, so it is written as an inline style per row. |
| `columnWidth`        | `number`             | `140`       | Default for columns without an explicit `width`.                       |
| `fitColumns`         | `boolean`            | `false`     | Scale columns proportionally to fill the viewport; residue absorbed in the last column. Shrinks down to 85% of natural widths; beyond that the user gets a horizontal scrollbar. |
| `showRowNumbers`     | `boolean`            | `false`     | Leading 1-based row-number column.                                     |
| `rowNumberWidth`     | `number`             | `56`        | Width (px) of the row-number column. Default fits up to "99,999"; bump it for six-figure row counts so the largest number stays fully visible at the bottom of a long scroll. |
| `initialColumnPinning` | `{ left?, right? }`| -           | Seed left/right pinning at mount.                                      |

## Virtualization

| Prop                   | Type      | Default | Notes                                              |
| ---------------------- | --------- | ------- | -------------------------------------------------- |
| `virtualization`       | `boolean` | `true`  | Row virtualization.                                |
| `columnVirtualization` | `boolean` | `true`  | Column virtualization. Disable for sticky-column pinning. |
| `overscan`             | `number`  | `8`     | Rows kept rendered above + below the viewport.     |
| `columnOverscan`       | `number`  | `3`     | Columns kept rendered left + right of the viewport. |

## Filter UI

| Prop                | Type                                       | Default   | Notes                                                                  |
| ------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------- |
| `filterMode`        | `'menu' \| 'row' \| 'global' \| 'none'`    | `'menu'`  | Umbrella prop. Overridden per-surface by the three below.              |
| `showGlobalFilter`  | `boolean`                                  | derived   | Show the global search input.                                          |
| `showColumnFilters` | `boolean`                                  | derived   | Show the column-menu filter funnel.                                    |
| `showFilterRow`     | `boolean`                                  | derived   | Show the per-column filter row under the header.                       |
| `showFilterMenu`    | `boolean`                                  | derived   | (Legacy alias for `showColumnFilters`.)                                |
| `externalFilter`    | `boolean`                                  | `false`   | Grid records filter UI state but does NOT filter rows. Pair with `onFiltersChange`. |

## Selection

| Prop                 | Type                                       | Default | Notes                                                |
| -------------------- | ------------------------------------------ | ------- | ---------------------------------------------------- |
| `selectionMode`      | `'both' \| 'row' \| 'cell' \| 'none'`      | `'both'`| Umbrella prop. Overridden per-surface by the two below. |
| `showRowSelection`   | `boolean`                                  | derived | Checkbox column.                                     |
| `enableCellSelection`| `boolean`                                  | derived | Click-and-drag range selection.                      |

## Editing

| Prop                  | Type      | Default | Notes                                                  |
| --------------------- | --------- | ------- | ------------------------------------------------------ |
| `enableInlineEditing` | `boolean` | `false` | Per-column `editorType` still required for a column to be editable. |
| `enableRowSummaries`  | `boolean` | `false` | Footer row aggregating every filtered row. Alias: `summary`. |

## Sort

| Prop           | Type      | Default | Notes                                                          |
| -------------- | --------- | ------- | -------------------------------------------------------------- |
| `externalSort` | `boolean` | `false` | Grid records sort state but does NOT re-order rows. Pair with `onSortingChange`. |

## Pagination

| Prop             | Type      | Default | Notes                                                          |
| ---------------- | --------- | ------- | -------------------------------------------------------------- |
| `showPagination` | `boolean` | `false` | Show the footer pager.                                         |
| `pageSize`       | `number`  | `10`    | Initial page size.                                             |

## Grouping

| Prop                   | Type                       | Default | Notes                            |
| ---------------------- | -------------------------- | ------- | -------------------------------- |
| `showGroupingControls` | `boolean`                  | `false` | Show the group-by toolbar.       |
| `groupBy`              | `ReadonlyArray<string>`    | `[]`    | Column ids to group by, outermost first. Re-applies when the prop changes; ignored when `treeData` is set. |
| `expanded`             | `Record<string, boolean>`  | `{}`    | Which group / tree rows are open, keyed by row id. Seeds the state and re-applies on change. |

## Callbacks

All callbacks are optional. None of them are required for the grid to
function - they exist for parents that want to observe or override.

### `onApiReady(api)`

Fires once after mount with the [`SvGridApi`](./SvGridApi.md) for
imperative operations.

### `onSortingChange(sorting)`

```ts
onSortingChange?: (sorting: Array<{ id: string; desc: boolean }>) => void
```

Fires when the user clicks a sort header. With `externalSort={true}`,
this is your hook to re-fetch / re-order the source data.

### `onFiltersChange(filters)`

```ts
onFiltersChange?: (filters: {
  global: string
  columns: Array<{
    id: string
    operator: 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'isBlank'
    value: string
    selectedValues?: Array<string>
  }>
}) => void
```

Fires when the global filter, any column operator filter, or any facet
checklist changes. With `externalFilter={true}`, this is your hook to
re-fetch.

### `onRowSelectionChange(selection, rows)`

```ts
onRowSelectionChange?: (
  selection: Record<string, boolean>,
  rows: TData[],
) => void
```

`selection` is keyed by row index; `rows` is the materialised array of
selected rows.

### `onCellValueChange(event)`

```ts
onCellValueChange?: (event: {
  rowIndex: number
  columnId: string
  oldValue: unknown
  newValue: unknown
  row: TData
}) => void
```

Fires when an inline edit **commits**. This is the editor's commit path
only - the programmatic `api.setCellValue()` writes the value without
firing it. Use this for cascading recomputes (line totals, derived
columns) and for sending edits to a server. See
[Saving values](../help/editing/saving-values.md).

### `onExpandedChange(expanded)`

```ts
onExpandedChange?: (expanded: Record<string, boolean>) => void
```

Fires whenever the expanded set changes - a click on a group banner,
`api.setRowExpanded()`, `api.expandAllGroups()` /
`api.collapseAllGroups()`. Receives the full next map, so it can be
written straight back into the `expanded` prop for a controlled setup
without looping. Group row ids look like
`group_department_Engineering`; tree rows use the engine row id.

### `onActiveCellChange(cell)`

```ts
onActiveCellChange?: (cell: {
  rowIndex: number
  colIndex: number
  columnId: string
}) => void
```

Fires every time the active cell changes - click, keyboard move,
Tab, Page Up/Down. Toolbar / ribbon UIs use this to stay synced with
the grid's selection without polling.

## See also

- [`SvGridApi`](./SvGridApi.md) - the imperative API exposed via `onApiReady`
- [`ColumnDef`](./ColumnDef.md) - column-definition shape
- [features](./features.md) - the feature registry
- [Enterprise extensions](./enterprise.md) - what `installEnterprise(api)` adds
