# `SvGridApi` reference

The imperative API exposed via `<SvGrid onApiReady={(api) => ...}>`.
Use it for data, column, filter, sort, group, selection, and
visibility operations from outside the component.

```ts
import type { SvGridApi } from '@svgrid/grid'

let api = $state<SvGridApi<typeof features, Order> | null>(null)
```

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onApiReady={(next) => (api = next)}
/>

<button onclick={() => api?.addRow({ /* ... */ })}>Add row</button>
```

## Cells

### `getCellValue(rowIndex, columnId)`

```ts
getCellValue(rowIndex: number, columnId: string): unknown
```

Read a cell value from the underlying data. Returns `undefined` when
either argument doesn't resolve.

### `setCellValue(rowIndex, columnId, value)`

```ts
setCellValue(rowIndex: number, columnId: string, value: unknown): void
```

Write a cell value through the column's `field`. Triggers a re-render.
Does NOT fire `onCellValueChange` - that callback is for **user**
edits.

```ts
// 1. Read one cell, write it back rounded.
const raw = api.getCellValue(0, 'amount')
api.setCellValue(0, 'amount', Math.round(Number(raw)))

// 2. Recompute a derived column after an edit the user made.
function onCellValueChange({ rowIndex, columnId }: { rowIndex: number; columnId: string }) {
  if (columnId !== 'qty' && columnId !== 'price') return
  const qty = Number(api.getCellValue(rowIndex, 'qty') ?? 0)
  const price = Number(api.getCellValue(rowIndex, 'price') ?? 0)
  api.setCellValue(rowIndex, 'total', qty * price)   // no callback loop
}

// 3. Neither argument resolving is not an error - you get undefined back.
api.getCellValue(9_999, 'amount')   // undefined
api.getCellValue(0, 'nope')         // undefined
```

## Rows

### `addRow(row, position?)`

```ts
addRow(row: TData, position?: 'top' | 'bottom' | number): void
```

`position` defaults to `'bottom'`. A numeric index inserts before that
index.

### `addRows(rows, position?)`

```ts
addRows(rows: ReadonlyArray<TData>, position?: 'top' | 'bottom' | number): void
```

Batched insert. Cheaper than calling `addRow` in a loop for hundreds
of rows.

### `removeRow(rowIndex)` / `removeRows(rowIndices)`

```ts
removeRow(rowIndex: number): void
removeRows(rowIndices: ReadonlyArray<number>): void
```

Remove by data-array index (the same index `onCellValueChange` reports).

```ts
// 1. Append one row, then jump to it.
api.addRow({ id: crypto.randomUUID(), name: '', status: 'draft' })
api.setActiveCell(api.getData().length - 1, 0)

// 2. Insert a batch at the top - cheaper than a loop of addRow.
api.addRows(incoming, 'top')

// 3. Remove the checked rows. Map ids to indices first: removeRows takes
//    data-array indices, and removing one at a time would shift the rest.
const ids = new Set(api.getSelectedRows().map((row) => row.id))
api.removeRows(
  api.getData().reduce<number[]>((acc, row, index) => {
    if (ids.has(row.id)) acc.push(index)
    return acc
  }, []),
)
```

### `applyTransaction(tx)`

```ts
applyTransaction(tx: {
  add?: ReadonlyArray<TData>
  update?: ReadonlyArray<TData>
  remove?: ReadonlyArray<TData | string>
}): { added: number; updated: number; removed: number }
```

One data update for a whole batch, so a streaming feed re-renders once rather
than once per row. `update` and `remove`-by-id match through `getRowId`;
`remove` also takes row object references.

```ts
// 1. A websocket tick: add the new trades, update the moved ones, drop the filled.
const result = api.applyTransaction({
  add: message.created,
  update: message.changed,
  remove: message.filledIds,
})
console.log(`${result.added} in, ${result.updated} changed, ${result.removed} out`)

// 2. Remove by reference when you have no getRowId.
api.applyTransaction({ remove: [rows[3]!] })

// 3. An empty transaction is a no-op that still reports honestly.
api.applyTransaction({})   // { added: 0, updated: 0, removed: 0 }
```

## Columns

### `addColumn(column, position?)` / `addColumns(columns, position?)`

```ts
addColumn(column: ColumnDef<TFeatures, TData>, position?: 'left' | 'right' | number): void
addColumns(columns: ReadonlyArray<ColumnDef<TFeatures, TData>>, position?: 'left' | 'right' | number): void
```

`position` defaults to `'right'`.

```ts
// 1. Append a column on the right.
api.addColumn({ field: 'owner', header: 'Owner', width: 160 })

// 2. Put an actions column first.
api.addColumn({ id: 'actions', header: '', width: 48, cell: () => '...' }, 'left')

