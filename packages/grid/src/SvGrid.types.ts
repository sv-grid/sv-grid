// Type definitions extracted from SvGrid.svelte. These are compile-time
// only - moving them out keeps the component's <script> focused on logic.
import type { Snippet } from "svelte";
import type {
  CellEditorType,
  ColumnDef,
  RowData,
  SvGridApi,
  TableFeatures,
} from "./index";
import type { ConditionalFormat } from "./conditional-formatting";

/** The cell a context menu was opened on. Passed to every item's callbacks. */
export type ContextMenuTarget<TData extends RowData = RowData> = {
  rowIndex: number;
  colIndex: number;
  columnId: string;
  /** Stable row id (from getRowId / row model), for keying notes etc. */
  rowId: string;
  row: TData | null;
};

/**
 * A context-menu entry. Either a built-in action key, the `"separator"`
 * divider, or a custom item. Built-in keys: `"copy" | "cut" | "paste" |
 * "clear" | "row_above" | "row_below" | "remove_row" | "remove_col"`.
 */
export type ContextMenuItem<TData extends RowData = RowData> =
  | string
  | {
      key: string;
      label: string;
      /** Hide the item entirely for this target. */
      hidden?: (target: ContextMenuTarget<TData>) => boolean;
      /** Render the item greyed-out and non-clickable for this target. */
      disabled?: (target: ContextMenuTarget<TData>) => boolean;
      /** Invoked on click. The menu closes afterwards. */
      action: (target: ContextMenuTarget<TData>) => void;
    };

