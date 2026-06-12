# `sv-grid-community` · `core.ts`

Auto-generated. Source: `packages\sv-grid-community\src\core.ts`.

### `type RowData`

_No JSDoc yet._

```ts
export type RowData = Record<string, unknown>
```

### `type Updater`

_No JSDoc yet._

```ts
export type Updater<T> = T | ((prev: T) => T)
```

### `type SortingState`

_No JSDoc yet._

```ts
export type SortingState = Array<{ id: string; desc: boolean }>
```

### `type ColumnFilter`

_No JSDoc yet._

```ts
export type ColumnFilter = { id: string; value: unknown; fn?: keyof typeof filterFns }
```

### `type ColumnFiltersState`

_No JSDoc yet._

```ts
export type ColumnFiltersState = Array<ColumnFilter>
```

### `type PaginationState`

_No JSDoc yet._

```ts
export type PaginationState = { pageIndex: number; pageSize: number }
```

### `type GroupingState`

_No JSDoc yet._

```ts
export type GroupingState = Array<string>
```

### `type ExpandedState`

_No JSDoc yet._

```ts
export type ExpandedState = Record<string, boolean>
```

### `type RowSelectionState`

_No JSDoc yet._

```ts
export type RowSelectionState = Record<string, boolean>
```

### `type ActiveCellState`

_No JSDoc yet._

```ts
export type ActiveCellState = {
  rowIndex: number
  colIndex: number
  cellId: string | null
}
```

### `type TableFeatures`

_No JSDoc yet._

```ts
export type TableFeatures = Record<string, unknown>
```

### `type CellData`

_No JSDoc yet._

```ts
export type CellData = unknown
```

### `type HeaderContext`

_No JSDoc yet._

```ts
export type HeaderContext<TData extends RowData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}
```

### `type CellContext`

_No JSDoc yet._

```ts
export type CellContext<TData extends RowData> = {
  cell: Cell<TData>
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
  getValue: () => unknown
}
```

### `type CellFormatConfig`

_No JSDoc yet._

```ts
export type CellFormatConfig =
```

### `type CellFormatter`

_No JSDoc yet._

```ts
export type CellFormatter<TData extends RowData> = (context: {
  value: unknown
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
}) => string
```

### `type ColumnDefTemplate`

_No JSDoc yet._

```ts
export type ColumnDefTemplate<TContext> = string | ((context: TContext) => unknown)
```

### `type ColumnDef`

_No JSDoc yet._

```ts
export type ColumnDef<TFeatures extends TableFeatures, TData extends RowData> = {
  id?: string
  field?: keyof TData & string
  accessorFn?: (row: TData) => unknown
  header?: ColumnDefTemplate<HeaderContext<TData>>
  footer?: ColumnDefTemplate<HeaderContext<TData>>
  cell?: ColumnDefTemplate<CellContext<TData>>
  columns?: Array<ColumnDef<TFeatures, TData>>
  editorType?: 'text' | 'number' | 'date' | 'datetime' | 'checkbox' | 'list' | 'chips'
  /**
   * Gate editing per column or per cell.
   *
   *   - `true` (or omitted): the column is fully editable.
   *   - `false`: the column is read-only - double-click, type-to-edit,
   *     fill-handle drag, Delete, and clipboard paste all skip it.
   *   - `(ctx) => boolean`: evaluated for each cell, so you can lock
   *     individual rows (e.g. by role, status, ownership). Returning
   *     `false` opts the cell out of every editing path, identical to
   *     setting `editable: false` on the whole column for that row.
   *
   * The grid-wide `enableInlineEditing` prop still wins when set to
   * `false`.
   */
  editable?: boolean | ((context: CellContext<TData>) => boolean)
  /**
   * When `false`, this column never shows a sort indicator and clicking
   * its header is a no-op - `api.setSort(thisColumn, ...)` is also
   * ignored. Defaults to `true` (the column participates in sorting as
   * long as `rowSortingFeature` is registered).
   */
  sortable?: boolean
  /**
   * When `false`, this column never shows a filter funnel / menu and
   * `api.setFilter(thisColumn, ...)` is ignored. Defaults to `true` (the
   * column is filterable as long as `columnFilteringFeature` is
   * registered).
   */
  filterable?: boolean
  /**
   * Options for `editorType: 'list' | 'chips'`. Either bare values (the
   * string is both value and label) or `{ value, label }` objects.
   * For `chips` this is optional - when omitted, the chips editor becomes
   * free-form (user types and presses Enter to commit a chip).
   *
   * Pass a function `(row) => options` for row-dependent (cascading)
   * options - e.g. City options that depend on Country in the same row.
   */
  editorOptions?:
    | ReadonlyArray<
        string | number | { value: string | number; label?: string; color?: string }
      >
    | ((
        row: TData,
      ) => ReadonlyArray<
        string | number | { value: string | number; label?: string; color?: string }
      >)
  /** When true, list/chips allow multiple selections. Cell value becomes an array. */
  editorMultiple?: boolean
  /** Separator used when joining array values for the readonly cell display. Defaults to ', '. */
  editorSeparator?: string
  format?: CellFormatConfig
  formatter?: CellFormatter<TData>
  /** Initial column width in pixels. Falls back to the grid's `columnWidth` prop. */
  width?: number
  /**
   * Horizontal alignment for header and body cells. When omitted, the
   * default is inferred from `editorType`:
   *   - `'number' | 'date' | 'datetime'` → `'right'`
   *   - `'checkbox'`                     → `'center'`
   *   - everything else                  → `'left'`
   */
  align?: 'left' | 'center' | 'right'
  /**
   * Per-cell conditional CSS. Two shapes:
   *
   *   - **String** (or array of strings): class name(s) added to the
   *     cell's `<td>` for every row in this column.
   *   - **Function**: invoked per cell with the same `CellContext` shape
   *     the `cell` renderer receives. Return a string, an array of
   *     strings, or an object mapping class names to booleans.
   *
   * Use it for status tinting, conditional bold, "negative number"
   * coloring - anything that's a function of the row's value. Cells
   * still receive their format / cell renderer; the class just
   * augments the rendered `<td>`.
   */
  cellClass?:
    | string
    | ReadonlyArray<string>
    | ((ctx: CellContext<TData>) => string | ReadonlyArray<string> | Record<string, boolean> | undefined | null)
}
```

