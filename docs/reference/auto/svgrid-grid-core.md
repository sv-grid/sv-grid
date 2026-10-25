# `@svgrid/grid` · `core.ts`

Auto-generated. Source: `packages\grid\src\core.ts`.

### `type RowData`

The constraint every row type satisfies: an object keyed by string. Your own
row type (`type Person = { name: string }`) is what flows through the generics
below; this is only the lower bound they are declared against.

```ts
export type RowData = Record<string, unknown>
```

### `type Updater`

A new value, or a function that derives it from the previous one - the shape
every `set*` on the grid accepts, so callers can update state without first
reading it.

  api.setSorting([{ id: 'name', desc: false }])
  api.setSorting((prev) => [...prev, { id: 'age', desc: true }])

```ts
export type Updater<T> = T | ((prev: T) => T)
```

### `type SortingState`

Active sort clauses, outermost first. `desc: false` is ascending.

```ts
export type SortingState = Array<{ id: string; desc: boolean }>
```

### `type ColumnFilter`

One column's filter: the column `id`, the `value` being matched, and
optionally which comparison to use. `fn` defaults to the column's own type -
see {@link filterFns} for the available names.

```ts
export type ColumnFilter = { id: string; value: unknown; fn?: keyof typeof filterFns }
```

### `type ColumnFiltersState`

Every active column filter. A column with no entry here is unfiltered.

```ts
export type ColumnFiltersState = Array<ColumnFilter>
```

### `type PaginationState`

Current page position. `pageIndex` is 0-based, so page 1 is index 0.

```ts
export type PaginationState = { pageIndex: number; pageSize: number }
```

### `type GroupingState`

Column ids the rows are grouped by, outermost first.

```ts
export type GroupingState = Array<string>
```

### `type ExpandedState`

Which rows are expanded, keyed by row id. Absent means collapsed.

```ts
export type ExpandedState = Record<string, boolean>
```

### `type RowSelectionState`

Which rows are selected, keyed by row id. Absent means unselected.

```ts
export type RowSelectionState = Record<string, boolean>
```

### `type ActiveCellState`

Where keyboard focus sits. The indices address the *displayed* grid (after
sorting, filtering and paging), not the source data.

```ts
export type ActiveCellState = {
  rowIndex: number
  colIndex: number
  cellId: string | null
}
```

### `type TableFeatures`

The set of features a grid has registered, as built by {@link tableFeatures}.
Deliberately open: a feature is identified by its key, so the type carries
which ones are on without enumerating them.

```ts
export type TableFeatures = Record<string, unknown>
```

### `type CellData`

A cell's value. Unconstrained - a column can hold anything.

```ts
export type CellData = unknown
```

### `type HeaderContext`

What a column's `header` render function receives.

```ts
export type HeaderContext<TData extends RowData> = {
  header: Header<TData>
  column: Column<TData>
  table: SvGrid<TData>
}
```

### `type CellContext`

What a column's `cell` render function receives. `getValue()` applies the
column's accessor (`field` or `fieldFn`); `row.original` is the raw object.

```ts
export type CellContext<TData extends RowData> = {
  cell: Cell<TData>
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
  getValue: () => unknown
}
```

### `type CellSpanParams`

Params passed to a column's `colSpan(...)` / `rowSpan(...)` callbacks.

```ts
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
```

### `type EditorOptionSource`

The raw option list a column's `editorOptions` can supply.

```ts
export type EditorOptionSource = ReadonlyArray<
  string | number | { value: string | number; label?: string; color?: string }
```

### `type ValueParserParams`

Params passed to a column's `valueParser(...)` on edit commit.

```ts
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
```

### `type EditorContext`

Context passed to a custom `cellEditor` snippet/component. Three write
helpers cover the lifecycle:

  - `update(next)`  - stage `next` as the draft, keep the editor open.
                      Use this for live-preview controls (sliders,
                      color pickers) so the user can keep adjusting.
  - `commit(next?)` - write the value AND close the editor. The
                      argument is optional; when omitted, the most
                      recently `update()`d value is saved. Use this
                      for "done" gestures (Enter, picking an option).
  - `cancel()`      - discard the draft and close the editor.

