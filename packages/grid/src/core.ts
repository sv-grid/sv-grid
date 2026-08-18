import type { SparklineConfig } from './sparkline'
import { resolveColumnId } from './column-id'

export type RowData = Record<string, unknown>
export type Updater<T> = T | ((prev: T) => T)
export type SortingState = Array<{ id: string; desc: boolean }>
export type ColumnFilter = { id: string; value: unknown; fn?: keyof typeof filterFns }
export type ColumnFiltersState = Array<ColumnFilter>
export type PaginationState = { pageIndex: number; pageSize: number }
export type GroupingState = Array<string>
export type ExpandedState = Record<string, boolean>
export type RowSelectionState = Record<string, boolean>
export type ActiveCellState = {
  rowIndex: number
  colIndex: number
  cellId: string | null
}
export type TableFeatures = Record<string, unknown>

export type CellData = unknown

export type HeaderContext<TData extends RowData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}

export type CellContext<TData extends RowData> = {
  cell: Cell<TData>
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
  getValue: () => unknown
}

/** Params passed to a column's `colSpan(...)` / `rowSpan(...)` callbacks. */
export type CellSpanParams<TData extends RowData = RowData> = {
  /** The row's underlying data object. */
  data: TData
  /** Display-row index in the current (filtered/sorted) row set. */
  rowIndex: number
  /** The column's id. */
  columnId: string
  /** The cell's base value for this column. */
  value: unknown
}

/** The raw option list a column's `editorOptions` can supply. */
export type EditorOptionSource = ReadonlyArray<
  string | number | { value: string | number; label?: string; color?: string }
>

/** Params passed to a column's `valueParser(...)` on edit commit. */
export type ValueParserParams<TData extends RowData = RowData> = {
  /** The value after built-in per-`editorType` coercion. */
  newValue: unknown
  /** The cell's previous value. */
  oldValue: unknown
  /** The raw string the editor produced (pre-coercion). */
  rawInput: string
  /** The row's underlying data object. */
  data: TData
  /** The column's id. */
  columnId: string
}

/**
 * Context passed to a custom `cellEditor` snippet/component. Three write
 * helpers cover the lifecycle:
 *
 *   - `update(next)`  - stage `next` as the draft, keep the editor open.
 *                       Use this for live-preview controls (sliders,
 *                       color pickers) so the user can keep adjusting.
 *   - `commit(next?)` - write the value AND close the editor. The
 *                       argument is optional; when omitted, the most
 *                       recently `update()`d value is saved. Use this
 *                       for "done" gestures (Enter, picking an option).
 *   - `cancel()`      - discard the draft and close the editor.
 */
export type EditorContext<TData extends RowData> = CellContext<TData> & {
  value: unknown
  update: (next: unknown) => void
  commit: (next?: unknown) => void
  cancel: () => void
}

export type CellFormatConfig =
  | {
      type: 'number'
      locales?: string | Array<string>
      options?: Intl.NumberFormatOptions
    }
  | {
      type: 'currency'
      /** ISO 4217 (default USD) */
      currency?: string
      locales?: string | Array<string>
      options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>
    }
  | {
      type: 'percent'
      locales?: string | Array<string>
      options?: Omit<Intl.NumberFormatOptions, 'style'>
      /**
       * If true, numeric cell values are 0–100 (e.g. 42 → 42%) instead of Intl’s 0–1 fraction (0.42 → 42%).
       * Default false.
       */
      valueIsPercentPoints?: boolean
    }
  | {
      type: 'date' | 'datetime'
      locales?: string | Array<string>
      /**
       * Shortcut patterns merged with `options`:
       * `'d'` short numeric date, `'D'` long date, `'y-m-d'` yyyy/mm/dd-style,
       * `'short'`|`'medium'`|`'long'` use dateStyle/timeStyle presets.
       */
      pattern?: string
      options?: Intl.DateTimeFormatOptions
    }

export type CellFormatter<TData extends RowData> = (context: {
  value: unknown
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
}) => string

export type ColumnDefTemplate<TContext> = string | ((context: TContext) => unknown)

/**
 * How a column's value is aggregated for a group row when `columnGrouping`
 * is active. Built-in reducers cover the common cases; pass a function for
 * anything custom (weighted average, median, percentile, distinct count).
 * The function receives the finite numeric values AND the raw leaf rows.
 */
export type GroupAggregator<TData = any> =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'countDistinct'
  | 'extent'
  | 'first'
  | ((values: number[], rows: Array<TData>) => unknown)