### `type Column`

_No JSDoc yet._

```ts
export type Column<TData extends RowData> = {
  id: string
  columnDef: ColumnDef<any, TData>
  depth: number
  parentId?: string
  getCanSort: () => boolean
  getCanFilter: () => boolean
  getIsSorted: () => false | 'asc' | 'desc'
  getToggleSortingHandler: () => () => void
}
```

### `type Header`

_No JSDoc yet._

```ts
export type Header<TData extends RowData> = {
  id: string
  isPlaceholder: boolean
  colSpan: number
  column: Column<TData>
  getContext: () => HeaderContext<TData>
}
```

### `type HeaderGroup`

_No JSDoc yet._

```ts
export type HeaderGroup<TData extends RowData> = {
  id: string
  headers: Array<Header<TData>>
}
```

### `type Cell`

_No JSDoc yet._

```ts
export type Cell<TData extends RowData> = {
  id: string
  row: Row<TData>
  column: Column<TData>
  getValue: () => unknown
  getContext: () => CellContext<TData>
}
```

### `type Row`

_No JSDoc yet._

```ts
export type Row<TData extends RowData> = {
  id: string
  index: number
  original: TData
  depth: number
  subRows?: Array<Row<TData>>
  /** Total leaf (data) rows under this group row. Undefined for data rows. */
  leafCount?: number
  getCanExpand: () => boolean
  getIsExpanded: () => boolean
  toggleExpanded: () => void
  getIsSelected: () => boolean
  toggleSelected: () => void
  getAllCells: () => Array<Cell<TData>>
  getCellValueByColumnId: (columnId: string) => unknown
}
```

### `type RowModel`

_No JSDoc yet._

```ts
export type RowModel<TData extends RowData> = {
  rows: Array<Row<TData>>
}
```

### `type Store`

_No JSDoc yet._

```ts
export type Store<T> = {
  readonly state: T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: () => void) => () => void
}
```

### `const rowSortingFeature`

_No JSDoc yet._

```ts
export const rowSortingFeature = { key: 'rowSortingFeature' }
```

### `const columnFilteringFeature`

_No JSDoc yet._

```ts
export const columnFilteringFeature = { key: 'columnFilteringFeature' }
```

### `const rowPaginationFeature`

_No JSDoc yet._

```ts
export const rowPaginationFeature = { key: 'rowPaginationFeature' }
```

### `const columnGroupingFeature`

_No JSDoc yet._

```ts
export const columnGroupingFeature = { key: 'columnGroupingFeature' }
```

### `const rowSelectionFeature`

