import type { SparklineConfig } from './sparkline'
import { resolveColumnId } from './column-id'

/**
 * The constraint every row type satisfies: an object keyed by string. Your own
 * row type (`type Person = { name: string }`) is what flows through the generics
 * below; this is only the lower bound they are declared against.
 */
export type RowData = Record<string, unknown>

/**
 * A new value, or a function that derives it from the previous one - the shape
 * every `set*` on the grid accepts, so callers can update state without first
 * reading it.
 *
 *   api.setSorting([{ id: 'name', desc: false }])
 *   api.setSorting((prev) => [...prev, { id: 'age', desc: true }])
 */
export type Updater<T> = T | ((prev: T) => T)

/** Active sort clauses, outermost first. `desc: false` is ascending. */
export type SortingState = Array<{ id: string; desc: boolean }>

/**
 * One column's filter: the column `id`, the `value` being matched, and
 * optionally which comparison to use. `fn` defaults to the column's own type -
 * see {@link filterFns} for the available names.
 */
export type ColumnFilter = { id: string; value: unknown; fn?: keyof typeof filterFns }

/** Every active column filter. A column with no entry here is unfiltered. */
export type ColumnFiltersState = Array<ColumnFilter>

/** Current page position. `pageIndex` is 0-based, so page 1 is index 0. */
export type PaginationState = { pageIndex: number; pageSize: number }

/** Column ids the rows are grouped by, outermost first. */
export type GroupingState = Array<string>

/** Which rows are expanded, keyed by row id. Absent means collapsed. */
export type ExpandedState = Record<string, boolean>

/** Which rows are selected, keyed by row id. Absent means unselected. */
export type RowSelectionState = Record<string, boolean>

/**
 * Where keyboard focus sits. The indices address the *displayed* grid (after
 * sorting, filtering and paging), not the source data.
 */
export type ActiveCellState = {
  rowIndex: number
  colIndex: number
  cellId: string | null
}

/**
 * The set of features a grid has registered, as built by {@link tableFeatures}.
 * Deliberately open: a feature is identified by its key, so the type carries
 * which ones are on without enumerating them.
 */
export type TableFeatures = Record<string, unknown>

/** A cell's value. Unconstrained - a column can hold anything. */
export type CellData = unknown

/** What a column's `header` render function receives. */
export type HeaderContext<TData extends RowData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}

/**
 * What a column's `cell` render function receives. `getValue()` applies the
 * column's accessor (`field` or `fieldFn`); `row.original` is the raw object.
 */
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

/**
 * Declarative cell formatting, applied through `Intl` - number, currency,
 * percent, date and datetime. Prefer this over a `formatter` function: it is
 * locale-aware, and export and the clipboard reuse the same configuration.
 */
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

/**
 * A column's custom display function, for anything {@link CellFormatConfig}
 * cannot express. Returns a string - to render markup, use `cell` instead.
 */
export type CellFormatter<TData extends RowData> = (context: {
  value: unknown
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
}) => string