/** Apply a group aggregator over a bucket's leaf rows for one column. */
export function applyGroupAggregate<TData extends RowData>(
  agg: GroupAggregator<TData>,
  columnId: string,
  rows: ReadonlyArray<Row<TData>>,
): unknown {
  const raw = rows.map((r) => r.getCellValueByColumnId(columnId))
  if (typeof agg === 'function') {
    const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    return agg(nums, rows.map((r) => r.original))
  }
  if (agg === 'count') return rows.length
  if (agg === 'countDistinct') return new Set(raw.map((v) => String(v ?? ''))).size
  if (agg === 'first') return raw[0]
  const nums = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  if (!nums.length) return undefined
  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
    case 'extent':
      return `${Math.min(...nums)} – ${Math.max(...nums)}`
    default:
      return undefined
  }
}

/**
 * A column definition.
 *
 * `TFeatures` is a phantom parameter - it is threaded through nested
 * `columns` groups but no member depends on it, so `{}`, `TableFeatures` and
 * `typeof features` are all interchangeable here. It is deliberately left
 * WITHOUT a default: `ColumnDef<Row>` would otherwise bind `Row` to this slot
 * and silently type your data as `RowData`, losing every field-name check.
 * Prefer {@link GridColumns} / {@link GridColumnDef} for the common case.
 */
