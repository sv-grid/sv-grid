<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  import {
    applyExcelFilter,
    normalizeForFilter,
    createColumnVirtualizer,
    createCoreRowModel,
    createExpandedRowModel,
    createFilteredRowModel,
    createGroupedRowModel,
    createPaginatedRowModel,
    createSvelteVirtualizer,
    createSortedRowModel,
    createSvGrid,
    filterFns,
    getGridCellA11yProps,
    getGridCellDomId,
    getGridHeaderA11yProps,
    getGridRootA11yProps,
    getGridRowA11yProps,
    parseEditorValue,
    normalizeEditorOptions,
    sortFns,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type CellContext,
    type EditorContext,
    type CellEditorOption,
    type CellEditorType,
    type CellFormatter,
    type CellFormatConfig,
    type Column,
    type ColumnDef,
    type Row,
    type RowData,
    type SvGridApi,
    type TableFeatures,
  } from "./index";
  import "./sv-grid-scrollbar";
  import type { Snippet } from "svelte";
  import { getKeyboardIntent, getNextActiveCell } from "./keyboard";
  import {
    formatNumericWithConfig,
    getDateFormatter,
    resolveDatePattern,
  } from "./cell-formatting";
  import {
    RenderSnippetConfig,
    RenderComponentConfig,
  } from "./render-component";
  import { buildFillPattern } from "./fill-patterns";
  import { buildSparkline, toSparklineValues } from "./sparkline";
  import {
    resolveCellFormat,
    computeColumnStat,
    formatsNeedingStats,
    type ConditionalFormat,
    type ColumnStat,
    type ResolvedCellFormat,
  } from "./conditional-formatting";
  import SvGridDropdown from "./SvGridDropdown.svelte";

  type Props = {
    data: ReadonlyArray<TData>;
    columns: Array<ColumnDef<TFeatures, TData>>;
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
    virtualization?: boolean;
    rowHeight?: number;
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
    enableInlineEditing?: boolean;
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
     * Show a docked Columns tool panel - the enterprise sidebar for toggling
     * column visibility, reordering, and grouping without a right-click. A
     * toggle button appears at the grid's top-right; the panel itself docks
     * on the right edge.
     */
    toolPanel?: boolean;
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
     * BCP-47 locale tag (or array of fallbacks) used for accent- and
     * case-insensitive text filtering / sorting / search. Powered by
     * `Intl.Collator` with `sensitivity: 'base'`, so "cafe", "Café"
     * and "CAFÉ" all match "cafe" without strain. Defaults to the
     * browser's locale.
     */
    filterLocale?: string | ReadonlyArray<string>;
  };

  type SelectionPoint = { rowIndex: number; colIndex: number };
  type SelectionRange = {
    anchor: SelectionPoint | null;
    focus: SelectionPoint | null;
  };
  type CellEditState = {
    rowId: string;
    columnId: string;
    editorType: CellEditorType;
    value: unknown;
  } | null;
  type FilterOperator =
    | "contains"
    | "equals"
    | "startsWith"
    | "greaterThan"
    | "lessThan"
    | "between"
    | "isBlank";
  type FilterOption = {
    value: FilterOperator;
    label: string;
    iconName: string;
  };
  type MenuPosition = { x: number; y: number };

  let props: Props = $props();

  // Resolved capability gates. Capabilities are OFF by default - a bare
  // grid is a plain read-only table, and each power feature is opted into
  // via its shortcut (`editable` / `pageable` / `groupable`) or the matching
  // fine-grained prop (`enableInlineEditing` / `showPagination` /
  // `showGroupingControls`). The shortcut wins when set; otherwise the
  // fine-grained prop wins; otherwise the capability is off. (Sorting and
  // filtering follow the same opt-in model already - they require their
  // feature, injected by `sortable` / `filterable`.)
  const editingEnabled = $derived(
    props.editable ?? props.enableInlineEditing ?? false,
  );
  const paginationEnabled = $derived(
    props.pageable ?? props.showPagination ?? false,
  );
  const groupingControlsEnabled = $derived(
    props.groupable ?? props.showGroupingControls ?? false,
  );

  let globalFilter = $state("");
  let scrollContainer: HTMLDivElement | null = $state(null);
  let gridRootEl: HTMLElement | null = $state(null);
  let filterRowValues = $state<Record<string, string>>({});
  let filterMenuValues = $state<
    Record<string, { operator: FilterOperator; value: string; valueTo?: string }>
  >({});
  let verticalScrollbarEl: HTMLElement | null = $state(null);
  let horizontalScrollbarEl: HTMLElement | null = $state(null);
  let scrollVersion = $state(0);
  /**
   * Separate state from `scrollVersion`: only bumped by the ResizeObserver
   * when the shell's CSS size changes. The virtualizer effects below depend
   * on this instead of `scrollVersion` so they DON'T re-run on every scroll
   * event - `scrollVersion` fires constantly during a drag.
   */
  let viewportVersion = $state(0);
  let lastResetSignature = "";
  let pendingScrollTop = 0;
  let pendingScrollLeft = 0;
  let scrollSyncRaf: number | null = null;
  let selectionRange = $state<SelectionRange>({ anchor: null, focus: null });
  let isDraggingSelection = $state(false);
  /** Excel-style fill handle drag state. While non-null we paint a "fill
   *  preview" overlay on cells between the source range and the pointer
   *  cell; on pointerup we extrapolate the source pattern into them. */
  let fillDrag = $state<{
    sourceMinRow: number;
    sourceMaxRow: number;
    sourceMinCol: number;
    sourceMaxCol: number;
    targetRow: number;
    targetCol: number;
  } | null>(null);
  let activeAtPointerDown: { rowIndex: number; colIndex: number } | null = null;
  let editingCell = $state<CellEditState>(null);
  let editedCellValues = $state<Record<string, unknown>>({});

  // ---- Undo / redo (history + pointer model) ---------------------------
  // VSCode-style: one ordered history array, plus a pointer to the index
  // of the NEXT undo step. Avoids the dual-stack edge cases where
  // multiple undo-redo cycles can lose entries.
  type HistoryStep = {
    rowId: string
    columnId: string
    field: string
    before: unknown
    after: unknown
  }
  const UNDO_LIMIT = 200
  let history    = $state<HistoryStep[]>([])
  /** Index in `history` of the LAST applied step. -1 means "nothing applied".
   *  undo() decrements; redo() increments. New edits truncate everything
   *  past the pointer (the classic "you can't redo after editing" rule). */
  let historyPtr = $state(-1)
  /** Bumps on every undo / redo / record so $derived consumers can
   *  observe via the api without subscribing to history directly. */
  let historyVersion = $state(0)

  // ---- Hover tooltip (custom popover, not native title=) ---------------
  // Triggered by per-column `tooltip` field OR per-cell `notes` prop.
  // Renders below / above the cell with smart edge clamping; opens on
  // pointerenter after a brief delay so it doesn't flash during scroll.
  type TooltipState = { text: string; x: number; y: number; below: boolean }
  let tooltip = $state<TooltipState | null>(null)
  let tooltipTimer: number | null = null
  function showTooltipFor(el: HTMLElement, text: string) {
    if (!text) return
    if (tooltipTimer) window.clearTimeout(tooltipTimer)
    tooltipTimer = window.setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const vw   = window.innerWidth
      const vh   = window.innerHeight
      const below = rect.bottom + 64 < vh
      // Clamp x so the 280px-wide tooltip doesn't fall off the viewport.
      const x = Math.min(Math.max(rect.left + 6, 10), vw - 290)
      const y = below ? rect.bottom + 6 : rect.top - 6
      tooltip = { text, x, y, below }
    }, 250)
  }
  function hideTooltip() {
    if (tooltipTimer) { window.clearTimeout(tooltipTimer); tooltipTimer = null }
    tooltip = null
  }

  // ---- Find-in-grid ----------------------------------------------------
  let findOpen  = $state(false)
  let findQuery = $state('')
  let findHitIndex = $state(0)
  type FindHit = { rowIndex: number; colIndex: number; columnId: string }
  const findHits = $derived.by<FindHit[]>(() => {
    const q = findQuery.trim().toLowerCase()
    if (!q || !findOpen) return []
    const out: FindHit[] = []
    for (let r = 0; r < allRows.length; r += 1) {
      const row = allRows[r]
      if (!row) continue
      for (let c = 0; c < allColumns.length; c += 1) {
        const col = allColumns[c]
        if (!col) continue
        const v = row.getCellValueByColumnId(col.id)
        if (v == null) continue
        const s = String(v).toLowerCase()
        if (s.includes(q)) out.push({ rowIndex: r, colIndex: c, columnId: col.id })
      }
    }
    return out
  })
  let theadEl: HTMLElement | null = $state(null);
  let headerHeight = $state(0);
  /** When an edit starts: true selects all text, false places the caret at the end. */
  let editorSelectAll = true;
  /** Per-column width overrides set by the resize handles. */
  let columnWidths = $state<Record<string, number>>({});
  let resizingColumnId = $state<string | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  const MIN_COLUMN_WIDTH = 40;
  /** Columns pinned to the left or right edge of the grid (sticky positioning).
   *  Seeded from `props.initialColumnPinning` so demos / tests can show the
   *  feature on first render without driving the column menu in JS. */
  let columnPinning = $state<{ left: Array<string>; right: Array<string> }>({
    left: [...(props.initialColumnPinning?.left ?? [])],
    right: [...(props.initialColumnPinning?.right ?? [])],
  });
  let columnVirtualizerVersion = $state(0);
  let gridStateVersion = $state(0);
  const selectionColumnWidth = 44;
  const rowNumberColumnWidth = $derived(props.rowNumberWidth ?? 56);
  const showRowNumbersEffective = $derived(props.showRowNumbers ?? false);
  const filterOperatorOptions: Array<FilterOption> = [
    { value: "contains", label: "Contains", iconName: "op-contains" },
    { value: "equals", label: "Equals", iconName: "op-equals" },
    { value: "startsWith", label: "Starts with", iconName: "op-startsWith" },
    { value: "greaterThan", label: "Greater than", iconName: "op-greaterThan" },
    { value: "lessThan", label: "Less than", iconName: "op-lessThan" },
    { value: "between", label: "Between", iconName: "op-between" },
    { value: "isBlank", label: "Is blank", iconName: "op-isBlank" },
  ];
  /** Which operators make sense for each column editor type. */
  const TEXT_OPERATORS: Array<FilterOperator> = [
    "contains",
    "equals",
    "startsWith",
    "isBlank",
  ];
  const NUMBER_OPERATORS: Array<FilterOperator> = [
    "equals",
    "greaterThan",
    "lessThan",
    "between",
    "isBlank",
  ];
  const DATE_OPERATORS: Array<FilterOperator> = [
    "equals",
    "lessThan",
    "greaterThan",
    "between",
    "isBlank",
  ];
  const CHECKBOX_OPERATORS: Array<FilterOperator> = ["equals", "isBlank"];
  let columnMenuFor = $state<string | null>(null);
  let columnMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let columnMenuSearch = $state("");
  let filterMenuFor = $state<string | null>(null);
  let filterMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let operatorMenuFor = $state<string | null>(null);
  let operatorMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let chooseColumnsPos = $state<MenuPosition | null>(null);
  let valueFilters = $state<Record<string, Set<string>>>({});
  const viewportWidth = $derived.by(() => {
    viewportVersion;
    return scrollContainer ? scrollContainer.clientWidth : 0;
  });
  const viewportHeight = $derived.by(() => {
    viewportVersion;
    return scrollContainer ? scrollContainer.clientHeight : 0;
  });
  const scrollMetrics = $derived.by(() => {
    scrollVersion;
    viewportVersion;
    // Track the virtualizers' versions too so when data loads or row /
    // column counts change, scrollMetrics re-reads the DOM's grown
    // scrollHeight / scrollWidth. Without these deps the scrollbar
    // receives a stale `content-size` ≈ 0, its hidden-check trips, it
    // sets `pointer-events: none`, and the user can't drag it. The
    // identifiers below are declared further down - derived callbacks
    // run lazily, so by the time this fires they're in scope.
    virtualizer.version;
    columnVirtualizerVersion;
    return {
      scrollTop: scrollContainer?.scrollTop ?? 0,
      scrollLeft: scrollContainer?.scrollLeft ?? 0,
      clientHeight: scrollContainer?.clientHeight ?? 0,
      clientWidth: scrollContainer?.clientWidth ?? 0,
      scrollHeight: scrollContainer?.scrollHeight ?? 0,
      scrollWidth: scrollContainer?.scrollWidth ?? 0,
    };
  });
  /** Vertical overflow from the virtualizer's authoritative total size,
   *  NOT from `scrollMetrics.scrollHeight`. Reading DOM dimensions
   *  during a Svelte derived runs BEFORE the browser paints - the table
   *  hasn't laid out the new rows yet, so `scrollHeight` is briefly 0
   *  even after data loads. That made the overflow flag return false,
   *  hid the scrollbar, and broke dragging. */
  const hasVerticalOverflow = $derived.by(() => {
    virtualizer.version;
    return virtualizer.getTotalSize() > viewportHeight + 1;
  });

  // Effective filter-UI flags. Each show* prop wins when explicitly set;
  // otherwise the `filterMode` prop (default 'menu') picks exactly one surface.
  const showGlobalFilterEffective = $derived(
    props.showGlobalFilter ?? (props.filterMode ?? "menu") === "global",
  );
  const showFilterRowEffective = $derived(
    props.showFilterRow ?? (props.filterMode ?? "menu") === "row",
  );
  const showColumnFiltersEffective = $derived(
    props.showColumnFilters ?? (props.filterMode ?? "menu") === "menu",
  );
  // The inline "floating filter" input under each header duplicates the
  // column menu's funnel popover when both are active, so it requires an
  // explicit opt-in via the `showColumnFilters` prop.
  const showInlineColumnFilterEffective = $derived(
    props.showColumnFilters === true,
  );

  // Effective selection-surface flags. `selectionMode` defaults to 'both' so
  // existing consumers keep their current behaviour.
  const showRowSelectionEffective = $derived(
    props.showRowSelection ??
      ((props.selectionMode ?? "both") === "row" ||
        (props.selectionMode ?? "both") === "both"),
  );
  const enableCellSelectionEffective = $derived(
    props.enableCellSelection ??
      ((props.selectionMode ?? "both") === "cell" ||
        (props.selectionMode ?? "both") === "both"),
  );

  function flushScheduledScrollSync() {
    scrollSyncRaf = null;
    scrollVersion += 1;
    if (rowVirtualizationEnabled) virtualizer.setScrollOffset(pendingScrollTop);
    if (columnVirtualizationEnabled)
      columnVirtualizer.setHorizontalOffset(pendingScrollLeft);
  }

  /**
   * Sync the virtualizer to the user's scroll position once per frame.
   *
   * The browser's smooth-scroll animation fires a `scroll` event on
   * every frame of the ~250 ms ramp after each wheel notch - so a
   * single wheel notch produces ~16 calls to `onBodyScroll`. Without
   * batching, each one ran a full virtualizer recalc + Svelte re-render
   * synchronously, which (a) made the work pile up on heavy demos and
   * (b) read on screen as "the grid keeps scrolling after the wheel
   * stopped" because each scroll event ticked the rendered window one
   * row at a time over a quarter-second.
   *
   * Batching to a single rAF flush per frame means each animation
   * frame produces ONE virtualizer update at the latest known scroll
   * position. Smooth-scroll still feels smooth (the browser is still
   * animating `scrollTop`), but the grid's per-frame cost is bounded
   * and the visible rows match the current `scrollTop` exactly when
   * the wheel stops - no trailing updates.
   */
  function scheduleScrollSync(scrollTop: number, scrollLeft: number) {
    pendingScrollTop = scrollTop;
    pendingScrollLeft = scrollLeft;
    if (scrollSyncRaf !== null) return;
    scrollSyncRaf = requestAnimationFrame(flushScheduledScrollSync);
  }

  // Internal source-of-truth for data and column defs. Seeded from props and
  // re-synced whenever the parent passes a new array; the imperative API
  // mutates these so add/remove operations don't need a callback round-trip.
  // svelte-ignore state_referenced_locally
  let internalData = $state.raw<ReadonlyArray<TData>>(props.data);
  // svelte-ignore state_referenced_locally
  let internalColumns = $state.raw<Array<ColumnDef<TFeatures, TData>>>(
    props.columns,
  );
  let hiddenColumns = $state<Record<string, boolean>>({});

  $effect(() => {
    // When the consumer replaces `data` (e.g. a "Reset" button), drop any
    // accumulated cell-edit overrides - otherwise `getCellDisplayValue`
    // would keep returning the old edited values from `editedCellValues`
    // even though the underlying data has been replaced.
    internalData = props.data;
    editedCellValues = {};
  });
  $effect(() => {
    internalColumns = props.columns;
  });

  // Captured ONCE at mount: `externalSort` is a structural choice (tree vs
  // flat data) so toggling it after mount is not supported. Reading it here
  // - outside the getter below - guarantees the pass-through sort is wired
  // in before `createSvGrid` first reads `_rowModels`.
  // svelte-ignore state_referenced_locally
  const externalSortEnabled = props.externalSort === true;
  // Same one-shot capture for external filtering. Server-side mode means
  // the wrapper records filter state but does not actually filter rows.
  // svelte-ignore state_referenced_locally
  const externalFilterEnabled = props.externalFilter === true;
  const passthroughSortedRowModel = ({ rows }: { rows: Array<Row<TData>> }) =>
    rows;

  // Merge the consumer's `features` set with whatever the boolean shortcuts
  // imply. A shortcut set to `true` injects its feature; set to `false` it
  // removes it (so `sortable={false}` wins even if `rowSortingFeature` was
  // passed in `features`); left undefined it defers to `features`.
  function resolveEffectiveFeatures(): TableFeatures {
    const merged: Record<string, unknown> = { ...(props.features ?? {}) };
    if (props.sortable === true) merged.rowSortingFeature = rowSortingFeature;
    else if (props.sortable === false) delete merged.rowSortingFeature;
    if (props.filterable === true)
      merged.columnFilteringFeature = columnFilteringFeature;
    else if (props.filterable === false) delete merged.columnFilteringFeature;
    if (props.groupable === true)
      merged.columnGroupingFeature = columnGroupingFeature;
    else if (props.groupable === false) delete merged.columnGroupingFeature;
    return tableFeatures(merged);
  }

  const grid = createSvGrid({
    get _features() {
      return resolveEffectiveFeatures();
    },
    get _rowModels() {
      // Pagination is intentionally NOT in the grid's row-model pipeline.
      // The wrapper applies its own filters (filterMenuValues, globalFilter,
      // valueFilters) on top of `grid.getRowModel().rows`. If pagination
      // ran first, those filters would only see the visible page. Instead
      // the wrapper paginates last - see `allRows` below.
      return {
        coreRowModel: createCoreRowModel<TData>(),
        filteredRowModel: createFilteredRowModel<TData>(),
        // External-sort mode: pass the rows through untouched so the consumer
        // controls ordering (e.g. tree data that must preserve hierarchy).
        sortedRowModel: externalSortEnabled
          ? passthroughSortedRowModel
          : createSortedRowModel<TData>(sortFns),
        groupedRowModel: createGroupedRowModel<TData>(),
        expandedRowModel: createExpandedRowModel<TData>(),
      };
    },
    get columns() {
      return internalColumns;
    },
    get data() {
      return internalData;
    },
    get getRowId() {
      return props.getRowId;
    },
    state: {
      columnFilters: [],
      grouping: [],
      sorting: [],
      // svelte-ignore state_referenced_locally
      pagination: { pageIndex: 0, pageSize: props.pageSize ?? 10 },
      rowSelection: {},
      expanded: {},
      activeCell: { rowIndex: 0, colIndex: 0, cellId: null },
    },
  });

  $effect(() => {
    const unsubscribe = grid.store.subscribe(() => {
      gridStateVersion += 1;
    });
    return unsubscribe;
  });

  /**
   * The grid's columns reordered so left-pinned columns come first and
   * right-pinned columns come last. All other code (rendering, keyboard nav,
   * active cell) operates on this ordered view.
   */
  /**
   * User-driven column order (drag-to-reorder OR `api.setColumnOrder`).
   * Stored as a flat list of column ids. Empty = use the natural order
   * from the columns prop. The pin grouping is applied on top of this.
   */
  let userColumnOrder = $state<string[]>([...(props.columnOrder ?? [])]);
  // Re-seed on prop change so consumers can drive order from outside.
  let lastSeededOrder = "";
  $effect(() => {
    const incoming = props.columnOrder
      ? [...props.columnOrder].join("|")
      : "";
    if (incoming === lastSeededOrder) return;
    lastSeededOrder = incoming;
    userColumnOrder = props.columnOrder ? [...props.columnOrder] : [];
  });

  const allColumns = $derived.by(() => {
    let raw = grid
      .getAllColumns()
      .filter((column) => !hiddenColumns[column.id]);
    // Apply user reorder (if any). Unknown ids in userColumnOrder are
    // skipped; columns not in userColumnOrder keep their original
    // relative order after the user-ordered ones.
    if (userColumnOrder.length > 0) {
      const byId = new Map(raw.map((c) => [c.id, c]));
      const seen = new Set<string>();
      const ordered: Column<TData>[] = [];
      for (const id of userColumnOrder) {
        const c = byId.get(id);
        if (c && !seen.has(id)) { ordered.push(c); seen.add(id); }
      }
      for (const c of raw) {
        if (!seen.has(c.id)) ordered.push(c);
      }
      raw = ordered;
    }
    const leftIds = columnPinning.left;
    const rightIds = columnPinning.right;
    if (!leftIds.length && !rightIds.length) return raw;
    const pinned = new Set([...leftIds, ...rightIds]);
    const findById = (id: string) => raw.find((column) => column.id === id);
    const left = leftIds
      .map(findById)
      .filter((c): c is Column<TData> => Boolean(c));
    const right = rightIds
      .map(findById)
      .filter((c): c is Column<TData> => Boolean(c));
    const unpinned = raw.filter((column) => !pinned.has(column.id));
    return [...left, ...unpinned, ...right];
  });

  /** Header groups reordered to match {@link allColumns}. */
  const headerGroups = $derived.by(() => {
    const base = grid.getHeaderGroups();
    if (!base.length) return base;
    const byId = new Map(
      base[0]!.headers.map((header) => [header.column.id, header]),
    );
    const headers: (typeof base)[number]["headers"] = [];
    for (const column of allColumns) {
      const header = byId.get(column.id);
      if (header) headers.push(header);
    }
    return [{ id: base[0]!.id, headers }];
  });

  /**
   * Group-header rows (PIVOT-style multi-level headers). When the
   * consumer's column tree has `columns: [...]` nesting, we render extra
   * header rows ABOVE the standard leaf-header row, each row showing one
   * level of group labels with a colSpan covering the leaves underneath.
   *
   * For flat column lists this returns [] and no extra rows render -
   * existing demos are unaffected.
   *
   * Each entry's `widthPx` precomputes the cell's pixel width as the sum
   * of its leaf widths so the cells line up exactly with the columns
   * below, even when the consumer mixes columns of different widths.
   */
  type GroupHeaderCell = {
    key: string;
    label: string;
    colSpan: number;
    widthPx: number;
    /** First leaf-column index this cell spans. */
    firstLeafIndex: number;
    /** True for the placeholder cells that fill the column above an
     *  early-bottoming leaf (e.g. the row-label column to the left of a
     *  multi-level value tree). They render as empty cells so the
     *  layout stays aligned without showing duplicate labels. */
    isPlaceholder: boolean;
  };
  const groupHeaderRows = $derived.by(() => {
    const userCols: Array<ColumnDef<any, TData>> =
      (props.columns as unknown as Array<ColumnDef<any, TData>>) ?? [];

    // 1. Find max depth in the user-provided column tree.
    function maxDepth(defs: Array<ColumnDef<any, TData>>): number {
      let m = 0;
      for (const d of defs) {
        if (d.columns?.length) {
          m = Math.max(m, 1 + maxDepth(d.columns));
        }
      }
      return m;
    }
    const depth = maxDepth(userCols);
    if (depth === 0) return [] as Array<{ id: string; cells: GroupHeaderCell[] }>;

    // 2. Resolve each LEAF column def -> its id + leaf-column index in
    //    `allColumns`. Walks the same tree the engine walked. Used to
    //    compute pixel widths for group cells.
    type LeafEntry = { id: string; widthPx: number };
    const leafEntries: LeafEntry[] = [];
    function buildId(def: ColumnDef<any, TData>, parentId: string | undefined, fallbackIx: number): string {
      return def.id ?? def.field ?? `${parentId ?? 'col'}_d_${fallbackIx}`;
    }
    function collectLeaves(
      defs: Array<ColumnDef<any, TData>>,
      parentId: string | undefined,
      depthHere: number,
    ): void {
      defs.forEach((def, ix) => {
        const id = buildId(def, parentId, ix);
        if (def.columns?.length) {
          collectLeaves(def.columns, id, depthHere + 1);
        } else {
          leafEntries.push({ id, widthPx: getColumnWidth(id) });
        }
      });
    }
    collectLeaves(userCols, undefined, 0);

    // 3. Emit per-depth group cells. We walk the tree per row, summing
    //    leaf widths under each node for colSpan + widthPx.
    type NodeAt = { def: ColumnDef<any, TData>; id: string; leafStart: number; leafEnd: number };
    function indexTree(
      defs: Array<ColumnDef<any, TData>>,
      parentId: string | undefined,
      cursor: { leaf: number },
    ): NodeAt[] {
      const nodes: NodeAt[] = [];
      for (const def of defs) {
        const id = buildId(def, parentId, nodes.length);
        const leafStart = cursor.leaf;
        if (def.columns?.length) {
          indexTree(def.columns, id, cursor);
        } else {
          cursor.leaf += 1;
        }
        const leafEnd = cursor.leaf;
        nodes.push({ def, id, leafStart, leafEnd });
      }
      return nodes;
    }
    const cursor = { leaf: 0 };
    const topNodes = indexTree(userCols, undefined, cursor);

    function nodesAtDepth(
      nodes: NodeAt[],
      currentDepth: number,
      targetDepth: number,
    ): NodeAt[] {
      if (currentDepth === targetDepth) return nodes;
      const out: NodeAt[] = [];
      for (const n of nodes) {
        if (n.def.columns?.length) {
          const childCursor = { leaf: n.leafStart };
          const children = indexTree(n.def.columns, n.id, childCursor);
          out.push(...nodesAtDepth(children, currentDepth + 1, targetDepth));
        } else {
          // Leaf reached early - emit a placeholder at this row so the
          // column above it stays empty (the leaf itself renders in the
          // bottom leaf-header row, not here).
          out.push(n);
        }
      }
      return out;
    }

    function sumLeafWidths(from: number, to: number): number {
      let sum = 0;
      for (let i = from; i < to; i += 1) sum += leafEntries[i]?.widthPx ?? 0;
      return sum;
    }

    const rows: Array<{ id: string; cells: GroupHeaderCell[] }> = [];
    for (let d = 0; d < depth; d += 1) {
      const at = nodesAtDepth(topNodes, 0, d);
      const cells: GroupHeaderCell[] = at.map((n) => {
        const isLeafEarly = !n.def.columns?.length;
        const headerText =
          typeof n.def.header === 'string' ? n.def.header : '';
        return {
          key: `${n.id}_d${d}`,
          label: isLeafEarly ? '' : headerText,
          colSpan: Math.max(1, n.leafEnd - n.leafStart),
          widthPx: sumLeafWidths(n.leafStart, n.leafEnd),
          firstLeafIndex: n.leafStart,
          isPlaceholder: isLeafEarly,
        };
      });
      rows.push({ id: `gh_${d}`, cells });
    }
    return rows;
  });

  /** Cumulative pixel offsets for left- and right-pinned columns. */
  const pinnedOffsets = $derived.by(() => {
    const rowNumberWidth = showRowNumbersEffective ? rowNumberColumnWidth : 0;
    const selectionWidth = showRowSelectionEffective ? selectionColumnWidth : 0;
    const left: Record<string, number> = {};
    let leftAcc = rowNumberWidth + selectionWidth;
    for (const id of columnPinning.left) {
      left[id] = leftAcc;
      leftAcc += getColumnWidth(id);
    }
    const right: Record<string, number> = {};
    let rightAcc = 0;
    for (let i = columnPinning.right.length - 1; i >= 0; i -= 1) {
      const id = columnPinning.right[i];
      if (!id) continue;
      right[id] = rightAcc;
      rightAcc += getColumnWidth(id);
    }
    return { left, right };
  });

  function cellPinStyle(columnId: string): string {
    // z-index 30 - higher than the active-cell / selection-range stacking
    // context (z=20) so a selected cell in the scrollable middle never
    // bleeds over the pinned columns during horizontal scroll. Still
    // sits below dropdowns (z=900+) and the column menu.
    const leftOffset = pinnedOffsets.left[columnId];
    if (leftOffset !== undefined) {
      return `position: sticky; left: ${leftOffset}px; z-index: 30;`;
    }
    const rightOffset = pinnedOffsets.right[columnId];
    if (rightOffset !== undefined) {
      return `position: sticky; right: ${rightOffset}px; z-index: 30;`;
    }
    return "";
  }

  function isColumnPinned(columnId: string): "left" | "right" | null {
    if (columnPinning.left.includes(columnId)) return "left";
    if (columnPinning.right.includes(columnId)) return "right";
    return null;
  }

  // ---- Column reorder (drag headers) ----------------------------------
  // Live drag state for the built-in header drag-to-reorder. Only set
  // when `props.enableColumnReorder` is true.
  let colDragId    = $state<string | null>(null);
  let colDropOnId  = $state<string | null>(null);
  let colDropSide  = $state<"before" | "after" | null>(null);

  /** Compute the current full column order as displayed (pinned-left
   *  first, unpinned in the middle, pinned-right last). The order
   *  emitted via `onColumnOrderChange` matches what the user sees. */
  function getCurrentColumnOrder(): string[] {
    return allColumns.map((c) => c.id);
  }

  function emitColumnOrder() {
    props.onColumnOrderChange?.(getCurrentColumnOrder());
  }

  function setColumnOrderInternal(ids: ReadonlyArray<string>) {
    userColumnOrder = [...ids];
    emitColumnOrder();
  }

  /** Drop `dragId` before / after `targetId` in the user order. We
   *  rebuild a clean order out of the currently-displayed columns so
   *  hidden columns are unaffected and pin groups stay logically
   *  separate (you can reorder freely within left-pinned / unpinned /
   *  right-pinned, but a drop across pin zones is allowed - the cell
   *  just lands in whichever zone the target belongs to). */
  function applyColumnDrop(dragId: string, targetId: string, side: "before" | "after") {
    if (dragId === targetId) return;
    const current = getCurrentColumnOrder();
    const without = current.filter((id) => id !== dragId);
    let idx = without.indexOf(targetId);
    if (idx < 0) return;
    if (side === "after") idx++;
    without.splice(idx, 0, dragId);
    setColumnOrderInternal(without);
  }

  function onColumnHeaderDragStart(e: DragEvent, columnId: string) {
    if (!(props.enableColumnReorder ?? false)) return;
    colDragId = columnId;
    e.dataTransfer?.setData("text/plain", columnId);
    e.dataTransfer!.effectAllowed = "move";
  }
  function onColumnHeaderDragOver(e: DragEvent, columnId: string) {
    if (!colDragId || colDragId === columnId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    colDropSide = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
    colDropOnId = columnId;
  }
  function onColumnHeaderDragLeave(columnId: string) {
    if (colDropOnId === columnId) { colDropOnId = null; colDropSide = null; }
  }
  function onColumnHeaderDrop(e: DragEvent, columnId: string) {
    e.preventDefault();
    if (colDragId && colDropSide) applyColumnDrop(colDragId, columnId, colDropSide);
    colDragId = null; colDropOnId = null; colDropSide = null;
  }
  function onColumnHeaderDragEnd() {
    colDragId = null; colDropOnId = null; colDropSide = null;
  }

  function pinColumnLeft(columnId: string) {
    const left = columnPinning.left.filter((id) => id !== columnId);
    const right = columnPinning.right.filter((id) => id !== columnId);
    columnPinning = { left: [...left, columnId], right };
    closeMenus();
  }

  function pinColumnRight(columnId: string) {
    const left = columnPinning.left.filter((id) => id !== columnId);
    const right = columnPinning.right.filter((id) => id !== columnId);
    columnPinning = { left, right: [columnId, ...right] };
    closeMenus();
  }

  function unpinColumn(columnId: string) {
    columnPinning = {
      left: columnPinning.left.filter((id) => id !== columnId),
      right: columnPinning.right.filter((id) => id !== columnId),
    };
    closeMenus();
  }
  function getColumnBaseValue(row: Row<TData>, column: Column<TData>) {
    const def = column.columnDef;
    if (def.accessorFn) return def.accessorFn(row.original);
    if (def.field) return row.original[def.field];
    return row.getCellValueByColumnId(column.id);
  }

  // ---- Conditional formatting --------------------------------------------
  // True when the feature is in use; gates the per-cell positioning context
  // (cells are otherwise non-relative for scroll performance).
  const hasConditionalFormats = $derived(
    (props.conditionalFormats?.length ?? 0) > 0,
  );
  // Per-column numeric min/max, needed only by colorScale / dataBar formats.
  // Lazy: this derived never runs unless `conditionalFormats` is set.
  const conditionalColumnStats = $derived.by(() => {
    const map = new Map<string, ColumnStat>();
    const formats = props.conditionalFormats;
    if (!formats?.length || !formatsNeedingStats(formats)) return map;
    for (const column of allColumns) {
      const needs = formats.some(
        (f) =>
          (f.type === "colorScale" || f.type === "dataBar") &&
          (!f.columns || f.columns.includes(column.id)),
      );
      if (!needs) continue;
      const def = column.columnDef;
      const accessorFn = def.accessorFn;
      const field = def.field;
      const stat = computeColumnStat(
        (function* () {
          for (const row of allRows) {
            yield accessorFn
              ? accessorFn(row.original)
              : field
                ? (row.original as Record<string, unknown>)[field]
                : row.getCellValueByColumnId(column.id);
          }
        })(),
      );
      if (stat) map.set(column.id, stat);
    }
    return map;
  });

  function cellConditionalFormat(
    row: Row<TData>,
    column: Column<TData>,
    value: unknown,
  ): ResolvedCellFormat | null {
    const formats = props.conditionalFormats;
    if (!formats?.length) return null;
    return resolveCellFormat(
      value,
      row.original,
      column.id,
      formats,
      conditionalColumnStats.get(column.id) ?? null,
    );
  }

  function cfTextStyle(cf: ResolvedCellFormat): string {
    let s = "";
    if (cf.color) s += `color:${cf.color};`;
    if (cf.fontWeight != null) s += `font-weight:${cf.fontWeight};`;
    return s;
  }

  function isGroupRow(row: Row<TData>) {
    return typeof row.getCanExpand === "function" && row.getCanExpand();
  }

  /**
   * Resolve `columnDef.editable` for one row × column pair.
   *
   *   - `undefined` / `true` → editable
   *   - `false` → not editable (column-level lockdown, fastest path)
   *   - function → call it with the cell's context and honour the
   *     boolean it returns (cell-level lockdown - used for things like
   *     "this field is owned by the server, this one isn't, by row")
   *
   * Called from every editing entry point: double-click, type-to-edit,
   * fill-handle drag, Delete-clear, clipboard paste. A central helper
   * keeps the cell-level callback signature consistent and saves a
   * lookup of CellContext at each site.
   */
  function isCellEditable(column: Column<TData>, row?: Row<TData>): boolean {
    const editable = column.columnDef.editable;
    if (editable === false) return false;
    if (typeof editable !== "function") return true;
    if (!row) return true;
    const ctx: CellContext<TData> = {
      cell: {
        id: `${row.id}_${column.id}`,
        row,
        column,
        getValue: () => getColumnBaseValue(row, column),
        getContext: () => ctx,
      },
      row,
      column,
      table: grid,
      getValue: () => getColumnBaseValue(row, column),
    };
    try {
      return editable(ctx) !== false;
    } catch {
      // A throwing predicate shouldn't crash the grid - log and treat
      // as not-editable so any error biases toward safety.
      return false;
    }
  }

  /** Variant that takes raw row + column indices for the rare callers
   *  (fill-handle, paste, Delete) that already work in index-space. */
  function isCellEditableAt(rowIndex: number, colIndex: number): boolean {
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!column) return false;
    return isCellEditable(column, row);
  }

  const sortDirectionByColumn = $derived.by(() => {
    gridStateVersion;
    const directions: Record<string, false | "asc" | "desc"> = {};
    for (const column of allColumns)
      directions[column.id] = column.getIsSorted();
    return directions;
  });

  const groupingColumns = $derived.by(() => {
    gridStateVersion;
    return grid.getState().grouping ?? [];
  });

  const paginationState = $derived.by(() => {
    gridStateVersion;
    return grid.getState().pagination ?? { pageIndex: 0, pageSize: 10 };
  });

  function getRowColumnValue(row: Row<TData>, columnId: string) {
    const column = allColumns.find((entry) => entry.id === columnId);
    return column
      ? getColumnBaseValue(row, column)
      : row.getCellValueByColumnId(columnId);
  }

  /**
   * Rows AFTER all filtering but BEFORE pagination. Used by the pager to
   * compute the correct "X to Y of Z" range and total page count when
   * filters reduce the dataset.
   */
  const allRowsBeforePagination = $derived.by(() => {
    gridStateVersion;
    // Touch internalData + internalColumns so the row model re-derives when
    // the consumer replaces the data array (e.g. via a "Reset" button).
    void internalData;
    void internalColumns;
    const rawRows = grid.getRowModel().rows;
    // External-filter mode: the consumer fetched / pre-filtered the rows
    // themselves (server-side data sources). Skip every local filter pass
    // so the data isn't double-filtered against the visible page.
    if (externalFilterEnabled) return rawRows;

    let rows = rawRows;
    if (globalFilter.trim()) {
      const needle = normalizeForFilter(globalFilter, props.filterLocale);
      rows = rows.filter((row) =>
        row
          .getAllCells()
          .some((cell) =>
            normalizeForFilter(String(cell.getValue() ?? ""), props.filterLocale)
              .includes(needle),
          ),
      );
    }

    const menuFilters = Object.entries(filterMenuValues).filter(
      ([_, filter]) => {
        if (filter.operator === "isBlank") return true;
        // `between` needs both endpoints; otherwise treat as inactive.
        if (filter.operator === "between") {
          return (
            filter.value.trim().length > 0 &&
            (filter.valueTo ?? "").trim().length > 0
          );
        }
        return filter.value.trim().length > 0;
      },
    );
    if (menuFilters.length) {
      rows = rows.filter((row) =>
        menuFilters.every(([columnId, filter]) =>
          applyExcelFilter(getRowColumnValue(row, columnId), {
            id: columnId,
            operator: filter.operator,
            value: filter.value,
            valueTo: filter.operator === "between" ? filter.valueTo : undefined,
          }, { locale: props.filterLocale }),
        ),
      );
    }

    const valueFilterEntries = Object.entries(valueFilters);
    if (valueFilterEntries.length) {
      // Resolve bucket defs up front so we don't re-hit the derived map
      // for every row × column combination. Columns without bucketing
      // map to `null` here and fall through to exact-value matching.
      const bucketEntries = valueFilterEntries.map(([columnId, allowed]) => ({
        columnId,
        allowed,
        buckets: facetBucketsByColumn.get(columnId) ?? null,
      }));
      rows = rows.filter((row) =>
        bucketEntries.every(({ columnId, allowed, buckets }) => {
          const raw = getRowColumnValue(row, columnId);
          if (buckets) {
            // Range-bucketed filter: find which bucket this row's value
            // falls into and check whether that bucket's label is allowed.
            const isDate = buckets[0]!.isDate;
            const num = rawToNumber(raw, isDate);
            if (!Number.isFinite(num)) return false;
            for (const bucket of buckets) {
              if (isInBucket(num, bucket)) return allowed.has(bucket.label);
            }
            return false;
          }
          return allowed.has(String(raw ?? ""));
        }),
      );
    }

    return rows;
  });

  /**
   * Visible rows for the current page. Applied last so filters operate on
   * the full dataset rather than the current page (see the comment above
   * `_rowModels`).
   */
  const allRows = $derived.by(() => {
    const rows = allRowsBeforePagination;
    if (!paginationEnabled) return rows;
    const { pageIndex, pageSize } = paginationState;
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  });
  const rowSelectionState = $derived.by(() => {
    gridStateVersion;
    return grid.getState().rowSelection ?? {};
  });

  // Forward selection changes to the consumer. Skips the very first invocation
  // (the initial empty state) so consumers don't get a spurious callback on mount.
  let lastSelectionSerialized = "";
  $effect(() => {
    const serialized = JSON.stringify(rowSelectionState);
    if (serialized === lastSelectionSerialized) return;
    lastSelectionSerialized = serialized;
    const callback = props.onRowSelectionChange;
    if (!callback) return;
    const data = internalData;
    const selectedRows: TData[] = [];
    for (let i = 0; i < data.length; i++) {
      if (rowSelectionState[String(i)]) selectedRows.push(data[i] as TData);
    }
    callback(rowSelectionState, selectedRows);
  });

  // Forward cell-selection rectangle changes to the consumer. Same
  // dedupe pattern - fires only when the serialized rectangle changes
  // so consumers don't see spurious callbacks during re-renders.
  let lastCellRangeSerialized = "";
  $effect(() => {
    const a = selectionRange.anchor;
    const f = selectionRange.focus;
    const ranges: Array<[number, number, number, number]> =
      a && f
        ? [[
            Math.min(a.rowIndex, f.rowIndex),
            Math.min(a.colIndex, f.colIndex),
            Math.max(a.rowIndex, f.rowIndex),
            Math.max(a.colIndex, f.colIndex),
          ]]
        : [];
    const serialized = JSON.stringify(ranges);
    if (serialized === lastCellRangeSerialized) return;
    lastCellRangeSerialized = serialized;
    props.onCellSelectionChange?.(ranges);
  });

  // ---- Status bar: live aggregates of the selected cell range -----------
  const statusBarEnabled = $derived(
    props.statusBar != null && props.statusBar !== false,
  );
  const statusBarAggregates = $derived(
    typeof props.statusBar === "object" && props.statusBar.aggregates
      ? props.statusBar.aggregates
      : (["count", "sum", "avg", "min", "max"] as const),
  );
  const statusBarStats = $derived.by(() => {
    if (!statusBarEnabled) return null;
    const a = selectionRange.anchor;
    const f = selectionRange.focus;
    if (!a || !f) return null;
    const minR = Math.min(a.rowIndex, f.rowIndex);
    const maxR = Math.max(a.rowIndex, f.rowIndex);
    const minC = Math.min(a.colIndex, f.colIndex);
    const maxC = Math.max(a.colIndex, f.colIndex);
    let count = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let r = minR; r <= maxR; r += 1) {
      const row = allRows[r];
      if (!row || isGroupRow(row)) continue;
      for (let c = minC; c <= maxC; c += 1) {
        const col = allColumns[c];
        if (!col) continue;
        count += 1;
        const base = getColumnBaseValue(row, col);
        const v = getCellDisplayValue(row.id, col.id, base);
        if (v == null || v === "") continue;
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        numericCount += 1;
        sum += n;
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
    if (count <= 1) return null;
    return {
      count,
      numericCount,
      sum,
      avg: numericCount ? sum / numericCount : 0,
      min: numericCount ? min : 0,
      max: numericCount ? max : 0,
    };
  });

  function fmtStat(n: number): string {
    return Number.isInteger(n)
      ? n.toLocaleString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // ---- Tool panel (docked columns sidebar) -------------------------------
  let toolPanelOpen = $state(false);
  const toolPanelEnabled = $derived(props.toolPanel === true);
  // Every column (including hidden ones) in the user's current order, so the
  // panel can toggle/reorder anything. Group columns are flagged live.
  const toolPanelColumns = $derived.by(() => {
    gridStateVersion;
    const all = grid.getAllColumns();
    if (!userColumnOrder.length) return all;
    const byId = new Map(all.map((c) => [c.id, c]));
    const ordered: Column<TData>[] = [];
    const seen = new Set<string>();
    for (const id of userColumnOrder) {
      const c = byId.get(id);
      if (c && !seen.has(id)) {
        ordered.push(c);
        seen.add(id);
      }
    }
    for (const c of all) if (!seen.has(c.id)) ordered.push(c);
    return ordered;
  });

  function toolPanelHeaderLabel(column: Column<TData>): string {
    const h = column.columnDef.header;
    return typeof h === "string" ? h : column.id;
  }
  function toggleColumnVisibleInPanel(columnId: string) {
    if (hiddenColumns[columnId]) {
      const next = { ...hiddenColumns };
      delete next[columnId];
      hiddenColumns = next;
    } else {
      hiddenColumns = { ...hiddenColumns, [columnId]: true };
    }
  }
  function moveColumnInPanel(columnId: string, dir: -1 | 1) {
    const current = toolPanelColumns.map((c) => c.id);
    const i = current.indexOf(columnId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    [current[i], current[j]] = [current[j]!, current[i]!];
    userColumnOrder = current;
  }
  function toggleGroupInPanel(columnId: string) {
    const g = (grid.getState().grouping ?? []) as string[];
    grid.setGrouping(
      g.includes(columnId)
        ? g.filter((x) => x !== columnId)
        : [...g, columnId],
    );
  }

  // Forward sort-clause changes to the consumer. Same dedupe pattern as the
  // selection callback above - fires only when the serialized clauses change.
  let lastSortingSerialized = "";
  $effect(() => {
    gridStateVersion;
    const sorting = (grid.getState().sorting ?? []) as Array<{
      id: string;
      desc: boolean;
    }>;
    const serialized = JSON.stringify(sorting);
    if (serialized === lastSortingSerialized) return;
    lastSortingSerialized = serialized;
    props.onSortingChange?.(sorting);
  });

  // Forward filter-state changes to the consumer. Consolidates the three
  // wrapper-managed filter stores (global text, per-column operator filters,
  // facet checklists) into one shape so server-side consumers can build a
  // single query. Skipped entirely when no callback is registered to avoid
  // serializing on every keystroke.
  let lastFiltersSerialized = "";
  $effect(() => {
    if (!props.onFiltersChange) return;
    const menuEntries = Object.entries(filterMenuValues)
      .filter(([, f]) => {
        if (f.operator === "isBlank") return true;
        if (f.operator === "between") {
          return f.value.trim().length > 0 && (f.valueTo ?? "").trim().length > 0;
        }
        return f.value.trim().length > 0;
      })
      .map(([id, f]) => ({
        id,
        operator: f.operator,
        value: f.value,
        ...(f.operator === "between" && f.valueTo
          ? { valueTo: f.valueTo }
          : {}),
      }));
    const valueEntries = Object.entries(valueFilters).map(([id, allowed]) => ({
      id,
      operator: "equals" as FilterOperator,
      value: "",
      selectedValues: Array.from(allowed).sort(),
    }));
    const merged = new Map<
      string,
      {
        id: string;
        operator: FilterOperator;
        value: string;
        selectedValues?: Array<string>;
      }
    >();
    for (const entry of menuEntries) merged.set(entry.id, entry);
    for (const entry of valueEntries) {
      const existing = merged.get(entry.id);
      merged.set(
        entry.id,
        existing
          ? { ...existing, selectedValues: entry.selectedValues }
          : entry,
      );
    }
    const payload = {
      global: globalFilter,
      columns: Array.from(merged.values()),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastFiltersSerialized) return;
    lastFiltersSerialized = serialized;
    props.onFiltersChange(payload);
  });

  const virtualizer = createSvelteVirtualizer({
    count: 0,
    estimateSize: 36,
    overscan: 8,
    viewportHeight: 520,
    scrollOffset: 0,
  });
  const columnVirtualizer = createColumnVirtualizer({
    count: 0,
    viewportWidth: 0,
    overscan: 3,
    estimateSize: () => 140,
  });
  columnVirtualizer.subscribe(() => {
    columnVirtualizerVersion += 1;
  });

  const rowVirtualizationEnabled = $derived(
    (props.virtualization ?? true) && allRows.length > 0,
  );
  const columnVirtualizationEnabled = $derived(
    (props.columnVirtualization ?? true) && allColumns.length > 0,
  );
  const virtualRows = $derived.by(() => {
    virtualizer.version;
    return virtualizer.getVirtualItems();
  });
  const virtualRowTotalSize = $derived.by(() => {
    virtualizer.version;
    return virtualizer.getTotalSize();
  });
  const virtualRowStart = $derived.by(() => virtualRows[0]?.start ?? 0);
  const virtualRowEnd = $derived.by(
    () => virtualRows[virtualRows.length - 1]?.end ?? 0,
  );
  const virtualRowBottomSpacer = $derived.by(() =>
    Math.max(virtualRowTotalSize - virtualRowEnd, 0),
  );
  const virtualColumns = $derived.by(() => {
    columnVirtualizerVersion;
    return columnVirtualizer.getVirtualItems();
  });
  const virtualColumnTotalSize = $derived.by(() => {
    columnVirtualizerVersion;
    return columnVirtualizer.getTotalSize();
  });
  const renderedColumnItems = $derived.by(() => {
    if (columnVirtualizationEnabled) return virtualColumns;
    let start = 0;
    return allColumns.map((column, index) => {
      const size = getColumnWidth(column.id);
      const item = { index, key: index, size, start, end: start + size };
      start += size;
      return item;
    });
  });
  function hasRenderedColumn(entry: {
    item: (typeof renderedColumnItems)[number];
    column: (typeof allColumns)[number] | undefined;
  }): entry is {
    item: (typeof renderedColumnItems)[number];
    column: (typeof allColumns)[number];
  } {
    return entry.column !== undefined;
  }
  const renderedColumns = $derived.by(() =>
    renderedColumnItems
      .map((item) => ({ item, column: allColumns[item.index] }))
      .filter(hasRenderedColumn),
  );
  const totalColumnWidth = $derived.by(() => {
    if (columnVirtualizationEnabled) return virtualColumnTotalSize;
    let total = 0;
    for (const column of allColumns) total += getColumnWidth(column.id);
    return total;
  });
  /** Horizontal overflow derived from the SOURCE OF TRUTH (column widths
   *  + leading sticky columns) compared to the viewport. We can't use
   *  `totalColumnWidth` here when column virtualization is on - that
   *  returns the column virtualizer's cached total, which only updates
   *  on `setOptions()` / scroll, NOT when `fittedColumnWidths` finishes
   *  scaling on first measure. Reading `getColumnWidth(c.id)` for every
   *  column instead is reactive to both `columnWidths` and
   *  `fittedColumnWidths`, so the overflow decision settles in the same
   *  render where fit-scaling lands - no race, no scrollbar flash. */
  const hasHorizontalOverflow = $derived.by(() => {
    const fixedCols =
      (showRowNumbersEffective ? rowNumberColumnWidth : 0) +
      (showRowSelectionEffective ? selectionColumnWidth : 0);
    let total = fixedCols;
    for (const column of allColumns) total += getColumnWidth(column.id);
    // +1 to tolerate sub-pixel rounding residue from `fitColumns`.
    return total > viewportWidth + 1;
  });
  const columnWindowStart = $derived.by(
    () => renderedColumnItems[0]?.start ?? 0,
  );
  const columnWindowEnd = $derived.by(
    () => renderedColumnItems[renderedColumnItems.length - 1]?.end ?? 0,
  );
  const columnWindowRightSpacer = $derived.by(() =>
    Math.max(totalColumnWidth - columnWindowEnd, 0),
  );

  const activeCell = $derived.by(() => {
    gridStateVersion;
    return (
      grid.getState().activeCell ?? { rowIndex: 0, colIndex: 0, cellId: null }
    );
  });

  const activeDescendantId = $derived.by(() => {
    const active = activeCell;
    const inRows = active.rowIndex >= 0 && active.rowIndex < allRows.length;
    const inCols = active.colIndex >= 0 && active.colIndex < allColumns.length;
    if (!inRows || !inCols) return null;
    return getGridCellDomId("svgrid", active.rowIndex, active.colIndex);
  });

  /** Apply the column's `format` config to a raw numeric summary value
   *  (sum / avg / etc.). Mirrors the currency/number/percent branches in
   *  `formatCellValue` so a totaled salary column shows "$1,234,567" in
   *  the footer instead of "1234567". Per-row `formatter` functions are
   *  intentionally NOT invoked here - they may close over row state. */
  function formatSummaryNumeric(column: Column<TData>, value: number): string {
    const formatConfig = column.columnDef.format as
      | CellFormatConfig
      | undefined;
    if (
      formatConfig &&
      (formatConfig.type === "number" ||
        formatConfig.type === "currency" ||
        formatConfig.type === "percent")
    ) {
      return formatNumericWithConfig(value, {
        type: formatConfig.type,
        locales: formatConfig.locales,
        currency:
          formatConfig.type === "currency"
            ? (formatConfig.currency ?? "USD")
            : undefined,
        valueIsPercentPoints:
          formatConfig.type === "percent"
            ? formatConfig.valueIsPercentPoints
            : undefined,
        options: formatConfig.options,
      });
    }
    return String(value);
  }

  /**
   * Aggregate every row into a per-column footer summary (sum for numeric
   * columns, `Count: N` otherwise). This loop is the hottest path on a
   * large grid - it is rows x columns iterations - so two things keep the
   * constant factor down:
   *
   *   1. The edited-cell overlay is only consulted when an edit actually
   *      exists. `key in editedCellValues` hits a reactive-proxy `has`
   *      trap for every cell otherwise - 5M no-op trap calls on a
   *      100k x 50 grid. Skipping it when the map is empty is the single
   *      biggest win here.
   *   2. The column's accessor (`accessorFn` / `field`) is resolved once
   *      per column, not re-read off `columnDef` for every cell.
   */
  function computeSummaries(
    rows: ReadonlyArray<Row<TData>>,
    columns: ReadonlyArray<Column<TData>>,
  ): Record<string, string> {
    const summary: Record<string, string> = {};
    const rowCount = rows.length;
    const hasEdits = Object.keys(editedCellValues).length > 0;
    for (const column of columns) {
      const def = column.columnDef;
      const accessorFn = def.accessorFn;
      const field = def.field;
      const columnId = column.id;
      let numericSum = 0;
      let numericCount = 0;
      for (let i = 0; i < rowCount; i += 1) {
        const row = rows[i]!;
        let value: unknown;
        const base = accessorFn
          ? accessorFn(row.original)
          : field
            ? (row.original as Record<string, unknown>)[field]
            : row.getCellValueByColumnId(columnId);
        if (hasEdits) {
          const key = getCellKey(row.id, columnId);
          value = key in editedCellValues ? editedCellValues[key] : base;
        } else {
          value = base;
        }
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) {
          numericSum += asNumber;
          numericCount += 1;
        }
      }
      summary[columnId] =
        numericCount > 0
          ? formatSummaryNumeric(column, numericSum)
          : `Count: ${rowCount}`;
    }
    return summary;
  }

  // Above this many cells (rows x columns) the summary aggregation is
  // deferred one animation frame so it never blocks first paint - a
  // 100k x 50 grid would otherwise spend seconds summing reactive cells
  // before the grid ever appears. Smaller grids compute inline so the
  // footer is correct on the first frame (no flicker).
  const SUMMARY_DEFER_CELL_LIMIT = 50_000;

  let summaryByColumn = $state<Record<string, string>>({});
  $effect(() => {
    // Re-aggregate whenever the visible data, columns, edits, or any
    // state that reorders/filters rows changes.
    gridStateVersion;
    void editedCellValues;
    const rows = allRows;
    const columns = allColumns;
    if (!(props.enableRowSummaries ?? true)) {
      summaryByColumn = {};
      return;
    }
    if (
      rows.length * columns.length <= SUMMARY_DEFER_CELL_LIMIT ||
      typeof requestAnimationFrame === "undefined"
    ) {
      summaryByColumn = computeSummaries(rows, columns);
      return;
    }
    // Large grid: paint first, total a frame later.
    let cancelled = false;
    const handle = requestAnimationFrame(() => {
      if (!cancelled) summaryByColumn = computeSummaries(rows, columns);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  });

  $effect(() => {
    if (!theadEl) return;
    headerHeight = theadEl.offsetHeight;
    const observer = new ResizeObserver(() => {
      headerHeight = theadEl?.offsetHeight ?? 0;
    });
    observer.observe(theadEl);
    return () => observer.disconnect();
  });

  // Bump scrollVersion when the table's layout size changes so scrollbar
  // visibility (and the thumb math that depends on scroll metrics) updates
  // after column resize / show-hide / add-remove.
  $effect(() => {
    if (!gridRootEl) return;
    const observer = new ResizeObserver(() => {
      scrollVersion += 1;
    });
    observer.observe(gridRootEl);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!allRows.length || !allColumns.length) return;
    const active = grid.getState().activeCell;
    if (active?.cellId) return;
    grid.setActiveCell({
      rowIndex: 0,
      colIndex: 0,
      cellId: getGridCellDomId("svgrid", 0, 0),
    });
  });

  $effect(() => {
    // Only reset scroll + selection + editing when the COLUMN SCHEMA
    // changes. Data length is too weak a signal:
    //   - Streaming inserts grow the length and shouldn't move scroll.
    //   - Filter / delete events shrink the length and shouldn't either
    //     (the user's spot in the data is what they care about).
    //   - Sort changes preserve length but mean "start from the top",
    //     so callers who want that should drive it explicitly via
    //     api.scrollToTop() (or the equivalent).
    // The columns ARE a schema change: existing scroll/selection
    // coordinates are no longer meaningful when the grid's column set
    // is replaced, so we still reset there.
    const colCount = props.columns.length;
    const nextSignature = `cols:${colCount}`;
    if (nextSignature === lastResetSignature) return;
    const isFirstRender = lastResetSignature === "";
    lastResetSignature = nextSignature;
    if (isFirstRender) return;

    selectionRange = { anchor: null, focus: null };
    editingCell = null;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      scrollContainer.scrollLeft = 0;
      scrollVersion += 1;
    }
    virtualizer.setScrollOffset(0);
    columnVirtualizer.setHorizontalOffset(0);
  });

  // Wire scroll-change listeners SEPARATELY for each scrollbar - bundling
  // them in one effect with `if (!vertical || !horizontal) return` was
  // the bug behind "vertical scrollbar can't be dragged": with overflow
  // gating, demos without horizontal overflow never mount the horizontal
  // scrollbar, the combined guard tripped, and the vertical listener
  // never got attached either. Each scrollbar is now independent.
  $effect(() => {
    if (!scrollContainer || !verticalScrollbarEl) return;
    const el = verticalScrollbarEl;
    const onVertical = (event: Event) => {
      const container = scrollContainer;
      if (!container) return;
      const customEvent = event as CustomEvent<{ value: number }>;
      container.scrollTop = customEvent.detail.value;
      scheduleScrollSync(container.scrollTop, container.scrollLeft);
    };
    el.addEventListener("scroll-change", onVertical as EventListener);
    return () =>
      el.removeEventListener("scroll-change", onVertical as EventListener);
  });

  $effect(() => {
    if (!scrollContainer || !horizontalScrollbarEl) return;
    const el = horizontalScrollbarEl;
    const onHorizontal = (event: Event) => {
      const container = scrollContainer;
      if (!container) return;
      const customEvent = event as CustomEvent<{ value: number }>;
      container.scrollLeft = customEvent.detail.value;
      scheduleScrollSync(container.scrollTop, container.scrollLeft);
    };
    el.addEventListener("scroll-change", onHorizontal as EventListener);
    return () =>
      el.removeEventListener("scroll-change", onHorizontal as EventListener);
  });

  $effect(() => {
    // When containerHeight is a string (e.g. "100%") the actual pixel height
    // depends on the parent layout - read it from the live scroll container.
    // We track `viewportVersion` (only bumped by the ResizeObserver below)
    // instead of `scrollVersion` so this effect does NOT re-run on every
    // scroll event - which would otherwise re-call setOptions hundreds of
    // times during a drag.
    viewportVersion;
    const viewportHeight =
      typeof props.containerHeight === "string"
        ? (scrollContainer?.clientHeight ?? 520)
        : (props.containerHeight ?? 520);
    virtualizer.setOptions({
      count: allRows.length,
      estimateSize: props.rowHeight ?? 36,
      overscan: props.overscan ?? 8,
      viewportHeight,
    });
  });

  // Track size changes of the shell so the virtualizer's viewport, the
  // fit-columns scale, and anything else that depends on the container
  // width/height stays in sync. Always attached (window resize / parent
  // layout shift / sidebar collapse can change the size whether the
  // consumer passed a numeric or "100%" containerHeight).
  /** True after the first ResizeObserver tick - i.e. once the grid has
   *  measured its real container size and `fitColumns` has had a chance
   *  to scale the columns to that width. Used to gate the scrollbar
   *  visibility: rendering it before this flips paints a horizontal
   *  scrollbar for ONE frame (based on the base column widths summing
   *  larger than the viewport), then immediately hides it once fit
   *  scaling kicks in - visible as a "flashing horizontal scrollbar"
   *  every time a demo first loads. */
  let hasMeasured = $state(false);

  $effect(() => {
    if (!scrollContainer) return;
    const observer = new ResizeObserver(() => {
      viewportVersion += 1;
      if (!hasMeasured) hasMeasured = true;
    });
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  });

  $effect(() => {
    // Reading columnWidths here registers it as a reactive dependency so
    // the effect re-runs when the user resizes a column. We pass a fresh
    // closure each run; the virtualizer sees a new function reference and
    // re-derives its layout from the current per-column widths.
    columnWidths;
    columnVirtualizer.setOptions({
      count: allColumns.length,
      estimateSize: (index: number) => {
        const column = allColumns[index];
        return column ? getColumnWidth(column.id) : (props.columnWidth ?? 140);
      },
      overscan: props.columnOverscan ?? 3,
      viewportHeight: viewportWidth,
    });
  });

  $effect(() => {
    if (!scrollContainer) return;
    if (rowVirtualizationEnabled)
      virtualizer.setScrollOffset(scrollContainer.scrollTop);
    if (columnVirtualizationEnabled)
      columnVirtualizer.setHorizontalOffset(scrollContainer.scrollLeft);
  });

  // Re-arms once the user scrolls away from the bottom, so a long lazy-load
  // run only fires `onScrollBottomReached` once per arrival at the end.
  let scrollBottomArmed = true;
  function onBodyScroll(event: Event) {
    const container = event.currentTarget as HTMLDivElement | null;
    if (!container) return;
    if (columnMenuFor || operatorMenuFor) closeMenus();
    scheduleScrollSync(container.scrollTop, container.scrollLeft);

    if (props.onScrollBottomReached) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 32;
      if (atBottom && scrollBottomArmed) {
        scrollBottomArmed = false;
        props.onScrollBottomReached({ scrollTop, scrollHeight, clientHeight });
      } else if (!atBottom && !scrollBottomArmed) {
        scrollBottomArmed = true;
      }
    }
  }

  function getCellKey(rowId: string, columnId: string) {
    return `${rowId}:${columnId}`;
  }

  /**
   * Normalise the return value of a `cellClass` / `rowClass` callback
   * (or a static `cellClass` field) into a single space-separated
   * class string. Accepts: string, string[], Record<string, boolean>,
   * null/undefined. Anything else returns ''.
   */
  function resolveClassList(
    value:
      | string
      | ReadonlyArray<string>
      | Record<string, boolean>
      | undefined
      | null,
  ): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.filter(Boolean).join(" ");
    if (typeof value === "object") {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(value)) if (v) parts.push(k);
      return parts.join(" ");
    }
    return "";
  }

  /** Compute the consumer-supplied row class for one rendered row. */
  function computeRowClass(row: Row<TData>, rowIndex: number): string {
    if (!props.rowClass) return "";
    return resolveClassList(
      props.rowClass({ row: row.original as TData, rowIndex }),
    );
  }

  /** Compute the consumer-supplied cell class for one rendered cell. */
  function computeCellClass(row: Row<TData>, column: Column<TData>): string {
    const raw = column.columnDef.cellClass;
    if (raw == null) return "";
    if (typeof raw === "string" || Array.isArray(raw)) {
      return resolveClassList(raw);
    }
    if (typeof raw === "function") {
      // Build a minimal CellContext - the only fields the wrapper-side
      // cellClass author needs are `row` and `column`. Callers can read
      // `ctx.row.original` and `ctx.column.id` exactly like in a `cell`
      // renderer. The other fields are stubbed for compatibility.
      const cellCtx = {
        row,
        column,
        cell: undefined as any,
        table: undefined as any,
        getValue: () => row.getCellValueByColumnId(column.id),
      };
      return resolveClassList(raw(cellCtx as any));
    }
    return "";
  }

  /**
   * Resolve the per-cell tooltip. Column-level `tooltip` field can be a
   * plain string (rendered as `title=`) or a `(ctx) => string` callback
   * for value-dependent text. Returning empty / nullish means no
   * tooltip - the renderer omits the `title=` attribute entirely.
   */
  function computeCellTooltip(row: Row<TData>, column: Column<TData>): string | null {
    const raw = column.columnDef.tooltip
    if (raw == null) return null
    if (typeof raw === "string") return raw || null
    if (typeof raw === "function") {
      const ctx = {
        row,
        column,
        cell: undefined as any,
        table: undefined as any,
        getValue: () => row.getCellValueByColumnId(column.id),
      }
      const out = (raw as any)(ctx)
      return out ? String(out) : null
    }
    return null
  }

  /**
   * Resolve a per-cell note (a longer comment / annotation). Notes
   * come from the grid's `notes` prop - a `{ [rowId]: { [columnId]: string } }`
   * map - so the consumer keeps note storage. Returning non-empty
   * paints a corner indicator AND becomes the cell's tooltip text.
   */
  function computeCellNote(row: Row<TData>, column: Column<TData>): string | null {
    const map = props.notes
    if (!map) return null
    const byCol = map[row.id]
    if (!byCol) return null
    const v = byCol[column.id]
    return v && v.trim() ? v : null
  }

  function getCellDisplayValue(
    rowId: string,
    columnId: string,
    baseValue: unknown,
  ) {
    const key = getCellKey(rowId, columnId);
    return key in editedCellValues ? editedCellValues[key] : baseValue;
  }

  function toDateInputValue(value: unknown) {
    if (value == null || value === "") return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return value;
    const parsed =
      value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function toDateTimeLocalInputValue(value: unknown) {
    if (value == null || value === "") return "";
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    )
      return value;
    const parsed =
      value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 16);
  }

  function getEditableInputValue(editorType: CellEditorType, value: unknown) {
    if (editorType === "date") return toDateInputValue(value);
    if (editorType === "datetime") return toDateTimeLocalInputValue(value);
    return String(value ?? "");
  }

  function getEditorInputType(editorType: CellEditorType) {
    if (editorType === "number") return "number";
    if (editorType === "date") return "date";
    if (editorType === "datetime") return "datetime-local";
    if (editorType === "time") return "time";
    if (editorType === "password") return "password";
    if (editorType === "color") return "color";
    return "text";
  }

  /**
   * Effective horizontal alignment for a column. Honors the explicit
   * `align` prop on the ColumnDef; otherwise picks a sensible default
   * based on `editorType`:
   *   number / date / datetime → 'right'
   *   checkbox                 → 'center'
   *   everything else          → 'left'
   */
  function getColumnAlign(column: Column<TData>): "left" | "center" | "right" {
    const explicit = column.columnDef.align;
    if (explicit) return explicit;
    const editorType = column.columnDef.editorType;
    if (
      editorType === "number" ||
      editorType === "date" ||
      editorType === "datetime"
    ) {
      return "right";
    }
    if (editorType === "checkbox") return "center";
    return "left";
  }

  /** Cached normalized options keyed by columnId - only used when the column
   *  has a static (non-function) `editorOptions`. Dynamic (per-row) options
   *  are resolved on every call because they can change as other cells in
   *  the same row change (the whole point of cascading editors). */
  const editorOptionsCache: Record<string, CellEditorOption[]> = {};
  function getColumnEditorOptions(
    column: Column<TData>,
    row?: Row<TData> | null,
  ): CellEditorOption[] {
    const def = column.columnDef.editorOptions;
    if (typeof def === "function") {
      // Dynamic per-row: must be re-evaluated because the row's other
      // cells may have just changed (cascade).
      if (!row?.original) return [];
      return normalizeEditorOptions(def(row.original as TData));
    }
    const id = column.id;
    if (
      !editorOptionsCache[id] ||
      editorOptionsCache[id + "__src"] !== (def as unknown as object)
    ) {
      editorOptionsCache[id] = normalizeEditorOptions(def);
      (editorOptionsCache as Record<string, unknown>)[id + "__src"] = def;
    }
    return editorOptionsCache[id];
  }

  /** Resolve a stored value to an array form (for list/chips multi-select). */
  function toValueArray(value: unknown): Array<string | number> {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) {
      return value.filter((v) => v != null && v !== "") as Array<
        string | number
      >;
    }
    return [value as string | number];
  }

  /** Look up the display label for a given option value. */
  function getOptionLabel(options: CellEditorOption[], value: unknown): string {
    const match = options.find(
      (o) => o.value === value || String(o.value) === String(value),
    );
    return match ? match.label : String(value ?? "");
  }

  /** Look up the configured `color` for a value (for colorful chips). */
  function getOptionColor(
    options: CellEditorOption[],
    value: unknown,
  ): string | undefined {
    const match = options.find(
      (o) => o.value === value || String(o.value) === String(value),
    );
    return match?.color;
  }

  /** Build a theme-aware inline `style` string for a colorful chip. The
   *  color value can be any CSS color (hex, rgb, hsl, oklch, named).
   *  We tint the background and border via `color-mix` so the chip stays
   *  readable on light AND dark themes, and use the color itself as the
   *  text color for a soft-pill look (à la GitHub labels). */
  function colorfulChipStyle(color: string | undefined): string {
    if (!color) return "";
    return (
      `background: color-mix(in srgb, ${color} 22%, transparent);` +
      `border-color: color-mix(in srgb, ${color} 45%, transparent);` +
      `color: color-mix(in srgb, ${color} 80%, var(--sg-fg, #0f172a));`
    );
  }

  /** Joined display string for list/chips cells. */
  function formatListCellValue(
    column: Column<TData>,
    value: unknown,
    row?: Row<TData> | null,
  ): string {
    const options = getColumnEditorOptions(column, row);
    const sep = column.columnDef.editorSeparator ?? ", ";
    if (Array.isArray(value)) {
      return value.map((v) => getOptionLabel(options, v)).join(sep);
    }
    if (value == null || value === "") return "";
    return getOptionLabel(options, value);
  }

  function getEditorClass(editorType: CellEditorType) {
    if (editorType === "number")
      return "sv-grid-cell-editor sv-grid-cell-editor-number";
    if (editorType === "date")
      return "sv-grid-cell-editor sv-grid-cell-editor-date";
    if (editorType === "datetime")
      return "sv-grid-cell-editor sv-grid-cell-editor-datetime";
    if (editorType === "color")
      return "sv-grid-cell-editor sv-grid-cell-editor-color";
    return "sv-grid-cell-editor";
  }

  function asDate(value: unknown) {
    if (value == null || value === "") return null;
    const parsed =
      value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatCellValue(
    column: Column<TData>,
    value: unknown,
    row: Row<TData>,
  ) {
    const formatter = column.columnDef.formatter as
      | CellFormatter<TData>
      | undefined;
    if (typeof formatter === "function") {
      const formatted = formatter({ value, row, column, table: grid });
      return String(formatted ?? "");
    }

    // Password columns: mask the stored value with bullets when the cell
    // is in read-only mode. The editor still receives the real string.
    if (column.columnDef.editorType === "password") {
      const s = String(value ?? "");
      return s.length > 0 ? "•".repeat(Math.min(s.length, 12)) : "";
    }

    const formatConfig = column.columnDef.format as
      | CellFormatConfig
      | undefined;
    if (!formatConfig) return String(value ?? "");

    if (
      formatConfig.type === "number" ||
      formatConfig.type === "currency" ||
      formatConfig.type === "percent"
    ) {
      return formatNumericWithConfig(value, {
        type: formatConfig.type,
        locales: formatConfig.locales,
        currency:
          formatConfig.type === "currency"
            ? (formatConfig.currency ?? "USD")
            : undefined,
        valueIsPercentPoints:
          formatConfig.type === "percent"
            ? formatConfig.valueIsPercentPoints
            : undefined,
        options: formatConfig.options,
      });
    }

    if (formatConfig.type === "date" || formatConfig.type === "datetime") {
      const parsedDate = asDate(value);
      if (parsedDate) {
        const preset = resolveDatePattern(
          formatConfig.pattern,
          formatConfig.type,
        );
        const merged: Intl.DateTimeFormatOptions =
          preset || formatConfig.options
            ? { ...preset, ...formatConfig.options }
            : formatConfig.type === "date"
              ? { year: "numeric", month: "2-digit", day: "2-digit" }
              : {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                };

        return getDateFormatter(formatConfig.locales, merged).format(
          parsedDate,
        );
      }
    }

    return String(value ?? "");
  }

  /**
   * Read a cell value from a PINNED row. Pinned rows aren't bound to a
   * TanStack Row<TData>, so we resolve the value directly off the raw
   * TData via `accessorFn` or `field`. Mirrors `getColumnBaseValue`'s
   * lookup path minus the Row indirection.
   */
  function getPinnedCellValue(
    rowData: TData,
    column: Column<TData>,
  ): unknown {
    const def = column.columnDef;
    if (def.accessorFn) return def.accessorFn(rowData);
    const field = def.field as string | undefined;
    if (!field) return undefined;
    return (rowData as unknown as Record<string, unknown>)[field];
  }

  /**
   * Format a cell value for a PINNED row. Same surface as
   * `formatCellValue` but doesn't depend on Row<TData>. Custom
   * `formatter` callbacks are invoked with a `row` of `null` (their
   * type allows it; most don't read it).
   */
  function formatPinnedValue(
    column: Column<TData>,
    value: unknown,
  ): string {
    const def = column.columnDef;
    const formatter = def.formatter as
      | ((ctx: { value: unknown; row: null; column: Column<TData>; table: typeof grid }) => unknown)
      | undefined;
    if (typeof formatter === "function") {
      return String(
        formatter({ value, row: null, column, table: grid }) ?? "",
      );
    }
    if (def.editorType === "password") {
      const s = String(value ?? "");
      return s.length > 0 ? "•".repeat(Math.min(s.length, 12)) : "";
    }
    const formatConfig = def.format as CellFormatConfig | undefined;
    if (!formatConfig) return String(value ?? "");
    if (
      formatConfig.type === "number" ||
      formatConfig.type === "currency" ||
      formatConfig.type === "percent"
    ) {
      return formatNumericWithConfig(value, {
        type: formatConfig.type,
        locales: formatConfig.locales,
        currency:
          formatConfig.type === "currency"
            ? (formatConfig.currency ?? "USD")
            : undefined,
        valueIsPercentPoints:
          formatConfig.type === "percent"
            ? formatConfig.valueIsPercentPoints
            : undefined,
        options: formatConfig.options,
      });
    }
    if (formatConfig.type === "date" || formatConfig.type === "datetime") {
      const parsedDate = asDate(value);
      if (parsedDate) {
        const preset = resolveDatePattern(formatConfig.pattern, formatConfig.type);
        const merged: Intl.DateTimeFormatOptions =
          preset || formatConfig.options
            ? { ...preset, ...formatConfig.options }
            : formatConfig.type === "date"
              ? { year: "numeric", month: "2-digit", day: "2-digit" }
              : { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };
        return getDateFormatter(formatConfig.locales, merged).format(parsedDate);
      }
    }
    return String(value ?? "");
  }

  /**
   * Resolve `cellClass` for a pinned row. We synthesise a minimal
   * context `{ getValue, value, row: null, column }`; cell-class
   * callbacks that read only the value (the common case) work
   * unchanged.
   */
  function computePinnedCellClass(
    rowData: TData,
    column: Column<TData>,
  ): string {
    const cellClass = column.columnDef.cellClass as
      | ((ctx: { getValue: () => unknown; value: unknown; row: null; column: Column<TData> }) => string | undefined | null)
      | undefined;
    if (typeof cellClass !== "function") return "";
    const value = getPinnedCellValue(rowData, column);
    const out = cellClass({ getValue: () => value, value, row: null, column });
    return out ? String(out) : "";
  }

  function isRowSelected(rowId: string) {
    return Boolean(rowSelectionState[rowId]);
  }

  function toggleRowSelectionById(rowId: string) {
    grid.setRowSelection((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }

  const headerSelectionState = $derived.by(() => {
    gridStateVersion;
    const selectable = allRows.filter((row) => !isGroupRow(row));
    if (!selectable.length) return "none";
    let selected = 0;
    for (const row of selectable) if (rowSelectionState[row.id]) selected += 1;
    if (selected === 0) return "none";
    return selected === selectable.length ? "all" : "some";
  });

  function toggleSelectAllRows() {
    const selectable = allRows.filter((row) => !isGroupRow(row));
    const select = headerSelectionState !== "all";
    grid.setRowSelection((prev) => {
      const next = { ...prev };
      for (const row of selectable) {
        if (select) next[row.id] = true;
        else delete next[row.id];
      }
      return next;
    });
  }

  /** True once a real interaction (click, keyboard nav, or a public-API
   *  call) has activated a cell. Distinct from `activeCell.cellId`, which
   *  the on-mount seed effect populates straight on the grid state without
   *  going through `setActiveCell` - so it can't tell a seeded (0,0) apart
   *  from a user-focused (0,0). The fill handle keys off this flag so it
   *  stays hidden until the user actually selects something. */
  let userHasActivatedCell = $state(false);

  function setActiveCell(rowIndex: number, colIndex: number) {
    userHasActivatedCell = true;
    grid.setActiveCell({
      rowIndex,
      colIndex,
      cellId: getGridCellDomId("svgrid", rowIndex, colIndex),
    });
    // Notify consumers (toolbars, ribbons) so they stay synced without
    // having to listen on the DOM. Fired on EVERY active-cell move -
    // click, arrow key, Tab, Enter, page-up/down, fill release.
    if (props.onActiveCellChange) {
      const column = allColumns[colIndex];
      props.onActiveCellChange({
        rowIndex,
        colIndex,
        columnId: column?.id ?? "",
      });
    }
  }

  function scrollActiveCellIntoView(rowIndex: number, colIndex: number) {
    if (!scrollContainer) return;
    if (rowIndex < 0 || rowIndex >= allRows.length) return;
    if (colIndex < 0 || colIndex >= allColumns.length) return;

    if (rowVirtualizationEnabled) {
      // Scroll only when the target row is not already fully visible. The grid
      // header is sticky, so the usable row area starts below it.
      const rowHeight = props.rowHeight ?? 36;
      const headerHeight = theadEl?.offsetHeight ?? 0;
      const rowTop = rowIndex * rowHeight;
      const rowBottom = rowTop + rowHeight;
      const currentTop = scrollContainer.scrollTop;
      const clientHeight = scrollContainer.clientHeight;
      let nextTop = currentTop;
      if (rowTop < currentTop) {
        nextTop = rowTop;
      } else if (headerHeight + rowBottom - currentTop > clientHeight) {
        nextTop = headerHeight + rowBottom - clientHeight;
      }
      nextTop = Math.max(nextTop, 0);
      if (nextTop !== currentTop) {
        scrollContainer.scrollTop = nextTop;
        virtualizer.setScrollOffset(nextTop);
        scrollVersion += 1;
      }
    } else {
      // Non-virtualized mode: the cell's <td> is already in the DOM.
      // Read its actual rect and bring it into view when it overlaps
      // with the sticky header or is past the visible bottom. Without
      // this branch, arrow keys move the active cell off-screen and
      // the scrollbar never follows.
      const cellEl = scrollContainer.querySelector<HTMLElement>(
        `td[data-svgrid-row="${rowIndex}"][data-svgrid-col="${colIndex}"]`,
      );
      if (cellEl) {
        const headerHeight   = theadEl?.offsetHeight ?? 0;
        const containerRect  = scrollContainer.getBoundingClientRect();
        const cellRect       = cellEl.getBoundingClientRect();
        const cellTopInView  = cellRect.top    - containerRect.top;
        const cellBotInView  = cellRect.bottom - containerRect.top;
        const clientHeight   = scrollContainer.clientHeight;
        let nextTop = scrollContainer.scrollTop;
        if (cellTopInView < headerHeight) {
          nextTop = scrollContainer.scrollTop + cellTopInView - headerHeight;
        } else if (cellBotInView > clientHeight) {
          nextTop = scrollContainer.scrollTop + cellBotInView - clientHeight;
        }
        nextTop = Math.max(nextTop, 0);
        if (nextTop !== scrollContainer.scrollTop) {
          scrollContainer.scrollTop = nextTop;
          scrollVersion += 1;
        }
      }
    }

    const item = renderedColumnItems.find((entry) => entry.index === colIndex);
    const fallbackWidth = props.columnWidth ?? 140;
    const cellStart = item?.start ?? colIndex * fallbackWidth;
    const cellEnd = cellStart + (item?.size ?? fallbackWidth);
    const viewStart = scrollContainer.scrollLeft;
    const viewEnd = viewStart + scrollContainer.clientWidth;
    if (cellStart < viewStart) {
      scrollContainer.scrollLeft = cellStart;
      scrollVersion += 1;
    } else if (cellEnd > viewEnd) {
      scrollContainer.scrollLeft = cellEnd - scrollContainer.clientWidth;
      scrollVersion += 1;
    }
  }

  /** Width before fitColumns scaling - what the columnDef/user actually set. */
  function getColumnBaseWidth(columnId: string) {
    if (columnWidths[columnId] !== undefined) return columnWidths[columnId];
    const column = grid.getAllColumns().find((c) => c.id === columnId);
    if (column?.columnDef.width !== undefined) return column.columnDef.width;
    return props.columnWidth ?? 140;
  }

  /**
   * Per-column fitted widths when `fitColumns` is on. Computed in one pass
   * so the LAST auto-sized column can absorb the rounding residue and make
   * the total match the target viewport width exactly. Without this the
   * per-column `Math.round` calls leave a 2-6 px residue and the user sees
   * a small horizontal scrollbar even though every column is "fitted".
   *
   * User-resized columns (entries in `columnWidths`) are taken at face
   * value and only the auto-sized columns share the scale + residue.
   *
   * Returns `null` when fit scaling is not in effect (off, no room, total
   * already >= target). Callers then fall back to the base width.
   */
  const fittedColumnWidths = $derived.by(() => {
    // Track viewport size (not scrollVersion) so we don't recompute on
    // every scroll - only when the container actually resizes.
    viewportVersion;
    if (!props.fitColumns) return null;
    const cols = grid.getAllColumns().filter((c) => !hiddenColumns[c.id]);
    if (!cols.length) return null;
    const rowNumberWidth = showRowNumbersEffective ? rowNumberColumnWidth : 0;
    const selectionWidth = showRowSelectionEffective ? selectionColumnWidth : 0;
    const target =
      (scrollContainer?.clientWidth ?? 0) - rowNumberWidth - selectionWidth;
    if (target <= 0) return null;

    // Split base widths into pinned (user-resized) and scalable.
    let pinnedTotal = 0;
    let scalableBase = 0;
    const scalableIds: string[] = [];
    for (const c of cols) {
      const w = getColumnBaseWidth(c.id);
      if (columnWidths[c.id] !== undefined) pinnedTotal += w;
      else {
        scalableBase += w;
        scalableIds.push(c.id);
      }
    }
    const scalableTarget = target - pinnedTotal;
    if (scalableTarget <= 0 || scalableBase <= 0) return null;
    // Within 1px of target - no scaling needed.
    if (Math.abs(scalableBase - scalableTarget) <= 1) return null;
    // Shrink only by a modest amount (≥85% of natural). Beyond that, leave
    // natural widths and let the user scroll - squashing every column
    // tighter would hide content.
    const scale = scalableTarget / scalableBase;
    if (scale < 0.85) return null;

    const widths: Record<string, number> = {};
    let runningSum = 0;
    for (let i = 0; i < scalableIds.length - 1; i += 1) {
      const id = scalableIds[i]!;
      const w = Math.max(
        MIN_COLUMN_WIDTH,
        Math.round(getColumnBaseWidth(id) * scale),
      );
      widths[id] = w;
      runningSum += w;
    }
    // The last scalable column absorbs whatever the previous rounding left
    // behind, so `sum(widths) === scalableTarget` exactly.
    const lastId = scalableIds[scalableIds.length - 1]!;
    widths[lastId] = Math.max(MIN_COLUMN_WIDTH, scalableTarget - runningSum);
    return widths;
  });

  function getColumnWidth(columnId: string) {
    const fitted = fittedColumnWidths?.[columnId];
    if (fitted !== undefined && columnWidths[columnId] === undefined)
      return fitted;
    return getColumnBaseWidth(columnId);
  }

  let resizePendingWidth = 0;
  let resizeRaf: number | null = null;

  function startColumnResize(event: PointerEvent, columnId: string) {
    event.stopPropagation();
    event.preventDefault();
    resizingColumnId = columnId;
    resizeStartX = event.clientX;
    resizeStartWidth = getColumnWidth(columnId);
    document.addEventListener("pointermove", onColumnResizeMove);
    document.addEventListener("pointerup", endColumnResize);
    document.addEventListener("pointercancel", endColumnResize);
  }

  function onColumnResizeMove(event: PointerEvent) {
    if (!resizingColumnId) return;
    // Coalesce updates onto the animation frame: pointermove can fire many
    // times per frame, and each $state mutation triggers a full reactive
    // recompute of the column-layout pipeline. Without rAF coalescing the
    // grid stutters during the drag.
    resizePendingWidth = Math.max(
      MIN_COLUMN_WIDTH,
      resizeStartWidth + (event.clientX - resizeStartX),
    );
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      if (!resizingColumnId) return;
      columnWidths = {
        ...columnWidths,
        [resizingColumnId]: resizePendingWidth,
      };
    });
  }

  function endColumnResize() {
    if (resizeRaf !== null) {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = null;
    }
    if (resizingColumnId && resizePendingWidth) {
      // Make sure the final width is committed even if the last rAF was
      // canceled mid-flight.
      columnWidths = {
        ...columnWidths,
        [resizingColumnId]: resizePendingWidth,
      };
    }
    resizingColumnId = null;
    document.removeEventListener("pointermove", onColumnResizeMove);
    document.removeEventListener("pointerup", endColumnResize);
    document.removeEventListener("pointercancel", endColumnResize);
  }

  function setSelection(rowIndex: number, colIndex: number) {
    if (!enableCellSelectionEffective) return;
    const point = { rowIndex, colIndex };
    selectionRange = { anchor: point, focus: point };
  }

  function extendSelection(rowIndex: number, colIndex: number) {
    if (!enableCellSelectionEffective) return;
    const anchor = selectionRange.anchor ?? { rowIndex, colIndex };
    selectionRange = { anchor, focus: { rowIndex, colIndex } };
  }

  function isCellInSelectedRange(rowIndex: number, colIndex: number) {
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (!anchor || !focus) return false;
    const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
    const minCol = Math.min(anchor.colIndex, focus.colIndex);
    const maxCol = Math.max(anchor.colIndex, focus.colIndex);
    return (
      rowIndex >= minRow &&
      rowIndex <= maxRow &&
      colIndex >= minCol &&
      colIndex <= maxCol
    );
  }

  /**
   * Returns which sides of the selection rectangle a cell sits on, for the
   * Excel-style outline. Returns null when the cell is outside the range.
   */
  function getCellRangeEdges(rowIndex: number, colIndex: number) {
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (!anchor || !focus) return null;
    const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
    const minCol = Math.min(anchor.colIndex, focus.colIndex);
    const maxCol = Math.max(anchor.colIndex, focus.colIndex);
    if (
      rowIndex < minRow ||
      rowIndex > maxRow ||
      colIndex < minCol ||
      colIndex > maxCol
    ) {
      return null;
    }
    return {
      top: rowIndex === minRow,
      bottom: rowIndex === maxRow,
      left: colIndex === minCol,
      right: colIndex === maxCol,
    };
  }

  /** Where the fill handle should render: the bottom-right cell of the
   *  selection range (or the active cell if there's no range). Returns
   *  null when cell selection is off or there is no anchored selection. */
  const fillHandleCell = $derived.by(() => {
    if (!(props.enableCellSelection ?? false)) return null;
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (anchor && focus) {
      return {
        rowIndex: Math.max(anchor.rowIndex, focus.rowIndex),
        colIndex: Math.max(anchor.colIndex, focus.colIndex),
      };
    }
    const a = activeCell;
    // Only show the handle once the user (or the public API) has actually
    // activated a cell. The on-mount seed writes activeCell (0,0) directly
    // to the grid state, so `cellId` alone can't gate this - see
    // `userHasActivatedCell`.
    if (!userHasActivatedCell || !a) return null;
    return { rowIndex: a.rowIndex, colIndex: a.colIndex };
  });

  /** Returns true when the given cell is inside the fill-drag preview
   *  range BUT outside the original source range. Used to paint a
   *  dashed-outline preview while the user is dragging the handle. */
  function isInFillPreview(rowIndex: number, colIndex: number) {
    const d = fillDrag;
    if (!d) return false;
    const minR = Math.min(d.sourceMinRow, d.targetRow);
    const maxR = Math.max(d.sourceMaxRow, d.targetRow);
    const minC = Math.min(d.sourceMinCol, d.targetCol);
    const maxC = Math.max(d.sourceMaxCol, d.targetCol);
    if (
      rowIndex < minR ||
      rowIndex > maxR ||
      colIndex < minC ||
      colIndex > maxC
    )
      return false;
    const inSource =
      rowIndex >= d.sourceMinRow &&
      rowIndex <= d.sourceMaxRow &&
      colIndex >= d.sourceMinCol &&
      colIndex <= d.sourceMaxCol;
    return !inSource;
  }

  /** Look up a column by id without depending on `buildApi`'s private
   *  closure (those helpers don't exist at this scope). */
  function findColumnById(columnId: string) {
    return allColumns.find((c) => c.id === columnId);
  }

  /** Read the raw underlying value for the cell at (rowIndex, columnId)
   *  for pattern extraction. */
  function readCellRaw(rowIndex: number, columnId: string): unknown {
    const row = internalData[rowIndex];
    const column = findColumnById(columnId);
    if (!row || !column?.columnDef.field) return undefined;
    return (row as Record<string, unknown>)[column.columnDef.field];
  }

  /** Write a value into (rowIndex, columnId) without going through the
   *  edit lifecycle. Fires `onCellValueChange` per write so consumers
   *  can react (formula recompute, autosave, etc.). */
  function writeCellRaw(rowIndex: number, columnId: string, value: unknown) {
    const row = internalData[rowIndex];
    const column = findColumnById(columnId);
    if (!row || !column?.columnDef.field) return;
    const field = column.columnDef.field;
    const oldValue = (row as Record<string, unknown>)[field];
    if (oldValue === value) return;
    // Resolve the row's id BEFORE swapping internalData - otherwise the
    // recomputed `allRows` references the new row object and the
    // `r.original === row` lookup fails, dropping our edit out of the
    // `editedCellValues` map (which getCellDisplayValue consults first).
    const rowId = allRows.find((r) => r.original === row)?.id;
    const next = internalData.slice() as Array<TData>;
    next[rowIndex] = { ...row, [field]: value } as TData;
    internalData = next;
    if (rowId) {
      const key = getCellKey(rowId, columnId);
      editedCellValues = { ...editedCellValues, [key]: value };
    }
    props.onCellValueChange?.({
      rowIndex,
      columnId,
      oldValue,
      newValue: value,
      row: next[rowIndex] as TData,
    });
  }

  /** Apply the pattern fill on pointerup. Each NEW row (or column) is
   *  filled from a pattern derived from the matching column (or row) of
   *  the source. Handles all four drag directions. */
  function applyFillPattern() {
    const d = fillDrag;
    if (!d) return;
    // Clear fillDrag FIRST so a thrown error doesn't leave the grid
    // stuck tracking the pointer.
    fillDrag = null;
    const newMinRow = Math.min(d.sourceMinRow, d.targetRow);
    const newMaxRow = Math.max(d.sourceMaxRow, d.targetRow);
    const newMinCol = Math.min(d.sourceMinCol, d.targetCol);
    const newMaxCol = Math.max(d.sourceMaxCol, d.targetCol);

    const verticalExtension =
      newMaxRow > d.sourceMaxRow || newMinRow < d.sourceMinRow;
    const horizontalExtension =
      newMaxCol > d.sourceMaxCol || newMinCol < d.sourceMinCol;

    if (verticalExtension) {
      // For each column in the source range, build a pattern from the
      // column's source values and apply to the new rows (above or below).
      for (let c = d.sourceMinCol; c <= d.sourceMaxCol; c += 1) {
        const column = allColumns[c];
        if (!column?.columnDef.field) continue;
        if (column.columnDef.editable === false) continue;
        const sourceColValues: unknown[] = [];
        for (let r = d.sourceMinRow; r <= d.sourceMaxRow; r += 1) {
          sourceColValues.push(readCellRaw(r, column.id));
        }
        if (newMaxRow > d.sourceMaxRow) {
          const targetRows = newMaxRow - d.sourceMaxRow;
          const fills = buildFillPattern(sourceColValues, targetRows);
          for (let i = 0; i < targetRows; i += 1) {
            const targetRow = d.sourceMaxRow + 1 + i;
            if (isCellEditableAt(targetRow, c))
              writeCellRaw(targetRow, column.id, fills[i]);
          }
        }
        if (newMinRow < d.sourceMinRow) {
          // Filling upward - reverse-extrapolate.
          const reversed = sourceColValues.slice().reverse();
          const targetRows = d.sourceMinRow - newMinRow;
          const fills = buildFillPattern(reversed, targetRows);
          for (let i = 0; i < targetRows; i += 1) {
            const targetRow = d.sourceMinRow - 1 - i;
            if (isCellEditableAt(targetRow, c))
              writeCellRaw(targetRow, column.id, fills[i]);
          }
        }
      }
    } else if (horizontalExtension) {
      // For each row in source range, build pattern from the row's source
      // values across columns and apply to new columns.
      for (let r = d.sourceMinRow; r <= d.sourceMaxRow; r += 1) {
        const sourceRowValues: unknown[] = [];
        for (let c = d.sourceMinCol; c <= d.sourceMaxCol; c += 1) {
          const col = allColumns[c];
          if (!col) continue;
          sourceRowValues.push(readCellRaw(r, col.id));
        }
        if (newMaxCol > d.sourceMaxCol) {
          const targetCols = newMaxCol - d.sourceMaxCol;
          const fills = buildFillPattern(sourceRowValues, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMaxCol + 1 + i;
            const col = allColumns[targetCol];
            if (col && isCellEditableAt(r, targetCol))
              writeCellRaw(r, col.id, fills[i]);
          }
        }
        if (newMinCol < d.sourceMinCol) {
          const reversed = sourceRowValues.slice().reverse();
          const targetCols = d.sourceMinCol - newMinCol;
          const fills = buildFillPattern(reversed, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMinCol - 1 - i;
            const col = allColumns[targetCol];
            if (col && isCellEditableAt(r, targetCol))
              writeCellRaw(r, col.id, fills[i]);
          }
        }
      }
    }

    // Extend the selection to the new range so the user can immediately
    // see what got filled.
    selectionRange = {
      anchor: { rowIndex: newMinRow, colIndex: newMinCol },
      focus: { rowIndex: newMaxRow, colIndex: newMaxCol },
    };
  }

  /** Clear the underlying value of every cell in the current selection
   *  range (or just the active cell when nothing is range-selected).
   *  Mirrors Excel's `Delete` key - values go to `null`, formatting and
   *  the row identity stay intact. */
  function clearSelectedCellValues() {
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (anchor && focus) {
      const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
      const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
      const minCol = Math.min(anchor.colIndex, focus.colIndex);
      const maxCol = Math.max(anchor.colIndex, focus.colIndex);
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          const col = allColumns[c];
          if (col?.columnDef.field && isCellEditableAt(r, c)) {
            writeCellRaw(r, col.id, null);
          }
        }
      }
      return;
    }
    const a = grid.getState().activeCell;
    if (a && userHasActivatedCell) {
      const col = allColumns[a.colIndex];
      if (col?.columnDef.field && isCellEditableAt(a.rowIndex, a.colIndex)) {
        writeCellRaw(a.rowIndex, col.id, null);
      }
    }
  }

  /** Fill-handle pointerdown - seed the drag with the current selection
   *  range (or active cell as a 1x1) and start tracking the pointer. */
  function startFillDrag(
    event: PointerEvent,
    rowIndex: number,
    colIndex: number,
  ) {
    event.stopPropagation();
    event.preventDefault();
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (anchor && focus) {
      fillDrag = {
        sourceMinRow: Math.min(anchor.rowIndex, focus.rowIndex),
        sourceMaxRow: Math.max(anchor.rowIndex, focus.rowIndex),
        sourceMinCol: Math.min(anchor.colIndex, focus.colIndex),
        sourceMaxCol: Math.max(anchor.colIndex, focus.colIndex),
        targetRow: rowIndex,
        targetCol: colIndex,
      };
    } else {
      fillDrag = {
        sourceMinRow: rowIndex,
        sourceMaxRow: rowIndex,
        sourceMinCol: colIndex,
        sourceMaxCol: colIndex,
        targetRow: rowIndex,
        targetCol: colIndex,
      };
    }
    // Don't `setPointerCapture` - we use `elementFromPoint` during the
    // drag to find the hovered cell, and capture would route the events
    // back to the handle, breaking the lookup. Window-level handlers
    // (`onWindowPointerMove` / `endDragSelection`) keep tracking.
  }

  /** Pointermove during fill-drag. We don't get cell coords from the
   *  event directly - find the td under the pointer via elementFromPoint
   *  and read its data-svgrid-row / data-svgrid-col attributes. */
  function onFillPointerMove(event: PointerEvent) {
    if (!fillDrag) return;
    const el = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;
    const cell = el?.closest(
      "td[data-svgrid-row][data-svgrid-col]",
    ) as HTMLElement | null;
    if (!cell) return;
    const r = Number(cell.dataset.svgridRow);
    const c = Number(cell.dataset.svgridCol);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    if (r === fillDrag.targetRow && c === fillDrag.targetCol) return;
    fillDrag = { ...fillDrag, targetRow: r, targetCol: c };
  }

  function onFillPointerUp() {
    if (!fillDrag) return;
    applyFillPattern();
  }

  function toggleBooleanCell(rowIndex: number, colIndex: number) {
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!row || !column) return;
    if (!column.columnDef.field) return;

    const baseValue = getColumnBaseValue(row, column);
    const currentValue = Boolean(
      getCellDisplayValue(row.id, column.id, baseValue),
    );
    const nextValue = !currentValue;
    (row.original as Record<string, unknown>)[column.columnDef.field] =
      nextValue;

    const key = getCellKey(row.id, column.id);
    editedCellValues = {
      ...editedCellValues,
      [key]: nextValue,
    };
    grid.store.setState((prev) => ({ ...prev }));
  }

  function onCellPointerDown(
    rowIndex: number,
    colIndex: number,
    event: PointerEvent,
  ) {
    if (event.button !== 0) return;
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!row || !column || isGroupRow(row)) return;
    const cellValue = getCellDisplayValue(
      row.id,
      column.id,
      getColumnBaseValue(row, column),
    );
    const isCheckboxColumn =
      column.columnDef.editorType === "checkbox" ||
      typeof cellValue === "boolean";
    if (isCheckboxColumn) return; // let onCellClick toggle the checkbox

    const active = grid.getState().activeCell;
    activeAtPointerDown = active
      ? { rowIndex: active.rowIndex, colIndex: active.colIndex }
      : null;
    if (event.shiftKey) {
      extendSelection(rowIndex, colIndex);
      setActiveCell(rowIndex, colIndex);
    } else {
      setActiveCell(rowIndex, colIndex);
      setSelection(rowIndex, colIndex);
      isDraggingSelection = true;
    }
  }

  function onCellPointerEnter(rowIndex: number, colIndex: number) {
    if (!isDraggingSelection) return;
    const row = allRows[rowIndex];
    if (!row || isGroupRow(row)) return;
    extendSelection(rowIndex, colIndex);
    setActiveCell(rowIndex, colIndex);
  }

  function endDragSelection() {
    isDraggingSelection = false;
    // Also commit a fill-handle drag if one was in progress - the user
    // released the mouse, time to apply the pattern.
    if (fillDrag) onFillPointerUp();
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (fillDrag) {
      onFillPointerMove(event);
      return;
    }
    if (!isDraggingSelection) return;
    // Safety: if no mouse button is held the drag is over (we may have
    // missed pointerup because the user lifted outside the window).
    if (event.buttons === 0) {
      endDragSelection();
    }
  }

  function onCellClick(rowIndex: number, colIndex: number) {
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!row || !column) return;

    gridRootEl?.focus({ preventScroll: true });

    if (isGroupRow(row)) {
      setActiveCell(rowIndex, colIndex);
      row.toggleExpanded?.();
      return;
    }

    const baseValue = getColumnBaseValue(row, column);
    const cellValue = getCellDisplayValue(row.id, column.id, baseValue);

    // Emit the public click events for data cells/rows (before any
    // checkbox-toggle / edit-entry side effects below).
    props.onCellClick?.({
      rowIndex,
      colIndex,
      columnId: column.id,
      value: cellValue,
      row: row.original as TData,
    });
    props.onRowClick?.({
      rowIndex,
      columnId: column.id,
      row: row.original as TData,
    });

    const isCheckboxColumn =
      column.columnDef.editorType === "checkbox" ||
      typeof cellValue === "boolean";

    if (isCheckboxColumn) {
      toggleBooleanCell(rowIndex, colIndex);
      setActiveCell(rowIndex, colIndex);
      setSelection(rowIndex, colIndex);
      editingCell = null;
      return;
    }

    // onCellPointerDown already set active+selection for data cells. Only
    // decide whether to enter edit mode (click on the previously-active cell).
    const wasActive =
      activeAtPointerDown !== null &&
      activeAtPointerDown.rowIndex === rowIndex &&
      activeAtPointerDown.colIndex === colIndex;
    if (wasActive && editingEnabled) {
      onCellDoubleClick(rowIndex, colIndex);
      return;
    }
    editingCell = null;
  }

  /**
   * Real double-click handler wired to the cell `ondblclick`. Emits the
   * public double-click events (independent of editability) and then runs
   * the edit-entry logic. Kept separate from `onCellDoubleClick` so the
   * single-click-to-edit path in `onCellClick` does NOT emit a dblclick.
   */
  function emitCellDoubleClick(rowIndex: number, colIndex: number) {
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (row && column && !isGroupRow(row)) {
      const value = getCellDisplayValue(
        row.id,
        column.id,
        getColumnBaseValue(row, column),
      );
      props.onCellDoubleClick?.({
        rowIndex,
        colIndex,
        columnId: column.id,
        value,
        row: row.original as TData,
      });
      props.onRowDoubleClick?.({
        rowIndex,
        columnId: column.id,
        row: row.original as TData,
      });
    }
    onCellDoubleClick(rowIndex, colIndex);
  }

  function copySelectionToClipboard() {
    const anchor = selectionRange.anchor;
    const focus = selectionRange.focus;
    if (!anchor || !focus) return;
    const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
    const minCol = Math.min(anchor.colIndex, focus.colIndex);
    const maxCol = Math.max(anchor.colIndex, focus.colIndex);
    const lines: Array<string> = [];
    for (let r = minRow; r <= maxRow; r += 1) {
      const row = allRows[r];
      if (!row || isGroupRow(row)) continue;
      const cells: Array<string> = [];
      for (let c = minCol; c <= maxCol; c += 1) {
        const column = allColumns[c];
        if (!column) {
          cells.push("");
          continue;
        }
        const base = getColumnBaseValue(row, column);
        const display = getCellDisplayValue(row.id, column.id, base);
        cells.push(String(display ?? ""));
      }
      lines.push(cells.join("\t"));
    }
    const text = lines.join("\n");
    void navigator.clipboard?.writeText(text).catch(() => {});
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.readText) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const anchor = selectionRange.anchor ?? grid.getState().activeCell;
    if (!anchor) return;
    const focus = selectionRange.focus ?? anchor;
    const startRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const startCol = Math.min(anchor.colIndex, focus.colIndex);
    const endRow   = Math.max(anchor.rowIndex, focus.rowIndex);
    const endCol   = Math.max(anchor.colIndex, focus.colIndex);
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    // Excel/Sheets behaviour: when the clipboard holds a single cell and
    // the selection is a range, fill the entire range with that value.
    // For larger clipboards (multi-row/col TSV), paste at the top-left
    // corner and let the clipboard determine the span (the original
    // behaviour).
    const clipboardIsSingleCell =
      lines.length === 1 && (lines[0]?.split("\t").length ?? 0) === 1;
    const selectionIsRange = startRow !== endRow || startCol !== endCol;
    const fillRange = clipboardIsSingleCell && selectionIsRange;

    const rowSpan = fillRange ? endRow - startRow + 1 : lines.length;
    const colSpan = fillRange
      ? endCol - startCol + 1
      : Math.max(...lines.map((l) => l.split("\t").length));

    const next = internalData.slice() as Array<TData>;
    for (let i = 0; i < rowSpan; i += 1) {
      const targetRowIndex = startRow + i;
      const row = allRows[targetRowIndex];
      if (!row || isGroupRow(row)) continue;
      // Map the visible row back to its index in the data array via row.id (default = String(index)).
      const dataIndex = Number(row.id);
      if (
        !Number.isInteger(dataIndex) ||
        dataIndex < 0 ||
        dataIndex >= next.length
      )
        continue;
      const originalRow = next[dataIndex];
      if (!originalRow) continue;
      const sourceCells = fillRange
        ? null
        : lines[i]?.split("\t") ?? [];
      const updated: Record<string, unknown> = {
        ...(originalRow as Record<string, unknown>),
      };
      for (let j = 0; j < colSpan; j += 1) {
        const column = allColumns[startCol + j];
        if (!column?.columnDef.field) continue;
        if (!isCellEditableAt(targetRowIndex, startCol + j)) continue;
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        const raw = fillRange ? lines[0]! : sourceCells?.[j] ?? "";
        updated[column.columnDef.field] = parseEditorValue(editorType, raw);
      }
      next[dataIndex] = updated as TData;
    }
    internalData = next;
    grid.store.setState((prev) => ({ ...prev }));
  }

  /**
   * Clear every editable cell in the current selection range. Used by
   * Ctrl/Cmd+X (after a copy) and by the Delete / Backspace keys.
   * Returns true if anything was changed - the caller uses that to
   * decide whether to call `preventDefault()` and refresh the store.
   */
  function clearSelectedCells(): boolean {
    const anchor = selectionRange.anchor ?? grid.getState().activeCell;
    if (!anchor) return false;
    const focus = selectionRange.focus ?? anchor;
    const startRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const startCol = Math.min(anchor.colIndex, focus.colIndex);
    const endRow   = Math.max(anchor.rowIndex, focus.rowIndex);
    const endCol   = Math.max(anchor.colIndex, focus.colIndex);

    const next = internalData.slice() as Array<TData>;
    let mutated = false;
    for (let r = startRow; r <= endRow; r += 1) {
      const row = allRows[r];
      if (!row || isGroupRow(row)) continue;
      const dataIndex = Number(row.id);
      if (
        !Number.isInteger(dataIndex) ||
        dataIndex < 0 ||
        dataIndex >= next.length
      ) continue;
      const originalRow = next[dataIndex];
      if (!originalRow) continue;
      const updated: Record<string, unknown> = {
        ...(originalRow as Record<string, unknown>),
      };
      let rowChanged = false;
      for (let c = startCol; c <= endCol; c += 1) {
        const column = allColumns[c];
        if (!column?.columnDef.field) continue;
        if (!isCellEditableAt(r, c)) continue;
        // Clear means: empty string for text, undefined for everything
        // else. parseEditorValue handles the per-type coercion.
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        updated[column.columnDef.field] = parseEditorValue(editorType, "");
        rowChanged = true;
      }
      if (rowChanged) {
        next[dataIndex] = updated as TData;
        mutated = true;
      }
    }
    if (mutated) {
      internalData = next;
      grid.store.setState((prev) => ({ ...prev }));
    }
    return mutated;
  }

  async function cutSelectionToClipboard(): Promise<void> {
    // Cut = copy + clear. Wait for the copy to land on the clipboard so
    // a slow writeText can't race the clear and leave the user with no
    // way to undo via paste.
    copySelectionToClipboard();
    // Best-effort flush; clipboard.writeText is fire-and-forget but we
    // already kicked it off above. The clear is synchronous.
    clearSelectedCells();
  }

  function onCellDoubleClick(rowIndex: number, colIndex: number) {
    if (!editingEnabled) return;
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!row || !column) return;
    if (isGroupRow(row)) return;
    if (!isCellEditable(column, row)) return;
    if (editingCell?.rowId === row.id && editingCell?.columnId === column.id)
      return;
    const editorType = (column.columnDef.editorType ??
      "text") as CellEditorType;
    editorSelectAll = true;
    let initialValue = getCellDisplayValue(
      row.id,
      column.id,
      row.getCellValueByColumnId(column.id),
    );
    if (editorType === "list" || editorType === "chips") {
      if (column.columnDef.editorMultiple) {
        // Seed with an array so the editor can mutate slot-by-slot.
        initialValue = toValueArray(initialValue);
      } else if (Array.isArray(initialValue)) {
        initialValue = initialValue[0] ?? "";
      }
    }
    editingCell = {
      rowId: row.id,
      columnId: column.id,
      editorType,
      value: initialValue,
    };
    setActiveCell(rowIndex, colIndex);
    setSelection(rowIndex, colIndex);
  }

  /** Start editing seeded with a typed character (Excel-style type-to-edit). */
  function startEditingWithChar(
    rowIndex: number,
    colIndex: number,
    char: string,
  ): boolean {
    if (!editingEnabled) return false;
    const row = allRows[rowIndex];
    const column = allColumns[colIndex];
    if (!row || !column || isGroupRow(row)) return false;
    if (!isCellEditable(column, row)) return false;
    const editorType = (column.columnDef.editorType ??
      "text") as CellEditorType;
    if (
      editorType === "checkbox" ||
      editorType === "date" ||
      editorType === "datetime" ||
      editorType === "list" ||
      editorType === "chips"
    ) {
      return false;
    }
    if (editorType === "number" && !/[0-9.+\-]/.test(char)) return false;
    editorSelectAll = false;
    editingCell = {
      rowId: row.id,
      columnId: column.id,
      editorType,
      value: char,
    };
    setActiveCell(rowIndex, colIndex);
    setSelection(rowIndex, colIndex);
    return true;
  }

  function saveEditingCell() {
    if (!editingCell) return;
    const row = allRows.find((entry) => entry.id === editingCell?.rowId);
    const column = allColumns.find(
      (entry) => entry.id === editingCell?.columnId,
    );
    const parsedValue = parseEditorValue(
      editingCell.editorType,
      editingCell.value,
      {
        multiple: column?.columnDef.editorMultiple === true,
      },
    );
    let oldValue: unknown = undefined;
    if (row?.original && column?.columnDef.field) {
      oldValue = (row.original as Record<string, unknown>)[
        column.columnDef.field
      ];
      (row.original as Record<string, unknown>)[column.columnDef.field] =
        parsedValue;
    }
    const key = getCellKey(editingCell.rowId, editingCell.columnId);
    editedCellValues = {
      ...editedCellValues,
      [key]: parsedValue,
    };
    grid.store.setState((prev) => ({ ...prev }));
    // Record into the history at the current pointer. Any forward
    // history (steps the user could have redone) is truncated - this
    // is the standard "edit invalidates redo" rule.
    if (oldValue !== parsedValue && row?.original && column?.columnDef.field) {
      const step: HistoryStep = {
        rowId:    editingCell.rowId,
        columnId: editingCell.columnId,
        field:    column.columnDef.field as string,
        before:   oldValue,
        after:    parsedValue,
      }
      const truncated = history.slice(0, historyPtr + 1)
      truncated.push(step)
      // Cap the buffer at UNDO_LIMIT; drop the OLDEST entries so the
      // pointer stays valid relative to the newest steps.
      if (truncated.length > UNDO_LIMIT) {
        const drop = truncated.length - UNDO_LIMIT
        history = truncated.slice(drop)
        historyPtr = history.length - 1
      } else {
        history = truncated
        historyPtr = history.length - 1
      }
      historyVersion += 1
    }
    // Notify the consumer AFTER the row has been updated so any callback-
    // driven recompute (cascade totals, server save, undo stack) sees the
    // post-write state. `rowIndex` matches the position in `props.data`.
    if (props.onCellValueChange && row?.original && column) {
      const rowIndex = internalData.indexOf(row.original as TData);
      props.onCellValueChange({
        rowIndex,
        columnId: column.id,
        oldValue,
        newValue: parsedValue,
        row: row.original as TData,
      });
    }
    editingCell = null;
  }

  /** Apply an undo / redo step directly to the underlying row, bypassing
   *  the editor pipeline so we don't accidentally re-push to the stack. */
  function applyHistoryStep(step: HistoryStep, direction: 'undo' | 'redo') {
    const row = allRows.find((r) => r.id === step.rowId)
    const col = allColumns.find((c) => c.id === step.columnId)
    if (!row?.original || !col) return
    const value = direction === 'undo' ? step.before : step.after
    ;(row.original as Record<string, unknown>)[step.field] = value
    const key = getCellKey(step.rowId, step.columnId)
    editedCellValues = { ...editedCellValues, [key]: value }
    grid.store.setState((prev) => ({ ...prev }))
    if (props.onCellValueChange) {
      const rowIndex = internalData.indexOf(row.original as TData)
      props.onCellValueChange({
        rowIndex,
        columnId: step.columnId,
        oldValue: direction === 'undo' ? step.after : step.before,
        newValue: value,
        row: row.original as TData,
      })
    }
  }

  function updateEditingCellValue(value: string) {
    editingCell = editingCell ? { ...editingCell, value } : editingCell;
  }

  function onEditorKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      saveEditingCell();
      gridRootEl?.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      editingCell = null;
      gridRootEl?.focus({ preventScroll: true });
    }
  }

  function focusOnMount(node: HTMLInputElement | HTMLTextAreaElement) {
    const selectAll = editorSelectAll;
    requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      try {
        if (selectAll) {
          node.select();
        } else {
          const end = node.value.length;
          node.setSelectionRange(end, end);
        }
      } catch {
        /* date/number inputs may not support text selection */
      }
    });
  }

  function onHeaderSortClick(event: MouseEvent, columnId: string) {
    const column = allColumns.find((entry) => entry.id === columnId);
    if (!column?.getCanSort?.()) return;
    const clauses = grid.getState().sorting ?? [];
    const current = clauses.find(
      (entry: { id: string; desc: boolean }) => entry.id === columnId,
    );

    if (!event.shiftKey) {
      // Single-sort: cycle this column's direction and clear all other
      // sorts. Cycle order: none → asc → desc → none.
      const nextClause = !current
        ? [{ id: columnId, desc: false }]
        : current.desc
          ? []
          : [{ id: columnId, desc: true }];
      grid.store.setState((prev) => ({ ...prev, sorting: nextClause }));
      return;
    }

    // Shift-click: append/toggle as part of a multi-sort.
    const nextClause = !current
      ? [...clauses, { id: columnId, desc: false }]
      : current.desc
        ? clauses.filter((entry: { id: string }) => entry.id !== columnId)
        : clauses.map((entry: { id: string; desc: boolean }) =>
            entry.id === columnId ? { ...entry, desc: true } : entry,
          );
    grid.store.setState((prev) => ({ ...prev, sorting: nextClause }));
  }

  function onGridKeyDown(event: KeyboardEvent) {
    // Only the grid root drives navigation - keys on header buttons, menus,
    // or the cell editor are handled by those controls themselves.
    if (event.target !== event.currentTarget) return;
    if (editingCell) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const lower = event.key.toLowerCase();
      if (lower === "c") {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (lower === "v") {
        event.preventDefault();
        void pasteFromClipboard();
        return;
      }
      if (lower === "x") {
        event.preventDefault();
        void cutSelectionToClipboard();
        return;
      }
      // Ctrl+Z (Cmd+Z) undoes the most recent cell edit. Ctrl+Shift+Z
      // and Ctrl+Y both redo. Mirrors VSCode / Sheets / Excel.
      if (lower === "z" && !event.shiftKey) {
        event.preventDefault()
        if (historyPtr >= 0) {
          const step = history[historyPtr]
          if (step) {
            applyHistoryStep(step, 'undo')
            historyPtr -= 1
            historyVersion += 1
          }
        }
        return
      }
      if ((lower === "z" && event.shiftKey) || lower === "y") {
        event.preventDefault()
        if (historyPtr < history.length - 1) {
          const step = history[historyPtr + 1]
          if (step) {
            applyHistoryStep(step, 'redo')
            historyPtr += 1
            historyVersion += 1
          }
        }
        return
      }
      // Ctrl+F opens the find overlay.
      if (lower === "f") {
        event.preventDefault()
        findOpen = true
        return
      }
    }
    // Esc closes find when nothing else owns the key.
    if (event.key === "Escape" && findOpen) {
      event.preventDefault()
      findOpen = false
      return
    }

    // Delete / Backspace clears every editable cell in the selection
    // range. No clipboard interaction - this is the "blank the cells I
    // have selected" gesture, distinct from Ctrl/Cmd+X.
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      !event.ctrlKey && !event.metaKey && !event.altKey
    ) {
      if (clearSelectedCells()) {
        event.preventDefault();
        return;
      }
    }

    const current = grid.getState().activeCell ?? {
      rowIndex: 0,
      colIndex: 0,
      cellId: null,
    };

    if (event.key === "F2") {
      event.preventDefault();
      onCellDoubleClick(current.rowIndex, current.colIndex);
      return;
    }

    const intent = getKeyboardIntent(event);
    if (intent === "noop") {
      // A printable character on the active cell starts editing seeded with it.
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (
          startEditingWithChar(current.rowIndex, current.colIndex, event.key)
        ) {
          event.preventDefault();
        }
      }
      return;
    }
    event.preventDefault();

    if (intent === "clearCells") {
      // Excel `Delete` - clear contents of every cell in the selection
      // (or the active cell if no range). Formatting is left alone, only
      // the underlying value is wiped.
      clearSelectedCellValues();
      return;
    }

    if (intent === "activate") {
      const row = allRows[current.rowIndex];
      const column = allColumns[current.colIndex];
      if (event.key === " ") {
        row?.toggleSelected?.();
        return;
      }
      if (event.ctrlKey && row?.getCanExpand?.()) {
        row.toggleExpanded?.();
        return;
      }
      if (column?.columnDef.editorType === "checkbox") {
        toggleBooleanCell(current.rowIndex, current.colIndex);
        return;
      }
      onCellDoubleClick(current.rowIndex, current.colIndex);
      return;
    }

    const next = getNextActiveCell(current, intent, {
      maxRow: Math.max(allRows.length - 1, 0),
      maxCol: Math.max(allColumns.length - 1, 0),
      pageSize: grid.getState().pagination?.pageSize ?? 10,
    });
    setActiveCell(next.rowIndex, next.colIndex);
    scrollActiveCellIntoView(next.rowIndex, next.colIndex);
    // Shift extends the selection ONLY for arrow keys (Excel-style).
    // Shift+Enter / Shift+Tab just change direction; they don't grow the
    // range, otherwise hammering Shift+Tab to backspace through a row
    // would paint a creeping rectangle behind the cursor.
    const shouldExtend =
      event.shiftKey &&
      (intent === "moveLeft" ||
        intent === "moveRight" ||
        intent === "moveUp" ||
        intent === "moveDown");
    if (shouldExtend) extendSelection(next.rowIndex, next.colIndex);
    else setSelection(next.rowIndex, next.colIndex);
  }

  function changePage(delta: number) {
    grid.setPagination((prev) => ({
      ...prev,
      pageIndex: Math.max((prev?.pageIndex ?? 0) + delta, 0),
    }));
  }

  function goToPage(pageIndex: number) {
    grid.setPagination((prev) => ({
      ...prev,
      pageIndex: Math.max(0, pageIndex),
    }));
  }

  function setPageSize(pageSize: number) {
    grid.setPagination((prev) => {
      const oldSize = prev?.pageSize ?? 10;
      const oldIndex = prev?.pageIndex ?? 0;
      // Keep the first visible row in view when the page size changes.
      const firstVisibleRow = oldIndex * oldSize;
      return {
        ...prev,
        pageSize,
        pageIndex: Math.max(0, Math.floor(firstVisibleRow / pageSize)),
      };
    });
  }

  function updateFilterRow(columnId: string, value: string) {
    filterRowValues = { ...filterRowValues, [columnId]: value };
    const current = filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    filterMenuValues = {
      ...filterMenuValues,
      [columnId]: { ...current, value },
    };
  }

  function updateFilterOperator(columnId: string, operator: FilterOperator) {
    const current = filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    filterMenuValues = {
      ...filterMenuValues,
      [columnId]: { ...current, operator },
    };
  }

  function updateFilterMenuValue(columnId: string, value: string) {
    const current = filterMenuValues[columnId] ?? {
      operator: "contains" as const,
      value: "",
    };
    filterMenuValues = {
      ...filterMenuValues,
      [columnId]: { ...current, value },
    };
    filterRowValues = { ...filterRowValues, [columnId]: value };
  }

  /** Upper-bound input for the `between` operator. Only relevant when
   *  the column's current operator is `between`; harmless to call
   *  otherwise. */
  function updateFilterMenuValueTo(columnId: string, valueTo: string) {
    const current = filterMenuValues[columnId] ?? {
      operator: "between" as const,
      value: "",
    };
    filterMenuValues = {
      ...filterMenuValues,
      [columnId]: { ...current, valueTo },
    };
  }

  function toggleCheckboxWithKeyboard(
    event: KeyboardEvent,
    toggle: () => void,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  }

  function getColumnAccessorValue(rowData: TData, column: Column<TData>) {
    const def = column.columnDef;
    if (def.accessorFn) return def.accessorFn(rowData);
    if (def.field) return rowData[def.field];
    return undefined;
  }

  const fallbackOperatorOption: FilterOption = {
    value: "contains",
    label: "Contains",
    iconName: "op-contains",
  };

  function operatorOption(value: FilterOperator): FilterOption {
    return (
      filterOperatorOptions.find((option) => option.value === value) ??
      fallbackOperatorOption
    );
  }

  /** Returns the operators that make sense for the given column's data type. */
  function operatorsForColumn(
    column: Column<TData> | undefined,
  ): Array<FilterOption> {
    const editorType = column?.columnDef.editorType ?? "text";
    const ids =
      editorType === "number"
        ? NUMBER_OPERATORS
        : editorType === "date" || editorType === "datetime"
          ? DATE_OPERATORS
          : editorType === "checkbox"
            ? CHECKBOX_OPERATORS
            : TEXT_OPERATORS;
    return ids
      .map((id) => filterOperatorOptions.find((option) => option.value === id))
      .filter((option): option is FilterOption => Boolean(option));
  }

  /** Default operator for a column (first one valid for its type). */
  function defaultOperatorFor(
    column: Column<TData> | undefined,
  ): FilterOperator {
    return operatorsForColumn(column)[0]?.value ?? "contains";
  }

  /** Date columns get friendlier labels for "less / greater than". */
  function operatorLabelFor(
    option: FilterOption,
    column: Column<TData> | undefined,
  ): string {
    const editorType = column?.columnDef.editorType;
    if (editorType === "date" || editorType === "datetime") {
      if (option.value === "lessThan") return "Before";
      if (option.value === "greaterThan") return "After";
    }
    return option.label;
  }

  function isColumnFiltered(columnId: string) {
    if (valueFilters[columnId]) return true;
    const menuFilter = filterMenuValues[columnId];
    return Boolean(
      menuFilter &&
        (menuFilter.operator === "isBlank" || menuFilter.value.trim()),
    );
  }

  function clampMenuX(x: number, width: number) {
    return Math.max(8, Math.min(x, window.innerWidth - width - 8));
  }

  function closeMenus() {
    columnMenuFor = null;
    filterMenuFor = null;
    operatorMenuFor = null;
    chooseColumnsPos = null;
  }

  /**
   * Lazily-created canvas used to measure text width via the 2D context.
   * Canvas measurement bypasses the cell's `overflow: hidden; white-space:
   * nowrap` constraint, which makes the body's `scrollWidth` useless here.
   */
  let measureCanvas: HTMLCanvasElement | null = null;
  function measureText(text: string, font: string): number {
    if (!text) return 0;
    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) return 0;
    ctx.font = font;
    return ctx.measureText(text).width;
  }

  /** Snap a column to the width of its widest visible cell (header + body). */
  function autosizeColumn(columnId: string) {
    if (!gridRootEl) return;
    const sampleCell = gridRootEl.querySelector<HTMLElement>(
      `[data-col-id="${CSS.escape(columnId)}"]`,
    );
    if (!sampleCell) return;
    const cellFont = getComputedStyle(sampleCell).font;

    let max = MIN_COLUMN_WIDTH;
    const header = gridRootEl.querySelector<HTMLElement>(
      `[data-svgrid-header-col="${CSS.escape(columnId)}"]`,
    );
    if (header) {
      const labelEl = header.querySelector<HTMLElement>(
        ".sv-grid-header-label",
      );
      const target = labelEl ?? header;
      const text = target.textContent ?? "";
      // +70 reserves room for sort indicator + funnel + 3-dot menu button
      max = Math.max(
        max,
        measureText(text, getComputedStyle(target).font) + 70,
      );
    }

    const cells = gridRootEl.querySelectorAll<HTMLElement>(
      `[data-col-id="${CSS.escape(columnId)}"]`,
    );
    cells.forEach((cell) => {
      const text = cell.textContent ?? "";
      const w = measureText(text, cellFont);
      if (w > max) max = w;
    });

    // cell horizontal padding (~16px) + 8px breathing room
    columnWidths = {
      ...columnWidths,
      [columnId]: Math.max(MIN_COLUMN_WIDTH, Math.ceil(max) + 24),
    };
  }

  function autosizeAllColumns() {
    for (const column of allColumns) autosizeColumn(column.id);
  }

  function resetColumns() {
    columnWidths = {};
    hiddenColumns = {};
    columnPinning = { left: [], right: [] };
  }

  function openChooseColumns(event: MouseEvent) {
    event.stopPropagation();
    // Submenu behavior: keep the parent operations menu open and float the
    // Choose Columns panel out to the right of it (AG-Grid style). Falls
    // back to below the item if the popover would clip the viewport.
    const trigger = event.currentTarget as HTMLElement;
    const menuEl = trigger.closest(".sv-grid-menu") as HTMLElement | null;
    const anchor = (menuEl ?? trigger).getBoundingClientRect();
    const panelWidth = 240;
    const wantRight = anchor.right + 4;
    const x =
      wantRight + panelWidth + 8 > window.innerWidth
        ? clampMenuX(anchor.left - panelWidth - 4, panelWidth)
        : clampMenuX(wantRight, panelWidth);
    chooseColumnsPos = { x, y: anchor.top };
  }

  function openColumnMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = columnMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    columnMenuPos = {
      x: clampMenuX(rect.right - 240, 240),
      y: rect.bottom + 4,
    };
    columnMenuFor = columnId;
  }

  function openFilterMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = filterMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;

    // If the consumer is running in row-mode (or any mode where the
    // funnel popover wouldn't render), redirect the click to the
    // inline filter input for this column. Without this the funnel
    // would be a dead button - it visibly clicks but nothing happens
    // because the menu is gated behind `showColumnFiltersEffective`.
    if (!showColumnFiltersEffective && showFilterRowEffective) {
      // Find the row-mode filter input and focus it. The input is
      // tagged with `data-svgrid-filter-col` so we can target by id
      // without depending on column position.
      const input = scrollContainer?.querySelector<HTMLInputElement>(
        `[data-svgrid-filter-col="${cssEscape(columnId)}"]`,
      );
      if (input) {
        input.focus();
        input.select();
        // Brief pulse so the user sees where focus landed.
        input.classList.add("sv-grid-filter-value-pulse");
        setTimeout(() => input.classList.remove("sv-grid-filter-value-pulse"), 700);
      }
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    filterMenuPos = {
      x: clampMenuX(rect.right - 260, 260),
      y: rect.bottom + 4,
    };
    columnMenuSearch = "";
    filterMenuFor = columnId;
  }
  function cssEscape(s: string): string {
    return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"');
  }

  function openOperatorMenu(event: MouseEvent, columnId: string) {
    event.stopPropagation();
    const wasOpen = operatorMenuFor === columnId;
    closeMenus();
    if (wasOpen) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    operatorMenuPos = { x: clampMenuX(rect.left, 184), y: rect.bottom + 4 };
    operatorMenuFor = columnId;
  }

  function sortColumnFromMenu(columnId: string, desc: boolean) {
    grid.store.setState((prev) => ({
      ...prev,
      sorting: [{ id: columnId, desc }],
    }));
    closeMenus();
  }

  function clearColumnSort(columnId: string) {
    grid.store.setState((prev) => ({
      ...prev,
      sorting: (prev.sorting ?? []).filter(
        (entry: { id: string }) => entry.id !== columnId,
      ),
    }));
    closeMenus();
  }

  function groupByColumnFromMenu(columnId: string) {
    const current = grid.getState().grouping ?? [];
    if (current.includes(columnId)) {
      closeMenus();
      return;
    }
    grid.setGrouping([...current, columnId]);
    closeMenus();
  }

  function clearGroupingFromMenu(columnId: string) {
    const current = grid.getState().grouping ?? [];
    grid.setGrouping(current.filter((id: string) => id !== columnId));
    closeMenus();
  }

  /**
   * Range buckets for the value-facet list.
   *
   * Numeric and date columns with many distinct values would otherwise
   * paint thousands of single-value checkboxes in the filter menu -
   * unusable. When a column's `editorType` is `'number' | 'date' |
   * 'datetime'` AND it has more than BUCKET_THRESHOLD distinct values,
   * we collapse the facet list into BUCKET_COUNT equal-width ranges
   * (e.g. "1,000 - 1,500") and let the user check those.
   *
   * The bucket structure carries the numeric bounds so the row filter
   * can re-test each row's value against the selected ranges without
   * re-doing the bucket math.
   */
  type FacetBucket = {
    label: string;
    numericMin: number;
    numericMax: number;
    isLast: boolean;
    isDate: boolean;
  };
  const FACET_BUCKET_THRESHOLD = 30;
  const FACET_BUCKET_COUNT = 10;

  function isBucketableColumn(column: Column<TData>): { isDate: boolean } | null {
    const editorType = column.columnDef.editorType;
    if (editorType === "number") return { isDate: false };
    if (editorType === "date" || editorType === "datetime") return { isDate: true };
    return null;
  }

  function rawToNumber(raw: unknown, isDate: boolean): number {
    if (raw == null || raw === "") return Number.NaN;
    if (isDate) {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      const t = d.getTime();
      return Number.isFinite(t) ? t : Number.NaN;
    }
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : Number.NaN;
  }

  function formatFacetNumber(n: number): string {
    const abs = Math.abs(n);
    const maxFractionDigits =
      abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
    return n.toLocaleString(undefined, {
      maximumFractionDigits: maxFractionDigits,
    });
  }

  function formatFacetDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function buildBuckets(
    column: Column<TData>,
    isDate: boolean,
  ): Array<FacetBucket> | null {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const distinct = new Set<number>();
    for (const rowData of props.data) {
      const num = rawToNumber(getColumnAccessorValue(rowData, column), isDate);
      if (!Number.isFinite(num)) continue;
      distinct.add(num);
      if (num < min) min = num;
      if (num > max) max = num;
    }
    if (distinct.size <= FACET_BUCKET_THRESHOLD) return null;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max)
      return null;

    const span = max - min;
    const buckets: Array<FacetBucket> = [];
    for (let i = 0; i < FACET_BUCKET_COUNT; i += 1) {
      const lo = min + (span * i) / FACET_BUCKET_COUNT;
      const hi = min + (span * (i + 1)) / FACET_BUCKET_COUNT;
      const label = isDate
        ? `${formatFacetDate(lo)} – ${formatFacetDate(hi)}`
        : `${formatFacetNumber(lo)} – ${formatFacetNumber(hi)}`;
      buckets.push({
        label,
        numericMin: lo,
        numericMax: hi,
        isLast: i === FACET_BUCKET_COUNT - 1,
        isDate,
      });
    }
    return buckets;
  }

  function isInBucket(num: number, bucket: FacetBucket): boolean {
    if (!Number.isFinite(num)) return false;
    if (num < bucket.numericMin) return false;
    return bucket.isLast ? num <= bucket.numericMax : num < bucket.numericMax;
  }

  /** Buckets for every column that should be bucketed, computed once and
   *  reused by both the facet UI and the row filter. Computing them lazily
   *  in a $derived means columns with no filter menu open and no active
   *  filter never pay the iteration cost. */
  const facetBucketsByColumn = $derived.by(() => {
    const map = new Map<string, Array<FacetBucket>>();
    for (const column of allColumns) {
      const meta = isBucketableColumn(column);
      if (!meta) continue;
      const buckets = buildBuckets(column, meta.isDate);
      if (buckets) map.set(column.id, buckets);
    }
    return map;
  });

  const columnMenuFacetValues = $derived.by(() => {
    const columnId = filterMenuFor;
    if (!columnId) return [] as Array<string>;
    const column = allColumns.find((entry) => entry.id === columnId);
    if (!column) return [] as Array<string>;
    // Range-bucketed facets for numeric / date columns with many values.
    const buckets = facetBucketsByColumn.get(columnId);
    if (buckets) return buckets.map((b) => b.label);
    // Default: distinct-value facets.
    const seen = new Set<string>();
    for (const rowData of props.data) {
      seen.add(String(getColumnAccessorValue(rowData, column) ?? ""));
    }
    return Array.from(seen).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  });

  const columnMenuVisibleFacets = $derived.by(() => {
    const query = columnMenuSearch.trim().toLowerCase();
    if (!query) return columnMenuFacetValues;
    return columnMenuFacetValues.filter((value) =>
      value.toLowerCase().includes(query),
    );
  });

  function isFacetChecked(columnId: string, value: string) {
    const selected = valueFilters[columnId];
    return selected ? selected.has(value) : true;
  }

  function toggleFacetValue(columnId: string, value: string) {
    const allValues = columnMenuFacetValues;
    const next = new Set(valueFilters[columnId] ?? allValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === allValues.length) {
      const copy = { ...valueFilters };
      delete copy[columnId];
      valueFilters = copy;
    } else {
      valueFilters = { ...valueFilters, [columnId]: next };
    }
  }

  function isAllFacetsChecked(columnId: string) {
    const selected = valueFilters[columnId];
    return !selected || selected.size >= columnMenuFacetValues.length;
  }

  function toggleAllFacets(columnId: string) {
    if (isAllFacetsChecked(columnId)) {
      valueFilters = { ...valueFilters, [columnId]: new Set<string>() };
    } else {
      const copy = { ...valueFilters };
      delete copy[columnId];
      valueFilters = copy;
    }
  }

  function clearColumnFilter(columnId: string) {
    if (valueFilters[columnId]) {
      const next = { ...valueFilters };
      delete next[columnId];
      valueFilters = next;
    }
    if (filterMenuValues[columnId]) {
      const next = { ...filterMenuValues };
      delete next[columnId];
      filterMenuValues = next;
    }
    if (filterRowValues[columnId]) {
      const next = { ...filterRowValues };
      delete next[columnId];
      filterRowValues = next;
    }
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && (columnMenuFor || operatorMenuFor)) {
      closeMenus();
    }
  }

  function columnDefMatchesId(
    def: ColumnDef<TFeatures, TData>,
    columnId: string,
  ): boolean {
    return (def.id ?? def.field ?? null) === columnId;
  }

  function buildApi(): SvGridApi<TFeatures, TData> {
    const findColumn = (columnId: string) =>
      grid.getAllColumns().find((column) => column.id === columnId);
    return {
      getCellValue(rowIndex, columnId) {
        const row = internalData[rowIndex];
        const column = findColumn(columnId);
        if (!row || !column) return undefined;
        if (column.columnDef.accessorFn)
          return column.columnDef.accessorFn(row);
        if (column.columnDef.field)
          return (row as Record<string, unknown>)[column.columnDef.field];
        return undefined;
      },
      setCellValue(rowIndex, columnId, value) {
        const row = internalData[rowIndex];
        const column = findColumn(columnId);
        if (!row || !column?.columnDef.field) return;
        const next = internalData.slice() as Array<TData>;
        next[rowIndex] = { ...row, [column.columnDef.field]: value } as TData;
        internalData = next;
      },
      selectCells(ranges) {
        // Engine supports a single anchor/focus rectangle today. Honour
        // the first entry; ignore the rest. Empty array clears.
        if (!ranges || ranges.length === 0) {
          selectionRange = { anchor: null, focus: null };
          return;
        }
        const [r1, c1, r2, c2] = ranges[0]!;
        const rowCount = internalData.length;
        const colCount = allColumns.length;
        if (rowCount === 0 || colCount === 0) return;
        // Clamp to the visible grid bounds so callers can pass open-ended
        // values like `[0, 0, Infinity, Infinity]` to mean "select all".
        const aRow = Math.max(0, Math.min(rowCount - 1, Math.min(r1, r2)));
        const fRow = Math.max(0, Math.min(rowCount - 1, Math.max(r1, r2)));
        const aCol = Math.max(0, Math.min(colCount - 1, Math.min(c1, c2)));
        const fCol = Math.max(0, Math.min(colCount - 1, Math.max(c1, c2)));
        selectionRange = {
          anchor: { rowIndex: aRow, colIndex: aCol },
          focus:  { rowIndex: fRow, colIndex: fCol },
        };
        // Move the active cell to the range's top-left so keyboard
        // navigation continues from there.
        setActiveCell(aRow, aCol);
      },
      getSelected() {
        const a = selectionRange.anchor;
        const f = selectionRange.focus;
        if (!a || !f) return [];
        const r1 = Math.min(a.rowIndex, f.rowIndex);
        const r2 = Math.max(a.rowIndex, f.rowIndex);
        const c1 = Math.min(a.colIndex, f.colIndex);
        const c2 = Math.max(a.colIndex, f.colIndex);
        return [[r1, c1, r2, c2]];
      },
      addRow(row, position = "bottom") {
        this.addRows([row], position);
      },
      addRows(rows, position = "bottom") {
        const next = internalData.slice() as Array<TData>;
        if (position === "top") next.unshift(...rows);
        else if (position === "bottom") next.push(...rows);
        else if (typeof position === "number")
          next.splice(Math.max(0, Math.min(position, next.length)), 0, ...rows);
        internalData = next;
      },
      removeRow(rowIndex) {
        this.removeRows([rowIndex]);
      },
      removeRows(rowIndices) {
        const drop = new Set(rowIndices);
        internalData = internalData.filter((_, i) => !drop.has(i));
      },
      applyTransaction(tx) {
        const getId = props.getRowId;
        let next = internalData.slice() as Array<TData>;
        let added = 0;
        let updated = 0;
        let removed = 0;

        if (tx.remove?.length) {
          const removeIds = new Set<string>();
          const removeRefs = new Set<TData>();
          for (const r of tx.remove) {
            if (typeof r === "string") removeIds.add(r);
            else removeRefs.add(r as TData);
          }
          next = next.filter((row, i) => {
            const hit =
              removeRefs.has(row) ||
              (getId ? removeIds.has(getId(row, i)) : false);
            if (hit) removed += 1;
            return !hit;
          });
        }

        if (tx.update?.length && getId) {
          const byId = new Map<string, TData>();
          for (const u of tx.update) byId.set(getId(u, 0), u);
          next = next.map((row, i) => {
            const u = byId.get(getId(row, i));
            if (u) {
              updated += 1;
              return u;
            }
            return row;
          });
        }

        if (tx.add?.length) {
          next.push(...(tx.add as Array<TData>));
          added += tx.add.length;
        }

        internalData = next;
        return { added, updated, removed };
      },
      addColumn(column, position = "right") {
        this.addColumns([column], position);
      },
      addColumns(columns, position = "right") {
        const next = internalColumns.slice();
        if (position === "left") next.unshift(...columns);
        else if (position === "right") next.push(...columns);
        else if (typeof position === "number")
          next.splice(
            Math.max(0, Math.min(position, next.length)),
            0,
            ...columns,
          );
        internalColumns = next;
      },
      removeColumn(columnId) {
        internalColumns = internalColumns.filter(
          (def) => !columnDefMatchesId(def, columnId),
        );
      },
      setColumnVisible(columnId, visible) {
        if (visible) {
          const next = { ...hiddenColumns };
          delete next[columnId];
          hiddenColumns = next;
        } else {
          hiddenColumns = { ...hiddenColumns, [columnId]: true };
        }
      },
      isColumnVisible(columnId) {
        return !hiddenColumns[columnId];
      },
      setSort(columnId, direction) {
        // Honour the column's `sortable` opt-out. Asking the engine
        // whether the column can sort folds in both the feature toggle
        // AND the per-column flag.
        const col = allColumns.find((c) => c.id === columnId);
        if (col && !col.getCanSort?.()) return;
        const clauses = direction
          ? [{ id: columnId, desc: direction === "desc" }]
          : (grid.getState().sorting ?? []).filter(
              (entry: { id: string }) => entry.id !== columnId,
            );
        grid.store.setState((prev) => ({ ...prev, sorting: clauses }));
      },
      clearSort() {
        grid.store.setState((prev) => ({ ...prev, sorting: [] }));
      },
      setGroupBy(columnIds) {
        grid.setGrouping([...columnIds]);
      },
      setFilter(columnId, filter) {
        // Honour the column's `filterable` opt-out. Same approach as
        // `setSort` - `getCanFilter()` already combines the feature flag
        // and the per-column field.
        const col = allColumns.find((c) => c.id === columnId);
        if (col && !col.getCanFilter?.()) return;
        if (!filter) {
          this.clearFilter(columnId);
          return;
        }
        filterMenuValues = {
          ...filterMenuValues,
          [columnId]: {
            operator: filter.operator,
            value: filter.value ?? "",
            ...(filter.operator === "between"
              ? { valueTo: filter.valueTo ?? "" }
              : {}),
          },
        };
      },
      setFacetFilter(columnId, values) {
        // Empty array OR null both mean "clear this column's facet" -
        // mirrors how the column menu treats unchecking the last value.
        if (!values || values.length === 0) {
          if (valueFilters[columnId]) {
            const next = { ...valueFilters };
            delete next[columnId];
            valueFilters = next;
          }
          return;
        }
        valueFilters = {
          ...valueFilters,
          [columnId]: new Set(values),
        };
      },
      clearFilter(columnId) {
        clearColumnFilter(columnId);
      },
      clearAllFilters() {
        // Wipe every filter surface in one go: column-menu, filter-row, set
        // filters, and the global search box.
        filterMenuValues = {};
        filterRowValues = {};
        valueFilters = {};
        if (globalFilter !== "") globalFilter = "";
      },
      getFilters() {
        // Return a defensive copy so callers can't mutate internal state.
        const out: Record<
          string,
          { operator: FilterOperator; value: string; valueTo?: string }
        > = {};
        for (const [columnId, filter] of Object.entries(filterMenuValues)) {
          out[columnId] = {
            operator: filter.operator,
            value: filter.value,
            ...(filter.operator === "between" && filter.valueTo
              ? { valueTo: filter.valueTo }
              : {}),
          };
        }
        return out;
      },
      getDisplayedRows() {
        // `allRows` is the final, post-filter, post-sort, post-group,
        // post-pagination list - exactly what the body renders. Skip group
        // header rows (they wrap an aggregate, not a TData row).
        const out: TData[] = [];
        for (const row of allRows) {
          if (row.subRows && row.subRows.length > 0) continue;
          out.push(row.original as TData);
        }
        return out;
      },
      getData() {
        return internalData;
      },
      getColumns() {
        // Snapshot every column in visual order with its human-readable
        // label and visibility flag. Used by external code (exporters,
        // column pickers) so they don't have to re-walk the columnDef
        // tree themselves.
        return allColumns.map((c) => ({
          id: c.id,
          field: (c.columnDef as { field?: string }).field,
          header:
            typeof c.columnDef.header === "string"
              ? c.columnDef.header
              : c.id,
          visible: !hiddenColumns[c.id],
        }));
      },
      clearRowSelection() {
        // Wipe the internal selection map AND emit the change so any
        // consumer holding a derived `selectedRows` resets too.
        grid.setRowSelection(() => ({}));
        props.onRowSelectionChange?.({}, []);
      },
      setColumnWidth(columnId: string, width: number) {
        const clamped = Math.max(MIN_COLUMN_WIDTH, Math.floor(width));
        columnWidths = { ...columnWidths, [columnId]: clamped };
      },
      getColumnWidths() {
        // Resolve every column's effective width by consulting both the
        // resize overrides (`columnWidths`) AND the columnDef defaults,
        // so the snapshot is round-trippable through setColumnWidth.
        const out: Record<string, number> = {};
        for (const c of allColumns) out[c.id] = getColumnWidth(c.id);
        return out;
      },
      setColumnPinning(pinning) {
        // Defensive copy + dedupe so callers can't mutate our state.
        const left = Array.from(new Set(pinning.left ?? []));
        const right = Array.from(new Set(pinning.right ?? []));
        columnPinning = { left, right };
      },
      getColumnPinning() {
        return {
          left: columnPinning.left.slice(),
          right: columnPinning.right.slice(),
        };
      },
      // ---- Column reorder
      setColumnOrder(order) {
        setColumnOrderInternal(order);
      },
      getColumnOrder() {
        return getCurrentColumnOrder();
      },
      setRowExpanded(id, expanded) {
        grid.setExpanded((prev) => ({ ...prev, [id]: !!expanded }));
      },
      expandAllGroups() {
        // Walk the current grouped row model and flip every group node on.
        const next: Record<string, boolean> = {};
        const walk = (rows: ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }>) => {
          for (const row of rows) {
            if (row.getCanExpand?.()) next[row.id] = true;
            const sub = row.subRows as ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }> | undefined;
            if (sub && sub.length > 0) walk(sub);
          }
        };
        walk(grid.getRowModel().rows as unknown as ReadonlyArray<{ id: string; getCanExpand?: () => boolean; subRows?: ReadonlyArray<unknown> }>);
        grid.setExpanded(() => next);
      },
      collapseAllGroups() {
        grid.setExpanded(() => ({}));
      },
      // ---- Undo / redo (history + pointer)
      undo() {
        if (historyPtr < 0) return false
        const step = history[historyPtr]
        if (!step) return false
        applyHistoryStep(step, 'undo')
        historyPtr -= 1
        historyVersion += 1
        return true
      },
      redo() {
        if (historyPtr >= history.length - 1) return false
        const step = history[historyPtr + 1]
        if (!step) return false
        applyHistoryStep(step, 'redo')
        historyPtr += 1
        historyVersion += 1
        return true
      },
      canUndo() { void historyVersion; return historyPtr >= 0 },
      canRedo() { void historyVersion; return historyPtr < history.length - 1 },
      clearHistory() { history = []; historyPtr = -1; historyVersion += 1 },
      // ---- Find
      openFind()  { findOpen = true },
      closeFind() { findOpen = false; findQuery = '' },
      setFindQuery(q: string) { findQuery = q; findHitIndex = 0 },
      getFindHits() { return findHits.slice() },
      // ---- Row selection (read + write)
      getSelectedRows() {
        const out: TData[] = [];
        for (const row of allRows) {
          if (isGroupRow(row)) continue;
          if (rowSelectionState[row.id]) out.push(row.original as TData);
        }
        return out;
      },
      getSelectedRowIds() {
        const out: string[] = [];
        for (const row of allRows) {
          if (!isGroupRow(row) && rowSelectionState[row.id]) out.push(row.id);
        }
        return out;
      },
      selectRows(ids, additive = false) {
        const set = new Set(ids);
        grid.setRowSelection((prev) => {
          const next: Record<string, boolean> = additive ? { ...prev } : {};
          for (const id of set) next[id] = true;
          return next;
        });
      },
      selectAllRows() {
        const next: Record<string, boolean> = {};
        for (const row of allRows) if (!isGroupRow(row)) next[row.id] = true;
        grid.setRowSelection(() => next);
      },
      toggleRowSelected(id) {
        toggleRowSelectionById(id);
      },
      // ---- Pagination
      getPageInfo() {
        const { pageIndex, pageSize } = paginationState;
        const total = allRowsBeforePagination.length;
        const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
        return { pageIndex, pageSize, pageCount, total };
      },
      setPage(pageIndex) {
        const total = allRowsBeforePagination.length;
        const pageCount = Math.max(
          1,
          Math.ceil(total / Math.max(1, paginationState.pageSize)),
        );
        goToPage(Math.max(0, Math.min(pageIndex, pageCount - 1)));
      },
      nextPage() {
        this.setPage(paginationState.pageIndex + 1);
      },
      prevPage() {
        this.setPage(paginationState.pageIndex - 1);
      },
      firstPage() {
        this.setPage(0);
      },
      lastPage() {
        const total = allRowsBeforePagination.length;
        const pageCount = Math.max(
          1,
          Math.ceil(total / Math.max(1, paginationState.pageSize)),
        );
        this.setPage(pageCount - 1);
      },
      setPageSize(size) {
        // Calls the component-level helper (lexical scope), not this method.
        setPageSize(Math.max(1, Math.floor(size)));
      },
      // ---- Navigation / scrolling
      scrollToRow(rowIndex) {
        if (!scrollContainer) return;
        const rh = props.rowHeight ?? 36;
        const maxIndex = Math.max(0, allRows.length - 1);
        const clamped = Math.max(0, Math.min(rowIndex, maxIndex));
        scrollContainer.scrollTop = clamped * rh;
        scheduleScrollSync(
          scrollContainer.scrollTop,
          scrollContainer.scrollLeft,
        );
      },
      getActiveCell() {
        const a = activeCell;
        if (!a || a.rowIndex < 0 || a.colIndex < 0) return null;
        const col = allColumns[a.colIndex];
        return {
          rowIndex: a.rowIndex,
          colIndex: a.colIndex,
          columnId: col?.id ?? "",
        };
      },
      setActiveCell(rowIndex, colIndex) {
        const r = Math.max(0, Math.min(rowIndex, Math.max(0, allRows.length - 1)));
        const c = Math.max(
          0,
          Math.min(colIndex, Math.max(0, allColumns.length - 1)),
        );
        // Calls the component-level helper (lexical scope), not this method.
        setActiveCell(r, c);
      },
      // ---- View state (save / restore)
      getState() {
        return {
          sorting: (grid.getState().sorting ?? []).map(
            (s: { id: string; desc: boolean }) => ({ id: s.id, desc: s.desc }),
          ),
          grouping: [...(grid.getState().grouping ?? [])],
          pagination: {
            pageIndex: paginationState.pageIndex,
            pageSize: paginationState.pageSize,
          },
          columnWidths: this.getColumnWidths(),
          columnPinning: this.getColumnPinning(),
          columnOrder: getCurrentColumnOrder(),
          hiddenColumns: Object.keys(hiddenColumns).filter(
            (k) => hiddenColumns[k],
          ),
          globalFilter,
          columnFilters: this.getFilters(),
          facetFilters: Object.fromEntries(
            Object.entries(valueFilters).map(([k, set]) => [
              k,
              Array.from(set),
            ]),
          ),
        };
      },
      setState(state) {
        if (state.sorting) {
          const sorting = state.sorting.map((s) => ({ id: s.id, desc: s.desc }));
          grid.store.setState((prev) => ({ ...prev, sorting }));
        }
        if (state.grouping) grid.setGrouping([...state.grouping]);
        if (state.pagination) {
          const p = state.pagination;
          grid.setPagination((prev) => ({ ...prev, ...p }));
        }
        if (state.columnWidths) columnWidths = { ...state.columnWidths };
        if (state.columnPinning)
          columnPinning = {
            left: [...(state.columnPinning.left ?? [])],
            right: [...(state.columnPinning.right ?? [])],
          };
        if (state.columnOrder) setColumnOrderInternal(state.columnOrder);
        if (state.hiddenColumns) {
          const next: Record<string, boolean> = {};
          for (const id of state.hiddenColumns) next[id] = true;
          hiddenColumns = next;
        }
        if (state.globalFilter !== undefined) globalFilter = state.globalFilter;
        if (state.columnFilters)
          filterMenuValues = { ...state.columnFilters };
        if (state.facetFilters) {
          const next: Record<string, Set<string>> = {};
          for (const [k, arr] of Object.entries(state.facetFilters))
            next[k] = new Set(arr);
          valueFilters = next;
        }
      },
      refresh() {
        grid.store.setState((prev) => ({ ...prev }));
      },
    };
  }

  // Fire onApiReady exactly once when the grid is first ready. Wrapping in
  // an effect that tracks `props.onApiReady` was racy - every parent render
  // creates a new inline arrow, the effect re-fired, and any synchronous
  // state mutation inside the callback (e.g. `api.setGroupBy(...)`) created
  // an infinite update loop. Now it's a true mount-once notification.
  let apiNotified = false;
  $effect(() => {
    if (apiNotified) return;
    const cb = props.onApiReady;
    if (!cb) return;
    apiNotified = true;
    cb(buildApi());
  });