/** A header or cell slot: a literal string, or a function returning renderable content. */
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
  // One pass, no intermediate arrays.
  //
  // This used to build a `raw` array, then a coerced one, then a filtered one -
  // three allocations per aggregated column PER GROUP - before reducing. On a
  // 100k-row grid grouped two levels deep, aggregation was about two thirds of
  // the total grouping cost (213ms with three aggregators against 81ms with
  // none), and each additional aggregated column added roughly 80ms.
  //
  // `count` first: it never needs to look at a value at all.
  if (agg === 'count') return rows.length

  if (agg === 'first') {
    return rows.length ? rows[0]!.getCellValueByColumnId(columnId) : undefined
  }

  if (agg === 'countDistinct') {
    const seen = new Set<string>()
    for (const row of rows) seen.add(String(row.getCellValueByColumnId(columnId) ?? ''))
    return seen.size
  }

  if (typeof agg === 'function') {
    // Custom aggregators keep their contract: the finite numbers, then the
    // original row objects. Note `Number(null)` is 0 and therefore finite, so
    // nulls DO reach the callback as zeros - long-standing behaviour.
    const nums: number[] = []
    for (const row of rows) {
      const n = Number(row.getCellValueByColumnId(columnId))
      if (Number.isFinite(n)) nums.push(n)
    }
    return agg(nums, rows.map((r) => r.original))
  }

  // sum / avg / min / max / extent share one accumulation pass.
  let count = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const row of rows) {
    const n = Number(row.getCellValueByColumnId(columnId))
    if (!Number.isFinite(n)) continue
    count++
    // Left-to-right, matching the previous `reduce`, so float rounding is
    // bit-identical rather than merely close.
    sum += n
    // Math.min/max on scalars rather than `<`, which differs on -0, and rather
    // than the old `Math.min(...nums)` - spreading a whole group throws
    // RangeError once the bucket is big enough to exhaust the argument stack.
    min = Math.min(min, n)
    max = Math.max(max, n)
  }
  if (!count) return undefined
  switch (agg) {
    case 'sum':
      return sum
    case 'avg':
      return sum / count
    case 'min':
      return min
    case 'max':
      return max
    case 'extent':
      return `${min} – ${max}`
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
   * cell spans to the right (1 = no span). Value-driven. Feed
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
   * Defaults to `false` (collapsed), the conventional default - so only the always-on
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
   * Declarative per-cell validation. Runs for EVERY
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
   * number, uppercase a code, look up an id). A `valueParser` hook.
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
   * What this column contributes to the grid's footer summary row (the one
   * turned on with `summary` / `enableRowSummaries`). Takes the same
   * aggregators as {@link aggregate}, and the result is formatted with this
   * column's `format`.
   *
   * Without it the footer falls back to its default: the sum of a numeric
   * column, `Count: N` otherwise. Set `false` to leave the cell blank, which is
   * usually what an actions or checkbox column wants.
   *
   *   { field: 'amount', summary: 'avg' }
   *   { id: 'actions', summary: false }
   */
  summary?: GroupAggregator<TData> | false
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
   * Whether the user may resize this column. Only consulted when the grid has
   * `columnResize` on - it narrows that, it does not enable anything.
   *
   * `false` removes the column's drag handle entirely, so pointer drag, the
   * keyboard arrows and double-click-to-autosize are all gone with it, and the
   * column menu drops its Autosize item. Use it for the columns whose width is
   * part of the layout rather than a preference: a row-number gutter, a
   * checkbox column, a fixed icon column.
   *
   * Programmatic sizing is unaffected - `api.autosizeColumn()`,
   * `api.setColumnWidth()` and `fitColumns` all still apply, the same way they
   * do when `columnResize` is off. This governs the user affordance only.
   */
  resizable?: boolean
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

/**
 * A resolved column: your {@link ColumnDef} plus everything the grid computed
 * from it - its id, its depth under any group header, and the sort handlers a
 * header needs. This is what you receive in render contexts; the `ColumnDef`
 * is what you wrote.
 */
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

/**
 * One header cell. `colSpan` is how many leaf columns it covers, and
 * `isPlaceholder` marks the empty cells that pad a group-header row so the
 * levels line up.
 */
export type Header<TData extends RowData> = {
  id: string
  isPlaceholder: boolean
  colSpan: number
  column: Column<TData>
  getContext: () => HeaderContext<TData>
}

/** One row of header cells. A grid with grouped columns has several, outermost first. */
export type HeaderGroup<TData extends RowData> = {
  id: string
  headers: Array<Header<TData>>
}

/** One cell: the intersection of a {@link Row} and a {@link Column}. */
export type Cell<TData extends RowData> = {
  id: string
  row: Row<TData>
  column: Column<TData>
  getValue: () => unknown
  getContext: () => CellContext<TData>
}

/**
 * A row in the display model. `original` is your untouched data object;
 * everything else is grid-computed. `index` is the position in the displayed
 * set, so it shifts as sorting and filtering change - key on `id`, not index.
 *
 * Group rows and tree parents carry `subRows`; a plain data row does not.
 */
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

/** The output of the row pipeline: the rows to display, in order. */
export type RowModel<TData extends RowData> = {
  rows: Array<Row<TData>>
}

/**
 * The minimal reactive store behind the headless core - read `state`, write
 * through `setState`, and `subscribe` for changes. Deliberately framework
 * free, which is what lets the core run under plain Node.
 *
 * In Svelte you rarely touch this: `subscribeGrid` wraps it with fine-grained
 * selectors so a component only re-runs for the slice it read.
 */
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

/**
 * Click-to-sort. Injected by the `sortable` shortcut.
 *
 * This and the five features below are opaque markers: pass the ones you want
 * to {@link tableFeatures} and the grid wires up the matching row model. With
 * `<SvGrid>` you rarely name them - the boolean shortcuts (`sortable`,
 * `filterable`, `pageable`, `groupable`) inject them for you. Reach for them
 * directly when driving the headless core, or when you want a feature on
 * without its UI.
 *
 * The names match TanStack Table v9, so a features object written for it works
 * here unchanged.
 */