_No JSDoc yet._

```ts
export const rowSelectionFeature = { key: 'rowSelectionFeature' }
```

### `const rowExpandingFeature`

_No JSDoc yet._

```ts
export const rowExpandingFeature = { key: 'rowExpandingFeature' }
```

### `function tableFeatures`

_No JSDoc yet._

```ts
export function tableFeatures<T extends TableFeatures>(features: T): T {
  return features
}
```

### `const sortFns`

_No JSDoc yet._

```ts
export const sortFns = {
  auto: (a: unknown, b: unknown) => String(a).localeCompare(String(b)),
  number: (a: unknown, b: unknown) => Number(a ?? 0) - Number(b ?? 0),
  date: (a: unknown, b: unknown) => {
    const aa = new Date(a as any).getTime()
    const bb = new Date(b as any).getTime()
    return aa - bb
  },
}
```

### `const filterFns`

_No JSDoc yet._

```ts
export const filterFns = {
  includesString: (value: unknown, query: string) =>
    String(value).toLowerCase().includes(query.toLowerCase()),
  equals: (value: unknown, query: unknown) => value === query,
}
```

### `type RowModelFactory`

_No JSDoc yet._

```ts
export type RowModelFactory<TData extends RowData> = (args: {
  table: SvGrid<TData>
  rows: Array<Row<TData>>
}) => Array<Row<TData>>
```

### `function createCoreRowModel`

_No JSDoc yet._

```ts
export function createCoreRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ rows }) => rows
}
```

### `function createFilteredRowModel`

_No JSDoc yet._

```ts
export function createFilteredRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const filters: ColumnFiltersState = table.getState().columnFilters ?? []
    if (!filters.length) return rows
    return rows.filter((row) => {
      return filters.every((filter) => {
        const cellValue = row
          .getAllCells()
          .find((cell) => cell.column.id === filter.id)
          ?.getValue()
        const filterFn = filter.fn ? filterFns[filter.fn] : filterFns.includesString
        return filterFn(cellValue, filter.value as any)
      })
    })
  }
}
```

### `function createPaginatedRowModel`

_No JSDoc yet._

```ts
export function createPaginatedRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const pagination = table.getState().pagination ?? { pageIndex: 0, pageSize: rows.length || 10 }
    const start = pagination.pageIndex * pagination.pageSize
    return rows.slice(start, start + pagination.pageSize)
  }
}
```

### `function createGroupedRowModel`

_No JSDoc yet._

```ts
export function createGroupedRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const grouping: GroupingState = table.getState().grouping ?? []
    if (!grouping.length) return rows
    const columns = table.getAllColumns()

    // Recursively bucket rows by each grouping column in turn. At every level a
    // group row is built that stands in for its children - a non-group column
    // resolves to the value shared by every leaf row, or to undefined when the
    // leaves disagree.
    function buildGroups(
      input: Array<Row<TData>>,
      levelIndex: number,
      depth: number,
      idPrefix: string,
    ): Array<Row<TData>> {
      if (levelIndex >= grouping.length) {
        // Leaves: actual data rows, with their nesting depth recorded.
        return input.map((row) => ({ ...row, depth }))
      }
      const groupKey = grouping[levelIndex]
      if (!groupKey) return input

      const buckets = new Map<string, Array<Row<TData>>>()
      for (const row of input) {
        const value = row.getCellValueByColumnId(groupKey)
        const key = String(value ?? '')
        const list = buckets.get(key) ?? []
        list.push(row)
        buckets.set(key, list)
      }

      const groupRows: Array<Row<TData>> = []
      let index = 0
      buckets.forEach((children, key) => {
        const id = `${idPrefix}_${groupKey}_${key}`
        const subRows = buildGroups(children, levelIndex + 1, depth + 1, id)
        const isDeepest = levelIndex + 1 >= grouping.length
        const leafCount = isDeepest
          ? subRows.length
          : subRows.reduce((sum, sub) => sum + (sub.leafCount ?? 0), 0)

        const resolveColumnValue = (columnId: string): unknown => {
          if (columnId === groupKey) return key
          let resolved: unknown
          let hasResolved = false
          for (const child of children) {
            const childValue = child.getCellValueByColumnId(columnId)
            if (!hasResolved) {
              resolved = childValue
              hasResolved = true
            } else if (childValue !== resolved) {
              return undefined
            }
          }
          return resolved
        }

        const groupOriginal: Record<string, unknown> = {}
        columns.forEach((column) => {
          const field = column.columnDef.field
          if (field) groupOriginal[field] = resolveColumnValue(column.id)
        })

        const groupRow: Row<TData> = {
          id,
          index: index++,
          original: groupOriginal as TData,
          depth,
          subRows,
          leafCount,
          getCanExpand: () => true,
          getIsExpanded: () => Boolean((table.getState().expanded ?? {})[id]),
          toggleExpanded: () => {
            table.setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
          },
          getIsSelected: () => Boolean((table.getState().rowSelection ?? {})[id]),
          toggleSelected: () => {
            table.setRowSelection((prev) => ({ ...prev, [id]: !prev[id] }))
          },
          getAllCells: () => [],
          getCellValueByColumnId: resolveColumnValue,
        }
        groupRows.push(groupRow)
      })
      return groupRows
    }

    return buildGroups(rows, 0, 0, 'group')
  }
}
```