</script>

<svelte:window
  onkeydown={onWindowKeydown}
  onpointerup={endDragSelection}
  onpointermove={onWindowPointerMove}
/>

{#if props.loading && !props.loadingOverlay}
  <div class="sv-grid-state sv-grid-state-loading" role="status">
    Loading grid data...
  </div>
{:else if props.error}
  <div class="sv-grid-state sv-grid-state-error" role="alert">
    {props.error}
  </div>
{:else}
  {#snippet icon(name: string)}
    <svg
      class="sv-grid-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {#if name === "sort"}
        <path d="M8 10l4-4 4 4" />
        <path d="M8 14l4 4 4-4" />
      {:else if name === "sort-asc"}
        <path d="M6 14l6-6 6 6" />
      {:else if name === "sort-desc"}
        <path d="M6 10l6 6 6-6" />
      {:else if name === "filter"}
        <path d="M3 5h18l-7 8v6l-4 2v-8z" />
      {:else if name === "menu"}
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      {:else if name === "group"}
        <path d="M12 3l8 4.5-8 4.5-8-4.5z" />
        <path d="M4 12l8 4.5 8-4.5" />
        <path d="M4 16.5l8 4.5 8-4.5" />
      {:else if name === "x"}
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      {:else if name === "chevron-down"}
        <path d="M6 9l6 6 6-6" />
      {:else if name === "op-contains"}
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
      {:else if name === "op-equals"}
        <path d="M5 9.5h14" />
        <path d="M5 14.5h14" />
      {:else if name === "op-startsWith"}
        <path d="M5 5v14" />
        <path d="M9 9h10" />
        <path d="M9 15h7" />
      {:else if name === "op-greaterThan"}
        <path d="M8 5l9 7-9 7" />
      {:else if name === "op-lessThan"}
        <path d="M16 5l-9 7 9 7" />
      {:else if name === "op-isBlank"}
        <circle cx="12" cy="12" r="8" />
        <path d="M6.5 6.5l11 11" />
      {:else if name === "autosize"}
        <path d="M3 12h18" />
        <path d="M3 12l4-4" />
        <path d="M3 12l4 4" />
        <path d="M21 12l-4-4" />
        <path d="M21 12l-4 4" />
      {:else if name === "columns"}
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="16" rx="1" />
        <rect x="17" y="4" width="4" height="16" rx="1" />
      {:else if name === "reset"}
        <path d="M3 4v6h6" />
        <path d="M3.5 10A9 9 0 1 0 6 5.3" />
      {/if}
    </svg>
  {/snippet}

  {#snippet cellBody(
    row: Row<TData>,
    column: Column<TData>,
    cellValue: unknown,
  )}
    {#if column.columnDef.editorType === "checkbox" || typeof cellValue === "boolean"}
      <div
        class="sv-grid-checkbox sv-grid-checkbox-readonly"
        role="checkbox"
        aria-checked={Boolean(cellValue)}
        aria-readonly="true"
        aria-label={toolPanelHeaderLabel(column)}
      ></div>
    {:else if (column.columnDef.editorType === "list" || column.columnDef.editorType === "chips") && column.columnDef.cell == null}
      {@const arr = Array.isArray(cellValue)
        ? cellValue
        : cellValue == null || cellValue === ""
          ? []
          : [cellValue]}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const isChipsType = column.columnDef.editorType === "chips"}
      {@const anyColored = arr.some((v) => getOptionColor(opts, v))}
      {#if arr.length > 0 && (isChipsType || anyColored)}
        <!-- Render as chips when:
             - the column is `chips` (always pill-style), OR
             - the column is `list` and at least one selected option has
               a `color` (so single-list cells like Priority "high" get
               a pill too, not just plain text). -->
        <div class="sv-grid-chips-display">
          {#each arr as v (String(v))}
            <span
              class="sv-grid-chip"
              style={colorfulChipStyle(getOptionColor(opts, v))}
            >
              {getOptionLabel(opts, v)}
            </span>
          {/each}
        </div>
      {:else}
        {formatListCellValue(column, cellValue, row)}
      {/if}
    {:else if column.columnDef.sparkline && column.columnDef.cell == null}
      {@const geo = buildSparkline(
        toSparklineValues(cellValue),
        column.columnDef.sparkline,
      )}
      {#if geo}
        {@const vals = toSparklineValues(cellValue)}
        <svg
          class="sv-grid-sparkline"
          width={geo.width}
          height={geo.height}
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Sparkline, ${vals.length} points, last ${vals[vals.length - 1]}`}
        >
          {#if geo.areaPath}
            <path
              d={geo.areaPath}
              fill={geo.color}
              fill-opacity="0.18"
              stroke="none"
            />
          {/if}
          {#if geo.linePath}
            <path
              d={geo.linePath}
              fill="none"
              stroke={geo.color}
              stroke-width={geo.lineWidth}
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/if}
          {#each geo.bars as bar, i (i)}
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={bar.h}
              rx="0.5"
              fill={bar.negative ? geo.negativeColor : geo.color}
            />
          {/each}
          {#if geo.lastPoint}
            <circle
              cx={geo.lastPoint.x}
              cy={geo.lastPoint.y}
              r={geo.lineWidth + 0.5}
              fill={geo.color}
            />
          {/if}
        </svg>
      {/if}
    {:else}
      {#if row.depth > 0 && column.id === allColumns[0]?.id}
        <span
          class="sv-grid-group-child-indent"
          style={`width: ${row.depth * 20}px;`}
          aria-hidden="true"
        ></span>
      {/if}
      {@const cellTemplate = column.columnDef.cell}
      {#if typeof cellTemplate === "function"}
        {@const rendered = cellTemplate({
          cell: {
            id: `${row.id}_${column.id}`,
            row,
            column,
            getValue: () => cellValue,
            getContext: () => ({}) as any,
          },
          row,
          column,
          table: grid,
          getValue: () => cellValue,
        })}
        {#if rendered instanceof RenderSnippetConfig}
          {@render rendered.snippet(rendered.params)}
        {:else if rendered instanceof RenderComponentConfig}
          <rendered.component {...rendered.props ?? {}} />
        {:else if typeof rendered === "string" || typeof rendered === "number"}
          {rendered}
        {:else}
          {formatCellValue(column, cellValue, row)}
        {/if}
      {:else if typeof cellTemplate === "string"}
        {cellTemplate}
      {:else}
        {formatCellValue(column, cellValue, row)}
      {/if}
    {/if}
  {/snippet}

  <!-- Cell content wrapped with conditional-formatting overlays. The color-
       scale fill and data bar are absolutely-positioned layers BEHIND the
       text (the app stylesheet forces `.sv-grid-cell` background with
       !important, so an overlay is the only way to tint reliably). Text
       color / weight and the icon-set glyph ride on the content wrapper.
       Falls straight through to `cellBody` when no format applies, so the
       common (unformatted) path pays nothing. -->
  {#snippet cellBodyWithFormat(
    row: Row<TData>,
    column: Column<TData>,
    cellValue: unknown,
  )}
    {@const cf = cellConditionalFormat(row, column, cellValue)}
    {#if cf && (cf.background || cf.dataBar || cf.icon || cf.color || cf.fontWeight != null)}
      {#if cf.background}
        <div class="sv-grid-cf-bg" style={`background:${cf.background}`}></div>
      {/if}
      {#if cf.dataBar}
        <div
          class="sv-grid-cf-bar"
          style={`width:${cf.dataBar.percent}%;background:${cf.dataBar.color}`}
        ></div>
      {/if}
      <span class="sv-grid-cf-content" style={cfTextStyle(cf)}>
        {#if cf.icon}<span class="sv-grid-cf-icon">{cf.icon}</span>{/if}
        {#if !cf.iconOnly}{@render cellBody(row, column, cellValue)}{/if}
      </span>
    {:else}
      {@render cellBody(row, column, cellValue)}
    {/if}
  {/snippet}

  <!-- Active cell editor. Branches on `editingCell.editorType`. Rendered
       only when a cell is in edit mode; the call site supplies the column
       AND row so we can resolve row-dependent `editorOptions` (cascade). -->
  {#snippet editorBody(column: Column<TData>, row: Row<TData>)}
    {#if column.columnDef.cellEditor}
      <!-- Custom editor slot. The columnDef provides a snippet that
           receives the editor context (value + commit + cancel) so the
           consumer fully owns the in-cell UI. -->
      {@const customEditor = column.columnDef.cellEditor as unknown as import('svelte').Snippet<[EditorContext<TData>]>}
      {@render customEditor({
        cell: row.getAllCells().find((c) => c.column.id === column.id)!,
        row,
        column,
        table: grid,
        getValue: () => editingCell?.value,
        value: editingCell?.value,
        update: (next: unknown) => {
          // Stage the draft without closing. Live-preview controls
          // (sliders, color pickers) call this on every input tick.
          editingCell = editingCell ? { ...editingCell, value: next } : editingCell
        },
        commit: (next?: unknown) => {
          // Write + close. If the caller passed a value, stage it
          // first; otherwise save whatever update() last wrote.
          if (next !== undefined) {
            editingCell = editingCell ? { ...editingCell, value: next } : editingCell
          }
          saveEditingCell()
        },
        cancel: () => {
          editingCell = null
          gridRootEl?.focus({ preventScroll: true })
        },
      })}
    {:else if editingCell?.editorType === "checkbox"}
      <button
        type="button"
        class="sv-grid-checkbox"
        role="checkbox"
        aria-checked={Boolean(editingCell.value)}
        aria-label="Edit checkbox value"
        onclick={(event) => {
          event.stopPropagation();
          const nextValue = !Boolean(editingCell?.value);
          editingCell = editingCell
            ? { ...editingCell, value: nextValue }
            : editingCell;
          saveEditingCell();
        }}
        onkeydown={(event) =>
          toggleCheckboxWithKeyboard(event, () => {
            event.stopPropagation();
            const nextValue = !Boolean(editingCell?.value);
            editingCell = editingCell
              ? { ...editingCell, value: nextValue }
              : editingCell;
            saveEditingCell();
          })}
        onblur={() => saveEditingCell()}
      ></button>
    {:else if editingCell?.editorType === "list"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      <SvGridDropdown
        options={opts}
        value={editingCell?.value}
        multiple={multi}
        placeholder="Select…"
        onChange={(next) => {
          editingCell = editingCell
            ? { ...editingCell, value: next }
            : editingCell;
        }}
        onCommit={() => saveEditingCell()}
        onCancel={() => {
          editingCell = null;
          gridRootEl?.focus({ preventScroll: true });
        }}
      />
    {:else if editingCell?.editorType === "chips"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {@const selectedArr = toValueArray(editingCell?.value)}
      {@render chipsEditor(opts, multi, selectedArr)}
    {:else if editingCell?.editorType === "rating"}
      {@const ratingVal = Math.max(0, Math.min(5, Math.round(Number(editingCell?.value) || 0)))}
      <span
        class="sv-grid-rating-editor"
        role="radiogroup"
        aria-label="Rating"
      >
        {#each [1, 2, 3, 4, 5] as n (n)}
          <button
            type="button"
            role="radio"
            aria-checked={ratingVal >= n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            class={`sv-grid-rating-star ${ratingVal >= n ? "sv-grid-rating-star-on" : ""}`}
            onmousedown={(event) => event.preventDefault()}
            onclick={(event) => {
              event.stopPropagation();
              editingCell = editingCell
                ? { ...editingCell, value: n }
                : editingCell;
              saveEditingCell();
            }}
            onkeydown={onEditorKeyDown}
          >★</button>
        {/each}
        <button
          type="button"
          aria-label="Clear rating"
          class="sv-grid-rating-clear"
          onmousedown={(event) => event.preventDefault()}
          onclick={(event) => {
            event.stopPropagation();
            editingCell = editingCell
              ? { ...editingCell, value: 0 }
              : editingCell;
            saveEditingCell();
          }}
        >×</button>
      </span>
    {:else if editingCell?.editorType === "select"}
      <!-- Custom dropdown: opens a themed popover identical in feel to
           the existing 'list' editor (single-select, no typeahead). -->
      {@const selectOpts = getColumnEditorOptions(column, row)}
      <SvGridDropdown
        options={selectOpts}
        value={editingCell?.value}
        multiple={false}
        placeholder="Select…"
        onChange={(next) => {
          editingCell = editingCell
            ? { ...editingCell, value: next }
            : editingCell;
        }}
        onCommit={() => saveEditingCell()}
        onCancel={() => {
          editingCell = null;
          gridRootEl?.focus({ preventScroll: true });
        }}
      />
    {:else if editingCell?.editorType === "rich-select"}
      <!-- Searchable combobox: same popover as 'select' with a
           typeahead filter input baked in at the top. -->
      {@const richOpts = getColumnEditorOptions(column, row)}
      <SvGridDropdown
        options={richOpts}
        value={editingCell?.value}
        multiple={false}
        searchable={true}
        placeholder="Search…"
        onChange={(next) => {
          editingCell = editingCell
            ? { ...editingCell, value: next }
            : editingCell;
        }}
        onCommit={() => saveEditingCell()}
        onCancel={() => {
          editingCell = null;
          gridRootEl?.focus({ preventScroll: true });
        }}
      />
    {:else if editingCell?.editorType === "textarea"}
      <!-- Multi-line editor. Commits on Tab, Ctrl/Cmd+Enter, or blur.
           Plain Enter inserts a newline (the whole point of textarea).
           Esc cancels. -->
      <textarea
        use:focusOnMount
        class="sv-grid-cell-editor sv-grid-cell-editor-textarea"
        rows="4"
        value={String(editingCell?.value ?? "")}
        onpointerdown={(event) => event.stopPropagation()}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLTextAreaElement).value,
          )}
        onkeydown={(event) => {
          event.stopPropagation()
          if (event.key === "Escape") {
            event.preventDefault()
            editingCell = null
            gridRootEl?.focus({ preventScroll: true })
            return
          }
          // Tab and Ctrl/Cmd+Enter both commit. Plain Enter inserts a newline.
          if (event.key === "Tab" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
            event.preventDefault()
            saveEditingCell()
            gridRootEl?.focus({ preventScroll: true })
          }
        }}
        onblur={() => saveEditingCell()}
      ></textarea>
    {:else if editingCell?.editorType === "color"}
      <!-- Native <input type="color"> opens its picker in a separate OS
           overlay; once the picker closes, focus stays on the input so
           `blur` never fires on its own. Commit on `change` (which fires
           exactly once when the picker is dismissed) so the chosen color
           is saved without needing the user to click elsewhere. -->
      <input
        use:focusOnMount
        class={getEditorClass("color")}
        type="color"
        value={getEditableInputValue("color", editingCell?.value)}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLInputElement).value,
          )}
        onchange={(event) => {
          updateEditingCellValue(
            (event.currentTarget as HTMLInputElement).value,
          );
          saveEditingCell();
        }}
        onblur={() => saveEditingCell()}
        onkeydown={onEditorKeyDown}
      />
    {:else}
      <input
        use:focusOnMount
        class={getEditorClass(editingCell?.editorType ?? "text")}
        type={getEditorInputType(editingCell?.editorType ?? "text")}
        value={getEditableInputValue(
          editingCell?.editorType ?? "text",
          editingCell?.value,
        )}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLInputElement).value,
          )}
        onblur={() => saveEditingCell()}
        onkeydown={onEditorKeyDown}
      />
    {/if}
  {/snippet}

  {#snippet chipsEditor(
    opts: CellEditorOption[],
    multi: boolean,
    selectedArr: Array<string | number>,
  )}
    {#if opts.length > 0}
      <!-- Options-driven chips editor: defer to the custom dropdown,
           which renders the selected values as chips in its trigger and
           pops out a styled listbox. Identical UX to the list editor
           with renderChipsInTrigger flipped on. -->
      <SvGridDropdown
        options={opts}
        value={editingCell?.value}
        multiple={multi}
        placeholder="Pick…"
        renderChipsInTrigger={true}
        onChange={(next) => {
          editingCell = editingCell
            ? { ...editingCell, value: next }
            : editingCell;
        }}
        onCommit={() => saveEditingCell()}
        onCancel={() => {
          editingCell = null;
          gridRootEl?.focus({ preventScroll: true });
        }}
      />
    {:else}
      <!-- Free-form chips: typed tags. Enter / comma commits a chip,
           Backspace on empty input removes the last chip, blur saves. -->
      <div
        class="sv-grid-cell-editor sv-grid-cell-editor-chips"
        role="group"
        tabindex={-1}
      >
        <div class="sv-grid-chips-row">
          {#each selectedArr as v, idx (String(v) + "_" + idx)}
            <span class="sv-grid-chip sv-grid-chip-removable">
              {String(v)}
              <button
                type="button"
                class="sv-grid-chip-remove"
                aria-label="Remove {String(v)}"
                onmousedown={(event) => event.preventDefault()}
                onclick={() => {
                  const next = selectedArr.filter((_, i) => i !== idx);
                  editingCell = editingCell
                    ? {
                        ...editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : editingCell;
                }}>×</button
              >
            </span>
          {/each}
          <input
            use:focusOnMount
            class="sv-grid-chip-input"
            type="text"
            placeholder={multi ? "Type, Enter to add" : "Type a value"}
            onkeydown={(event) => {
              if (event.key === "Enter" || (multi && event.key === ",")) {
                event.preventDefault();
                event.stopPropagation();
                const input = event.currentTarget as HTMLInputElement;
                const raw = input.value.trim();
                if (raw) {
                  const next = multi ? [...selectedArr, raw] : [raw];
                  editingCell = editingCell
                    ? { ...editingCell, value: multi ? next : raw }
                    : editingCell;
                  input.value = "";
                  if (!multi) saveEditingCell();
                }
              } else if (event.key === "Escape") {
                onEditorKeyDown(event);
              } else if (event.key === "Backspace") {
                const input = event.currentTarget as HTMLInputElement;
                if (input.value === "" && selectedArr.length > 0) {
                  event.preventDefault();
                  const next = selectedArr.slice(0, -1);
                  editingCell = editingCell
                    ? {
                        ...editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : editingCell;
                }
              }
            }}
            onblur={() => saveEditingCell()}
          />
          {#if multi}
            <button
              type="button"
              class="sv-grid-chip-commit"
              onmousedown={(event) => event.preventDefault()}
              onclick={() => saveEditingCell()}
              aria-label="Commit chip selection">Done</button
            >
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet groupRowContent(row: Row<TData>)}
    {@const groupingColumnId = groupingColumns[row.depth] ?? ""}
    {@const groupingColumn = allColumns.find((c) => c.id === groupingColumnId)}
    {@const headerLabel =
      typeof groupingColumn?.columnDef.header === "string"
        ? groupingColumn.columnDef.header
        : groupingColumnId}
    {@const groupValueRaw = row.getCellValueByColumnId(groupingColumnId)}
    {@const groupValue = groupingColumn
      ? formatCellValue(groupingColumn, groupValueRaw, row)
      : String(groupValueRaw ?? "")}
    {@const count = row.leafCount ?? row.subRows?.length ?? 0}
    <div
      class="sv-grid-group-content"
      style={`padding-left: ${row.depth * 20}px;`}
    >
      <button
        type="button"
        class="sv-grid-group-toggle"
        aria-expanded={row.getIsExpanded?.() ? "true" : "false"}
        aria-label={row.getIsExpanded?.() ? "Collapse group" : "Expand group"}
        onclick={(event) => {
          event.stopPropagation();
          row.toggleExpanded?.();
        }}>{row.getIsExpanded?.() ? "▾" : "▸"}</button
      >
      <span class="sv-grid-group-label">{headerLabel}: {groupValue}</span>
      <span class="sv-grid-group-count"
        >{count} {count === 1 ? "row" : "rows"}</span
      >
      {#each allColumns as col (col.id)}
        {#if col.columnDef.aggregate && col.id !== groupingColumnId}
          {@const aggVal = row.getCellValueByColumnId(col.id)}
          {#if aggVal != null && aggVal !== ""}
            <span class="sv-grid-group-agg">
              <span class="sv-grid-group-agg-label"
                >{typeof col.columnDef.header === "string"
                  ? col.columnDef.header
                  : col.id}</span
              >
              {formatCellValue(col, aggVal, row)}
            </span>
          {/if}
        {/if}
      {/each}
    </div>
  {/snippet}

  <!-- A full-width detail row: one colspan cell spanning every column,
       hosting the consumer's `renderDetailRow` snippet. Auto height (no
       fixed row height) so the panel grows to fit its content. -->
  {#snippet detailRowMarkup(detailRow: Row<TData>, detailRowIndex: number)}
    <tr
      class="sv-grid-row sv-grid-detail-row"
      {...getGridRowA11yProps(detailRowIndex + 1)}
    >
      <td
        class="sv-grid-cell sv-grid-detail-cell"
        colspan={allColumns.length +
          (showRowNumbersEffective ? 1 : 0) +
          (showRowSelectionEffective ? 1 : 0)}
      >
        {#if props.renderDetailRow}
          {@render props.renderDetailRow({
            row: detailRow.original as TData,
            rowIndex: detailRowIndex,
          })}
        {/if}
      </td>
    </tr>
  {/snippet}

  <!-- A single pinned row (top or bottom). Read-only by design: no
       inline editing, no row-selection checkbox, no fill handle.
       Position-sticky CSS keeps it anchored to the top of the body or
       the bottom of the viewport while the rest scrolls. -->
  {#snippet pinnedRowBody(rowData: TData, where: "top" | "bottom", index: number)}
    <tr
      class={`sv-grid-row sv-grid-pinned-row sv-grid-pinned-row-${where}`}
      data-pinned-row={where}
      data-pinned-index={index}
    >
      {#if showRowNumbersEffective}
        <td
          class="sv-grid-cell sv-grid-row-number-cell"
          style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
        >{where === "top" ? "↑" : "↓"}</td>
      {/if}
      {#if showRowSelectionEffective}
        <td
          class="sv-grid-cell sv-grid-selection-cell"
          style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
        ></td>
      {/if}
      {#if columnVirtualizationEnabled && columnWindowStart > 0}
        <td
          class="sv-grid-cell sv-grid-cell-spacer"
          aria-hidden="true"
          style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
        ></td>
      {/if}
      {#each renderedColumns as rendered (rendered.column.id)}
        {@const value = getPinnedCellValue(rowData, rendered.column)}
        {@const userCellClass = computePinnedCellClass(rowData, rendered.column)}
        <td
          class={`sv-grid-cell ${userCellClass}`}
          data-col-id={rendered.column.id}
          data-pinned={isColumnPinned(rendered.column.id) ?? undefined}
          style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
        >{formatPinnedValue(rendered.column, value)}</td>
      {/each}
      {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
        <td
          class="sv-grid-cell sv-grid-cell-spacer"
          aria-hidden="true"
          style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
        ></td>
      {/if}
    </tr>
  {/snippet}

  <div
    class="sv-grid-root"
    class:sv-grid-root-fill={props.containerHeight === "100%"}
  >
    {#if showGlobalFilterEffective}
      <label class="sv-grid-global-filter">
        Filter all rows
        <input bind:value={globalFilter} placeholder="Type to filter..." />
      </label>
    {/if}

    <div
      class="sv-grid-shell"
      style={`height: ${
        typeof props.containerHeight === "string"
          ? props.containerHeight
          : `${props.containerHeight ?? 520}px`
      }; --sg-thead-h: ${headerHeight}px; --sg-pinned-row-h: ${(props.rowHeight ?? 36)}px;`}
    >
      <div
        class="sv-grid-container sv-grid-container-custom-scrollbars"
        bind:this={scrollContainer}
        onscroll={onBodyScroll}
        style={`overflow: auto; position: relative; height: calc(100% - ${hasMeasured && hasHorizontalOverflow ? 16 : 0}px);`}
      >
        <table
          bind:this={gridRootEl}
          class="sv-grid-table"
          {...getGridRootA11yProps({
            activeDescendantId,
            rowCount: allRows.length,
            colCount: allColumns.length,
          })}
          onkeydown={onGridKeyDown}
          style={`min-width: ${totalColumnWidth}px;`}
        >
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <thead class="sv-grid-head" bind:this={theadEl} role="rowgroup">
            <!-- Multi-level group header rows. Only present when the
                 consumer's column tree has `columns: [...]` nesting.
                 Each TH spans the leaf widths underneath via the
                 precomputed `widthPx` + `colSpan` from groupHeaderRows. -->
            {#each groupHeaderRows as row (row.id)}
              <tr
                class="sv-grid-row sv-grid-header-row sv-grid-group-header-row"
                {...getGridRowA11yProps()}
              >
                {#if showRowNumbersEffective}
                  <th
                    class="sv-grid-column sv-grid-row-number-column"
                    style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                    aria-hidden="true"
                  ></th>
                {/if}
                {#if showRowSelectionEffective}
                  <th
                    class="sv-grid-column sv-grid-selection-column"
                    style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                    aria-hidden="true"
                  ></th>
                {/if}
                {#each row.cells as cell (cell.key)}
                  <th
                    class="sv-grid-column sv-grid-group-header-cell"
                    class:sv-grid-group-header-placeholder={cell.isPlaceholder}
                    colspan={cell.colSpan}
                    style={`width: ${cell.widthPx}px; min-width: ${cell.widthPx}px; max-width: ${cell.widthPx}px;`}
                  >
                    {#if !cell.isPlaceholder}
                      <span class="sv-grid-group-header-label">{cell.label}</span>
                    {/if}
                  </th>
                {/each}
              </tr>
            {/each}
            {#each headerGroups as headerGroup (headerGroup.id)}
              <tr
                class="sv-grid-row sv-grid-header-row"
                {...getGridRowA11yProps()}
              >
                {#if showRowNumbersEffective}
                  <th
                    class="sv-grid-column sv-grid-row-number-column"
                    style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                    aria-label="Row number"
                  >
                    <span class="sv-grid-row-number-head">#</span>
                  </th>
                {/if}
                {#if showRowSelectionEffective}
                  <th
                    class="sv-grid-column sv-grid-selection-column"
                    style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                  >
                    <button
                      type="button"
                      class="sv-grid-checkbox"
                      role="checkbox"
                      aria-checked={headerSelectionState === "all"
                        ? "true"
                        : headerSelectionState === "some"
                          ? "mixed"
                          : "false"}
                      aria-label="Select all rows"
                      onclick={toggleSelectAllRows}
                      onkeydown={(event) =>
                        toggleCheckboxWithKeyboard(event, toggleSelectAllRows)}
                    ></button>
                  </th>
                {/if}
                {#if columnVirtualizationEnabled && columnWindowStart > 0}
                  <th
                    class="sv-grid-column sv-grid-column-spacer"
                    aria-hidden="true"
                    style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
                  ></th>
                {/if}
                {#each renderedColumns as rendered (rendered.column.id)}
                  {@const header = headerGroup.headers[rendered.item.index]}
                  {#if header}
                    {@const sortDirection =
                      sortDirectionByColumn[header.column.id]}
                    {@const isGrouped = groupingColumns.includes(
                      header.column.id,
                    )}
                    <th
                      class="sv-grid-column"
                      class:is-drag-target-before={colDropOnId === header.column.id && colDropSide === "before"}
                      class:is-drag-target-after={colDropOnId === header.column.id && colDropSide === "after"}
                      class:is-dragging={colDragId === header.column.id}
                      data-svgrid-header-col={header.column.id}
                      data-align={getColumnAlign(rendered.column)}
                      data-pinned={isColumnPinned(rendered.column.id) ??
                        undefined}
                      draggable={(props.enableColumnReorder ?? false) ? true : undefined}
                      ondragstart={(e) =>
                        (props.enableColumnReorder ?? false) &&
                        onColumnHeaderDragStart(e, header.column.id)}
                      ondragover={(e) =>
                        (props.enableColumnReorder ?? false) &&
                        onColumnHeaderDragOver(e, header.column.id)}
                      ondragleave={() =>
                        (props.enableColumnReorder ?? false) &&
                        onColumnHeaderDragLeave(header.column.id)}
                      ondrop={(e) =>
                        (props.enableColumnReorder ?? false) &&
                        onColumnHeaderDrop(e, header.column.id)}
                      ondragend={() =>
                        (props.enableColumnReorder ?? false) &&
                        onColumnHeaderDragEnd()}
                      style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                      {...getGridHeaderA11yProps({
                        sortable: header.column.getCanSort(),
                        sortDirection:
                          sortDirection === "asc"
                            ? "ascending"
                            : sortDirection === "desc"
                              ? "descending"
                              : "none",
                      })}
                    >
                      {#if !header.isPlaceholder}
                        <div class="sv-grid-header-cell">
                          {#if typeof header.column.columnDef.header === "function"}
                            {@const rendered = header.column.columnDef.header(header.getContext())}
                            <!-- Custom header (snippet/component): rendered
                                 OUTSIDE the sort button so the consumer's
                                 own interactive elements (menu buttons,
                                 dropdowns, etc) are valid DOM and receive
                                 their own clicks. Clicking blank header
                                 background still triggers sort via the
                                 wrapper's role=button + click handler. -->
                            <div
                              class="sv-grid-header-custom"
                              role="button"
                              tabindex="-1"
                              onclick={(event) => {
                                if (!header.column.getCanSort()) return
                                // If the click landed on an interactive
                                // element inside the custom header, let
                                // that element handle it.
                                const t = event.target as HTMLElement | null
                                if (t && t.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]') &&
                                    !(t.classList.contains('sv-grid-header-custom'))) return
                                onHeaderSortClick(event, header.column.id)
                              }}
                              onkeydown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                if (!header.column.getCanSort()) return
                                event.preventDefault()
                                onHeaderSortClick(event as unknown as MouseEvent, header.column.id)
                              }}
                            >
                              {#if rendered instanceof RenderSnippetConfig}
                                {@render rendered.snippet(rendered.params)}
                              {:else if rendered instanceof RenderComponentConfig}
                                <rendered.component {...rendered.props ?? {}} />
                              {:else if typeof rendered === "string" || typeof rendered === "number"}
                                {rendered}
                              {:else}
                                {header.id}
                              {/if}
                              {#if header.column.getCanSort()}
                                {#if sortDirection === "asc"}
                                  <span class="sv-grid-header-icon"
                                    >{@render icon("sort-asc")}</span>
                                {:else if sortDirection === "desc"}
                                  <span class="sv-grid-header-icon"
                                    >{@render icon("sort-desc")}</span>
                                {/if}
                              {/if}
                            </div>
                          {:else}
                            <button
                              type="button"
                              class="sv-grid-header-sort"
                              onclick={(event) =>
                                onHeaderSortClick(event, header.column.id)}
                            >
                              <span class="sv-grid-header-label">
                                {typeof header.column.columnDef.header === "string"
                                  ? header.column.columnDef.header
                                  : header.id}
                              </span>
                              {#if header.column.getCanSort()}
                                {#if sortDirection === "asc"}
                                  <span class="sv-grid-header-icon"
                                    >{@render icon("sort-asc")}</span
                                  >
                                {:else if sortDirection === "desc"}
                                  <span class="sv-grid-header-icon"
                                    >{@render icon("sort-desc")}</span
                                  >
                                {:else}
                                  <span
                                    class="sv-grid-header-icon sv-grid-header-icon-hint"
                                    >{@render icon("sort")}</span
                                  >
                                {/if}
                              {/if}
                            </button>
                          {/if}
                          {#if isGrouped}
                            <span
                              class="sv-grid-header-icon sv-grid-header-icon-flag"
                              title="Grouped">{@render icon("group")}</span
                            >
                          {/if}
                          {#if header.column.getCanFilter()}
                            <button
                              type="button"
                              class="sv-grid-col-menu-btn sv-grid-col-filter-btn"
                              class:is-open={filterMenuFor === header.column.id}
                              class:is-active={isColumnFiltered(
                                header.column.id,
                              )}
                              aria-label="Filter"
                              aria-haspopup="menu"
                              onclick={(event) =>
                                openFilterMenu(event, header.column.id)}
                            >
                              {@render icon("filter")}
                            </button>
                          {/if}
                          <button
                            type="button"
                            class="sv-grid-col-menu-btn"
                            class:is-open={columnMenuFor === header.column.id}
                            aria-label="Column menu"
                            aria-haspopup="menu"
                            onclick={(event) =>
                              openColumnMenu(event, header.column.id)}
                          >
                            {@render icon("menu")}
                          </button>
                        </div>
                        {#if showInlineColumnFilterEffective && header.column.getCanFilter()}
                          <input
                            class="sv-grid-column-filter"
                            placeholder="Filter"
                            oninput={(event) => {
                              const value = (
                                event.currentTarget as HTMLInputElement
                              ).value;
                              grid.setColumnFilters((prev) => [
                                ...prev.filter(
                                  (entry) => entry.id !== header.column.id,
                                ),
                                ...(value
                                  ? [
                                      {
                                        id: header.column.id,
                                        value,
                                        fn: "includesString" as const,
                                      },
                                    ]
                                  : []),
                              ]);
                            }}
                          />
                        {/if}
                        <div
                          class="sv-grid-resize-handle"
                          class:is-resizing={resizingColumnId ===
                            header.column.id}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label="Resize column"
                          onpointerdown={(event) =>
                            startColumnResize(event, header.column.id)}
                          ondblclick={(event) => event.stopPropagation()}
                        ></div>
                      {/if}
                    </th>
                  {/if}
                {/each}
                {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
                  <th
                    class="sv-grid-column sv-grid-column-spacer"
                    aria-hidden="true"
                    style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
                  ></th>
                {/if}
              </tr>
              {#if showFilterRowEffective}
                <tr {...getGridRowA11yProps()}>
                  {#if showRowNumbersEffective}
                    <th
                      class="sv-grid-column sv-grid-row-number-column"
                      style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                    ></th>
                  {/if}
                  {#if showRowSelectionEffective}
                    <th
                      class="sv-grid-column sv-grid-selection-column"
                      style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                    ></th>
                  {/if}
                  {#if columnVirtualizationEnabled && columnWindowStart > 0}
                    <th
                      class="sv-grid-column sv-grid-column-spacer"
                      aria-hidden="true"
                      style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
                    ></th>
                  {/if}
                  {#each renderedColumns as rendered (rendered.column.id)}
                    {@const activeOperator =
                      filterMenuValues[rendered.column.id]?.operator ??
                      defaultOperatorFor(rendered.column)}
                    <th
                      class="sv-grid-column"
                      data-pinned={isColumnPinned(rendered.column.id) ??
                        undefined}
                      style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                    >
                      <div class="sv-grid-filter-row-control">
                        <button
                          type="button"
                          class="sv-grid-filter-operator-btn"
                          class:is-open={operatorMenuFor === rendered.column.id}
                          title={`Condition: ${operatorOption(activeOperator).label}`}
                          aria-label={`Filter condition: ${operatorOption(activeOperator).label}`}
                          onclick={(event) =>
                            openOperatorMenu(event, rendered.column.id)}
                        >
                          <span class="sv-grid-header-icon"
                            >{@render icon(
                              operatorOption(activeOperator).iconName,
                            )}</span
                          >
                          <span class="sv-grid-caret"
                            >{@render icon("chevron-down")}</span
                          >
                        </button>
                        {#if activeOperator !== "isBlank"}
                          <input
                            class="sv-grid-filter-value"
                            placeholder="Filter rows"
                            data-svgrid-filter-col={rendered.column.id}
                            value={filterRowValues[rendered.column.id] ?? ""}
                            oninput={(event) =>
                              updateFilterRow(
                                rendered.column.id,
                                (event.currentTarget as HTMLInputElement).value,
                              )}
                          />
                        {/if}
                      </div>
                    </th>
                  {/each}
                  {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
                    <th
                      class="sv-grid-column sv-grid-column-spacer"
                      aria-hidden="true"
                      style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
                    ></th>
                  {/if}
                </tr>
              {/if}
            {/each}
          </thead>
          {#if props.pinnedTopRows && props.pinnedTopRows.length > 0}
            <!-- svelte-ignore a11y_no_redundant_roles -->
            <tbody class="sv-grid-pinned sv-grid-pinned-top-body" role="rowgroup">
              {#each props.pinnedTopRows as r, i (i)}
                {@render pinnedRowBody(r, "top", i)}
              {/each}
            </tbody>
          {/if}
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <tbody class="sv-grid-body" role="rowgroup">
            {#if !allRows.length && !(props.loading && props.loadingOverlay)}
              <tr class="sv-grid-row sv-grid-empty-row">
                <td
                  class="sv-grid-cell sv-grid-empty-cell"
                  colSpan={allColumns.length +
                    (showRowNumbersEffective ? 1 : 0) +
                    (showRowSelectionEffective ? 1 : 0)}
                >
                  {props.emptyMessage ?? "No rows to display."}
                </td>
              </tr>
            {:else if rowVirtualizationEnabled}
              {#if virtualRowStart > 0}
                <tr class="sv-grid-row sv-grid-row-spacer" aria-hidden="true">
                  <td
                    class="sv-grid-cell sv-grid-cell-spacer"
                    style={`height: ${virtualRowStart}px; padding: 0; border: 0;`}
                    colSpan={allColumns.length +
                      (showRowNumbersEffective ? 1 : 0) +
                      (showRowSelectionEffective ? 1 : 0)}
                  ></td>
                </tr>
              {/if}
              {#each virtualRows as rowItem (rowItem.key)}
                {@const rowIndex = rowItem.index}
                {@const row = allRows[rowIndex]}
                {#if row}
                  {#if props.isDetailRow?.(row.original as TData, rowIndex)}
                    {@render detailRowMarkup(row, rowIndex)}
                  {:else if isGroupRow(row)}
                    <tr
                      class="sv-grid-row sv-grid-group-row"
                      class:sv-grid-row-selected={isRowSelected(row.id)}
                      aria-level={row.depth + 1}
                      aria-expanded={row.getIsExpanded?.() ? "true" : "false"}
                      {...getGridRowA11yProps(rowIndex + 1)}
                      style={`height: ${rowItem.size}px;`}
                    >
                      <td
                        class="sv-grid-cell sv-grid-group-cell"
                        class:sv-grid-cell-active={activeCell.rowIndex ===
                          rowIndex}
                        colspan={allColumns.length +
                          (showRowNumbersEffective ? 1 : 0) +
                          (showRowSelectionEffective ? 1 : 0)}
                        onclick={() => row.toggleExpanded?.()}
                      >
                        {@render groupRowContent(row)}
                      </td>
                    </tr>
                  {:else}
                    {@const userRowClass = computeRowClass(row, rowIndex)}
                    <tr
                      class={`sv-grid-row ${userRowClass}`}
                      class:sv-grid-row-selected={isRowSelected(row.id)}
                      {...getGridRowA11yProps(rowIndex + 1)}
                      style={`height: ${rowItem.size}px;`}
                    >
                      {#if showRowNumbersEffective}
                        <td
                          class="sv-grid-cell sv-grid-row-number-cell"
                          style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                          >{rowIndex + 1}</td
                        >
                      {/if}
                      {#if showRowSelectionEffective}
                        <td
                          class="sv-grid-cell sv-grid-selection-cell"
                          style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                          onclick={() => toggleRowSelectionById(row.id)}
                        >
                          <button
                            type="button"
                            class="sv-grid-checkbox"
                            role="checkbox"
                            aria-checked={isRowSelected(row.id)}
                            aria-label="Select row"
                            onclick={(event) => {
                              event.stopPropagation();
                              toggleRowSelectionById(row.id);
                            }}
                            onkeydown={(event) =>
                              toggleCheckboxWithKeyboard(event, () => {
                                event.stopPropagation();
                                toggleRowSelectionById(row.id);
                              })}
                          ></button>
                        </td>
                      {/if}
                      {#if columnVirtualizationEnabled && columnWindowStart > 0}
                        <td
                          class="sv-grid-cell sv-grid-cell-spacer"
                          aria-hidden="true"
                          style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
                        ></td>
                      {/if}
                      {#each renderedColumns as rendered (rendered.column.id)}
                        {@const colIndex = rendered.item.index}
                        {@const baseValue = getColumnBaseValue(
                          row,
                          rendered.column,
                        )}
                        {@const cellValue = getCellDisplayValue(
                          row.id,
                          rendered.column.id,
                          baseValue,
                        )}
                        {@const isEditing =
                          editingCell?.rowId === row.id &&
                          editingCell?.columnId === rendered.column.id}
                        {@const rangeEdges = getCellRangeEdges(
                          rowIndex,
                          colIndex,
                        )}
                        {@const hasFillHandle =
                          fillHandleCell &&
                          fillHandleCell.rowIndex === rowIndex &&
                          fillHandleCell.colIndex === colIndex}
                        {@const userCellClass = computeCellClass(row, rendered.column)}
                        {@const cellTooltip = computeCellTooltip(row, rendered.column)}
                        {@const cellNote    = computeCellNote(row, rendered.column)}
                        <td
                          class={`sv-grid-cell ${userCellClass}`}
                          class:sv-grid-cell-editing={isEditing}
                          class:sv-grid-cell-active={activeCell.rowIndex ===
                            rowIndex && activeCell.colIndex === colIndex}
                          class:sv-grid-cell-has-fill-handle={hasFillHandle}
                          class:sv-grid-cell-cf={hasConditionalFormats}
                          class:sv-grid-cell-has-note={cellNote != null}
                          data-svgrid-row={rowIndex}
                          data-svgrid-col={colIndex}
                          data-col-id={rendered.column.id}
                          data-align={getColumnAlign(rendered.column)}
                          data-pinned={isColumnPinned(rendered.column.id) ??
                            undefined}
                          data-selected-range={rangeEdges ? "true" : undefined}
                          data-range-top={rangeEdges?.top ? "true" : undefined}
                          data-range-bottom={rangeEdges?.bottom
                            ? "true"
                            : undefined}
                          data-range-left={rangeEdges?.left
                            ? "true"
                            : undefined}
                          data-range-right={rangeEdges?.right
                            ? "true"
                            : undefined}
                          data-fill-preview={isInFillPreview(rowIndex, colIndex)
                            ? "true"
                            : undefined}
                          style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                          onpointerdown={(event) =>
                            onCellPointerDown(rowIndex, colIndex, event)}
                          onpointerenter={() =>
                            onCellPointerEnter(rowIndex, colIndex)}
                          ondblclick={() =>
                            emitCellDoubleClick(rowIndex, colIndex)}
                          onclick={() => onCellClick(rowIndex, colIndex)}
                          {...getGridCellA11yProps({
                            id: getGridCellDomId("svgrid", rowIndex, colIndex),
                            rowIndex: rowIndex + 1,
                            colIndex: colIndex + 1,
                            selected: isRowSelected(row.id),
                          })}
                        >
                          {#if isEditing}
                            {@render editorBody(rendered.column, row)}
                          {:else}
                            {@render cellBodyWithFormat(row, rendered.column, cellValue)}
                          {/if}
                          {#if !isEditing && fillHandleCell && fillHandleCell.rowIndex === rowIndex && fillHandleCell.colIndex === colIndex}
                            <!-- Excel-style fill handle: drag down/right to
                           extend the selection and pattern-fill the new
                           cells on release. Rendered inside the bottom-
                           right cell of the selection range (or active
                           cell if there's no range). -->
                            <div
                              class="sv-grid-fill-handle"
                              role="button"
                              aria-label="Fill handle"
                              onpointerdown={(event) =>
                                startFillDrag(event, rowIndex, colIndex)}
                            ></div>
                          {/if}
                          {#if cellNote != null && !isEditing}
                            <span
                              class="sv-grid-cell-note-corner"
                              aria-label="Note"
                              onpointerenter={(event) => {
                                event.stopPropagation()
                                showTooltipFor(event.currentTarget as HTMLElement, cellNote)
                              }}
                              onpointerleave={(event) => {
                                event.stopPropagation()
                                hideTooltip()
                              }}
                            ></span>
                          {/if}
                        </td>
                      {/each}
                      {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
                        <td
                          class="sv-grid-cell sv-grid-cell-spacer"
                          aria-hidden="true"
                          style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
                        ></td>
                      {/if}
                    </tr>
                  {/if}
                {/if}
              {/each}
              {#if virtualRowBottomSpacer > 0}
                <tr class="sv-grid-row sv-grid-row-spacer" aria-hidden="true">
                  <td
                    class="sv-grid-cell sv-grid-cell-spacer"
                    style={`height: ${virtualRowBottomSpacer}px; padding: 0; border: 0;`}
                    colSpan={allColumns.length +
                      (showRowNumbersEffective ? 1 : 0) +
                      (showRowSelectionEffective ? 1 : 0)}
                  ></td>
                </tr>
              {/if}
            {:else}
              {#each allRows as row, rowIndex (row.id)}
                {#if props.isDetailRow?.(row.original as TData, rowIndex)}
                  {@render detailRowMarkup(row, rowIndex)}
                {:else if isGroupRow(row)}
                  <tr
                    class="sv-grid-row sv-grid-group-row"
                    class:sv-grid-row-selected={isRowSelected(row.id)}
                    aria-level={row.depth + 1}
                    aria-expanded={row.getIsExpanded?.() ? "true" : "false"}
                    {...getGridRowA11yProps(rowIndex + 1)}
                  >
                    <td
                      class="sv-grid-cell sv-grid-group-cell"
                      class:sv-grid-cell-active={activeCell.rowIndex ===
                        rowIndex}
                      colspan={allColumns.length +
                        (showRowNumbersEffective ? 1 : 0) +
                        (showRowSelectionEffective ? 1 : 0)}
                      onclick={() => row.toggleExpanded?.()}
                    >
                      {@render groupRowContent(row)}
                    </td>
                  </tr>
                {:else}
                  {@const userRowClass = computeRowClass(row, rowIndex)}
                  <tr
                    class={`sv-grid-row ${userRowClass}`}
                    class:sv-grid-row-selected={isRowSelected(row.id)}
                    {...getGridRowA11yProps(rowIndex + 1)}
                  >
                    {#if showRowNumbersEffective}
                      <td
                        class="sv-grid-cell sv-grid-row-number-cell"
                        style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                        >{rowIndex + 1}</td
                      >
                    {/if}
                    {#if showRowSelectionEffective}
                      <td
                        class="sv-grid-cell sv-grid-selection-cell"
                        style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                        onclick={() => toggleRowSelectionById(row.id)}
                      >
                        <button
                          type="button"
                          class="sv-grid-checkbox"
                          role="checkbox"
                          aria-checked={isRowSelected(row.id)}
                          aria-label="Select row"
                          onclick={(event) => {
                            event.stopPropagation();
                            toggleRowSelectionById(row.id);
                          }}
                          onkeydown={(event) =>
                            toggleCheckboxWithKeyboard(event, () => {
                              event.stopPropagation();
                              toggleRowSelectionById(row.id);
                            })}
                        ></button>
                      </td>
                    {/if}
                    {#if columnVirtualizationEnabled && columnWindowStart > 0}
                      <td
                        class="sv-grid-cell sv-grid-cell-spacer"
                        aria-hidden="true"
                        style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
                      ></td>
                    {/if}
                    {#each renderedColumns as rendered (rendered.column.id)}
                      {@const colIndex = rendered.item.index}
                      {@const baseValue = getColumnBaseValue(
                        row,
                        rendered.column,
                      )}
                      {@const cellValue = getCellDisplayValue(
                        row.id,
                        rendered.column.id,
                        baseValue,
                      )}
                      {@const isEditing =
                        editingCell?.rowId === row.id &&
                        editingCell?.columnId === rendered.column.id}
                      {@const rangeEdges = getCellRangeEdges(
                        rowIndex,
                        colIndex,
                      )}
                      {@const userCellClass = computeCellClass(row, rendered.column)}
                      {@const cellTooltip = computeCellTooltip(row, rendered.column)}
                      {@const cellNote    = computeCellNote(row, rendered.column)}
                      <td
                        class={`sv-grid-cell ${userCellClass}`}
                        class:sv-grid-cell-editing={isEditing}
                        class:sv-grid-cell-active={activeCell.rowIndex ===
                          rowIndex && activeCell.colIndex === colIndex}
                        class:sv-grid-cell-cf={hasConditionalFormats}
                        class:sv-grid-cell-has-note={cellNote != null}
                        data-svgrid-row={rowIndex}
                        data-svgrid-col={colIndex}
                        data-col-id={rendered.column.id}
                        data-pinned={isColumnPinned(rendered.column.id) ??
                          undefined}
                        data-selected-range={rangeEdges ? "true" : undefined}
                        data-range-top={rangeEdges?.top ? "true" : undefined}
                        data-range-bottom={rangeEdges?.bottom
                          ? "true"
                          : undefined}
                        data-range-left={rangeEdges?.left ? "true" : undefined}
                        data-range-right={rangeEdges?.right
                          ? "true"
                          : undefined}
                        style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                        onpointerdown={(event) =>
                          onCellPointerDown(rowIndex, colIndex, event)}
                        onpointerenter={(event) => {
                          onCellPointerEnter(rowIndex, colIndex)
                          // Column tooltip fires on whole-cell hover.
                          // Per-cell notes are gated on the corner hot-
                          // zone below (Excel-style: hover the small
                          // triangle to read the note).
                          if (cellTooltip) showTooltipFor(event.currentTarget as HTMLElement, cellTooltip)
                        }}
                        onpointerleave={hideTooltip}
                        ondblclick={() => emitCellDoubleClick(rowIndex, colIndex)}
                        onclick={() => onCellClick(rowIndex, colIndex)}
                        {...getGridCellA11yProps({
                          id: getGridCellDomId("svgrid", rowIndex, colIndex),
                          rowIndex: rowIndex + 1,
                          colIndex: colIndex + 1,
                          selected: isRowSelected(row.id),
                        })}
                      >
                        {#if isEditing}
                          {@render editorBody(rendered.column, row)}
                        {:else}
                          {@render cellBodyWithFormat(row, rendered.column, cellValue)}
                        {/if}
                        {#if cellNote != null && !isEditing}
                          <!-- Excel-style per-cell note indicator. The
                               triangle itself is the hot-zone; hover
                               just the corner to see the note (Excel
                               red-dot behaviour). The cell-level
                               tooltip handler only shows the column
                               tooltip, so the two surfaces stay
                               separate. -->
                          <span
                            class="sv-grid-cell-note-corner"
                            aria-label="Note"
                            onpointerenter={(event) => {
                              event.stopPropagation()
                              showTooltipFor(event.currentTarget as HTMLElement, cellNote)
                            }}
                            onpointerleave={(event) => {
                              event.stopPropagation()
                              hideTooltip()
                            }}
                          ></span>
                        {/if}
                      </td>
                    {/each}
                    {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
                      <td
                        class="sv-grid-cell sv-grid-cell-spacer"
                        aria-hidden="true"
                        style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
                      ></td>
                    {/if}
                  </tr>
                {/if}
              {/each}
            {/if}
          </tbody>
          {#if props.pinnedBottomRows && props.pinnedBottomRows.length > 0}
            <!-- svelte-ignore a11y_no_redundant_roles -->
            <tbody class="sv-grid-pinned sv-grid-pinned-bottom-body" role="rowgroup">
              {#each props.pinnedBottomRows as r, i (i)}
                {@render pinnedRowBody(r, "bottom", i)}
              {/each}
            </tbody>
          {/if}
          {#if props.enableRowSummaries ?? true}
            <!-- svelte-ignore a11y_no_redundant_roles -->
            <tfoot class="sv-grid-foot" role="rowgroup">
              <tr
                class="sv-grid-row sv-grid-summary-row"
                {...getGridRowA11yProps()}
              >
                {#if showRowNumbersEffective}
                  <!-- Row-number column has no aggregate; the digit it normally
                   shows is the row index, which doesn't make sense to sum. -->
                  <th
                    class="sv-grid-column sv-grid-summary-column sv-grid-row-number-column"
                    style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
                  ></th>
                {/if}
                {#if showRowSelectionEffective}
                  <!-- Selection column is checkbox-only; no aggregate. -->
                  <th
                    class="sv-grid-column sv-grid-summary-column sv-grid-selection-column"
                    style={`width: ${selectionColumnWidth}px; min-width: ${selectionColumnWidth}px; max-width: ${selectionColumnWidth}px; left: ${showRowNumbersEffective ? rowNumberColumnWidth : 0}px;`}
                  ></th>
                {/if}
                {#if columnVirtualizationEnabled && columnWindowStart > 0}
                  <th
                    class="sv-grid-column sv-grid-column-spacer"
                    aria-hidden="true"
                    style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
                  ></th>
                {/if}
                {#each renderedColumns as rendered (rendered.column.id)}
                  <th
                    class="sv-grid-column sv-grid-summary-column"
                    data-pinned={isColumnPinned(rendered.column.id) ??
                      undefined}
                    style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                  >
                    {summaryByColumn[rendered.column.id] ?? ""}
                  </th>
                {/each}
                {#if columnVirtualizationEnabled && columnWindowRightSpacer > 0}
                  <th
                    class="sv-grid-column sv-grid-column-spacer"
                    aria-hidden="true"
                    style={`width: ${columnWindowRightSpacer}px; min-width: ${columnWindowRightSpacer}px; max-width: ${columnWindowRightSpacer}px;`}
                  ></th>
                {/if}
              </tr>
            </tfoot>
          {/if}
        </table>
      </div>
      <!-- 16-px placeholder above the vertical scrollbar that matches the
         header height - fills the gap so the scrollbar starts exactly
         under the header row. Only needed when the vertical scrollbar
         is actually rendered; without this guard the block stays as a
         visible colored rectangle in the top-right corner even on
         demos with no vertical overflow. -->
      {#if hasMeasured && hasVerticalOverflow}
        <div
          class="sv-grid-scrollbar-corner"
          aria-hidden="true"
          style={`height: ${headerHeight}px;`}
        ></div>
      {/if}
      <!-- Scrollbar attributes come from AUTHORITATIVE sources, not the
         DOM. `scrollMetrics.scrollHeight/scrollWidth` are read inside a
         Svelte derived during render - the browser hasn't painted yet,
         so those values lag one frame behind the real layout. The
         scrollbar's own `hidden`-check then trips on stale `content-size
         <= viewport-size`, disables itself, and the user can't drag it.
         Using `virtualRowTotalSize` / `totalColumnWidth` (which come
         straight from the virtualizers' authoritative state) avoids the
         lag - the scrollbar always sees the same overflow numbers our
         gating did. -->
      {#if hasMeasured && hasVerticalOverflow}
        <!-- content-size = the container's actual `scrollHeight`.
             The scroll container's real `scrollHeight` includes
             EVERYTHING in the scroll content: the sticky thead, the
             tbody (top spacer + rendered rows + bottom spacer), and a
             sticky tfoot if rendered. Computing it from
             `virtualRowTotalSize + headerHeight` works in the common
             case but undercounts when the footer is present or the
             header is more than one row, leaving the last few rows
             beyond the scrollbar's reach. We read it from the DOM
             once `hasMeasured` is true (i.e. after the first
             ResizeObserver tick), and fall back to the virtualizer
             math if for some reason the DOM read returns 0 (early
             render races). -->
        <sv-grid-scrollbar
          class="sv-grid-scrollbar sv-grid-scrollbar-vertical"
          bind:this={verticalScrollbarEl}
          orientation="vertical"
          viewport-size={viewportHeight}
          content-size={scrollMetrics.scrollHeight ||
            virtualRowTotalSize + headerHeight}
          value={scrollMetrics.scrollTop}
          step={props.rowHeight ?? 36}
          style={`top: ${headerHeight}px; height: calc(100% - ${headerHeight + (hasHorizontalOverflow ? 16 : 0)}px);`}
        ></sv-grid-scrollbar>
      {/if}
      {#if hasMeasured && hasHorizontalOverflow}
        {@const horizontalContentSize =
          totalColumnWidth +
          (showRowNumbersEffective ? rowNumberColumnWidth : 0) +
          (showRowSelectionEffective ? selectionColumnWidth : 0)}
        <sv-grid-scrollbar
          class="sv-grid-scrollbar sv-grid-scrollbar-horizontal"
          bind:this={horizontalScrollbarEl}
          orientation="horizontal"
          viewport-size={viewportWidth}
          content-size={horizontalContentSize}
          value={scrollMetrics.scrollLeft}
          step={props.columnWidth ?? 140}
          style={`width: calc(100% - ${hasVerticalOverflow ? 16 : 0}px);`}
        ></sv-grid-scrollbar>
      {/if}
      {#if hasMeasured && hasVerticalOverflow && hasHorizontalOverflow}
        <div class="sv-grid-scrollbar-corner-br" aria-hidden="true"></div>
      {/if}
    </div>

    {#if statusBarEnabled && statusBarStats}
      {@const s = statusBarStats}
      <div class="sv-grid-status-bar" role="status" aria-live="polite">
        {#each statusBarAggregates as agg (agg)}
          {#if agg === "count"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Count</span>{fmtStat(s.count)}</span
            >
          {:else if agg === "numericCount"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Numeric</span>{fmtStat(s.numericCount)}</span
            >
          {:else if s.numericCount > 0 && agg === "sum"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Sum</span>{fmtStat(s.sum)}</span
            >
          {:else if s.numericCount > 0 && agg === "avg"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Avg</span>{fmtStat(s.avg)}</span
            >
          {:else if s.numericCount > 0 && agg === "min"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Min</span>{fmtStat(s.min)}</span
            >
          {:else if s.numericCount > 0 && agg === "max"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Max</span>{fmtStat(s.max)}</span
            >
          {/if}
        {/each}
      </div>
    {/if}

    {#if paginationEnabled}
      {@const totalRows = allRowsBeforePagination.length}
      {@const pageSize = paginationState.pageSize}
      {@const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))}
      {@const currentPage = Math.min(paginationState.pageIndex + 1, pageCount)}
      {@const rangeStart =
        totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}
      {@const rangeEnd = Math.min(totalRows, currentPage * pageSize)}
      {@const onFirst = currentPage <= 1}
      {@const onLast = currentPage >= pageCount}
      <div class="sv-grid-pagination" role="navigation" aria-label="Pagination">
        <label class="sv-grid-pagination-pagesize">
          <span>Page Size:</span>
          <select
            onchange={(event) =>
              setPageSize(
                parseInt((event.currentTarget as HTMLSelectElement).value, 10),
              )}
          >
            <option value="10" selected={pageSize === 10}>10</option>
            <option value="25" selected={pageSize === 25}>25</option>
            <option value="50" selected={pageSize === 50}>50</option>
            <option value="100" selected={pageSize === 100}>100</option>
          </select>
        </label>
        <span class="sv-grid-pagination-range">
          <strong>{rangeStart.toLocaleString()}</strong> to
          <strong>{rangeEnd.toLocaleString()}</strong> of
          <strong>{totalRows.toLocaleString()}</strong>
        </span>
        <div class="sv-grid-pagination-nav">
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onFirst}
            onclick={() => goToPage(0)}
            aria-label="First page">⇤</button
          >
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onFirst}
            onclick={() => changePage(-1)}
            aria-label="Previous page">‹</button
          >
          <span class="sv-grid-pagination-label">
            Page <strong>{currentPage.toLocaleString()}</strong> of
            <strong>{pageCount.toLocaleString()}</strong>
          </span>
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onLast}
            onclick={() => changePage(1)}
            aria-label="Next page">›</button
          >
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onLast}
            onclick={() => goToPage(pageCount - 1)}
            aria-label="Last page">⇥</button
          >
        </div>
      </div>
    {/if}

    {#if findOpen}
      <!-- Find-in-grid overlay. Anchored to the TOP of the grid root so
           it tracks the grid even when the page scrolls. Ctrl+F opens;
           Enter cycles to the next hit; Esc closes. -->
      <div class="sv-grid-find" role="search" aria-label="Find in grid">
        <svg class="sv-grid-find-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          class="sv-grid-find-input"
          type="search"
          placeholder="Find in grid…"
          autofocus
          bind:value={findQuery}
          oninput={() => (findHitIndex = 0)}
          onkeydown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              if (findHits.length === 0) return
              findHitIndex = (findHitIndex + (event.shiftKey ? -1 : 1) + findHits.length) % findHits.length
              const hit = findHits[findHitIndex]
              if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
            }
            if (event.key === 'Escape') { event.preventDefault(); findOpen = false; findQuery = '' }
          }}
        />
        <span class="sv-grid-find-count">
          {findHits.length === 0 && findQuery.trim()
            ? 'No matches'
            : findHits.length === 0
              ? ''
              : `${findHitIndex + 1} of ${findHits.length}`}
        </span>
        <button type="button" class="sv-grid-find-step" aria-label="Previous match"
          disabled={findHits.length === 0}
          onclick={() => {
            findHitIndex = (findHitIndex - 1 + findHits.length) % findHits.length
            const hit = findHits[findHitIndex]
            if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
          }}>↑</button>
        <button type="button" class="sv-grid-find-step" aria-label="Next match"
          disabled={findHits.length === 0}
          onclick={() => {
            findHitIndex = (findHitIndex + 1) % findHits.length
            const hit = findHits[findHitIndex]
            if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
          }}>↓</button>
        <button type="button" class="sv-grid-find-close" aria-label="Close find"
          onclick={() => { findOpen = false; findQuery = '' }}>✕</button>
      </div>
    {/if}

    {#if props.loading && props.loadingOverlay}
      <div class="sv-grid-loading-overlay" role="status" aria-live="polite">
        <div class="sv-grid-loading-bar"></div>
        {#if allRows.length === 0}
          <div class="sv-grid-skeleton" aria-hidden="true">
            {#each Array(props.loadingSkeletonRows ?? 8) as _, r (r)}
              <div class="sv-grid-skeleton-row">
                {#each allColumns as col (col.id)}
                  <div
                    class="sv-grid-skeleton-cell"
                    style={`width:${getColumnWidth(col.id)}px`}
                  >
                    <span class="sv-grid-skeleton-bar"></span>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
        <span class="sv-grid-sr-only">Loading…</span>
      </div>
    {/if}

    {#if toolPanelEnabled}
      <button
        type="button"
        class="sv-grid-tool-panel-toggle"
        class:is-open={toolPanelOpen}
        aria-label={toolPanelOpen ? "Close columns panel" : "Open columns panel"}
        aria-expanded={toolPanelOpen}
        onclick={() => (toolPanelOpen = !toolPanelOpen)}
        title="Columns"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="6" height="16" rx="1" />
          <rect x="11" y="4" width="4" height="16" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>
      {#if toolPanelOpen}
        <aside class="sv-grid-tool-panel" aria-label="Columns tool panel">
          <div class="sv-grid-tool-panel-head">
            <span>Columns</span>
            <button
              type="button"
              class="sv-grid-tool-panel-close"
              aria-label="Close"
              onclick={() => (toolPanelOpen = false)}>✕</button
            >
          </div>
          <ul class="sv-grid-tool-panel-list">
            {#each toolPanelColumns as column, i (column.id)}
              {@const visible = !hiddenColumns[column.id]}
              {@const grouped = groupingColumns.includes(column.id)}
              <li class="sv-grid-tool-panel-item">
                <label class="sv-grid-tool-panel-vis">
                  <input
                    type="checkbox"
                    checked={visible}
                    onchange={() => toggleColumnVisibleInPanel(column.id)}
                  />
                  <span class="sv-grid-tool-panel-name">{toolPanelHeaderLabel(column)}</span>
                </label>
                <span class="sv-grid-tool-panel-actions">
                  <button
                    type="button"
                    class="sv-grid-tool-panel-btn"
                    class:is-active={grouped}
                    aria-label={grouped ? "Ungroup" : "Group by"}
                    title={grouped ? "Ungroup" : "Group by this column"}
                    onclick={() => toggleGroupInPanel(column.id)}>⊞</button
                  >
                  <button
                    type="button"
                    class="sv-grid-tool-panel-btn"
                    aria-label="Move up"
                    disabled={i === 0}
                    onclick={() => moveColumnInPanel(column.id, -1)}>↑</button
                  >
                  <button
                    type="button"
                    class="sv-grid-tool-panel-btn"
                    aria-label="Move down"
                    disabled={i === toolPanelColumns.length - 1}
                    onclick={() => moveColumnInPanel(column.id, 1)}>↓</button
                  >
                </span>
              </li>
            {/each}
          </ul>
        </aside>
      {/if}
    {/if}
  </div>
  <!-- /.sv-grid-root -->

  {#if tooltip}
    <!-- Custom hover tooltip. Floats above the grid; positioned by
         showTooltipFor(). Notes and column tooltips both surface here. -->
    <div
      class="sv-grid-tooltip"
      class:sv-grid-tooltip-above={!tooltip.below}
      style={`left: ${tooltip.x}px; top: ${tooltip.y}px; ${tooltip.below ? '' : 'transform: translateY(-100%);'}`}
      role="tooltip"
    >{tooltip.text}</div>
  {/if}

  {#if columnMenuFor || filterMenuFor || operatorMenuFor || chooseColumnsPos}
    <div
      class="sv-grid-menu-backdrop"
      role="presentation"
      onclick={closeMenus}
    ></div>
  {/if}

  {#if columnMenuFor}
    {@const menuColumnId = columnMenuFor}
    {@const menuCol = allColumns.find((c) => c.id === menuColumnId)}
    {@const menuCanSort = menuCol?.getCanSort?.() ?? false}
    <div
      class="sv-grid-menu sv-grid-column-menu"
      role="menu"
      style={`left: ${columnMenuPos.x}px; top: ${columnMenuPos.y}px;`}
    >
      {#if menuCanSort}
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          onclick={() => sortColumnFromMenu(menuColumnId, false)}
        >
          <span class="sv-grid-header-icon">{@render icon("sort-asc")}</span> Sort
          ascending
        </button>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          onclick={() => sortColumnFromMenu(menuColumnId, true)}
        >
          <span class="sv-grid-header-icon">{@render icon("sort-desc")}</span> Sort
          descending
        </button>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={!sortDirectionByColumn[menuColumnId]}
          onclick={() => clearColumnSort(menuColumnId)}
        >
          <span class="sv-grid-header-icon">{@render icon("x")}</span> Remove sort
        </button>
      {/if}
      {#if !columnVirtualizationEnabled}
        {@const menuPinSide = isColumnPinned(menuColumnId)}
        <div class="sv-grid-menu-sep"></div>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={menuPinSide === "left"}
          onclick={() => pinColumnLeft(menuColumnId)}
        >
          <span class="sv-grid-header-icon"
            >{@render icon("op-startsWith")}</span
          > Pin to left
        </button>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={menuPinSide === "right"}
          onclick={() => pinColumnRight(menuColumnId)}
        >
          <span class="sv-grid-header-icon"
            >{@render icon("op-greaterThan")}</span
          > Pin to right
        </button>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={!menuPinSide}
          onclick={() => unpinColumn(menuColumnId)}
        >
          <span class="sv-grid-header-icon">{@render icon("x")}</span> Unpin column
        </button>
      {/if}
      <div class="sv-grid-menu-sep"></div>
      <button
        type="button"
        class="sv-grid-menu-item"
        role="menuitem"
        onclick={() => {
          autosizeColumn(menuColumnId);
          closeMenus();
        }}
      >
        <span class="sv-grid-header-icon">{@render icon("autosize")}</span> Autosize
        this column
      </button>
      <button
        type="button"
        class="sv-grid-menu-item"
        role="menuitem"
        onclick={() => {
          autosizeAllColumns();
          closeMenus();
        }}
      >
        <span class="sv-grid-header-icon">{@render icon("autosize")}</span> Autosize
        all columns
      </button>
      {#if groupingControlsEnabled}
        <div class="sv-grid-menu-sep"></div>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={groupingColumns.includes(menuColumnId)}
          onclick={() => groupByColumnFromMenu(menuColumnId)}
        >
          <span class="sv-grid-header-icon">{@render icon("group")}</span> Group
          by this column
        </button>
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitem"
          disabled={!groupingColumns.includes(menuColumnId)}
          onclick={() => clearGroupingFromMenu(menuColumnId)}
        >
          <span class="sv-grid-header-icon">{@render icon("x")}</span> Remove grouping
        </button>
      {/if}
      <div class="sv-grid-menu-sep"></div>
      <button
        type="button"
        class="sv-grid-menu-item"
        class:is-open={chooseColumnsPos !== null}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={chooseColumnsPos !== null}
        onclick={(event) => openChooseColumns(event)}
      >
        <span class="sv-grid-header-icon">{@render icon("columns")}</span>
        Choose columns
        <span class="sv-grid-header-icon sv-grid-menu-item-chevron"
          >{@render icon("chevron-down")}</span
        >
      </button>
      <button
        type="button"
        class="sv-grid-menu-item"
        role="menuitem"
        onclick={() => {
          resetColumns();
          closeMenus();
        }}
      >
        <span class="sv-grid-header-icon">{@render icon("reset")}</span> Reset columns
      </button>
    </div>
  {/if}

  {#if filterMenuFor && showColumnFiltersEffective}
    {@const menuColumnId = filterMenuFor}
    {@const menuColumn = allColumns.find((c) => c.id === menuColumnId)}
    {@const menuOperatorOptions = operatorsForColumn(menuColumn)}
    {@const menuActiveOperator =
      filterMenuValues[menuColumnId]?.operator ??
      defaultOperatorFor(menuColumn)}
    {@const menuInputType = getEditorInputType(
      (menuColumn?.columnDef.editorType ?? "text") as CellEditorType,
    )}
    <div
      class="sv-grid-menu sv-grid-filter-menu"
      role="menu"
      style={`left: ${filterMenuPos.x}px; top: ${filterMenuPos.y}px;`}
    >
      <div class="sv-grid-menu-filter">
        <div class="sv-grid-menu-filter-head">
          <span class="sv-grid-header-icon">{@render icon("filter")}</span> Filter
          condition
        </div>
        <select
          class="sv-grid-menu-operator-select"
          aria-label="Filter condition"
          value={menuActiveOperator}
          onchange={(event) =>
            updateFilterOperator(
              menuColumnId,
              (event.currentTarget as HTMLSelectElement)
                .value as FilterOperator,
            )}
        >
          {#each menuOperatorOptions as option (option.value)}
            <option value={option.value}
              >{operatorLabelFor(option, menuColumn)}</option
            >
          {/each}
        </select>
        {#if menuActiveOperator !== "isBlank"}
          <input
            class="sv-grid-menu-condition-value"
            type={menuInputType}
            value={filterMenuValues[menuColumnId]?.value ?? ""}
            placeholder={menuActiveOperator === "between" ? "From" : "Filter value..."}
            oninput={(event) =>
              updateFilterMenuValue(
                menuColumnId,
                (event.currentTarget as HTMLInputElement).value,
              )}
          />
          {#if menuActiveOperator === "between"}
            <input
              class="sv-grid-menu-condition-value"
              type={menuInputType}
              value={filterMenuValues[menuColumnId]?.valueTo ?? ""}
              placeholder="To"
              oninput={(event) =>
                updateFilterMenuValueTo(
                  menuColumnId,
                  (event.currentTarget as HTMLInputElement).value,
                )}
            />
          {/if}
        {/if}
        <div class="sv-grid-menu-sep"></div>
        <div class="sv-grid-menu-filter-head">Values</div>
        <input
          class="sv-grid-menu-search"
          placeholder="Search values..."
          bind:value={columnMenuSearch}
        />
        <label class="sv-grid-facet sv-grid-facet-all">
          <input
            type="checkbox"
            checked={isAllFacetsChecked(menuColumnId)}
            onchange={() => toggleAllFacets(menuColumnId)}
          />
          <span class="sv-grid-facet-label">(Select all)</span>
        </label>
        <div class="sv-grid-facet-list">
          {#each columnMenuVisibleFacets as value (value)}
            <label class="sv-grid-facet">
              <input
                type="checkbox"
                checked={isFacetChecked(menuColumnId, value)}
                onchange={() => toggleFacetValue(menuColumnId, value)}
              />
              <span class="sv-grid-facet-label"
                >{value === "" ? "(Blanks)" : value}</span
              >
            </label>
          {:else}
            <div class="sv-grid-facet-empty">No values</div>
          {/each}
        </div>
        {#if columnMenuFacetValues.length > columnMenuVisibleFacets.length}
          <div class="sv-grid-facet-note">
            Showing {columnMenuVisibleFacets.length} of {columnMenuFacetValues.length}
          </div>
        {/if}
        <div class="sv-grid-menu-actions">
          <button
            type="button"
            class="sv-grid-menu-btn"
            disabled={!isColumnFiltered(menuColumnId)}
            onclick={() => clearColumnFilter(menuColumnId)}
          >
            Clear filter
          </button>
          <button
            type="button"
            class="sv-grid-menu-btn sv-grid-menu-btn-primary"
            onclick={closeMenus}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if chooseColumnsPos}
    {@const everyColumn = grid.getAllColumns()}
    <div
      class="sv-grid-menu sv-grid-choose-columns-menu"
      role="menu"
      style={`left: ${chooseColumnsPos.x}px; top: ${chooseColumnsPos.y}px;`}
    >
      <div class="sv-grid-menu-filter-head">Visible columns</div>
      <div class="sv-grid-facet-list">
        {#each everyColumn as column (column.id)}
          <label class="sv-grid-facet">
            <input
              type="checkbox"
              checked={!hiddenColumns[column.id]}
              onchange={(event) => {
                const visible = (event.currentTarget as HTMLInputElement)
                  .checked;
                if (visible) {
                  const next = { ...hiddenColumns };
                  delete next[column.id];
                  hiddenColumns = next;
                } else {
                  hiddenColumns = { ...hiddenColumns, [column.id]: true };
                }
              }}
            />
            <span class="sv-grid-facet-label"
              >{typeof column.columnDef.header === "string"
                ? column.columnDef.header
                : column.id}</span
            >
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if operatorMenuFor}
    {@const opColumnId = operatorMenuFor}
    {@const opColumn = allColumns.find((c) => c.id === opColumnId)}
    {@const opOptions = operatorsForColumn(opColumn)}
    {@const opActive =
      filterMenuValues[opColumnId]?.operator ?? defaultOperatorFor(opColumn)}
    <div
      class="sv-grid-menu sv-grid-operator-menu"
      role="menu"
      style={`left: ${operatorMenuPos.x}px; top: ${operatorMenuPos.y}px;`}
    >
      {#each opOptions as option (option.value)}
        <button
          type="button"
          class="sv-grid-menu-item"
          role="menuitemradio"
          aria-checked={opActive === option.value}
          onclick={() => {
            updateFilterOperator(opColumnId, option.value);
            closeMenus();
          }}
        >
          <span class="sv-grid-header-icon"
            >{@render icon(option.iconName)}</span
          >
          {operatorLabelFor(option, opColumn)}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  /* Root wrapper: holds the shell + pager + any overlays (find, tooltips
   * pinned to the root). Position-relative so absolutely-positioned
   * overlays (the find-in-grid toolbar) anchor to the grid, not the
   * viewport. */
  .sv-grid-root {
    position: relative;
  }
  .sv-grid-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .sv-grid-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 18;
    pointer-events: auto;
    background: color-mix(in srgb, var(--sg-bg, #fff) 35%, transparent);
  }
  /* Indeterminate top progress bar - the "something is happening" signal
     that keeps the current rows visible underneath (no flash). */
  .sv-grid-loading-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 18%, transparent);
  }
  .sv-grid-loading-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 40%;
    background: var(--sg-accent, #2563eb);
    animation: sv-grid-loading-slide 1.1s ease-in-out infinite;
  }
  @keyframes sv-grid-loading-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
  /* First-load skeleton: shimmer placeholder rows under the header. */
  .sv-grid-skeleton {
    position: absolute;
    top: var(--sg-thead-h, 40px);
    left: 0;
    right: 0;
    padding: 0;
    overflow: hidden;
  }
  .sv-grid-skeleton-row {
    display: flex;
    height: var(--sg-pinned-row-h, 36px);
    align-items: center;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-grid-skeleton-cell {
    flex-shrink: 0;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .sv-grid-skeleton-bar {
    display: block;
    height: 10px;
    width: 70%;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--sg-muted, #94a3b8) 18%, transparent) 25%,
      color-mix(in srgb, var(--sg-muted, #94a3b8) 32%, transparent) 50%,
      color-mix(in srgb, var(--sg-muted, #94a3b8) 18%, transparent) 75%
    );
    background-size: 200% 100%;
    animation: sv-grid-shimmer 1.3s linear infinite;
  }
  @keyframes sv-grid-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .sv-grid-tool-panel-toggle {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 21;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: var(--sg-muted, #64748b);
    cursor: pointer;
  }
  .sv-grid-tool-panel-toggle:hover,
  .sv-grid-tool-panel-toggle.is-open {
    color: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
  }
  .sv-grid-tool-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    width: 250px;
    display: flex;
    flex-direction: column;
    background: var(--sg-bg, #fff);
    border-left: 1px solid var(--sg-border, #e2e8f0);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
  }
  .sv-grid-tool-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sg-muted, #64748b);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-grid-tool-panel-close {
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    font-size: 14px;
    cursor: pointer;
  }
  .sv-grid-tool-panel-list {
    list-style: none;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
    flex: 1;
  }
  .sv-grid-tool-panel-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 5px;
  }
  .sv-grid-tool-panel-item:hover {
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.1));
  }
  .sv-grid-tool-panel-vis {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .sv-grid-tool-panel-vis input {
    accent-color: var(--sg-accent, #2563eb);
  }
  .sv-grid-tool-panel-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-grid-tool-panel-actions {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .sv-grid-tool-panel-btn {
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--sg-muted, #64748b);
    font-size: 13px;
    cursor: pointer;
  }
  .sv-grid-tool-panel-btn:hover:not(:disabled) {
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.18));
    color: var(--sg-fg, #0f172a);
  }
  .sv-grid-tool-panel-btn.is-active {
    color: var(--sg-accent, #2563eb);
  }
  .sv-grid-tool-panel-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  /* Root wrapper fill mode: only takes effect when consumer passes
   * containerHeight='100%'. The shell becomes a flex item that expands
   * while the pager keeps its natural height. */
  .sv-grid-root-fill {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .sv-grid-root-fill > .sv-grid-shell {
    flex: 1 1 0;
    min-height: 0;
    height: auto !important;
  }

  .sv-grid-shell {
    position: relative;
    border-bottom: 1px solid var(--sg-border, #cbd5e1);
  }

  .sv-grid-table {
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .sv-grid-table:focus {
    outline: none;
  }

  .sv-grid-column,
  .sv-grid-cell {
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    user-select: none;
  }
  /* Only the active cell + the cell hosting the fill handle become a
     positioning context (so the absolutely-positioned handle anchors
     to the cell box). Adding `position: relative` to EVERY cell paints
     each one as its own layout box and noticeably slows vertical
     scroll on dense grids - keep it scoped. Sticky / pinned cells are
     already positioning contexts via `position: sticky`. */
  .sv-grid-cell-active,
  .sv-grid-cell-has-fill-handle {
    position: relative;
  }
  /* The cell that owns the fill handle gets overflow: visible so the
     handle isn't clipped - chip cells in particular pack pills right up
     to the cell edges, and with overflow: hidden the handle's hover
     scale-up + the handle itself could be partially eaten by them. */
  .sv-grid-cell-has-fill-handle {
    overflow: visible;
  }

  /* Full-width expandable detail row (props.isDetailRow / renderDetailRow).
     Overrides the normal single-line cell clamps so the panel spans every
     column and grows to its natural height. Pair with virtualization={false}
     so the variable height isn't fought by the fixed-row-height virtualizer.
     These rules sit AFTER `.sv-grid-cell` so they win at equal specificity. */
  .sv-grid-detail-row {
    height: auto !important;
  }
  .sv-grid-detail-cell {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
    height: auto;
    padding: 0;
    background: var(--sg-bg, #fff);
    user-select: text;
  }

  /* Pinned columns read as "frozen" via three layered cues:
       1. A distinct tint (slightly stronger than the header) so the
          pinned strip is visible even before you scroll.
       2. A solid 1px divider on the inside edge (toward the scrollable
          middle) and a soft drop shadow extending into the scroll area.
       3. A thin accent stripe on the outermost edge that turns on when
          the grid scrolls past the pin - a familiar Excel-style cue.
     The shadow direction flips based on which side is pinned so it
     always points toward the scrollable middle. */
  .sv-grid-cell[data-pinned="left"],
  .sv-grid-column[data-pinned="left"] {
    background: var(--sg-pinned-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 8%));
    box-shadow:
      inset -1px 0 0 var(--sg-pinned-divider, var(--sg-border, #cbd5e1)),
      8px 0 12px -6px rgba(15, 23, 42, 0.22);
  }
  .sv-grid-cell[data-pinned="right"],
  .sv-grid-column[data-pinned="right"] {
    background: var(--sg-pinned-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 8%));
    box-shadow:
      inset 1px 0 0 var(--sg-pinned-divider, var(--sg-border, #cbd5e1)),
      -8px 0 12px -6px rgba(15, 23, 42, 0.22);
  }
  /* Header row pinned cells get a slightly darker variant + bolder font
     so the frozen header itself reads as part of the grid chrome. */
  .sv-grid-head .sv-grid-column[data-pinned="left"],
  .sv-grid-head .sv-grid-column[data-pinned="right"] {
    background: var(--sg-pinned-header-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 60%, var(--sg-accent, #2563eb) 14%));
    font-weight: 600;
  }
  /* Zebra rows: keep the pinned tint visible (don't let the row-alt
     background bleed through) by re-painting the pinned cells. */
  .sv-grid-row-alt > .sv-grid-cell[data-pinned] {
    background: var(--sg-pinned-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 8%));
  }
  /* When the row is selected, keep the pinned tint but layer the
     selection color over it so the row still reads as selected. */
  .sv-grid-row-selected > .sv-grid-cell[data-pinned] {
    background:
      linear-gradient(
        color-mix(in srgb, var(--sg-selection-bg, #dbeafe) 65%, transparent),
        color-mix(in srgb, var(--sg-selection-bg, #dbeafe) 65%, transparent)
      ),
      var(--sg-pinned-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 8%));
  }
  /* Hovered row keeps the pinned tint distinguishable from the hover. */
  .sv-grid-row:hover > .sv-grid-cell[data-pinned] {
    background:
      linear-gradient(
        color-mix(in srgb, var(--sg-row-hover-bg, #eef2ff) 55%, transparent),
        color-mix(in srgb, var(--sg-row-hover-bg, #eef2ff) 55%, transparent)
      ),
      var(--sg-pinned-bg, color-mix(in oklab, var(--sg-header-bg, #f1f5f9) 70%, var(--sg-accent, #2563eb) 8%));
  }

  .sv-grid-column {
    position: relative;
  }

  /* Column alignment via data-align attribute (see getColumnAlign helper).
   * For body cells text-align is enough; for headers the label lives inside
   * a flex container so we adjust justify-content on the sort button.
   * Padding is biased to the aligned side: left-aligned text gets a 7px
   * left gap; right-aligned numbers/dates get a 7px right gap. */
  .sv-grid-cell[data-align="left"],
  .sv-grid-column[data-align="left"] {
    padding-left: 7px;
  }
  .sv-grid-cell[data-align="right"] {
    text-align: right;
    padding-right: 7px;
  }
  .sv-grid-cell[data-align="center"] {
    text-align: center;
  }
  .sv-grid-column[data-align="right"] {
    padding-right: 7px;
  }
  .sv-grid-column[data-align="right"] .sv-grid-header-sort {
    justify-content: flex-end;
  }
  .sv-grid-column[data-align="center"] .sv-grid-header-sort {
    justify-content: center;
  }

  .sv-grid-resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 5px;
    height: 100%;
    cursor: col-resize;
    user-select: none;
    z-index: 2;
    transition: background-color 100ms ease;
  }

  .sv-grid-resize-handle:hover,
  .sv-grid-resize-handle.is-resizing {
    background: rgba(11, 99, 243, 0.3);
  }

  .sv-grid-head {
    position: sticky;
    top: 0;
    z-index: 6;
    background: var(--sg-header-bg, #f5f7fb);
  }

  /* Header drag-to-reorder. The `draggable` attribute is only set
   * when `enableColumnReorder` is true, so the cursor and drop
   * indicators only show in that mode. */
  .sv-grid-column[draggable="true"] { cursor: grab; }
  .sv-grid-column[draggable="true"]:active { cursor: grabbing; }
  .sv-grid-column.is-dragging { opacity: 0.55; }
  .sv-grid-column.is-drag-target-before,
  .sv-grid-column.is-drag-target-after {
    position: relative;
  }
  .sv-grid-column.is-drag-target-before::before,
  .sv-grid-column.is-drag-target-after::after {
    content: "";
    position: absolute; top: 4px; bottom: 4px; width: 3px;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 2px;
    box-shadow: 0 0 6px #6366f1;
    pointer-events: none;
    z-index: 7;
    animation: sg-drop-pulse 700ms ease-in-out infinite alternate;
  }
  .sv-grid-column.is-drag-target-before::before { left:  -2px; }
  .sv-grid-column.is-drag-target-after::after   { right: -2px; }
  @keyframes sg-drop-pulse { from { opacity: 0.55; } to { opacity: 1; } }

  /* Pinned rows (top / bottom). Each cell sticks individually so the
   * row tracks scroll on every browser. Top rows stick below the sticky
   * thead via --sg-thead-h; bottom rows stick to the bottom of the
   * scroll container. Tinted background distinguishes them from
   * regular rows. */
  .sv-grid-pinned-row td {
    position: sticky;
    z-index: 4;
    background: var(--sg-pinned-bg, color-mix(in oklab, #6366f1 4%, #ffffff));
    border-bottom: 1px solid var(--sg-pinned-border, color-mix(in oklab, #6366f1 24%, transparent));
    font-weight: 600;
  }
  .sv-grid-pinned-row-top td    { top: var(--sg-thead-h, 36px); }
  .sv-grid-pinned-row-bottom td { bottom: 0; border-top: 1px solid var(--sg-pinned-border, color-mix(in oklab, #6366f1 24%, transparent)); }
  /* Stack multiple pinned-top rows: row 1 stops at thead, row 2 stops
   * at thead + 36px, etc. The component itself sets --sg-pinned-top-h
   * to the current pinned-top stack height via $effect. */
  .sv-grid-pinned-row-top[data-pinned-index="1"] td { top: calc(var(--sg-thead-h, 36px) + var(--sg-pinned-row-h, 32px)); }
  .sv-grid-pinned-row-top[data-pinned-index="2"] td { top: calc(var(--sg-thead-h, 36px) + var(--sg-pinned-row-h, 32px) * 2); }
  .sv-grid-pinned-row-top[data-pinned-index="3"] td { top: calc(var(--sg-thead-h, 36px) + var(--sg-pinned-row-h, 32px) * 3); }
  .sv-grid-pinned-row-bottom[data-pinned-index="1"] td { bottom: var(--sg-pinned-row-h, 32px); }
  .sv-grid-pinned-row-bottom[data-pinned-index="2"] td { bottom: calc(var(--sg-pinned-row-h, 32px) * 2); }
  .sv-grid-pinned-row-bottom[data-pinned-index="3"] td { bottom: calc(var(--sg-pinned-row-h, 32px) * 3); }
  /* Sticky-left columns keep their left position; just override their
   * z so they sit above non-pinned pinned-row cells. */
  .sv-grid-pinned-row td[data-pinned] { z-index: 5; }

  /* Group header rows for multi-level (pivot-style) headers. Sits above
   * the standard leaf header row when the column tree has nesting. */
  .sv-grid-group-header-row {
    background: var(--sg-header-bg, #eef2f8);
  }
  .sv-grid-group-header-cell {
    box-sizing: border-box;
    border-bottom: 1px solid var(--sg-border, #d8dee9);
    border-right: 1px solid var(--sg-border, #e2e8f0);
    text-align: center;
    padding: 4px 8px;
    font-weight: 700;
    font-size: 11.5px;
    color: var(--sg-header-fg, #475569);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sv-grid-group-header-placeholder {
    background: transparent;
    border-right-color: transparent;
  }
  .sv-grid-group-header-label {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sv-grid-foot {
    position: sticky;
    bottom: 0;
    z-index: 6;
    background: var(--sg-header-bg, #f5f7fb);
  }

  .sv-grid-container {
    scrollbar-width: auto;
    -ms-overflow-style: auto;
    /* Trap wheel scroll inside the grid. Without this, hitting the top
     * or bottom edge of the grid lets the wheel event chain to the
     * outer page (or any scrollable ancestor), so what feels like one
     * wheel notch keeps scrolling something else - the "starts and
     * doesn't stop" symptom. `contain` cancels the chained scroll
     * but still bounces normally inside the grid. */
    overscroll-behavior: contain;
    /* Disable scroll anchoring. The virtualizer changes the top-spacer
     * height every time the visible row window slides - modern browsers
     * (default `overflow-anchor: auto`) react by quietly adjusting
     * `scrollTop` to keep the visible content stable. That adjustment
     * fires another `scroll` event, which fires `onBodyScroll`, which
     * re-runs the virtualizer, which shifts the spacer again, which
     * adjusts `scrollTop` again - a self-sustaining loop that
     * presents as "the grid keeps scrolling after the wheel stops."
     * Turning anchoring off lets the virtualizer own the scroll
     * position outright. */
    overflow-anchor: none;
  }

  .sv-grid-container.sv-grid-container-custom-scrollbars {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .sv-grid-container.sv-grid-container-custom-scrollbars::-webkit-scrollbar {
    display: none;
  }

  .sv-grid-scrollbar {
    position: absolute;
    z-index: 20;
  }

  /* Scrollbars anchor to the inline-end edge so RTL flips them to the
   * left automatically. `inset-inline-end` resolves to `right` in LTR
   * and `left` in RTL, no manual override needed. */
  .sv-grid-scrollbar-vertical {
    top: 0;
    inset-inline-end: 0;
    width: 16px;
    height: calc(100% - 16px);
  }

  .sv-grid-scrollbar-corner {
    position: absolute;
    top: 0;
    inset-inline-end: 0;
    width: 16px;
    background: var(--sg-header-bg, #f5f7fb);
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    z-index: 6;
    pointer-events: none;
  }

  .sv-grid-scrollbar-corner-br {
    position: absolute;
    inset-inline-end: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    background: var(--sg-header-bg, #eef2f8);
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
    z-index: 21;
    pointer-events: none;
  }

  .sv-grid-scrollbar-horizontal {
    inset-inline-start: 0;
    bottom: 0;
    width: calc(100% - 16px);
    height: 16px;
  }

  .sv-grid-selection-column,
  .sv-grid-selection-cell {
    text-align: center;
    padding-inline: 6px;
    position: sticky;
    z-index: 4;
  }

  /* Row-number column: sticks to the left edge of the scroll viewport. */
  .sv-grid-row-number-column,
  .sv-grid-row-number-cell {
    text-align: right;
    padding-inline: 8px;
    position: sticky;
    left: 0;
    z-index: 4;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .sv-grid-row-number-head {
    color: inherit;
  }

  .sv-grid-filter-row-control {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }

  .sv-grid-filter-operator {
    flex: 2 1 0;
    min-width: 0;
    box-sizing: border-box;
  }

  .sv-grid-filter-value {
    flex: 3 1 0;
    min-width: 0;
    box-sizing: border-box;
  }

  /* Brief glow used when the user clicks the funnel icon while the grid
     is in row-filter mode - draws attention to where the input is so
     the click isn't a no-op. */
  .sv-grid-filter-value.sv-grid-filter-value-pulse {
    animation: sv-grid-filter-pulse 700ms ease-out;
  }
  @keyframes sv-grid-filter-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(11, 99, 243, 0.55); }
    70%  { box-shadow: 0 0 0 6px rgba(11, 99, 243, 0); }
    100% { box-shadow: 0 0 0 0 rgba(11, 99, 243, 0); }
  }

  .sv-grid-checkbox {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin: 0 auto;
    border: 1px solid var(--sg-input-border, #8794a8);
    border-radius: 4px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-accent, #0b63f3);
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background-color 120ms ease;
  }

  /* Color editor - native HTML color input filling the cell so the
     swatch is clickable across the whole cell area, not just the tiny
     OS default size. */
  .sv-grid-cell-editor-color {
    width: 100%;
    height: 100%;
    padding: 2px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .sv-grid-cell-editor-color::-webkit-color-swatch-wrapper { padding: 0; }
  .sv-grid-cell-editor-color::-webkit-color-swatch { border: 0; border-radius: 4px; }
  .sv-grid-cell-editor-color::-moz-color-swatch { border: 0; border-radius: 4px; }

  /* Rating editor - 5 clickable stars + clear button. Renders inline
     in the cell when editorType="rating"; the readonly view renders a
     filled-star count via the default text path (or a snippet cell). */
  .sv-grid-rating-editor {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    height: 100%;
  }
  .sv-grid-rating-star {
    border: 0; background: transparent; cursor: pointer;
    color: var(--sg-rating-empty, #cbd5e1);
    font-size: 18px; line-height: 1;
    padding: 0 1px;
    transition: color 80ms ease, transform 80ms ease;
  }
  .sv-grid-rating-star-on { color: var(--sg-rating-on, #f59e0b); }
  .sv-grid-rating-star:hover { color: var(--sg-rating-hover, #fbbf24); transform: scale(1.12); }
  .sv-grid-rating-clear {
    margin-left: 4px;
    border: 0; background: transparent;
    color: var(--sg-muted, #94a3b8);
    cursor: pointer; font-size: 14px;
  }
  .sv-grid-rating-clear:hover { color: var(--sg-fg, #0f172a); }

  .sv-grid-checkbox[aria-checked="true"],
  .sv-grid-checkbox[aria-checked="mixed"] {
    border-color: var(--sg-accent, #0b63f3);
    background: var(--sg-selection-bg, #eaf2ff);
  }

  .sv-grid-checkbox[aria-checked="true"]::after {
    content: "";
    width: 5px;
    height: 9px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(40deg) translate(-1px, -1px);
  }

  .sv-grid-checkbox[aria-checked="mixed"]::after {
    content: "";
    width: 8px;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
  }

  .sv-grid-checkbox:focus-visible {
    outline: 2px solid var(--sg-accent, #0b63f3);
    outline-offset: 1px;
  }

  .sv-grid-checkbox-readonly {
    cursor: default;
    pointer-events: none;
  }

  .sv-grid-cell-active,
  .sv-grid-cell-editing {
    position: relative;
    /* High enough to sit above pinned-column stacking contexts (z=4) so the
       list/chips popover overlays adjacent cells instead of being clipped. */
    z-index: 20;
    /* `box-shadow: inset` is bound to the cell's own box, so the ring
       clips cleanly with the cell when it's partially scrolled out of
       view (and shows up consistently at the right edge of a virtualized
       window). The previous `outline + outline-offset: -2px` rendered at
       the wrong position on clipped cells in some browsers - it's drawn
       outside the layout box, so the negative offset's effect was
       inconsistent at scroll boundaries. */
    box-shadow: inset 0 0 0 2px var(--sg-accent, #0b63f3);
    outline: none;
    /* Let list/chips popouts extend past the cell box (default cells have
       overflow: hidden so the chips picker would otherwise be clipped). */
    overflow: visible;
  }

  /* Excel-style fill handle: a 7×7 blue square anchored to the bottom-
     right corner of the active cell or selection range. The parent
     `.sv-grid-cell` is `position: relative` (sticky cells override
     that with sticky - which is also a positioning context), so the
     handle anchors to the cell box. */
  /* Excel-style per-cell note indicator. A small triangle in the top-
   * right corner that, when hovered, shows the note tooltip. The
   * triangle IS the hot-zone (12×12 square clipped to a triangle via
   * border tricks); a transparent invisible square on top widens the
   * hit target a little so it's not painful to hit. */
  .sv-grid-cell-note-corner {
    position: absolute;
    top: 0; right: 0;
    width: 12px; height: 12px;
    /* Triangle: 0,0  →  12,0  →  12,12 */
    background:
      linear-gradient(45deg, transparent 50%, var(--sg-note-corner, #f59e0b) 50%);
    cursor: help;
    z-index: 6;
  }
  /* Slightly larger invisible hit area so users don't have to land on
     a 6×6 pixel triangle. */
  .sv-grid-cell-note-corner::before {
    content: '';
    position: absolute;
    inset: -3px -3px 0 0;
  }

  .sv-grid-fill-handle {
    position: absolute;
    /* Sit fully INSIDE the cell box so `overflow: hidden` doesn't clip
       most of the handle. Previously the handle stuck 3px outside the
       cell and the visible 4×4 corner was nearly unclickable - especially
       on chip cells where pills filled the bottom edge. */
    bottom: 0;
    right: 0;
    width: 9px;
    height: 9px;
    background: var(--sg-accent, #0b63f3);
    border: 1px solid var(--sg-bg, #ffffff);
    box-sizing: border-box;
    cursor: crosshair;
    z-index: 15;
    touch-action: none;
  }
  .sv-grid-fill-handle:hover {
    transform: scale(1.3);
    transform-origin: bottom right;
  }

  /* Fill-preview overlay paints a dashed accent border on the cells the
     user is about to fill. Source cells (still in the selection range)
     keep their normal range styling. */
  .sv-grid-cell[data-fill-preview="true"] {
    box-shadow: inset 0 0 0 2px rgba(11, 99, 243, 0.5);
    background: rgba(11, 99, 243, 0.08);
  }

  .sv-grid-cell-editing {
    padding: 0;
  }

  /* The four CSS variables let us compose a single box-shadow that draws the
     selection rectangle outline only on the cells that sit on its edges. */
  .sv-grid-cell[data-selected-range="true"] {
    background: var(--sg-selection-bg, #eef4ff);
    --sv-range-top: 0 0 0 transparent;
    --sv-range-bottom: 0 0 0 transparent;
    --sv-range-left: 0 0 0 transparent;
    --sv-range-right: 0 0 0 transparent;
    box-shadow: var(--sv-range-top), var(--sv-range-bottom),
      var(--sv-range-left), var(--sv-range-right);
  }

  .sv-grid-cell[data-range-top="true"] {
    --sv-range-top: inset 0 2px 0 var(--sg-accent, #0b63f3);
  }

  .sv-grid-cell[data-range-bottom="true"] {
    --sv-range-bottom: inset 0 -2px 0 var(--sg-accent, #0b63f3);
  }

  .sv-grid-cell[data-range-left="true"] {
    --sv-range-left: inset 2px 0 0 var(--sg-accent, #0b63f3);
  }

  .sv-grid-cell[data-range-right="true"] {
    --sv-range-right: inset -2px 0 0 var(--sg-accent, #0b63f3);
  }

  .sv-grid-cell-editor {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    outline: none;
    background: var(--sg-input-bg, #fff);
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    padding: 0 8px;
  }

  /* Filter-related inputs share the same focused-cell outline treatment. */
  .sv-grid-global-filter input:focus,
  .sv-grid-filter-value:focus,
  .sv-grid-column-filter:focus,
  .sv-grid-menu-search:focus,
  .sv-grid-menu-condition-value:focus,
  .sv-grid-menu-operator:focus {
    outline: 2px solid var(--sg-accent, #0b63f3);
    outline-offset: -2px;
    border-color: var(--sg-accent, #0b63f3);
  }

  .sv-grid-cell-editor-number,
  .sv-grid-cell-editor-date,
  .sv-grid-cell-editor-datetime {
    width: 100%;
    height: 100%;
  }

  /* List editor: native <select>. For multi-select it grows into a
     small popup-style listbox that hangs over the cell. */
  .sv-grid-cell-editor-list {
    width: 100%;
    height: 100%;
    appearance: auto;
    font: inherit;
    color: inherit;
    background: var(--sg-input-bg, #fff);
    border: 0;
    padding: 0 6px;
    box-sizing: border-box;
  }
  .sv-grid-cell-editor-list[multiple] {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: auto;
    min-height: 100%;
    max-height: 220px;
    z-index: 5;
    padding: 4px;
    border: 1px solid var(--sg-accent, #0b63f3);
    background: var(--sg-input-bg, #fff);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  }

  /* Free-form chips editor (multi-value cell with removable tokens).
     Absolutely positioned so it can grow downward past the row without
     pushing other rows. Theme-aware background + accent border + drop
     shadow so it reads as a popout above the next row, not as part of
     it. The cell's outer outline is suppressed for this editor - this
     popout already provides its own border. */
  .sv-grid-cell-editor-chips {
    position: absolute;
    top: -1px;
    left: -1px;
    right: -1px;
    min-height: calc(100% + 2px);
    background: var(--sg-header-bg, var(--sg-bg, #ffffff));
    color: var(--sg-fg, #0f172a);
    padding: 4px 6px;
    box-sizing: border-box;
    z-index: 1000;
    overflow: visible;
    display: flex;
    align-items: flex-start;
    border: 1px solid var(--sg-accent, #2563eb);
    border-radius: 6px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  }
  /* When the chips editor is mounted, the parent .sv-grid-cell-editing
     no longer needs its own outline - the popout already shows one. */
  .sv-grid-cell-editing:has(.sv-grid-cell-editor-chips) {
    outline: none;
  }
  .sv-grid-chips-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    width: 100%;
  }
  .sv-grid-chip-input {
    flex: 1 1 80px;
    min-width: 60px;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    color: inherit;
    padding: 2px 4px;
  }
  .sv-grid-chip-picker {
    flex: 1 1 100px;
    min-width: 80px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid rgba(15, 23, 42, 0.15);
    border-radius: 4px;
    padding: 2px 4px;
  }
  .sv-grid-chip-commit {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
    background: var(--sg-accent, #0b63f3);
    border: 0;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
  }
  .sv-grid-chip-commit:hover {
    filter: brightness(1.1);
  }

  /* Chip badge - used both in readonly cell display and inside the
     chips editor. Subtle neutral chrome, scales to the row's font size.
     Readonly chip rows stay on one line (the parent <td> has
     overflow: hidden, so overflowing chips get clipped - widen the
     column or open the editor to see all). */
  .sv-grid-chips-display {
    display: inline-flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    vertical-align: middle;
  }
  .sv-grid-sparkline {
    display: inline-block;
    vertical-align: middle;
    overflow: visible;
  }
  /* Conditional formatting overlays - behind the cell text. */
  .sv-grid-cf-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  .sv-grid-cf-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 0;
    opacity: 0.85;
    border-radius: 0 2px 2px 0;
    pointer-events: none;
  }
  .sv-grid-cell-cf {
    position: relative;
  }
  .sv-grid-status-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
    padding: 6px 14px;
    font-size: 12px;
    color: var(--sg-fg);
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-top: 0;
    flex-shrink: 0;
  }
  .sv-grid-status-item {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .sv-grid-status-label {
    color: var(--sg-muted, #64748b);
    font-weight: 400;
    margin-right: 5px;
  }
  .sv-grid-cf-content {
    position: relative;
    z-index: 1;
  }
  .sv-grid-cf-icon {
    margin-right: 5px;
    font-size: 0.95em;
  }
  .sv-grid-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 0.85em;
    line-height: 1.4;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 18%, transparent);
    color: var(--sg-fg, inherit);
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--sg-accent, #2563eb) 35%, transparent);
    white-space: nowrap;
  }
  .sv-grid-chip-removable {
    padding-right: 2px;
  }
  .sv-grid-chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, transparent);
    color: inherit;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .sv-grid-chip-remove:hover {
    background: rgba(220, 38, 38, 0.7);
    color: #fff;
  }

  .sv-grid-icon {
    width: 1em;
    height: 1em;
    display: block;
    flex: none;
  }

  .sv-grid-header-cell {
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
    min-width: 0;
  }

  .sv-grid-header-sort {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    padding: 2px;
    border: 0;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  /* Custom (function-valued) header rendering. Behaves like the sort
     button but is a div so the consumer's snippet can contain its own
     interactive elements (menu buttons, dropdowns, etc) - button-in-
     button DOM is invalid. */
  .sv-grid-header-custom {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    padding: 2px;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  .sv-grid-header-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sv-grid-header-icon {
    display: inline-flex;
    flex: none;
    font-size: 13px;
    color: var(--sg-muted, #5b6b85);
  }

  .sv-grid-header-icon-hint {
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .sv-grid-column:hover .sv-grid-header-icon-hint {
    opacity: 0.4;
  }

  .sv-grid-header-icon-flag {
    color: var(--sg-accent, #0b63f3);
  }

  .sv-grid-col-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    /* Collapse to zero width when invisible so a non-hovered column
       has no dead space at the right; the funnel (when an active
       filter is on) can then sit flush against the right edge.
       Hover / focus / open expand it back to 22px. */
    width: 0;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--sg-muted, #5b6b85);
    font-size: 15px;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    transition:
      width 140ms ease,
      opacity 140ms ease,
      background-color 120ms ease;
  }

  .sv-grid-column:hover .sv-grid-col-menu-btn,
  .sv-grid-col-menu-btn.is-open,
  .sv-grid-col-menu-btn:focus-visible {
    width: 22px;
    opacity: 1;
    pointer-events: auto;
  }

  /* The funnel filter button is a sibling .sv-grid-col-menu-btn that
     ALSO carries .sv-grid-col-filter-btn. When the column has an
     active filter (.is-active) the funnel stays visible at full size
     even when the column isn't hovered - so users can see at a glance
     which columns are filtered. Because the 3-dot menu still collapses
     to width: 0 in that state, the funnel ends up flush against the
     right edge. On hover, the menu expands back to 22px and pushes the
     funnel left naturally. */
  .sv-grid-col-filter-btn.is-active {
    width: 22px;
    opacity: 1;
    pointer-events: auto;
  }

  .sv-grid-col-menu-btn:hover,
  .sv-grid-col-menu-btn.is-open {
    background: var(--sg-row-hover-bg, #e2e8f3);
  }

  .sv-grid-filter-operator-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex: none;
    height: 24px;
    padding: 0 4px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 4px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #334155);
    font-size: 13px;
    cursor: pointer;
  }

  .sv-grid-filter-operator-btn.is-open {
    border-color: var(--sg-accent, #0b63f3);
  }

  .sv-grid-caret {
    display: inline-flex;
    font-size: 9px;
    color: var(--sg-muted, #94a3b8);
  }

  .sv-grid-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: transparent;
  }

  .sv-grid-menu {
    position: fixed;
    z-index: 901;
    max-height: calc(100vh - 24px);
    overflow: auto;
    padding: 4px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d6dee9);
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
    font-size: 13px;
    color: var(--sg-fg, #1f2937);
  }

  .sv-grid-column-menu {
    width: 260px;
  }

  .sv-grid-operator-menu {
    width: 184px;
  }

  .sv-grid-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sv-grid-menu-item:hover {
    background: var(--sg-row-hover-bg, #eef2f8);
  }

  .sv-grid-menu-item[aria-checked="true"] {
    background: var(--sg-selection-bg, #eaf2ff);
    color: var(--sg-accent, #0b63f3);
  }

  .sv-grid-menu-sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--sg-border, #e6ebf2);
  }

  .sv-grid-menu-filter {
    padding: 4px 6px 6px;
  }

  .sv-grid-menu-filter-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0 6px;
    font-weight: 600;
    color: var(--sg-muted, #475569);
  }

  .sv-grid-menu-search {
    width: 100%;
    height: 28px;
    box-sizing: border-box;
    margin-bottom: 6px;
    padding: 0 8px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 5px;
    font: inherit;
  }

  .sv-grid-menu-filter-row {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }

  .sv-grid-menu-operator-group {
    display: flex;
    gap: 2px;
    margin-bottom: 6px;
  }

  .sv-grid-menu-operator-btn {
    flex: 1 1 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 4px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #475569);
    cursor: pointer;
    transition:
      background-color 100ms ease,
      color 100ms ease,
      border-color 100ms ease;
  }

  .sv-grid-menu-operator-btn:hover {
    background: var(--sg-row-hover-bg, #eef2f8);
  }

  .sv-grid-menu-operator-btn.is-active {
    background: var(--sg-accent, #0b63f3);
    border-color: var(--sg-accent, #0b63f3);
    color: #fff;
  }

  .sv-grid-menu-condition-value {
    flex: 1 1 0;
    min-width: 0;
    height: 28px;
    box-sizing: border-box;
    padding: 0 8px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 5px;
    font: inherit;
  }

  .sv-grid-facet-list {
    max-height: 200px;
    overflow: auto;
    border: 1px solid var(--sg-border, #eaeef4);
    border-radius: 5px;
  }

  .sv-grid-facet {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .sv-grid-facet:hover {
    background: var(--sg-row-hover-bg, #f4f6fa);
  }

  .sv-grid-facet-all {
    border-bottom: 1px solid var(--sg-border, #eaeef4);
    font-weight: 600;
  }

  .sv-grid-facet input {
    flex: none;
  }

  .sv-grid-facet-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sv-grid-facet-empty,
  .sv-grid-facet-note {
    padding: 6px 8px;
    color: var(--sg-muted, #94a3b8);
    font-size: 12px;
  }

  .sv-grid-menu-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding-top: 8px;
  }

  .sv-grid-menu-btn {
    padding: 5px 10px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 5px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #334155);
    font: inherit;
    cursor: pointer;
  }

  .sv-grid-menu-btn-primary {
    background: var(--sg-accent, #0b63f3);
    border-color: var(--sg-accent, #0b63f3);
    color: #fff;
  }

  .sv-grid-menu-item:disabled,
  .sv-grid-menu-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .sv-grid-menu-item:disabled:hover {
    background: transparent;
  }

  .sv-grid-group-row > .sv-grid-cell {
    background: var(--sg-header-bg, #eef2f8);
    font-weight: 600;
    cursor: pointer;
  }

  .sv-grid-row-selected > .sv-grid-cell {
    background: var(--sg-selection-bg, #eaf2ff);
  }

  .sv-grid-group-cell {
    padding: 0 12px;
  }

  .sv-grid-group-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sv-grid-group-toggle {
    border: 0;
    background: transparent;
    padding: 0 4px 0 0;
    font-size: 11px;
    line-height: 1;
    color: var(--sg-fg, #334155);
    cursor: pointer;
  }

  .sv-grid-group-count {
    margin-left: 6px;
    font-weight: 400;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .sv-grid-group-agg {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-fg);
    white-space: nowrap;
  }
  .sv-grid-group-agg-label {
    font-weight: 400;
    color: var(--sg-muted, #64748b);
    margin-right: 4px;
  }
  .sv-grid-group-agg-label::after {
    content: ":";
  }

  .sv-grid-group-child-indent {
    display: inline-block;
    width: 18px;
  }

  /* ---- Custom hover tooltip (column .tooltip + cell notes) ---- */
  .sv-grid-tooltip {
    position: fixed;
    z-index: 10000;
    max-width: 280px;
    padding: 8px 10px;
    background: #0f172a;
    color: #f1f5f9;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
    pointer-events: none;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  :global([data-theme="dark"]) .sv-grid-tooltip { background: #f1f5f9; color: #0f172a; }

  /* ---- Textarea editor ---- */
  .sv-grid-cell-editor-textarea {
    width: 100%;
    min-height: 80px;
    padding: 6px 8px;
    border: 1px solid var(--sg-accent, #6366f1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 4px;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.4;
    resize: vertical;
    outline: none;
    box-shadow: var(--sg-focus-ring, 0 0 0 2px rgba(99, 102, 241, 0.40));
  }

  /* ---- Find-in-grid overlay ---- */
  .sv-grid-find {
    position: absolute;
    top: 8px; right: 8px;
    z-index: 60;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 8px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
    min-width: 280px;
  }
  .sv-grid-find-icon {
    width: 14px; height: 14px;
    color: var(--sg-muted, #94a3b8);
    flex: none;
    margin-left: 2px;
  }
  .sv-grid-find-input {
    flex: 1; min-width: 0;
    border: 0; outline: none;
    background: transparent;
    color: inherit;
    font-size: 13px;
    padding: 2px 6px;
  }
  .sv-grid-find-input::placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-grid-find-count {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
    padding: 0 4px;
    white-space: nowrap;
  }
  .sv-grid-find-step, .sv-grid-find-close {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px;
    background: transparent;
    border: 0;
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .sv-grid-find-step:hover:not(:disabled),
  .sv-grid-find-close:hover {
    background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.12));
    color: var(--sg-fg, #0f172a);
  }
  .sv-grid-find-step:disabled { opacity: 0.30; cursor: default; }
</style>
