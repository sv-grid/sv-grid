# `SvGridApi` reference

The imperative API exposed via `<SvGrid onApiReady={(api) => ...}>`.
Use it for data, column, filter, sort, group, selection, and
visibility operations from outside the component.

```ts
import type { SvGridApi } from 'sv-grid-community'

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

## Columns

### `addColumn(column, position?)` / `addColumns(columns, position?)`

```ts
addColumn(column: ColumnDef<TFeatures, TData>, position?: 'left' | 'right' | number): void
addColumns(columns: ReadonlyArray<ColumnDef<TFeatures, TData>>, position?: 'left' | 'right' | number): void
```

`position` defaults to `'right'`.

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

## Sort

### `setSort(columnId, direction)`

```ts
setSort(columnId: string, direction: 'asc' | 'desc' | null): void
```

Replaces any existing sort. Pass `null` to clear sort on that column.
Multi-sort through the API is on the
[Missing features](../help/missing-features.md) list - the user can
build it themselves with Shift-click on headers.

### `clearSort()`

```ts
clearSort(): void
```

Clear all sort clauses.

## Group

### `setGroupBy(columnIds)`

```ts
setGroupBy(columnIds: ReadonlyArray<string>): void
```

Group by zero or more columns. Replaces any existing group config.

## Filter

### `setFilter(columnId, filter)`

```ts
setFilter(
  columnId: string,
  filter: { operator: SvGridFilterOperator; value?: string } | null,
): void
```

Where `SvGridFilterOperator` is:

```ts
type SvGridFilterOperator =
  | 'contains' | 'equals' | 'startsWith'
  | 'greaterThan' | 'lessThan' | 'isBlank'
```

Pass `null` to clear.

### `clearFilter(columnId)`

```ts
clearFilter(columnId: string): void
```

Clear a single column's filter. (A `clearAllFilters()` helper is on
the [Missing features](../help/missing-features.md) list.)

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

## Pro extensions

After `installPro(api)`, the same object also exposes:

```ts
api.exportData(opts)   // see Pro export reference
api.print(opts)
api.importData(opts)
api.ai.filter(...)
api.ai.smartFill(...)
api.ai.summarize(...)
api.ai.classify(...)
api.pivot.build(config)
api.pivot.buildFrom(data, config)
```

See [Pro reference](./pro.md).