### `function createExpandedRowModel`

_No JSDoc yet._

```ts
export function createExpandedRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const expanded: ExpandedState = table.getState().expanded ?? {}
    const flattened: Array<Row<TData>> = []
    const visit = (row: Row<TData>) => {
      flattened.push(row)
      if (row.subRows?.length && expanded[row.id]) {
        for (const sub of row.subRows) visit(sub)
      }
    }
    for (const row of rows) visit(row)
    return flattened
  }
}
```

### `function createSortedRowModel`

_No JSDoc yet._

```ts
export function createSortedRowModel<TData extends RowData>(
```

### `type SvGridOptions`

_No JSDoc yet._

```ts
export type SvGridOptions<TFeatures extends TableFeatures, TData extends RowData> = {
  _features: TFeatures
  _rowModels?: {
    coreRowModel?: RowModelFactory<TData>
    filteredRowModel?: RowModelFactory<TData>
    sortedRowModel?: RowModelFactory<TData>
    paginatedRowModel?: RowModelFactory<TData>
    groupedRowModel?: RowModelFactory<TData>
    expandedRowModel?: RowModelFactory<TData>
  }
  columns: Array<ColumnDef<TFeatures, TData>>
  data: ReadonlyArray<TData>
  /**
   * Optional row-id resolver. When set, the value it returns becomes
   * `row.id` (and therefore the selection / expansion / edit key). When
   * omitted, ids fall back to the row's array index as a string. Use a
   * stable id (database PK, UUID, etc.) so selection survives reorders.
   */
  getRowId?: (row: TData, index: number) => string
  state?: Partial<Record<string, any>>
  onSortingChange?: (updater: Updater<SortingState>) => void
  onColumnFiltersChange?: (updater: Updater<ColumnFiltersState>) => void
  onPaginationChange?: (updater: Updater<PaginationState>) => void
  onGroupingChange?: (updater: Updater<GroupingState>) => void
  onExpandedChange?: (updater: Updater<ExpandedState>) => void
  onRowSelectionChange?: (updater: Updater<RowSelectionState>) => void
  onActiveCellChange?: (updater: Updater<ActiveCellState>) => void
}
```

### `type SvGrid`

_No JSDoc yet._

```ts
export type SvGrid<TData extends RowData> = {
  store: Store<Record<string, any>>
  optionsStore: Store<Record<string, any>>
  state: Record<string, any>
  getState: () => Record<string, any>
  setOptions: (updater: Updater<Record<string, any>>) => void
  setColumnFilters: (updater: Updater<ColumnFiltersState>) => void
  setPagination: (updater: Updater<PaginationState>) => void
  setGrouping: (updater: Updater<GroupingState>) => void
  setExpanded: (updater: Updater<ExpandedState>) => void
  setRowSelection: (updater: Updater<RowSelectionState>) => void
  setActiveCell: (updater: Updater<ActiveCellState>) => void
  moveActiveCell: (next: { rowDelta?: number; colDelta?: number }) => void
  getAllColumns: () => Array<Column<TData>>
  getHeaderGroups: () => Array<HeaderGroup<TData>>
  getFooterGroups: () => Array<HeaderGroup<TData>>
  getRowModel: () => RowModel<TData>
}
```

### `function createSvGridCore`

_No JSDoc yet._

```ts
export function createSvGridCore<TFeatures extends TableFeatures, TData extends RowData>(
```

### `function isFunction`

_No JSDoc yet._

```ts
export function isFunction(value: unknown): value is (...args: Array<any>) => any {
  return typeof value === 'function'
}
```