export type ColumnDef<TFeatures extends TableFeatures, TData extends RowData> = {
  id?: string
  field?: keyof TData & string
  fieldFn?: (row: TData) => unknown
  header?: ColumnDefTemplate<HeaderContext<TData>>
  footer?: ColumnDefTemplate<HeaderContext<TData>>
  cell?: ColumnDefTemplate<CellContext<TData>>
  columns?: Array<ColumnDef<TFeatures, TData>>
  /**
   * Declarative cell spanning (merged cells). Return how many COLUMNS this
   * cell spans to the right (1 = no span). Value-driven, AG-Grid-style. Feed
   * `spansToMerges(rows, columns)` into `spreadsheetLayout` to apply - it uses
   * the same real `colspan`/`rowspan` merge engine (no separate code path).
   */
  colSpan?: (params: CellSpanParams<TData>) => number
  /**
   * Declarative cell spanning (merged cells). Return how many ROWS this cell
   * spans downward (1 = no span). See `colSpan` for how to apply.
   */
  rowSpan?: (params: CellSpanParams<TData>) => number
  /**
   * High-level data type for the column. A convenience that resolves to the
   * right `editorType`, alignment, date `format`, and filter operators without
   * setting each by hand:
   *   'text' → text editor, left-aligned
   *   'number' → number editor, right-aligned, numeric filter operators
   *   'boolean' → checkbox editor, centered
   *   'date' → date editor (Date values), right-aligned, `{ type: 'date' }` format
   *   'dateString' → date editor for ISO date STRINGS (e.g. '2026-06-27')
   * Anything you set explicitly (`editorType`, `align`, `format`) still wins -
   * `cellDataType` only fills the gaps. Grid-level `inferColumnTypes` infers
   * this from the first data row for columns that declare neither.
   */
  cellDataType?: 'text' | 'number' | 'boolean' | 'date' | 'dateString'
  /**
   * Hide this column when the grid's `responsive` mode is on and the grid is
   * narrower than this many pixels - drop low-priority columns on small
   * screens. No effect unless the grid has `responsive` set.
   */
  hideBelow?: number
  /**
   * For a column INSIDE a collapsible column group: `'open'` shows this column
   * only while the group is expanded, `'closed'` only while collapsed. Omit to
   * always show it. Setting it on any direct child gives the parent group a
   * collapse toggle. Pair with `openByDefault` on the group.
   */
  columnGroupShow?: 'open' | 'closed'
  /**
   * For a GROUP column (one with `columns: [...]`): start the group expanded.
   * Defaults to `false` (collapsed), matching AG Grid - so only the always-on
   * and `columnGroupShow: 'closed'` children show until the user expands it.
   */
  openByDefault?: boolean
  editorType?:
    | 'text'
    | 'number'
    | 'date'         // rich SvCalendar popover (opt out with 'date-native')
    | 'datetime'     // rich SvDateTimePicker (opt out with 'datetime-native')
    | 'time'         // rich SvTimePicker dial (opt out with 'time-native')
    | 'date-native'      // plain <input type="date">
    | 'datetime-native'  // plain <input type="datetime-local">
    | 'time-native'      // plain <input type="time"> - HH:MM or HH:MM:SS
    | 'password'     // native <input type="password"> with masked rendering
    | 'checkbox'
    | 'list'
    | 'chips'
    | 'select'       // custom dropdown - single value, no typeahead
    | 'rich-select'  // custom dropdown with a typeahead search input
    | 'autocomplete' // free-text input with a live-filtered suggestion list (accepts any value)
    | 'textarea'     // multi-line editor; Tab or Ctrl+Enter commits, plain Enter inserts a newline
    | 'color'        // native <input type="color"> swatch
    | 'rating'       // 5-star rating control
    // Any other string names a CUSTOM editor registered via `registerCellEditor`
    // (or `registerBuiltinEditors`). `(string & {})` keeps the literals above
    // autocompleting while allowing arbitrary custom type names.
    | (string & {})
  /**
   * Custom in-cell editor. Receives the cell context PLUS a `commit(value)`
   * and `cancel()` helper. Use when none of the built-in `editorType`s fit;
   * the snippet's outer element is mounted inside the editing cell and
   * inherits keyboard handling (Esc cancels, Enter commits unless your
   * snippet preventDefaults it).
   *
   * Coexists with `editorType`: when both are set, `cellEditor` wins and
   * `editorType` is treated as a hint for parsing the saved value.
   */
  cellEditor?: ColumnDefTemplate<EditorContext<TData>>
  /**
   * Per-column tooltip. String shows as a native `title=`; `(ctx) => string`
   * runs per cell so the tooltip can reflect the value. Returning an empty
   * string skips the tooltip.
   */
  tooltip?: string | ((ctx: CellContext<TData>) => string | null | undefined)
  /**
   * Declarative per-cell validation (Handsontable-style). Runs for EVERY
   * rendered cell - including values already present in `data` on load, not
   * just on edit - so bad data is flagged immediately. Invalid cells get the
   * `sv-grid-cell-invalid` class (red highlight) and the returned message as
   * their tooltip.
   *
   * Return value:
   *   - `null` / `undefined` / `true` → valid (no highlight)
   *   - `false`                       → invalid, no message
   *   - a non-empty `string`          → invalid, string is the tooltip
   *
   * The value keeps rendering as-is (the grid does NOT roll it back); pair
   * with `onCellValueChange` if you also want to reject the commit.
   */
  validate?: (params: {
    value: unknown
    row: TData
    rowIndex: number
    column: Column<TData>
  }) => string | boolean | null | undefined
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
   * Transform the committed edit value before it is written to the row.
   * Runs after the built-in per-`editorType` coercion, so `newValue` is
   * already type-parsed; return the final value to store (e.g. round a
   * number, uppercase a code, look up an id). AG-Grid-style `valueParser`.
   */
  valueParser?: (params: ValueParserParams<TData>) => unknown
  /**
   * Briefly flash / highlight this column's cell when its value changes
   * (streaming feeds, edits, server pushes). `true` uses the default flash;
   * pass `{ className }` to apply your own animation class instead.
   */
  cellFlash?: boolean | { className?: string }
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
   *
   * Either form may return a **Promise**, for options that come from the
   * server. While it resolves, the editor shows a loading state and the cell
   * renders its raw value.
   *
   * Results are cached so reopening an editor does not refetch: a static source
   * per column, a per-row source per row AND per that row's data - so a cascade
   * reloads by itself when the cell it depends on is edited. Call
   * `api.refreshEditorOptions(columnId?)` when the list changes server-side.
   */
  editorOptions?:
    | EditorOptionSource
    | Promise<EditorOptionSource>
    | ((row: TData) => EditorOptionSource | Promise<EditorOptionSource>)
  /** When true, list/chips allow multiple selections. Cell value becomes an array. */
  editorMultiple?: boolean
  /** Separator used when joining array values for the readonly cell display. Defaults to ', '. */
  editorSeparator?: string
  format?: CellFormatConfig
  formatter?: CellFormatter<TData>
  /**
   * Aggregate this column's values into the group row when grouping is
   * active. `'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct' |
   * 'extent' | 'first'`, or a custom `(values, rows) => unknown`. The result
   * is formatted with this column's `format` and shown in the group header.
   */
  aggregate?: GroupAggregator<TData>
  /**
   * Render the cell as an in-cell sparkline chart. The cell value should be
   * an array of numbers (or a comma/space separated string). Mutually
   * exclusive with a custom `cell` renderer (a `cell` wins if both are set).
   *
   *   { sparkline: { type: 'line' } }                 // default line
   *   { sparkline: { type: 'bar', color: '#16a34a' } }
   *   { sparkline: { type: 'winloss' } }              // sign-only up/down
   *
   * See `SparklineConfig` for the full option set (type, color,
   * negativeColor, width, height, fixed min/max).
   */
  sparkline?: SparklineConfig
  /** Initial column width in pixels. Falls back to the grid's `columnWidth` prop. */
  width?: number
  /**
   * Initial visibility. Set `false` to start the column hidden while still
   * listing it in the Choose Columns UI for the user to re-enable. Applied
   * once at mount; after that `api.setColumnVisible` / user toggles win.
   * On a group column, `false` hides the whole group's leaf columns.
   */
  visible?: boolean
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

/**
 * A column definition keyed only by your row type - the ergonomic form of
 * {@link ColumnDef}, whose first parameter is a phantom feature bag that is
 * almost always `{}`.
 *
 * ```ts
 * const columns: GridColumns<Person> = [{ field: 'firstName', header: 'Name' }]
 * ```
 *
 * Interchangeable with `ColumnDef<{}, TData>` and `ColumnDef<typeof features,
 * TData>` in both directions, so it mixes freely with existing code.
 */
export type GridColumnDef<TData extends RowData = RowData> = ColumnDef<TableFeatures, TData>

/** An array of {@link GridColumnDef} - what you pass to `<SvGrid columns={...}>`. */
export type GridColumns<TData extends RowData = RowData> = Array<GridColumnDef<TData>>

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

export type Header<TData extends RowData> = {
  id: string
  isPlaceholder: boolean
  colSpan: number
  column: Column<TData>
  getContext: () => HeaderContext<TData>
}

export type HeaderGroup<TData extends RowData> = {
  id: string
  headers: Array<Header<TData>>
}

export type Cell<TData extends RowData> = {
  id: string
  row: Row<TData>
  column: Column<TData>
  getValue: () => unknown
  getContext: () => CellContext<TData>
}

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

export type RowModel<TData extends RowData> = {
  rows: Array<Row<TData>>
}

export type Store<T> = {
  readonly state: T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: () => void) => () => void
}