export const rowSortingFeature = { key: 'rowSortingFeature' }
/** Per-column filtering. Injected by the `filterable` shortcut. */
export const columnFilteringFeature = { key: 'columnFilteringFeature' }
/** Paging of the row model. Injected by the `pageable` shortcut. */
export const rowPaginationFeature = { key: 'rowPaginationFeature' }
/** Row grouping with aggregation. Injected by the `groupable` shortcut. */
export const columnGroupingFeature = { key: 'columnGroupingFeature' }
/** Row selection state (the checkbox column reads it). */
export const rowSelectionFeature = { key: 'rowSelectionFeature' }
/** Expand / collapse, for tree rows and master-detail. */
export const rowExpandingFeature = { key: 'rowExpandingFeature' }

/**
 * Declare which features a grid uses. Identity at runtime - its whole job is to
 * capture the exact set in the type, so `ColumnDef<typeof features, Row>` knows
 * what is registered and anything you did not register is tree-shaken out.
 *
 * ```ts
 * const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
 * ```
 *
 * Same call signature as TanStack Table v9, so a features object written for it
 * transfers unchanged.
 */
export function tableFeatures<T extends TableFeatures>(features: T): T {
  return features
}

/**
 * Built-in comparators, chosen per column by its data type. `auto` compares as
 * text; set a column's type or supply your own comparator to override.
 */
export const sortFns = {
  auto: (a: unknown, b: unknown) => String(a).localeCompare(String(b)),
  number: (a: unknown, b: unknown) => Number(a ?? 0) - Number(b ?? 0),
  date: (a: unknown, b: unknown) => {
    const aa = new Date(a as any).getTime()
    const bb = new Date(b as any).getTime()
    return aa - bb
  },
}

/**
 * Built-in match functions, named by {@link ColumnFilter}'s `fn`.
 * `includesString` is case-insensitive substring; `equals` is strict identity.
 */
export const filterFns = {
  includesString: (value: unknown, query: string) =>
    String(value).toLowerCase().includes(query.toLowerCase()),
  equals: (value: unknown, query: unknown) => value === query,
}

/**
 * Everything a base row needs that is the same for every row in the table.
 *
 * One object per table, referenced by every row, instead of one closure scope
 * per row. See {@link BASE_ROW_METHODS}.
 */
type BaseRowCtx<TData extends RowData> = {
  grid: SvGrid<TData>
  store: { state: Record<string, any> }
  columns: Array<Column<TData>>
  columnCount: number
  columnIndexById: Map<string, number>
}

/**
 * Keys for a base row's private fields.
 *
 * Symbols, not string keys, and that is load-bearing. A row's shared methods
 * need a pointer back to the table, but `_ctx` as a normal property made every
 * row serialise the entire grid: `JSON.stringify(oneRow)` grew with the dataset
 * (981 chars at 3 rows, 67,719 at 3,000) because `options.data` is reachable
 * through it, so stringifying a row model was quadratic. Rows used to serialise
 * to a small constant and must again.
 *
 * A symbol key is invisible to `JSON.stringify`, `Object.keys` and `for...in`,
 * yet IS copied by object spread - which matters because several row models
 * legitimately do `{ ...row, depth }` and the clone needs these to work.
 * Non-enumerable string keys would have hidden them from JSON but also from the
 * spread, silently breaking every cloned row.
 */
const ROW_CTX = Symbol('svgrid.row.ctx')
const ROW_VALUES = Symbol('svgrid.row.values')
const ROW_CELLS = Symbol('svgrid.row.cells')

/** A base row's private fields, on top of the public {@link Row} surface. */
type BaseRowState<TData extends RowData> = Row<TData> & {
  [ROW_CTX]: BaseRowCtx<TData>
  [ROW_VALUES]: Array<unknown> | null
  [ROW_CELLS]: Array<Cell<TData>> | null
}

/**
 * The methods every base row carries, defined ONCE and assigned by reference.
 *
 * Rows used to be built as object literals whose methods were closures, which
 * meant a 100k-row grid allocated 700k closures and a closure scope per row
 * before painting anything. Measured at 100k x 9: 13.8 ms and 56.5 MB to build,
 * against 2.0 ms and 14.5 MB for this shape - the single largest cost in
 * mounting a large grid.
 *
 * They read their row through `this` rather than a captured variable, which is
 * why they can be shared. Note they are assigned as OWN properties rather than
 * put on a prototype: `Row` is public, several row models legitimately do
 * `{ ...row, depth }`, and a spread copies own properties but not a prototype.
 * A class here would silently strip every method off a cloned row.
 */