// 3. Insert before a known column, wherever it currently sits.
const at = api.getColumnOrder().indexOf('salary')
api.addColumn({ field: 'bonus', header: 'Bonus', width: 120 }, at)
```

### `removeColumn(columnId)`

```ts
removeColumn(columnId: string): void
```

By id (or `field` when no id was provided).

## Visibility

### `setColumnVisible(columnId, visible)` / `isColumnVisible(columnId)`

```ts
setColumnVisible(columnId: string, visible: boolean): void
isColumnVisible(columnId: string): boolean
```

Hidden columns stay in the column array but don't render.

```ts
// 1. Toggle one column.
api.setColumnVisible('team', !api.isColumnVisible('team'))

// 2. Build a column picker from the snapshot - hidden columns are included.
const picker = api.getColumns().map(({ id, header, visible }) => ({ id, header, visible }))

// 3. Show only a named set.
const keep = new Set(['name', 'salary'])
for (const column of api.getColumns()) api.setColumnVisible(column.id, keep.has(column.id))
```

## Sort

### `setSort(columnId, direction)`

```ts
setSort(columnId: string, direction: 'asc' | 'desc' | null): void
```

Replaces any existing sort. Pass `null` to clear sort on that column.
Multi-sort through the API is on the
[Missing features](../help/missing-features.md) list - the user can
build it themselves with Shift-click on headers, and a saved multi-sort
restores through `setState({ sorting })`.

### `clearSort()`

```ts
clearSort(): void
```

Clear all sort clauses.

```ts
// 1. Sort by one column, descending.
api.setSort('salary', 'desc')

// 2. Cycle a header yourself: asc -> desc -> none.
const current = api.getState().sorting.find((clause) => clause.id === 'salary')
api.setSort('salary', !current ? 'asc' : current.desc ? null : 'desc')

// 3. Restore a saved multi-sort, which setSort cannot express on its own.
api.setState({ sorting: [{ id: 'team', desc: false }, { id: 'salary', desc: true }] })
```

## Group

### `setGroupBy(columnIds)`

```ts
setGroupBy(columnIds: ReadonlyArray<string>): void
```

Group by zero or more columns. Replaces any existing group config.

```ts
// 1. Group by one column, then open every bucket.
api.setGroupBy(['team'])
api.expandAllGroups()

// 2. Nest two levels, outermost first.
api.setGroupBy(['region', 'team'])

// 3. Ungroup, and collapse whatever was open.
api.setGroupBy([])
api.collapseAllGroups()
```

Group row ids are `group_<columnId>_<value>`, which is what
`setRowExpanded` and the `expanded` prop key on:

```ts
api.setRowExpanded('group_team_Research', true)
```

## Filter

### `setFilter(columnId, filter)`

```ts
setFilter(
  columnId: string,
  filter:
    | {
        operator: SvGridFilterOperator
        value?: string
        /** Upper bound, required when `operator` is `'between'`. */
        valueTo?: string
        /** Optional second condition on the same column. */
        operator2?: SvGridFilterOperator
        value2?: string
        valueTo2?: string
        /** How the two conditions combine. Defaults to `'AND'`. */
        join?: 'AND' | 'OR'
      }
    | null,
): void
```

Where `SvGridFilterOperator` is the same union the filter menu offers:

```ts
type SvGridFilterOperator =
  | 'contains' | 'notContains'
  | 'equals' | 'notEquals'
  | 'startsWith' | 'endsWith'
  | 'regex'
  | 'in' | 'notIn'
  | 'greaterThan' | 'lessThan' | 'between'
  | 'isBlank' | 'isNotBlank'
```

Pass `null` to clear.

### `setFacetFilter(columnId, values)`

```ts
setFacetFilter(columnId: string, values: ReadonlyArray<string> | null): void
```

Set the column-menu value checklist (the Excel-style set filter). An empty
array or `null` clears it.

### `clearFilter(columnId)` / `clearAllFilters()` / `getFilters()`

```ts
clearFilter(columnId: string): void
clearAllFilters(): void
getFilters(): Record<string, { operator: SvGridFilterOperator; value: string; valueTo?: string }>
```

`clearFilter` clears one column. `clearAllFilters` clears every filter
surface in one call - column, filter row, set list, global search and the
advanced filter. `getFilters` reads the active column filters back as a
snapshot.

```ts
// 1. One condition.
api.setFilter('team', { operator: 'contains', value: 'Res' })

// 2. A range, and a two-condition clause joined however you like.
api.setFilter('salary', { operator: 'between', value: '140000', valueTo: '160000' })
api.setFilter('salary', {
  operator: 'greaterThan',
  value: '140000',
  operator2: 'lessThan',
  value2: '160000',
  join: 'AND',
})