function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get state() {
      return value
    },
    setState(updater) {
      value = updater(value)
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const rowSortingFeature = { key: 'rowSortingFeature' }
export const columnFilteringFeature = { key: 'columnFilteringFeature' }
export const rowPaginationFeature = { key: 'rowPaginationFeature' }
export const columnGroupingFeature = { key: 'columnGroupingFeature' }
export const rowSelectionFeature = { key: 'rowSelectionFeature' }
export const rowExpandingFeature = { key: 'rowExpandingFeature' }

export function tableFeatures<T extends TableFeatures>(features: T): T {
  return features
}

export const sortFns = {
  auto: (a: unknown, b: unknown) => String(a).localeCompare(String(b)),
  number: (a: unknown, b: unknown) => Number(a ?? 0) - Number(b ?? 0),
  date: (a: unknown, b: unknown) => {
    const aa = new Date(a as any).getTime()
    const bb = new Date(b as any).getTime()
    return aa - bb
  },
}

export const filterFns = {
  includesString: (value: unknown, query: string) =>
    String(value).toLowerCase().includes(query.toLowerCase()),
  equals: (value: unknown, query: unknown) => value === query,
}

export type RowModelFactory<TData extends RowData> = (args: {
  table: SvGrid<TData>
  rows: Array<Row<TData>>
}) => Array<Row<TData>>

export function createCoreRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ rows }) => rows
}
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
export function createPaginatedRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const pagination = table.getState().pagination ?? { pageIndex: 0, pageSize: rows.length || 10 }
    const start = pagination.pageIndex * pagination.pageSize
    return rows.slice(start, start + pagination.pageSize)
  }
}
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
          if (!field) return
          const agg = column.columnDef.aggregate
          groupOriginal[field] = agg
            ? applyGroupAggregate(agg, column.id, children)
            : resolveColumnValue(column.id)
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
          // Prefer the precomputed group value (which carries aggregates)
          // and fall back to the shared-value resolver for columns without
          // a field.
          getCellValueByColumnId: (columnId: string) => {
            const col = columns.find((c) => c.id === columnId)
            const field = col?.columnDef.field
            if (field && field in groupOriginal) return groupOriginal[field]
            return resolveColumnValue(columnId)
          },
        }
        groupRows.push(groupRow)
      })
      return groupRows
    }

    return buildGroups(rows, 0, 0, 'group')
  }
}
export type TreeRowModelOptions = {
  /** Field holding each row's parent id. Rows with no parent are roots. */
  parentField: string
  /** Field holding the row's own id. Defaults to `'id'`. */
  idField?: string
}