```ts
export type EditorContext<TData extends RowData> = CellContext<TData> & {
  value: unknown
  update: (next: unknown) => void
  commit: (next?: unknown) => void
  cancel: () => void
}
```

### `type CustomFilterContext`

What a custom filter control receives, in the filter menu and in the
floating filter row. The grid owns the model; the control reads `model`
and writes it back through `setModel`.

```ts
export type CustomFilterContext<TData extends RowData, TModel = any> = {
  column: Column<TData>
  /** The column's current model, or `undefined` when none is set. */
  model: TModel | undefined
  /** Replace the model. `null` or `undefined` clears the filter. */
  setModel: (next: TModel | null | undefined) => void
  /**
   * Which surface is rendering the control: the filter menu, the floating
   * filter row, or the tool panel's Filters tab.
   */
  surface: 'menu' | 'floating' | 'panel'
  /**
   * The column's distinct values under every OTHER column's filter, the
   * same list the menu's Values checklist shows. Computed on call, so a
   * control that never asks pays nothing.
   */
  values: () => Array<string>
  /** Close the filter menu. Does nothing on the other surfaces. */
  close: () => void
}
```

### `type CustomColumnFilter`

A column filter whose state is your own model rather than an operator and
a value: a range slider's `[min, max]`, a tag picker's `string[]`, a
"last N days" count.

The model lives in the grid (`api.setCustomFilter`, `getState().customFilters`)
and is ANDed with the column's operator condition and its Values checklist,
the same as those two are with each other. Keep it JSON-serializable if you
save views.

  customFilter: {
    predicate: ([min, max]: [number, number]) => (value) =>
      Number(value) >= min && Number(value) <= max,
    menu: priceRange,      // a Snippet<[CustomFilterContext]>
    floating: priceRange,
  }

```ts
export type CustomColumnFilter<TData extends RowData, TModel = any> = {
  /**
   * Build the row test for a model. Runs once per filter change, not once
   * per row, so parse dates or build sets here. The returned function gets
   * the column's value and the row's data.
   */
  predicate: (model: TModel) => (value: unknown, row: TData) => boolean
  /**
   * Whether a model narrows anything. An inactive model is kept (the control
   * still shows it) but filters nothing and lights no funnel. Default: not
   * `null` / `undefined` / `''` / an empty array.
   */
  isActive?: (model: TModel) => boolean
  /**
   * The control in the filter menu and the tool panel's Filters tab, in
   * place of the operator condition. A Svelte snippet taking a
   * {@link CustomFilterContext}. Falls back to `floating` when omitted.
   */
  menu?: (context: CustomFilterContext<TData, TModel>) => unknown
  /**
   * The control in the floating filter row, in place of the operator button
   * and input. Falls back to `menu` when omitted.
   */
  floating?: (context: CustomFilterContext<TData, TModel>) => unknown
  /** Keep the Values checklist under the custom control in the menu. Default `true`. */
  showValues?: boolean
}
```

### `type CellFormatConfig`

Declarative cell formatting, applied through `Intl` - number, currency,
percent, date and datetime. Prefer this over a `formatter` function: it is
locale-aware, and export and the clipboard reuse the same configuration.

```ts
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
```

### `type CellFormatter`

A column's custom display function, for anything {@link CellFormatConfig}
cannot express. Returns a string - to render markup, use `cell` instead.

```ts
export type CellFormatter<TData extends RowData> = (context: {
  value: unknown
  row: Row<TData>
  column: Column<TData>
  table: SvGrid<TData>
}) => string
```

### `type ColumnDefTemplate`

A header or cell slot: a literal string, or a function returning renderable content.

```ts
export type ColumnDefTemplate<TContext> = string | ((context: TContext) => unknown)
```

### `type GroupAggregator`