export type Props<TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData> = {
  data: ReadonlyArray<TData>;
  columns: Array<ColumnDef<TFeatures, TData>>;
  /**
   * Right-click context menu. `true` shows the default item set (copy, cut,
   * paste, clear, insert row above/below, remove row, remove column). Pass an
   * array to customize: strings are built-in keys, `"separator"` is a divider,
   * and objects are custom items. Omitted/`false` disables the menu (native
   * browser menu shows instead).
   */
  contextMenu?: boolean | ReadonlyArray<ContextMenuItem<TData>>;
  /**
   * The feature set built with `tableFeatures({ ... })`. Optional - the
   * `sortable` / `filterable` / `groupable` shortcuts below inject the
   * matching feature for you, so a grid can be configured entirely from
   * the boolean shortcuts without importing the feature constants.
   */
  features?: TFeatures;
  /**
   * Convenience shortcuts to switch a whole capability on without wiring
   * `features` or the finer-grained props by hand. Every capability is OFF
   * by default - a bare grid is a plain read-only table - so set the
   * shortcut `true` to opt in. (`false` / omitted both leave it off; the
   * shortcut is mainly there to turn things ON.)
   *
   *   `sortable`   - column sorting       (injects `rowSortingFeature`)
   *   `filterable` - column filtering     (injects `columnFilteringFeature`)
   *   `editable`   - inline cell editing  (alias of `enableInlineEditing`)
   *   `groupable`  - row grouping controls(alias of `showGroupingControls`,
   *                  also injects `columnGroupingFeature`)
   *   `pageable`   - pagination footer    (alias of `showPagination`)
   *
   * Fine-grained props (`enableInlineEditing`, `showPagination`, ...) still
   * work; the shortcut wins only when it is explicitly set.
   */
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  groupable?: boolean;
  pageable?: boolean;
  loading?: boolean;
  /**
   * Render `loading` as a non-blocking overlay instead of replacing the
   * whole grid: the current rows stay visible (dimmed, with a top progress
   * bar) during a refetch, and the first load shows shimmer skeleton rows.
   * Ideal for server-paged grids so paging/sorting doesn't flash. Defaults
   * to `false` (the classic full "Loading..." replacement).
   */
  loadingOverlay?: boolean;
  /** Skeleton placeholder rows to show on first load. Defaults to 8. */
  loadingSkeletonRows?: number;
  error?: string | null;
  emptyMessage?: string;
  showGlobalFilter?: boolean;
  showColumnFilters?: boolean;
  /**
   * Quick way to pick a single filtering UI. When set it controls which of
   * the three filter surfaces appears (and is overridden per-surface by the
   * `showGlobalFilter` / `showColumnFilters` / `showFilterRow` props).
   * Defaults to `'menu'` (only the column menu's filter section is shown).
   */
  filterMode?: "row" | "menu" | "global" | "none";
  showGroupingControls?: boolean;
  showRowSelection?: boolean;
  showPagination?: boolean;
  /** Initial page size when pagination is enabled. Defaults to 10. */
  pageSize?: number;
  /** Page-size choices shown in the footer's selector. Defaults to `[10, 25, 50, 100]`. */
  pageSizeOptions?: number[];
  /**
   * Where the pagination footer sits: `'bottom'` (default), `'top'`, or `'both'`.
   * The status bar (when enabled) always stays at the bottom.
   */
  paginationPosition?: 'top' | 'bottom' | 'both';
  /**
   * Server-side pagination. When `true`, the grid renders its native
   * pagination footer from the `rowCount` / `pageIndex` you provide (rather
   * than counting the local rows), does NOT slice `data` (the rows you pass are
   * treated as the current page), and emits `onPaginationChange` when the user
   * pages or changes page size. Pair with `externalSort` / `externalFilter`
   * and a server data source. Requires `showPagination` / `pageable` to show
   * the footer. Controlled: you own `pageIndex` + `pageSize` + `rowCount`.
   */
  externalPagination?: boolean;
  /** Total rows on the server, for the footer's range + page count. Used with `externalPagination`. */
  rowCount?: number;
  /** Current 0-based page index. Used with `externalPagination` (controlled). */
  pageIndex?: number;
  /**
   * Fires when the user changes page or page size while `externalPagination`
   * is on. Fetch that page and update `data` / `rowCount` / `pageIndex`.
   */
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
  virtualization?: boolean;
  /** Row height in pixels. Pass a function `(rowIndex) => px` for
   *  per-row variable heights (e.g. an interactive row-resize feature).
   *  Defaults to 30. */
  rowHeight?: number | ((rowIndex: number) => number);
  /**
   * Height (px) of a single column-header level row. With multi-level
   * (grouped) headers the total header height is `levels * headerHeight`,
   * since each level renders as its own row. When omitted, header rows size
   * to their content (the default). Does not affect the filter row.
   */
  headerHeight?: number;
  overscan?: number;
  /**
   * Height of the grid's scrollable shell. A number is treated as pixels;
   * a string is used as-is, so callers can pass `'100%'` or `'auto'` to
   * make the grid fill its parent. Defaults to 520 px.
   */
  containerHeight?: number | string;
  columnVirtualization?: boolean;
  columnOverscan?: number;
  columnWidth?: number;
  /**
   * Columns pinned to the left/right edge on mount. Each entry is a
   * column id (matches `ColumnDef.field` when no explicit id is set).
   * The internal pinning state is seeded once at mount; user-driven
   * pinning via the column menu still works and overrides this default.
   * Requires `columnVirtualization={false}` to be visible in the menu
   * UI (sticky positioning can't co-exist with column virtualization
   * since the virtualizer recycles DOM nodes).
   */
  initialColumnPinning?: {
    left?: ReadonlyArray<string>;
    right?: ReadonlyArray<string>;
  };
  /**
   * When `true`, columns are scaled proportionally so their total width
   * fills the viewport (no empty space on the right). Disabled by
   * default - explicit `width` values are used as-is. User resizes still
   * win once they happen.
   */
  fitColumns?: boolean;
  showFilterMenu?: boolean;
  showFilterRow?: boolean;
  enableCellSelection?: boolean;
  /**
   * Highlight the row under the pointer. Default **false** - the hover tint can
   * compete with the cell selection / fill marquee. Set `true` to opt in; when
   * on, the hover no longer paints over selected cells so the selection stays
   * visible.
   */
  enableRowHover?: boolean;
  /**
   * Prepend a header row (the column labels) to copied cell ranges, so pasting
   * into Excel / Sheets includes the headers. Applies per copied range.
   */
  copyHeadersToClipboard?: boolean;
  /**
   * Transform each cell value on its way to the clipboard - e.g. strip
   * currency symbols, expand codes to labels, or redact. Receives the display
   * value plus the row/column context; return the string (or value) to copy.
   */
  processCellForClipboard?: (params: {
    value: unknown;
    column: unknown;
    row: TData;
    rowIndex: number;
    columnId: string;
  }) => unknown;
  enableInlineEditing?: boolean;
  /**
   * Full-row editing. When `true`, starting an edit puts the WHOLE row into
   * edit mode - every editable cell shows an inline editor at once - and a
   * single Enter (or focus leaving the row) commits all of them; Esc cancels
   * the whole row. Requires `enableInlineEditing`. The full-row editor covers
   * text / number / date / datetime / checkbox / list-select editor types.
   */
  fullRowEditing?: boolean;
  enableRowSummaries?: boolean;
  /**
   * Excel-style status bar under the grid showing live aggregates of the
   * selected cell range (count, numeric count, sum, average, min, max).
   * `true` shows the default set; pass `{ aggregates: [...] }` to choose
   * which. Requires `enableCellSelection`.
   */
  statusBar?:
    | boolean
    | {
        aggregates?: ReadonlyArray<
          "count" | "numericCount" | "sum" | "avg" | "min" | "max"
        >;
      };
  /**
   * Show the docked tool panel - the enterprise sidebar with Columns and
   * Filters tabs. A "Columns & Filters" button appears in a toolbar above the
   * grid; the panel docks on the right edge.
   */
  toolPanel?: boolean;
  /**
   * Render the header column menu (⋮) as a tabbed popover - **General**,
   * **Filter**, and **Columns** tabs (the AG-Grid layout). Defaults to `false`,
   * which keeps the flat menu (actions list + "Choose columns" submenu).
   */
  columnMenuTabs?: boolean;
  /** Open the tool panel on first render (instead of collapsed). */
  toolPanelDefaultOpen?: boolean;
  /** Which tab the tool panel starts on. Defaults to `'columns'`. */
  toolPanelDefaultTab?: "columns" | "filters";
  /**
   * Quick way to pick which selection surfaces are active. `'row'` shows the
   * selection checkbox column only, `'cell'` allows rectangle/range cell
   * selection only, `'both'` (default) enables both, `'none'` disables both.
   * Overridden per-surface by `showRowSelection` / `enableCellSelection`.
   */
  selectionMode?: "row" | "cell" | "both" | "none";
  /**
   * Render a leading row-number column (1-based) before any selection
   * column. Useful as a permanent anchor when scrolling wide grids.
   */
  showRowNumbers?: boolean;
  /**
   * Paint alternating data rows with the `--sg-row-alt-bg` color (zebra
   * striping). Only data rows stripe - pinned, group, detail, and summary
   * rows keep their single background. Defaults to `false`.
   */
  zebraRows?: boolean;
  /**
   * Width (px) of the row-number column. Defaults to 56, which fits up
   * to "99,999"; bump this when the dataset crosses six digits so the
   * largest row number stays fully visible at the bottom of a scroll.
   */
  rowNumberWidth?: number;
  /** Receives the imperative grid API once the component has mounted. */
  onApiReady?: (api: SvGridApi<TFeatures, TData>) => void;
  /**
   * Fires whenever the row-selection state changes. The first argument
   * is the new selection record `{ [rowId]: true }`; the second is the
   * array of selected `TData` rows.
   */
  onRowSelectionChange?: (
    selection: Record<string, boolean>,
    rows: TData[],
  ) => void;
  /**
   * Fires whenever the cell-selection rectangle changes (mouse, keyboard,
   * or `api.selectCells()`). `ranges` matches `api.getSelected()` -
   * `[rowStart, colStart, rowEnd, colEnd]` rectangles in grid coords.
   * Empty array when the user clears the selection.
   */
  onCellSelectionChange?: (
    ranges: Array<[number, number, number, number]>,
  ) => void;
  /**
   * When `true`, the grid records sort state (and renders sort indicators
   * + cycling on headers) but does NOT actually re-order the rows. The
   * consumer is expected to sort `data` themselves - typically via
   * `onSortingChange`. Use this for tree/hierarchical data, where a flat
   * global sort would break parent-child adjacency. Defaults to `false`.
   */
  externalSort?: boolean;
  /**
   * Fires whenever the sort clauses change. Receives the new array of
   * `{ id, desc }` entries. Pair with `externalSort={true}` when the
   * consumer wants to own the row ordering.
   */
  onSortingChange?: (sorting: Array<{ id: string; desc: boolean }>) => void;
  /**
   * When `true`, the grid still records column-filter / global-filter /
   * facet state (so the menu UI works and indicators light up) but does
   * NOT actually filter the rows. The consumer is expected to fetch / sort
   * / filter the data themselves - typically via `onFiltersChange`. Used
   * by server-side data sources. Defaults to `false`.
   */
  externalFilter?: boolean;
  /**
   * Fires whenever any of the in-grid filter state changes - global
   * search, per-column operator filters, or facet (value-checklist)
   * filters. Pair with `externalFilter={true}` when the consumer wants to
   * push the query to the server.
   */
  onFiltersChange?: (filters: {
    global: string;
    columns: Array<{
      id: string;
      operator: FilterOperator;
      value: string;
      /**
       * Upper bound for the `between` operator. Only set when
       * `operator === 'between'` AND the user has typed both values.
       */
      valueTo?: string;
      selectedValues?: Array<string>;
    }>;
  }) => void;
  /**
   * Fires when an inline edit is committed (Enter / Tab / blur). Useful
   * for cascade-recompute pipelines: a parent listens, then refreshes
   * derived columns or aggregates. The wrapper has already written the
   * parsed value back into the row by the time this fires.
   */
  /**
   * Resolve a stable id per row. Drives selection, expansion, edit,
   * and active-cell state. When omitted, the row's array index is
   * used - fine for read-only views but the wrong choice if `data`
   * gets reordered or filtered outside the grid (selection would
   * follow positions, not actual rows). Use a database PK, a UUID,
   * or any stable string.
   */
  getRowId?: (row: TData, index: number) => string;
  /**
   * Conditional class(es) added to every `<tr>` body row. Receives
   * the row's `original` data + its data-array index. Return a
   * string, an array of strings, or an object mapping class names to
   * booleans. Useful for "highlight overdue rows", "tint cancelled
   * orders", and similar row-level state mappings.
   */
  rowClass?: (ctx: {
    row: TData;
    rowIndex: number;
  }) => string | ReadonlyArray<string> | Record<string, boolean> | undefined | null;
  /**
   * Per-cell notes - longer free-form comments shown as a corner
   * indicator + tooltip on hover. Keyed by row id then column id;
   * empty / missing entries mean "no note". The grid owns rendering;
   * you own storage (write your own callbacks to add / edit notes).
   */
  notes?: Record<string, Record<string, string>>;
  /**
   * Allow editing per-cell notes/comments through the UI: the context menu
   * gains an "Edit comment" item that opens a popover editor. Edits are
   * applied to an internal overlay for immediate feedback and emitted via
   * `onNoteChange` so you can persist them back into `notes`.
   */
  editableComments?: boolean;
  /** Fires when a comment is saved or removed (removed = empty `note`). */
  onNoteChange?: (event: { rowId: string; columnId: string; note: string }) => void;
  /**
   * Excel-style conditional formatting. A list of value-driven rules that
   * color cells: `colorScale` (gradient across the column range),
   * `dataBar` (in-cell proportional bar), `iconSet` (arrows / traffic /
   * triangles by threshold), and `rule` (apply a style when a predicate
   * matches). Scope a format to specific columns with `columns: [...]`,
   * or omit it to apply to every column. Later entries win on conflict.
   */
  conditionalFormats?: ReadonlyArray<ConditionalFormat<TData>>;
  onCellValueChange?: (event: {
    rowIndex: number;
    columnId: string;
    oldValue: unknown;
    newValue: unknown;
    row: TData;
  }) => void;
  /**
   * Fires whenever the active cell changes - click, keyboard move,
   * tab, page-up/down, etc. Consumers (toolbars, ribbon UIs) use this
   * to stay synced with the grid's selection without polling the DOM.
   */
  onActiveCellChange?: (cell: {
    rowIndex: number;
    colIndex: number;
    columnId: string;
  }) => void;
  /**
   * Fires when a data cell (and therefore a row) is single-clicked.
   * Group-header rows are excluded. `value` is the displayed cell value.
   */
  onCellClick?: (event: {
    rowIndex: number;
    colIndex: number;
    columnId: string;
    value: unknown;
    row: TData;
  }) => void;
  /** Fires when a data row is single-clicked (any cell). Group rows excluded. */
  onRowClick?: (event: {
    rowIndex: number;
    columnId: string;
    row: TData;
  }) => void;
  /**
   * Fires when a data cell is double-clicked - independent of whether the
   * cell is editable, so it fires even on read-only grids. Group rows excluded.
   */
  onCellDoubleClick?: (event: {
    rowIndex: number;
    colIndex: number;
    columnId: string;
    value: unknown;
    row: TData;
  }) => void;
  /** Fires when a data row is double-clicked (any cell). Group rows excluded. */
  onRowDoubleClick?: (event: {
    rowIndex: number;
    columnId: string;
    row: TData;
  }) => void;
  /**
   * Fires once each time the body is scrolled to (within ~32px of) the
   * bottom. Re-arms after the user scrolls back up. The canonical hook for
   * infinite / lazy loading - append more rows to `data` when it fires.
   */
  onScrollBottomReached?: (event: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) => void;
  /**
   * Marks a row as an expandable "detail row". When this returns true the
   * grid renders that row as a SINGLE full-width cell (colspan across every
   * column) using `renderDetailRow`, instead of the normal per-column cells
   * - the canonical Stripe / GitHub "expand a rich panel beneath the row"
   * pattern. Insert the detail rows into `data` yourself (typically right
   * after the row they belong to) and toggle them with your own expanded
   * state. Pair with `virtualization={false}` so the variable-height detail
   * isn't clipped by the fixed-row-height virtualizer.
   */
  isDetailRow?: (row: TData, rowIndex: number) => boolean;
  /**
   * Snippet rendered inside the full-width detail cell for rows where
   * `isDetailRow` is true. Receives the row's data and its index.
   */
  renderDetailRow?: Snippet<[{ row: TData; rowIndex: number }]>;
  /**
   * Rows to pin to the TOP of the grid - rendered above the regular
   * rows and sticky-positioned so they stay visible while the user
   * scrolls. Typical use: a "totals" or "headline" row that should
   * always be in view. Rows are read-only (no inline editing, no
   * row-selection checkbox). They share the column schema with the
   * main grid; field/format/cell/cellClass all apply.
   */
  pinnedTopRows?: ReadonlyArray<TData>;
  /**
   * Rows to pin to the BOTTOM of the grid - rendered below the regular
   * rows and sticky-positioned (sticks to the bottom of the viewport
   * while the user scrolls). Typical use: a "page totals" or "grand
   * total" row computed from `getDisplayedRows()`.
   */
  pinnedBottomRows?: ReadonlyArray<TData>;
  /**
   * Enables drag-to-reorder on the grid's column headers. When `true`,
   * every header gets `draggable=true` and a drop indicator paints
   * between headers during a drag. On drop the grid mutates its
   * internal column order and fires `onColumnOrderChange` with the
   * new order. Defaults to `false`.
   */
  enableColumnReorder?: boolean;
  /**
   * Initial column order, by `id` (falls back to `field`). When the
   * user reorders columns, this is the starting state. After mount,
   * the grid owns the order internally and emits `onColumnOrderChange`
   * on every change - persist that to `localStorage` to restore.
   */
  columnOrder?: ReadonlyArray<string>;
  /** Fires every time the column order changes (drag or `api.setColumnOrder`). */
  onColumnOrderChange?: (order: ReadonlyArray<string>) => void;
  /**
   * Infer each column's data type (number / boolean / date / ISO date-string /
   * text) from the first data row, for columns that declare neither an
   * explicit `editorType` nor a `cellDataType`. Sets the matching editor,
   * alignment, date format, and filter operators automatically. Explicit
   * column config always wins. Defaults to `false`.
   */
  inferColumnTypes?: boolean;
  /**
   * Enables managed row dragging. When `true`, every row becomes a drag
   * source (grab cursor + a grip in the row-number cell) and a drop
   * indicator paints between rows during a drag. On drop the grid mutates
   * its own internal data - reordering within the grid, or moving the row
   * across grids that share the same {@link rowDragGroup}. Defaults to
   * `false`.
   */
  rowDragManaged?: boolean;
  /**
   * Connection group for cross-grid row dragging. Grids that share the same
   * non-empty `rowDragGroup` string (and have `rowDragManaged` on) can
   * exchange rows: dragging a row out of one and dropping it into another
   * removes it from the source and inserts it into the target. Omit to keep
   * dragging confined to reordering within a single grid.
   */
  rowDragGroup?: string;
  /**
   * Fires on the TARGET grid after a managed row drag settles, with the
   * moved row, its landing index, whether it stayed in the same grid, and
   * the source / target grid ids. Use it to mirror the move into your own
   * state (persistence, server sync). The grid has already applied the
   * change to its internal data by the time this fires.
   */
  onRowDragEnd?: (event: {
    row: TData;
    toIndex: number;
    sameGrid: boolean;
    fromGridId: number;
    toGridId: number;
  }) => void;
  /**
   * Align this grid with others that share the same non-empty
   * `alignedGridGroup` string: horizontal scroll and column-resize widths are
   * kept in lockstep across every grid in the group. Use for a totals/header
   * grid above a body grid, or side-by-side comparison grids that must line up.
   * The grids should declare the same columns (matched by id) for widths to map.
   */
  alignedGridGroup?: string;
  /**
   * BCP-47 locale tag (or array of fallbacks) used for accent- and
   * case-insensitive text filtering / sorting / search. Powered by
   * `Intl.Collator` with `sensitivity: 'base'`, so "cafe", "Café"
   * and "CAFÉ" all match "cafe" without strain. Defaults to the
   * browser's locale.
   */
  filterLocale?: string | ReadonlyArray<string>;
};

export type SelectionPoint = { rowIndex: number; colIndex: number };
export type SelectionRange = {
  anchor: SelectionPoint | null;
  focus: SelectionPoint | null;
};
export type CellEditState = {
  rowId: string;
  columnId: string;
  editorType: CellEditorType;
  value: unknown;
} | null;
export type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "isBlank";
export type FilterOption = {
  value: FilterOperator;
  label: string;
  iconName: string;
};
export type MenuPosition = { x: number; y: number };