/**
 * Client-side tree data: nest the grid's own flat rows into a parent/child
 * hierarchy that `createExpandedRowModel` then walks.
 *
 * This works on the rows the grid already built rather than on raw data, so
 * tree rows keep their cells, editing, selection and formatting - they are real
 * data rows that happen to have children, not synthetic banners like grouping's.
 * That is also why the model is parent-id based: nested source arrays never
 * become rows (the grid only builds rows for `data`), so nested input is
 * flattened first with {@link flattenTreeData}. One code path, no duplicated
 * row construction.
 *
 * Rows are tagged `__treeRow` so `isGroupRow` does not mistake an expandable
 * data row for a full-width group banner.
 */
export function createTreeRowModel<TData extends RowData>(
  options: TreeRowModelOptions,
): RowModelFactory<TData> {
  const { parentField, idField = 'id' } = options
  return ({ table, rows }) => {
    if (!rows.length) return rows
    const keyOf = (row: Row<TData>) => (row.original as any)?.[idField]
    const parentOf = (row: Row<TData>) => (row.original as any)?.[parentField]

    const present = new Set<unknown>()
    for (const row of rows) present.add(keyOf(row))

    const childrenByParent = new Map<unknown, Array<Row<TData>>>()
    const roots: Array<Row<TData>> = []
    for (const row of rows) {
      const parent = parentOf(row)
      // A row whose parent is absent (filtered out, or never existed) becomes a
      // root rather than disappearing - silently dropping rows is worse than a
      // shallower tree. Self-parenting is treated the same way.
      if (parent == null || parent === keyOf(row) || !present.has(parent)) {
        roots.push(row)
        continue
      }
      const list = childrenByParent.get(parent) ?? []
      list.push(row)
      childrenByParent.set(parent, list)
    }

    // Guards a cycle in the parent chain from recursing forever.
    const seen = new Set<unknown>()
    const build = (row: Row<TData>, depth: number): Row<TData> => {
      const key = keyOf(row)
      const id = row.id
      if (seen.has(key)) {
        return { ...row, depth, subRows: [], getCanExpand: () => false } as Row<TData>
      }
      seen.add(key)
      const subRows = (childrenByParent.get(key) ?? []).map((child) => build(child, depth + 1))
      return {
        ...row,
        depth,
        subRows,
        leafCount: subRows.reduce((n, sub) => n + 1 + (sub.leafCount ?? 0), 0),
        __treeRow: true,
        getCanExpand: () => subRows.length > 0,
        getIsExpanded: () => Boolean((table.getState().expanded ?? {})[id]),
        toggleExpanded: () => {
          table.setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
        },
      } as Row<TData>
    }

    return roots.map((root) => build(root, 0))
  }
}

export type FlattenTreeOptions = {
  /** Field holding an array of child objects. */
  childrenField: string
  /** Field holding each object's id. Defaults to `'id'`. */
  idField?: string
  /** Field to WRITE the resolved parent id onto. Defaults to `'__parentId'`. */
  parentField?: string
}

/**
 * Flatten nested tree data into the flat parent-id shape `createTreeRowModel`
 * consumes, stamping each child with its parent's id.
 *
 * Children are emitted directly after their parent so the natural order already
 * matches the rendered tree. The `childrenField` array is left on the objects
 * (harmless, and callers often still want it); only the parent link is added.
 */
export function flattenTreeData<T extends RowData>(
  data: ReadonlyArray<T>,
  options: FlattenTreeOptions,
): T[] {
  const { childrenField, idField = 'id', parentField = '__parentId' } = options
  const out: T[] = []
  const walk = (nodes: ReadonlyArray<T>, parentId: unknown) => {
    for (const node of nodes) {
      const flat = { ...node, [parentField]: parentId } as T
      out.push(flat)
      const kids = (node as any)[childrenField]
      if (Array.isArray(kids) && kids.length) walk(kids as ReadonlyArray<T>, (node as any)[idField])
    }
  }
  walk(data, null)
  return out
}

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
export function createSortedRowModel<TData extends RowData>(
  localSortFns: typeof sortFns = sortFns,
): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const sorting = table.getState().sorting ?? []
    if (!sorting.length) return rows

    const sorted = [...rows].sort((a, b) => {
      for (const clause of sorting) {
        const column = table.getAllColumns().find((col) => col.id === clause.id)
        if (!column) continue
        const editorType = column.columnDef.editorType
        const comparator =
          editorType === 'number'
            ? localSortFns.number
            : editorType === 'date' || editorType === 'datetime'
              ? localSortFns.date
              : localSortFns.auto
        const result = comparator(
          a.getCellValueByColumnId(column.id),
          b.getCellValueByColumnId(column.id),
        )
        if (result !== 0) return clause.desc ? -result : result
      }
      return 0
    })
    return sorted
  }
}

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