How a column's value is aggregated for a group row when `columnGrouping`
is active. Built-in reducers cover the common cases; pass a function for
anything custom (weighted average, median, percentile, distinct count).
The function receives the finite numeric values AND the raw leaf rows.

```ts
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
```

### `function applyGroupAggregate`

Apply a group aggregator over a bucket's leaf rows for one column.

```ts
export function applyGroupAggregate<TData extends RowData>(
  agg: GroupAggregator<TData>,
  columnId: string,
  rows: ReadonlyArray<Row<TData>>,
): unknown
```

### `type ColumnDef`

A column definition.

`TFeatures` is a phantom parameter - it is threaded through nested
`columns` groups but no member depends on it, so `{}`, `TableFeatures` and
`typeof features` are all interchangeable here. It is deliberately left
WITHOUT a default: `ColumnDef<Row>` would otherwise bind `Row` to this slot
and silently type your data as `RowData`, losing every field-name check.
Prefer {@link GridColumns} / {@link GridColumnDef} for the common case.

```ts
export type ColumnDef<TFeatures extends TableFeatures, TData extends RowData> = {
  id?: string
  field?: keyof TData & string
  fieldFn?: (row: TData) => unknown
  header?: ColumnDefTemplate<HeaderContext<TData>>
  footer?: ColumnDefTemplate<HeaderContext<TData>>
  cell?: ColumnDefTemplate<CellContext<TData>>
  /**
   * A field type registered by `@svgrid/enterprise/fields` (`'attachment'`,
   * `'rating'`, `'url'`, ...). With the module enabled the cell is drawn by
   * that type; a column's own `cell` still wins. Without it the column draws
   * as an ordinary one.
   */
  fieldType?: string
  /** Properties of `fieldType` (options, precision, max files, ...). */
  fieldProps?: Record<string, unknown>
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
   * What the column's values are. It decides sorting, filter operators and
   * alignment, whatever edits the cell: `editorType` only picks the editor,
   * so a number column can be typed in a text box or a custom editor and
   * still sort, filter and align as numbers.
   *   'text' → left-aligned, text filters (text editor by default)
   *   'number' → right-aligned, numeric sort and filters (number editor)
   *   'boolean' → centered, true / false filter (checkbox editor)
   *   'date' → Date values, right-aligned, date sort and filters (date
   *     editor, `{ type: 'date' }` format)
   *   'dateString' → ISO date STRINGS (e.g. '2026-06-27'), as a date
   * Anything you set explicitly (`editorType`, `align`, `format`) still wins.
   * Without it, a built-in `editorType` (`number`, `date`, `datetime`,
   * `checkbox`) implies the type, as before; grid-level `inferColumnTypes`
   * infers it from the first data row for columns with neither.
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
   * The text format of the date / datetime editor's box, in date-format
   * tokens (`'MMMM d, yyyy'`, `'MM/dd/yyyy h:mm tt'`), so an edit shows the
   * date the way the cell does. Default `'yyyy-MM-dd'`, with time
   * `'yyyy-MM-dd HH:mm'`.
   */
  editorFormatString?: string
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
   * On its own `validate` flags: the value keeps rendering as-is and an
   * edit that fails it still lands. Set `rejectInvalid` to refuse such an
   * edit instead.
   */
  validate?: (params: {
    value: unknown
    row: TData
    rowIndex: number
    column: Column<TData>
  }) => string | boolean | null | undefined
  /**
   * Refuse an edit that `validate` flags. When true, a committed value that
   * makes `validate` return `false` or a message is not written: the cell
   * keeps its old value, no history step is recorded and
   * `onCellValueChange` does not fire. The value is checked after
   * `valueParser` has run, so the rule sees what would be stored. Applies to
   * the inline editor, a commit to a selection and a full-row edit; paste
   * does not go through the editor and is not checked.
   */
  rejectInvalid?: boolean
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
   * Replace the built-in filter condition with your own control and model.
   * See {@link CustomColumnFilter}. Without `menu` or `floating` the column
   * keeps the built-in UI and the model is set only through
   * `api.setCustomFilter`.
   */
  customFilter?: CustomColumnFilter<TData>
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
  /**
   * The text editor accepts line breaks: Alt+Enter inserts one and the
   * editor grows a line per break, while Enter still commits. What a
   * spreadsheet cell with wrapped text wants; `editorType: 'textarea'` is
   * the other shape, where Enter itself is the line break.
   */
  editorMultiline?: boolean
  /** Separator used when joining array values for the readonly cell display. Defaults to ', '. */
  editorSeparator?: string
  format?: CellFormatConfig
  formatter?: CellFormatter<TData>
  /**
   * The number this column sorts a value by, in place of the value: a status
   * option's position in its list, say, so "To do" comes before "Done".
   * Blanks and anything not a number sort first, as in a number column.
   */
  sortValue?: (value: unknown) => number | null | undefined
  /**
   * Compare two of this column's values yourself, in place of the built-in
   * order. `desc` is the direction being sorted; the grid reverses your result
   * for a descending sort, so return the ascending order unless you want a
   * value held at one end in both directions (`@svgrid/enterprise`'s
   * `blanksLast` does that). `sortValue` wins over it.
   */
  sortComparator?: (a: unknown, b: unknown, desc: boolean) => number
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
```