// 3. A value checklist, then clear everything.
api.setFacetFilter('team', ['Research', 'Kernel'])
api.clearAllFilters()
```

Reading filters back pairs with `getState` for save-view flows:

```ts
const filters = api.getFilters()
// { salary: { operator: 'between', value: '140000', valueTo: '160000' } }
```

## Data snapshot

### `getData()`

```ts
getData(): ReadonlyArray<TData>
```

Snapshot of the current internal data array - the grid's working
copy, which reflects every cell edit and `addRow` / `removeRow` since
mount.

### `getDisplayedRows()`

```ts
getDisplayedRows(): ReadonlyArray<TData>
```

Returns the rows that are currently **visible** in the grid - after
filter, sort, and pagination. Use for `pro.exportData(...)` when you
want to export the current view.

```ts
// 1. What the user sees right now, in the order they see it.
const view = api.getDisplayedRows()

// 2. The working copy: every row, including edits and added rows.
const all = api.getData()

// 3. While grouping is on, group banners are not rows - so a fully collapsed
//    grid gives you an empty array even though banners are on screen.
api.setGroupBy(['team'])
api.collapseAllGroups()
api.getDisplayedRows()            // []
api.getState().grouping           // ['team'] - count banners from here
```

## The rest of the surface

This page is the curated tour. The api also carries editing
(`startEditing` / `stopEditing`), undo / redo (`undo`, `redo`, `canUndo`,
`canRedo`, `clearHistory`), cell-range selection (`selectCells`,
`getSelected`), row selection (`getSelectedRows`, `getSelectedRowIds`,
`selectRows`, `selectAllRows`, `toggleRowSelected`, `clearRowSelection`),
column layout (`setColumnWidth`, `getColumnWidths`, `autosizeColumn`,
`autosizeAllColumns`, `setColumnPinning`, `getColumnPinning`,
`setColumnOrder`, `getColumnOrder`, `getColumns`), expansion
(`setRowExpanded`, `expandAllGroups`, `collapseAllGroups`), pagination
(`getPageInfo`, `setPage`, `nextPage`, `prevPage`, `firstPage`, `lastPage`,
`setPageSize`), navigation (`scrollToRow`, `getActiveCell`,
`setActiveCell`), find (`openFind`, `closeFind`, `setFindQuery`,
`getFindHits`), the free exporters (`exportCsv`, `exportTsv`, `exportJson`,
`copyToClipboard`), batched row mutation (`applyTransaction`), runtime prop
overrides (`setOption`, `getOption`, `resetOptions`), the advanced filter
(`setAdvancedFilter`, `getAdvancedFilter`, `clearAdvancedFilter`,
`isAdvancedFilterActive`), integrated charting (`openChart`, `closeChart`,
`configureChart`, `chartRange`, `getChartSpec`, `setChartAiHandler`), view
state (`getState`, `setState`, `refresh`) and `refreshEditorOptions`.

Every member, with its full signature and doc comment, is generated from the
source in
[`reference/auto/svgrid-grid-svgrid-wrapper.types`](./auto/svgrid-grid-svgrid-wrapper.types.md).
Behaviour for all of them is covered by the API QA suite in
`packages/grid/src/qa/`.

Three of those groups, in the shape they are usually reached for:

**Row selection**

```ts
// 1. Select by id (row ids come from `getRowId`, or the row index as a string).
api.selectRows(['r1', 'r4'])

// 2. Add to the selection instead of replacing it, then read it back.
api.selectRows(['r7'], true)
const chosen = api.getSelectedRows()

// 3. Select everything on screen, then clear.
api.selectAllRows()
api.clearRowSelection()
```

**Pagination**

```ts
// 1. Where am I?
const { pageIndex, pageCount, total } = api.getPageInfo()

// 2. Walk pages - every call clamps, so no bounds checks of your own.
api.nextPage()
api.lastPage()
api.setPage(2)

// 3. Change the page size, keeping the first visible row in view.
api.setPageSize(50)
```

**Saved views**

```ts
// 1. Save the whole view: sort, filters, grouping, column layout, pagination.
localStorage.setItem('grid.view', JSON.stringify(api.getState()))

// 2. Restore it.
const saved = localStorage.getItem('grid.view')
if (saved) api.setState(JSON.parse(saved))

// 3. Restore only part of it - `setState` applies just the keys present.
api.setState({ columnWidths: { name: 260 }, hiddenColumns: ['notes'] })
```

## Enterprise extensions

After `installEnterprise(api)`, the same object also exposes:

```ts
api.exportData(opts)   // see Enterprise export reference
api.print(opts)
api.importData(opts)
api.ai.filter(...)
api.ai.smartFill(...)
api.ai.summarize(...)
api.ai.classify(...)
api.pivot.build(config)
api.pivot.buildFrom(data, config)
```

See [Enterprise reference](./enterprise.md).