const BASE_ROW_METHODS = {
  getCanExpand(this: BaseRowState<RowData>) {
    return false
  },
  getIsExpanded(this: BaseRowState<RowData>) {
    return Boolean((this[ROW_CTX].store.state.expanded ?? {})[this.id])
  },
  toggleExpanded(this: BaseRowState<RowData>) {
    const id = this.id
    this[ROW_CTX].grid.setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  },
  getIsSelected(this: BaseRowState<RowData>) {
    return Boolean((this[ROW_CTX].store.state.rowSelection ?? {})[this.id])
  },
  toggleSelected(this: BaseRowState<RowData>) {
    const id = this.id
    this[ROW_CTX].grid.setRowSelection((prev) => ({ ...prev, [id]: !prev[id] }))
  },
  getAllCells(this: BaseRowState<RowData>) {
    return this[ROW_CELLS] ?? buildBaseRowCells(this)
  },
  getCellValueByColumnId(this: BaseRowState<RowData>, columnId: string) {
    const idx = this[ROW_CTX].columnIndexById.get(columnId)
    if (idx === undefined) return undefined
    if (!this[ROW_VALUES]) this[ROW_VALUES] = baseRowValues(this)
    return this[ROW_VALUES][idx]
  },
}

/**
 * Materialise one row's `Cell[]`, memoised on the row.
 *
 * A free function taking the row rather than a method using `this`, because the
 * cell closures need a stable reference to it and aliasing `this` inside a
 * method is exactly the pattern that produces `self`/`that` bugs.
 */
function buildBaseRowCells<TData extends RowData>(row: BaseRowState<TData>): Array<Cell<TData>> {
  const { columns, columnCount, grid } = row[ROW_CTX]
  const built = new Array<Cell<TData>>(columnCount)
  for (let i = 0; i < columnCount; i++) {
    const column = columns[i]!
    const colIndex = i
    const cell: Cell<TData> = {
      id: `${row.id}_${column.id}`,
      row,
      column,
      getValue: () => {
        if (!row[ROW_VALUES]) row[ROW_VALUES] = baseRowValues(row)
        return row[ROW_VALUES][colIndex]
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
  row[ROW_CELLS] = built
  return built
}

/**
 * Resolve every column's value for one row. Kept lazy: a 100k-row grid showing
 * twenty rows must not materialise 900k values to paint.
 */
function baseRowValues<TData extends RowData>(row: BaseRowState<TData>): Array<unknown> {
  const { columns, columnCount } = row[ROW_CTX]
  const original = row.original as Record<string, unknown>
  const values = new Array<unknown>(columnCount)
  for (let i = 0; i < columnCount; i++) {
    const def = columns[i]!.columnDef
    if (def.fieldFn) values[i] = def.fieldFn(original as TData)
    else if (def.field) values[i] = original[def.field]
    else values[i] = undefined
  }
  return values
}

/**
 * One stage of the row pipeline: takes the rows produced so far and returns the
 * next set. Stages compose in the order given to `_rowModels`, so filtering
 * before sorting sorts only what survived the filter.
 */
export type RowModelFactory<TData extends RowData> = (args: {
  table: SvGrid<TData>
  rows: Array<Row<TData>>
}) => Array<Row<TData>>

/**
 * The identity stage that starts every pipeline. Always required, even when no
 * other stage is: it is what turns your data into rows.
 */
export function createCoreRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ rows }) => rows
}
/**
 * Drops rows that fail the active {@link ColumnFiltersState}. Pairs with
 * `columnFilteringFeature`; without it there are no filters to apply.
 */
export function createFilteredRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const filters: ColumnFiltersState = table.getState().columnFilters ?? []
    if (!filters.length) return rows

    // Resolve each filter's match function once, outside the row loop.
    const compiled = filters.map((filter) => ({
      id: filter.id,
      value: filter.value,
      fn: filter.fn ? filterFns[filter.fn] : filterFns.includesString,
    }))

    return rows.filter((row) => {
      for (let i = 0; i < compiled.length; i++) {
        const filter = compiled[i]!
        // `getCellValueByColumnId` rather than `getAllCells().find(...)`.
        // Both read the same lazily-built `cachedValues` array, but the latter
        // also builds and caches the row's whole `Cell[]` - one object per
        // column - purely to reach one field. On a 100k-row grid that is
        // 100,000 cell arrays the filter never looks at again, and it defeats
        // the laziness the row factory exists to provide.
        if (!filter.fn(row.getCellValueByColumnId(filter.id), filter.value as any)) return false
      }
      return true
    })
  }
}
/**
 * Narrows the rows to the current page. Put it LAST: anything after it would
 * only ever see one page of data.
 */