### `type GridColumnDef`

A column definition keyed only by your row type - the ergonomic form of
{@link ColumnDef}, whose first parameter is a phantom feature bag that is
almost always `{}`.

```ts
const columns: GridColumns<Person> = [{ field: 'firstName', header: 'Name' }]
```

Interchangeable with `ColumnDef<{}, TData>` and `ColumnDef<typeof features,
TData>` in both directions, so it mixes freely with existing code.

```ts
export type GridColumnDef<TData extends RowData = RowData> = ColumnDef<TableFeatures, TData>
```

### `type GridColumns`

An array of {@link GridColumnDef} - what you pass to `<SvGrid columns={...}>`.

```ts
export type GridColumns<TData extends RowData = RowData> = Array<GridColumnDef<TData>>
```

### `type Column`

A resolved column: your {@link ColumnDef} plus everything the grid computed
from it - its id, its depth under any group header, and the sort handlers a
header needs. This is what you receive in render contexts; the `ColumnDef`
is what you wrote.

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

One header cell. `colSpan` is how many leaf columns it covers, and
`isPlaceholder` marks the empty cells that pad a group-header row so the
levels line up.

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

One row of header cells. A grid with grouped columns has several, outermost first.

```ts
export type HeaderGroup<TData extends RowData> = {
  id: string
  headers: Array<Header<TData>>
}
```

### `type Cell`

One cell: the intersection of a {@link Row} and a {@link Column}.

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

A row in the display model. `original` is your untouched data object;
everything else is grid-computed. `index` is the position in the displayed
set, so it shifts as sorting and filtering change - key on `id`, not index.

Group rows and tree parents carry `subRows`; a plain data row does not.

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

The output of the row pipeline: the rows to display, in order.

```ts
export type RowModel<TData extends RowData> = {
  rows: Array<Row<TData>>
}
```

### `type Store`

The minimal reactive store behind the headless core - read `state`, write
through `setState`, and `subscribe` for changes. Deliberately framework
free, which is what lets the core run under plain Node.

In Svelte you rarely touch this: `subscribeGrid` wraps it with fine-grained
selectors so a component only re-runs for the slice it read.

```ts
export type Store<T> = {
  readonly state: T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: () => void) => () => void
}
```

### `const rowSortingFeature`

Click-to-sort. Injected by the `sortable` shortcut.

This and the five features below are opaque markers: pass the ones you want
to {@link tableFeatures} and the grid wires up the matching row model. With
`<SvGrid>` you rarely name them - the boolean shortcuts (`sortable`,
`filterable`, `pageable`, `groupable`) inject them for you. Reach for them
directly when driving the headless core, or when you want a feature on
without its UI.