type InternalGrid<TData extends RowData> = SvGrid<TData> & {
  getAllColumns: () => Array<Column<TData>>
}

export function createSvGridCore<TFeatures extends TableFeatures, TData extends RowData>(
  options: SvGridOptions<TFeatures, TData>,
): SvGrid<TData> {
  const internalState: Record<string, any> = {
    sorting: [],
    columnFilters: [],
    pagination: { pageIndex: 0, pageSize: options.data.length || 10 },
    grouping: [],
    expanded: {},
    rowSelection: {},
    activeCell: { rowIndex: 0, colIndex: 0, cellId: null },
    ...(options.state ?? {}),
  }
  const store = createStore(internalState)
  const optionsStore = createStore(options as Record<string, any>)
  let cachedColumnsInput: Array<ColumnDef<TFeatures, TData>> | null = null
  let cachedColumns: Array<Column<TData>> = []
  let cachedHeaderGroups: Array<HeaderGroup<TData>> = []
  let cachedBaseRowsInput: ReadonlyArray<TData> | null = null
  let cachedBaseRowsColumns: Array<Column<TData>> | null = null
  let cachedBaseRows: Array<Row<TData>> = []
  let cachedRowModel: RowModel<TData> | null = null
  let cachedRowModelBaseRows: Array<Row<TData>> | null = null
  let cachedPipeline = options._rowModels
  let cachedSlices: {
    sorting: SortingState | undefined
    columnFilters: ColumnFiltersState | undefined
    pagination: PaginationState | undefined
    grouping: GroupingState | undefined
    expanded: ExpandedState | undefined
    rowSelection: RowSelectionState | undefined
  } | null = null

  const grid = {
    store,
    optionsStore,
    get state() {
      return store.state
    },
    getState() {
      return store.state
    },
    setOptions(updater: Updater<Record<string, any>>) {
      optionsStore.setState((prev) =>
        typeof updater === 'function' ? (updater as any)(prev) : updater,
      )
    },
    setColumnFilters(updater: Updater<ColumnFiltersState>) {
      store.setState((prev) => ({
        ...prev,
        columnFilters:
          typeof updater === 'function' ? (updater as any)(prev.columnFilters ?? []) : updater,
      }))
      options.onColumnFiltersChange?.(updater)
    },
    setPagination(updater: Updater<PaginationState>) {
      store.setState((prev) => ({
        ...prev,
        pagination:
          typeof updater === 'function'
            ? (updater as any)(prev.pagination ?? { pageIndex: 0, pageSize: 10 })
            : updater,
      }))
      options.onPaginationChange?.(updater)
    },
    setGrouping(updater: Updater<GroupingState>) {
      store.setState((prev) => ({
        ...prev,
        grouping: typeof updater === 'function' ? (updater as any)(prev.grouping ?? []) : updater,
      }))
      options.onGroupingChange?.(updater)
    },
    setExpanded(updater: Updater<ExpandedState>) {
      store.setState((prev) => ({
        ...prev,
        expanded: typeof updater === 'function' ? (updater as any)(prev.expanded ?? {}) : updater,
      }))
      options.onExpandedChange?.(updater)
    },
    setRowSelection(updater: Updater<RowSelectionState>) {
      store.setState((prev) => ({
        ...prev,
        rowSelection:
          typeof updater === 'function' ? (updater as any)(prev.rowSelection ?? {}) : updater,
      }))
      options.onRowSelectionChange?.(updater)
    },
    setActiveCell(updater: Updater<ActiveCellState>) {
      store.setState((prev) => {
        const previous: ActiveCellState = prev.activeCell ?? {
          rowIndex: 0,
          colIndex: 0,
          cellId: null,
        }
        const nextActive =
          typeof updater === 'function' ? updater(previous) : updater
        return {
          ...prev,
          activeCell: nextActive,
        }
      })
      options.onActiveCellChange?.(updater)
    },
    moveActiveCell(next: { rowDelta?: number; colDelta?: number }) {
      const rows = grid.getRowModel().rows
      const columns = grid.getAllColumns()
      const maxRow = Math.max(rows.length - 1, 0)
      const maxCol = Math.max(columns.length - 1, 0)
      const current: ActiveCellState = grid.getState().activeCell ?? {
        rowIndex: 0,
        colIndex: 0,
        cellId: null,
      }

      const rowIndex = Math.min(
        Math.max(current.rowIndex + (next.rowDelta ?? 0), 0),
        maxRow,
      )
      const colIndex = Math.min(
        Math.max(current.colIndex + (next.colDelta ?? 0), 0),
        maxCol,
      )
      const columnId = columns[colIndex]?.id ?? 'col_0'
      grid.setActiveCell({
        rowIndex,
        colIndex,
        cellId: `${rowIndex}_${columnId}`,
      })
    },
    getAllColumns() {
      // Cache hit: referentially identical columns array.
      if (cachedColumnsInput === options.columns && cachedColumns.length) {
        return cachedColumns
      }
      // Soft cache hit: consumers commonly recreate the columns array
      // inline on every render (e.g. `columns={[...]}`). If the new
      // array has the same length AND each entry has the same `field` /
      // `id` / `header` (the visibility-affecting structure of a
      // column), trust the previous build. Mutable inner fields like
      // `cell` and `editorOptions` are still picked up on the next real
      // render that bumps an actual data dep - they're read at cell-
      // render time, not at this top-level cache.
      if (
        cachedColumnsInput &&
        options.columns.length === cachedColumnsInput.length &&
        cachedColumns.length === options.columns.length &&
        options.columns.every((c, i) => {
          const prev = cachedColumnsInput![i]!
          return (
            c.field === prev.field &&
            c.id === prev.id &&
            c.header === prev.header &&
            c.editorType === prev.editorType
          )
        })
      ) {
        // Update the stored input reference so the strict check hits
        // next time, but reuse the built column model.
        cachedColumnsInput = options.columns
        return cachedColumns
      }

      cachedColumnsInput = options.columns
      cachedHeaderGroups = []
      const build = (
        defs: Array<ColumnDef<TFeatures, TData>>,
        depth: number,
        parentId?: string,
      ): Array<Column<TData>> => {
        const leaves: Array<Column<TData>> = []
        defs.forEach((columnDef, index) => {
          const id = resolveColumnId(columnDef, parentId, depth, index)
          if (columnDef.columns?.length) {
            leaves.push(...build(columnDef.columns, depth + 1, id))
            return
          }
          leaves.push({
            id,
            depth,
            parentId,
            columnDef,
            getCanSort: () =>
              Boolean((options._features as any).rowSortingFeature) &&
              columnDef.sortable !== false,
            getCanFilter: () =>
              Boolean((options._features as any).columnFilteringFeature) &&
              columnDef.filterable !== false,
            getIsSorted: () => {
              const entry = store.state.sorting?.find((s: any) => s.id === id)
              if (!entry) return false
              return entry.desc ? 'desc' : 'asc'
            },
            getToggleSortingHandler: () => () => {
              const clauses: SortingState = store.state.sorting ?? []
              const current = clauses.find((s: any) => s.id === id)
              const nextClause: SortingState = !current
                ? [...clauses, { id, desc: false }]
                : current.desc
                  ? clauses.filter((s) => s.id !== id)
                  : clauses.map((s) => (s.id === id ? { ...s, desc: true } : s))
              store.setState((prev) => ({ ...prev, sorting: nextClause }))
              options.onSortingChange?.(nextClause)
            },
          })
        })
        return leaves
      }
      cachedColumns = build(options.columns, 0)
      return cachedColumns
    },
    getHeaderGroups() {
      if (cachedHeaderGroups.length) return cachedHeaderGroups
      const headers = grid.getAllColumns().map((column) => {
        const header: Header<TData> = {
          id: column.id,
          isPlaceholder: false,
          colSpan: 1,
          column,
          getContext: () => ({ header, column, table: grid }),
        }
        return header
      })
      cachedHeaderGroups = [{ id: 'header_group_0', headers }]
      return cachedHeaderGroups
    },
    getFooterGroups() {
      return grid.getHeaderGroups()
    },
    getRowModel() {
      const columns = grid.getAllColumns()
      if (cachedBaseRowsInput !== options.data || cachedBaseRowsColumns !== columns) {
        cachedBaseRowsInput = options.data
        cachedBaseRowsColumns = columns
        // O(1) column-id → index lookup so getCellValueByColumnId doesn't do
        // a linear `findIndex` on every cell read (was O(rows × cells × cols)).
        const columnIndexById = new Map<string, number>()
        for (let i = 0; i < columns.length; i++) columnIndexById.set(columns[i]!.id, i)
        const columnCount = columns.length

        cachedBaseRows = new Array(options.data.length)
        const getRowId = options.getRowId
        for (let index = 0; index < options.data.length; index++) {
          const original = options.data[index]!
          const id = getRowId ? getRowId(original, index) : String(index)
          // `values` and `cells` are computed lazily - for a 100k-row grid
          // with only ~20 visible rows we don't want to materialise every
          // row's full value array or cell objects up front.
          let cachedValues: Array<unknown> | null = null
          let cachedCells: Array<Cell<TData>> | null = null

          function computeValues(): Array<unknown> {
            const values = new Array<unknown>(columnCount)
            for (let i = 0; i < columnCount; i++) {
              const column = columns[i]!
              if (column.columnDef.fieldFn) {
                values[i] = column.columnDef.fieldFn(original)
              } else if (column.columnDef.field) {
                values[i] = (original as any)[column.columnDef.field]
              } else {
                values[i] = undefined
              }
            }
            return values
          }

          const row: Row<TData> = {
            id,
            index,
            original,
            depth: 0,
            getCanExpand: () => false,
            getIsExpanded: () => Boolean((store.state.expanded ?? {})[id]),
            toggleExpanded: () => {
              grid.setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
            },
            getIsSelected: () => Boolean((store.state.rowSelection ?? {})[id]),
            toggleSelected: () => {
              grid.setRowSelection((prev) => ({ ...prev, [id]: !prev[id] }))
            },
            getAllCells: () => {
              if (cachedCells) return cachedCells
              const built = new Array<Cell<TData>>(columnCount)
              for (let i = 0; i < columnCount; i++) {
                const column = columns[i]!
                const colIndex = i
                const cell: Cell<TData> = {
                  id: `${id}_${column.id}`,
                  row,
                  column,
                  getValue: () => {
                    if (!cachedValues) cachedValues = computeValues()
                    return cachedValues[colIndex]
                  },
                  getContext: () => ({
                    cell,
                    row,
                    column,
                    table: grid,
                    getValue: () => cell.getValue(),
                  }),
                }
                built[i] = cell
              }
              cachedCells = built
              return built
            },
            getCellValueByColumnId: (columnId: string) => {
              const idx = columnIndexById.get(columnId)
              if (idx === undefined) return undefined
              if (!cachedValues) cachedValues = computeValues()
              return cachedValues[idx]
            },
          }
          cachedBaseRows[index] = row
        }
      }

      const currentSlices = {
        sorting: store.state.sorting,
        columnFilters: store.state.columnFilters,
        pagination: store.state.pagination,
        grouping: store.state.grouping,
        expanded: store.state.expanded,
        rowSelection: store.state.rowSelection,
      }
      if (
        cachedRowModel &&
        cachedRowModelBaseRows === cachedBaseRows &&
        cachedPipeline === options._rowModels &&
        cachedSlices?.sorting === currentSlices.sorting &&
        cachedSlices?.columnFilters === currentSlices.columnFilters &&
        cachedSlices?.pagination === currentSlices.pagination &&
        cachedSlices?.grouping === currentSlices.grouping &&
        cachedSlices?.expanded === currentSlices.expanded &&
        cachedSlices?.rowSelection === currentSlices.rowSelection
      ) {
        return cachedRowModel
      }

      let rows: Array<Row<TData>> = cachedBaseRows

      const pipeline = options._rowModels ?? {}
      const ordered: Array<RowModelFactory<TData> | undefined> = [
        pipeline.coreRowModel,
        pipeline.filteredRowModel,
        pipeline.sortedRowModel,
        pipeline.groupedRowModel,
        pipeline.expandedRowModel,
        pipeline.paginatedRowModel,
      ]
      ordered.forEach((fn) => {
        if (fn) rows = fn({ table: grid, rows })
      })
      cachedPipeline = options._rowModels
      cachedSlices = currentSlices
      cachedRowModelBaseRows = cachedBaseRows
      cachedRowModel = { rows }
      return cachedRowModel
    },
  } as InternalGrid<TData>

  return grid
}

export function isFunction(value: unknown): value is (...args: Array<any>) => any {
  return typeof value === 'function'
}