export function createPaginatedRowModel<TData extends RowData>(): RowModelFactory<TData> {
  return ({ table, rows }) => {
    const pagination = table.getState().pagination ?? { pageIndex: 0, pageSize: rows.length || 10 }
    const start = pagination.pageIndex * pagination.pageSize
    return rows.slice(start, start + pagination.pageSize)
  }
}
/**
 * Buckets rows by the active {@link GroupingState} and inserts a group row
 * ahead of each bucket, carrying that bucket's aggregates.
 */
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
      /** Grouping columns already fixed by an ancestor bucket, and their raw
       *  values - `undefined` where that bucket mixed several. */
      fixedValues: ReadonlyMap<string, unknown>,
    ): Array<Row<TData>> {
      if (levelIndex >= grouping.length) {
        // Leaves: actual data rows, with their nesting depth recorded.
        return input.map((row) => ({ ...row, depth }))
      }
      const groupKey = grouping[levelIndex]
      if (!groupKey) return input

      // Buckets carry the RAW grouping value alongside the rows, plus whether
      // the bucket saw more than one distinct raw value. Both are needed to let
      // deeper levels skip re-scanning this column: buckets are keyed by
      // `String(value ?? '')`, so `null`, `undefined` and `''` collapse into one
      // bucket, and a scan of such a bucket would report disagreement. Tracking
      // it here costs one comparison per row and keeps the shortcut honest.
      type Bucket = { rows: Array<Row<TData>>; raw: unknown; mixed: boolean }
      const buckets = new Map<string, Bucket>()
      for (const row of input) {
        const value = row.getCellValueByColumnId(groupKey)
        const key = String(value ?? '')
        const bucket = buckets.get(key)
        if (bucket) {
          bucket.rows.push(row)
          if (!bucket.mixed && bucket.raw !== value) bucket.mixed = true
        } else {
          buckets.set(key, { rows: [row], raw: value, mixed: false })
        }
      }

      const groupRows: Array<Row<TData>> = []
      let index = 0
      buckets.forEach((bucket, key) => {
        const children = bucket.rows
        const id = `${idPrefix}_${groupKey}_${key}`
        // Record this column as fixed for deeper levels ONLY when the bucket is
        // homogeneous. If all rows here share a raw value, so does every subset
        // of them, which is what makes the shortcut sound.
        //
        // A MIXED bucket must not be recorded at all - not even as "undefined".
        // `null`, `undefined` and `''` share a bucket key, so a mixed bucket can
        // still split into homogeneous children one level down, and those
        // children have a real shared value that a scan would find. Marking the
        // column resolved here would hand them the parent's disagreement.
        const nextFixed = bucket.mixed ? fixedValues : new Map(fixedValues).set(groupKey, bucket.raw)
        const subRows = buildGroups(children, levelIndex + 1, depth + 1, id, nextFixed)
        const isDeepest = levelIndex + 1 >= grouping.length
        const leafCount = isDeepest
          ? subRows.length
          : subRows.reduce((sum, sub) => sum + (sub.leafCount ?? 0), 0)

        // Every grouping column ABOVE this level is already resolved: bucketing
        // by it is what made it constant, so scanning the children to rediscover
        // it is pure waste. Only the current level's key short-circuited before,
        // so a second-level group walked all of its children to re-derive the
        // first level's value - about 100,000 reads on the 100k x 9 two-level
        // case, for an answer already in hand.
        //
        // The current level still returns the stringified bucket key rather than
        // the raw value, because that is what it has always returned and the
        // group row's display depends on it.
        const resolveColumnValue = (columnId: string): unknown => {
          if (columnId === groupKey) return key
          if (fixedValues.has(columnId)) return fixedValues.get(columnId)
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

    return buildGroups(rows, 0, 0, 'group', new Map())
  }
}
/**
 * How to read a hierarchy out of FLAT rows: each row names its parent, and the
 * grid reconstructs the tree. Rows whose parent id matches nothing become roots
 * rather than disappearing.
 *
 * For nested source data (`children: [...]`), flatten it first with
 * {@link flattenTreeData}.
 */
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

/**
 * How to flatten NESTED source data into the parent-id shape tree rows need.
 * `parentField` is written onto each row, so point `treeData.parentField` at
 * the same name afterwards.
 */
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

/**
 * Hides the descendants of collapsed rows. Needed for grouping, tree data and
 * master-detail alike - all three are the same expand/collapse mechanism.
 */
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
/**
 * Orders rows by the active {@link SortingState}. Pass your own comparators to
 * override the built-in {@link sortFns} - useful for locale-aware or
 * domain-specific ordering.
 */
export function createSortedRowModel<TData extends RowData>(
  localSortFns: typeof sortFns = sortFns,
): RowModelFactory<TData> {
  return function sortedRowModelStage({ table, rows }) {
    const sorting = table.getState().sorting ?? []
    if (!sorting.length) return rows

    // Resolve every clause ONCE, before sorting.
    //
    // This used to live inside the comparator, so `getAllColumns().find(...)`
    // ran per comparison per clause: a single-clause sort of 100k rows made
    // 1,528,947 array scans, and a three-clause sort made 3,933,751 (measured;
    // `pnpm bench --case=sort-1col`). The comparator is called O(n log n)
    // times, so anything inside it that is not O(1) sets the cost of the sort.
    const allColumns = table.getAllColumns()
    const clauses: Array<{
      keys: Array<any>
      desc: boolean
      compare: (a: any, b: any) => number
    }> = []

    for (const clause of sorting) {
      const column = allColumns.find((col) => col.id === clause.id)
      if (!column) continue
      const editorType = column.columnDef.editorType
      const comparator =
        editorType === 'number'
          ? localSortFns.number
          : editorType === 'date' || editorType === 'datetime'
            ? localSortFns.date
            : localSortFns.auto

      // Precompute one sort key per row, so the comparator reads an array slot
      // instead of walking the row's column index on every comparison. For the
      // three built-in comparators the key is also cheaper to compare than the
      // raw value: a timestamp rather than two `new Date()` allocations, a
      // number rather than two `Number()` coercions, a collator rather than a
      // fresh one per `localeCompare` call.
      //
      // The identity checks against `sortFns` matter: `localSortFns` is a
      // public parameter, so a caller can substitute their own comparators.
      // When they have, we fall through to calling their function with the raw
      // values - still hoisted, just not specialised.
      const columnId = column.id
      const n = rows.length
      let keys: Array<any> = new Array(n)
      let compare: (a: any, b: any) => number

      if (comparator === sortFns.number) {
        for (let i = 0; i < n; i++) keys[i] = Number(rows[i]!.getCellValueByColumnId(columnId) ?? 0)
        compare = compareNumericKeys
      } else if (comparator === sortFns.date) {
        for (let i = 0; i < n; i++) {
          keys[i] = new Date(rows[i]!.getCellValueByColumnId(columnId) as any).getTime()
        }
        compare = compareNumericKeys
      } else if (comparator === sortFns.auto) {
        const strings: string[] = new Array(n)
        // Decide whether ranking is worth attempting BEFORE paying for it.
        //
        // Building the distinct set and then discarding it costs about 9 ms on
        // a 100k-row column where nearly every value is unique, and ranking
        // saves about 19 ms where they repeat - so guessing wrong in either
        // direction is measurable. A small stride sample answers it for well
        // under a millisecond.
        //
        // Strided rather than the first N rows: data arrives sorted or
        // clustered often enough that a prefix is a bad estimator of the whole
        // column. Reading every k-th row is no more expensive and does not care
        // how the rows are arranged.
        const rankLimit = n >> 1
        let distinct: Set<string> | null = null
        if (n > 0) {
          const sampleTarget = Math.min(n, 256)
          const stride = Math.max(1, Math.floor(n / sampleTarget))
          const sample = new Set<string>()
          let sampled = 0
          for (let i = 0; i < n; i += stride) {
            sample.add(String(rows[i]!.getCellValueByColumnId(columnId)))
            sampled++
          }
          // Only attempt ranking when the sample suggests real repetition.
          if (sample.size * 2 <= sampled) distinct = new Set()
        }

        for (let i = 0; i < n; i++) {
          const s = String(rows[i]!.getCellValueByColumnId(columnId))
          strings[i] = s
          if (distinct) {
            distinct.add(s)
            if (distinct.size > rankLimit) distinct = null
          }
        }

        // Collation is by far the most expensive comparison we do - a CPU
        // profile of a 100k text sort put 65% of the whole operation inside the
        // collator. But a column's DISTINCT values are usually far fewer than
        // its rows (statuses, regions, categories, owners), so rank the
        // distinct values once and sort by rank afterwards. That turns
        // O(n log n) collator calls into O(u log u), where u is the number of
        // distinct values, and the resulting order is identical because rank is
        // a monotone relabelling of the collated order - equal strings share a
        // rank, so ties still fall through to the stable sort exactly as before.
        //
        // Guarded on the uniqueness ratio: when nearly every value is distinct
        // the ranking pass cannot save any collator calls and would just add an
        // O(n) Map build, so that case keeps comparing directly.
        if (distinct) {
          const ordered = Array.from(distinct).sort(compareCollatedKeys)
          const rankOf = new Map<string, number>()
          for (let i = 0; i < ordered.length; i++) rankOf.set(ordered[i]!, i)
          for (let i = 0; i < n; i++) keys[i] = rankOf.get(strings[i]!)!
          compare = compareNumericKeys
        } else {
          keys = strings
          compare = compareCollatedKeys
        }
      } else {
        for (let i = 0; i < n; i++) keys[i] = rows[i]!.getCellValueByColumnId(columnId)
        compare = comparator
      }

      clauses.push({ keys, desc: clause.desc, compare })
    }

    if (!clauses.length) return rows

    // Sort an index array, then materialise. `Array.prototype.sort` is stable,
    // so equal keys keep their original relative order exactly as the previous
    // `[...rows].sort(...)` did.
    const order = new Array<number>(rows.length)
    for (let i = 0; i < order.length; i++) order[i] = i

    // Single-clause sorts get a specialised comparator.
    //
    // Most sorts are one column, and that path runs O(n log n) times - 1.66
    // million comparisons for 100k rows. The general loop pays a clause-array
    // index, three property loads and an indirect call on every one of them,
    // none of which vary once the clause list is fixed. Hoisting them into a
    // closure and, for the numeric comparator, inlining the subtraction removes
    // the call entirely.
    //
    // `keys[ib] - keys[ia]` for descending is exactly `-(keys[ia] - keys[ib])`
    // as far as sorting is concerned: both are NaN for unorderable values,
    // which the spec coerces to 0, and they differ only in producing 0 versus
    // -0 for equal keys, which sorts identically.
    if (clauses.length === 1) {
      const { keys, compare, desc } = clauses[0]!
      if (compare === compareNumericKeys) {
        order.sort(
          desc
            ? function compareOneNumericDesc(ia, ib) { return keys[ib] - keys[ia] }
            : function compareOneNumericAsc(ia, ib) { return keys[ia] - keys[ib] },
        )
      } else {
        order.sort(
          desc
            ? function compareOneDesc(ia, ib) { return -compare(keys[ia], keys[ib]) }
            : function compareOneAsc(ia, ib) { return compare(keys[ia], keys[ib]) },
        )
      }
    } else {
      order.sort(function compareRowsByClauses(ia, ib) {
        for (let k = 0; k < clauses.length; k++) {
          const clause = clauses[k]!
          const result = clause.compare(clause.keys[ia], clause.keys[ib])
          if (result !== 0) return clause.desc ? -result : result
        }
        return 0
      })
    }

    const sorted = new Array<Row<TData>>(rows.length)
    for (let i = 0; i < order.length; i++) sorted[i] = rows[order[i]!]!
    return sorted
  }
}

/**
 * Numeric key comparison for the built-in `number` and `date` comparators.
 * Subtraction rather than `<`/`>` on purpose: it reproduces the originals
 * exactly, NaN included. An unparseable date or a non-numeric value yields NaN,
 * and the sort spec turns a NaN comparison result into 0 (SortCompare coerces
 * it), which is the behaviour callers already depend on.
 */
function compareNumericKeys(a: number, b: number): number {
  return a - b
}

/**
 * Text key comparison for the built-in `auto` comparator.
 *
 * `localeCompare`, NOT a hoisted `Intl.Collator`. The specification defines
 * `localeCompare` with no locale or options as constructing a default collator
 * per call, so hoisting one looks like the obvious optimisation - and it is
 * measurably slower. V8 fast-paths `String.prototype.localeCompare` for the
 * default locale; going through a collator object misses that path. Measured
 * sorting 100k strings: 33 ms via `localeCompare` against 83 ms via a cached
 * collator on ASCII, 58 ms against 99 ms with accents mixed in, and the two
 * produce byte-identical orderings across all 100k positions.
 *
 * Left as its own function so the sort path has one place to change if that
 * ever stops being true. Re-measure before "optimising" this again.
 */
function compareCollatedKeys(a: string, b: string): number {
  return a.localeCompare(b)
}

/**
 * Everything {@link createSvGridCore} accepts: the data and columns, the
 * features and row models that make up the pipeline, and an `on*Change`
 * callback per piece of state for controlled use.
 *
 * `<SvGrid>` builds this for you from its props - you only construct it
 * directly when driving the headless core.
 */
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

/**
 * The headless grid instance: the state stores plus the read methods a renderer
 * needs (`getHeaderGroups()`, `getRowModel()`, the `set*` writers).
 *
 * Framework free by design - `<SvGrid>` is one renderer over this, and you can
 * write another. See the "Why headless?" guide.
 */
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

/**
 * Build a headless grid: state, the row pipeline, and the read methods, with no
 * DOM and no Svelte. This is the engine `<SvGrid>` renders.
 *
 * Most callers want `createSvGrid` (the runes-aware wrapper) or the component
 * itself; reach for this when you are writing your own renderer or running the
 * pipeline outside a browser.
 */
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

        // One shared context for every row in this table, so a row carries a
        // pointer rather than a closure scope. See BASE_ROW_METHODS.
        const rowCtx: BaseRowCtx<TData> = {
          grid: grid as SvGrid<TData>,
          store,
          columns,
          columnCount,
          columnIndexById,
        }

        cachedBaseRows = new Array(options.data.length)
        const getRowId = options.getRowId
        const m = BASE_ROW_METHODS as unknown as {
          getCanExpand: Row<TData>['getCanExpand']
          getIsExpanded: Row<TData>['getIsExpanded']
          toggleExpanded: Row<TData>['toggleExpanded']
          getIsSelected: Row<TData>['getIsSelected']
          toggleSelected: Row<TData>['toggleSelected']
          getAllCells: Row<TData>['getAllCells']
          getCellValueByColumnId: Row<TData>['getCellValueByColumnId']
        }
        for (let index = 0; index < options.data.length; index++) {
          const original = options.data[index]!
          // `_values` and `_cells` stay null until something reads them - a
          // 100k-row grid showing twenty rows must not materialise every row's
          // values or cell objects to paint.
          const row: BaseRowState<TData> = {
            id: getRowId ? getRowId(original, index) : String(index),
            index,
            original,
            depth: 0,
            [ROW_CTX]: rowCtx,
            [ROW_VALUES]: null,
            [ROW_CELLS]: null,
            getCanExpand: m.getCanExpand,
            getIsExpanded: m.getIsExpanded,
            toggleExpanded: m.toggleExpanded,
            getIsSelected: m.getIsSelected,
            toggleSelected: m.toggleSelected,
            getAllCells: m.getAllCells,
            getCellValueByColumnId: m.getCellValueByColumnId,
          }
          cachedBaseRows[index] = row
        }
      }

      // Only the slices a pipeline stage actually READS belong in this key.
      //
      // `rowSelection` used to be here, which meant ticking one checkbox on a
      // 100k-row grid re-filtered and re-sorted the entire dataset to rebuild a
      // row array that was identical by construction. Nothing reads it: the two
      // consumers are `getIsSelected` closures (on data rows and on group rows)
      // that read `store.state` when called, so they observe a selection change
      // without the model being rebuilt.
      //
      // `_rowModels` is a closed set of six named slots, so no consumer stage
      // can be inserted that might read selection. A caller CAN supply a custom
      // function for one of those slots; if one ever needs a slice that is not
      // listed here, add it here rather than reinstating all of them.
      const currentSlices = {
        sorting: store.state.sorting,
        columnFilters: store.state.columnFilters,
        pagination: store.state.pagination,
        grouping: store.state.grouping,
        expanded: store.state.expanded,
      }
      if (
        cachedRowModel &&
        cachedRowModelBaseRows === cachedBaseRows &&
        cachedPipeline === options._rowModels &&
        cachedSlices?.sorting === currentSlices.sorting &&
        cachedSlices?.columnFilters === currentSlices.columnFilters &&
        cachedSlices?.pagination === currentSlices.pagination &&
        cachedSlices?.grouping === currentSlices.grouping &&
        cachedSlices?.expanded === currentSlices.expanded
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

/** Narrowing helper for the many options that accept a value or a function. */
export function isFunction(value: unknown): value is (...args: Array<any>) => any {
  return typeof value === 'function'
}