The names match TanStack Table v9, so a features object written for it works
here unchanged.

```ts
export const rowSortingFeature = { key: 'rowSortingFeature' }
```

### `const columnFilteringFeature`

Per-column filtering. Injected by the `filterable` shortcut.

```ts
export const columnFilteringFeature = { key: 'columnFilteringFeature' }
```

### `const rowPaginationFeature`

Paging of the row model. Injected by the `pageable` shortcut.

```ts
export const rowPaginationFeature = { key: 'rowPaginationFeature' }
```

### `const columnGroupingFeature`

Row grouping with aggregation. Injected by the `groupable` shortcut.

```ts
export const columnGroupingFeature = { key: 'columnGroupingFeature' }
```

### `const rowSelectionFeature`

Row selection state (the checkbox column reads it).

```ts
export const rowSelectionFeature = { key: 'rowSelectionFeature' }
```

### `const rowExpandingFeature`

Expand / collapse, for tree rows and master-detail.

```ts
export const rowExpandingFeature = { key: 'rowExpandingFeature' }
```

### `function tableFeatures`

Declare which features a grid uses. Identity at runtime - its whole job is to
capture the exact set in the type, so `ColumnDef<typeof features, Row>` knows
what is registered and anything you did not register is tree-shaken out.

```ts
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
```

Same call signature as TanStack Table v9, so a features object written for it
transfers unchanged.

```ts
export function tableFeatures<T extends TableFeatures>(features: T): T
```

### `const sortFns`

Built-in comparators, chosen per column by its data type. `auto` compares as
text; set a column's type or supply your own comparator to override.

```ts
export const sortFns = {
  auto: (a: unknown, b: unknown) => compareAutoValues(a, b),
  number: (a: unknown, b: unknown) => compareNumericKeys(numberSortKey(a), numberSortKey(b)),
  date: (a: unknown, b: unknown) => compareNumericKeys(dateSortKey(a), dateSortKey(b)),
}
```

### `const filterFns`

Built-in match functions, named by {@link ColumnFilter}'s `fn`.
`includesString` is case-insensitive substring; `equals` is strict identity.

```ts
export const filterFns = {
  includesString: (value: unknown, query: string) =>
    String(value).toLowerCase().includes(query.toLowerCase()),
  equals: (value: unknown, query: unknown) => value === query,
}
```

### `type BaseRowCtx`

Everything a base row needs that is the same for every row in the table.

One object per table, referenced by every row, instead of one closure scope
per row. See {@link BASE_ROW_METHODS}.

```ts
export type BaseRowCtx<TData extends RowData> = {
  grid: SvGrid<TData>
  store: { state: Record<string, any> }
  columns: Array<Column<TData>>
  columnCount: number
  columnIndexById: Map<string, number>
}
```

### `const ROW_VALUES`

A base row's cached cell values. @internal

```ts
export const ROW_VALUES = Symbol('svgrid.row.values')
```

### `const ROW_CELLS`

A base row's cached cells. @internal

```ts
export const ROW_CELLS = Symbol('svgrid.row.cells')
```

### `const ROW_FILTER_POS`

The row's index in the last full filter's output (see ROW_FILTER_GEN). @internal

```ts
export const ROW_FILTER_POS = Symbol('svgrid.row.filterPos')
```

### `function denseRows`

The rows as a plain dense array. For a lazyRows() list, makes the rows not
made yet and returns its backing array - the same row objects, without the
Proxy in front. Anything that reads every row (a sort, a filter) should go
through this first: a trap per read, over several passes of a million rows,
cost more than building the rows did.

```ts
export function denseRows<T>(rows: T[]): T[]
```

### `type WindowedRowModel`

The row model for windowed data (windowed-data.ts), or null when `data` is
an ordinary array. It lives in windowed-row-model.ts and is installed by the
first createWindowedData() call, so a grid that is never handed windowed
data does not bundle it: this file imports nothing from either module.

```ts
export type WindowedRowModel<TData extends RowData> = (data: unknown, columns: Array<Column<TData>>) => RowModel<TData> | null
```

### `type WindowedRowModelInstall`

How windowed-row-model.ts builds its row model from the base row helpers. @internal

```ts
export type WindowedRowModelInstall =<TData extends RowData>(ctx: {
  rowCtxFor: (columns: Array<Column<TData>>) => BaseRowCtx<TData>
  getRowId: () => ((row: TData, index: number) => string) | undefined
}) => WindowedRowModel<TData>
```

### `function registerWindowedRowModel`

Internal: windowed-row-model.ts installs itself here.

```ts
export function registerWindowedRowModel(install: WindowedRowModelInstall): void
```

### `type BaseRowState`

A base row's private fields, on top of the public {@link Row} surface.

```ts
export type BaseRowState<TData extends RowData> = Row<TData> & {
  [ROW_CTX]: BaseRowCtx<TData>
  [ROW_VALUES]: Array<unknown> | null
  [ROW_CELLS]: Array<Cell<TData>> | null
  [ROW_FILTER_GEN]: number
  [ROW_FILTER_POS]: number
  [ROW_SORT_DROPPED]: number
  [ROW_SORT_KEY]: unknown
}
```

### `const BASE_ROW_METHODS`

The methods every base row carries, defined ONCE and assigned by reference.

Rows used to be built as object literals whose methods were closures, which
meant a 100k-row grid allocated 700k closures and a closure scope per row
before painting anything. Measured at 100k x 9: 13.8 ms and 56.5 MB to build,
against 2.0 ms and 14.5 MB for this shape - the single largest cost in
mounting a large grid.

They read their row through `this` rather than a captured variable, which is
why they can be shared. Note they are assigned as OWN properties rather than
put on a prototype: `Row` is public, several row models legitimately do
`{ ...row, depth }`, and a spread copies own properties but not a prototype.
A class here would silently strip every method off a cloned row.

```ts
export const BASE_ROW_METHODS = {
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
```

### `type RowModelFactory`

One stage of the row pipeline: takes the rows produced so far and returns the
next set. Stages compose in the order given to `_rowModels`, so filtering
before sorting sorts only what survived the filter.

```ts
export type RowModelFactory<TData extends RowData> = (args: {
  table: SvGrid<TData>
  rows: Array<Row<TData>>
}) => Array<Row<TData>>
```

### `function createCoreRowModel`

The identity stage that starts every pipeline. Always required, even when no
other stage is: it is what turns your data into rows.

```ts
export function createCoreRowModel<TData extends RowData>(): RowModelFactory<TData>
```

### `function createFilteredRowModel`

Drops rows that fail the active {@link ColumnFiltersState}. Pairs with
`columnFilteringFeature`; without it there are no filters to apply.

```ts
export function createFilteredRowModel<TData extends RowData>(): RowModelFactory<TData>
```

### `function createPaginatedRowModel`

Narrows the rows to the current page. Put it LAST: anything after it would
only ever see one page of data.

```ts
export function createPaginatedRowModel<TData extends RowData>(): RowModelFactory<TData>
```

### `function createGroupedRowModel`

Buckets rows by the active {@link GroupingState} and inserts a group row
ahead of each bucket, carrying that bucket's aggregates.

```ts
export function createGroupedRowModel<TData extends RowData>(): RowModelFactory<TData>
```

### `type TreeRowModelOptions`

How to read a hierarchy out of FLAT rows: each row names its parent, and the
grid reconstructs the tree. Rows whose parent id matches nothing become roots
rather than disappearing.

For nested source data (`children: [...]`), flatten it first with
{@link flattenTreeData}.

```ts
export type TreeRowModelOptions = {
  /** Field holding each row's parent id. Rows with no parent are roots. */
  parentField: string
  /** Field holding the row's own id. Defaults to `'id'`. */
  idField?: string
}
```

### `function createTreeRowModel`

Client-side tree data: nest the grid's own flat rows into a parent/child
hierarchy that `createExpandedRowModel` then walks.

This works on the rows the grid already built rather than on raw data, so
tree rows keep their cells, editing, selection and formatting - they are real
data rows that happen to have children, not synthetic banners like grouping's.
That is also why the model is parent-id based: nested source arrays never
become rows (the grid only builds rows for `data`), so nested input is
flattened first with {@link flattenTreeData}. One code path, no duplicated
row construction.

Rows are tagged `__treeRow` so `isGroupRow` does not mistake an expandable
data row for a full-width group banner.

```ts
export function createTreeRowModel<TData extends RowData>(
  options: TreeRowModelOptions,
): RowModelFactory<TData>
```

### `type FlattenTreeOptions`

How to flatten NESTED source data into the parent-id shape tree rows need.
`parentField` is written onto each row, so point `treeData.parentField` at
the same name afterwards.

```ts
export type FlattenTreeOptions = {
  /** Field holding an array of child objects. */
  childrenField: string
  /** Field holding each object's id. Defaults to `'id'`. */
  idField?: string
  /** Field to WRITE the resolved parent id onto. Defaults to `'__parentId'`. */
  parentField?: string
}
```

### `function flattenTreeData`

Flatten nested tree data into the flat parent-id shape `createTreeRowModel`
consumes, stamping each child with its parent's id.

Children are emitted directly after their parent so the natural order already
matches the rendered tree. The `childrenField` array is left on the objects
(harmless, and callers often still want it); only the parent link is added.

```ts
export function flattenTreeData<T extends RowData>(
  data: ReadonlyArray<T>,
  options: FlattenTreeOptions,
): T[]
```

### `function createExpandedRowModel`

Hides the descendants of collapsed rows. Needed for grouping, tree data and
master-detail alike - all three are the same expand/collapse mechanism.

```ts
export function createExpandedRowModel<TData extends RowData>(): RowModelFactory<TData>
```

### `function replacedRowsOf`

The rows `getRowModel` replaced in the rebuild this pipeline run follows, or null.

```ts
export function replacedRowsOf(table: SvGrid<any>): ReadonlyMap<Row<any>, Row<any>> | null
```

### `function createSortedRowModel`

The sorting stage of the row pipeline: orders the rows by the grid's
`sorting` state with the built-in comparators (or the `localSortFns` map
handed in), stable, equal keys keeping their data order. A tick that
replaces a few rows out of many is repaired incrementally rather than
re-sorted (see the note inside). Registered by `rowSortingFeature`; an app
only calls this to install its own comparator set.

```ts
export function createSortedRowModel<TData extends RowData>(
  localSortFns: typeof sortFns = sortFns,
): RowModelFactory<TData>
```

### `type SvGridOptions`

Everything {@link createSvGridCore} accepts: the data and columns, the
features and row models that make up the pipeline, and an `on*Change`
callback per piece of state for controlled use.

`<SvGrid>` builds this for you from its props - you only construct it
directly when driving the headless core.

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

The headless grid instance: the state stores plus the read methods a renderer
needs (`getHeaderGroups()`, `getRowModel()`, the `set*` writers).

Framework free by design - `<SvGrid>` is one renderer over this, and you can
write another. See the "Why headless?" guide.

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

Build a headless grid: state, the row pipeline, and the read methods, with no
DOM and no Svelte. This is the engine `<SvGrid>` renders.

Most callers want `createSvGrid` (the runes-aware wrapper) or the component
itself; reach for this when you are writing your own renderer or running the
pipeline outside a browser.

```ts
export function createSvGridCore<TFeatures extends TableFeatures, TData extends RowData>(
  options: SvGridOptions<TFeatures, TData>,
): SvGrid<TData>
```

### `function isFunction`

Narrowing helper for the many options that accept a value or a function.

```ts
export function isFunction(value: unknown): value is (...args: Array<any>) => any
```
