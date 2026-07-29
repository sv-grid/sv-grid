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
import type { MenuItem } from "./SvMenuList.svelte";
import type {
  ChartType,
  ChartSpec,
  ChartAnnotation,
  ChartReferenceLine,
} from "./chart";

/** One aggregated bucket returned by a server-side `getAggregate`. */
export type ChartAggregateBucket = { category: string; series?: string; value: number };
/** The request a server-side `getAggregate` receives (whole-dataset charting). */
export type ChartAggregateRequest = {
  dimension: string | undefined;
  measure: string | null;
  series?: string;
  reduce: "sum" | "avg" | "count";
  filterModel: Record<string, unknown>;
};

/**
 * Config for the built-in `charting` prop. All fields optional and additive;
 * `charting={true}` is the zero-config form. Column references are column
 * field names / ids.
 */
export type ChartingConfig<TData extends RowData = RowData> = {
  /** Right-side drawer (default) or bottom dock. */
  position?: "bottom" | "right";
  /** Open the panel on first render. */
  defaultOpen?: boolean;
  /** Initial chart type. */
  defaultType?: ChartType;
  /** Docked-bottom height (px). */
  height?: number;
  /** Drawer width (px). */
  width?: number;
  /** Clicking a chart category filters the grid on the charted dimension. */
  crossFilter?: boolean;
  /** Group-by column. */
  dimension?: string;
  /** Split-by column: one series per distinct value. */
  series?: string;
  /** Measure column, or several for a multi-series chart. */
  measures?: string | string[];
  reduce?: "sum" | "avg" | "count";
  stacked?: boolean;
  stacked100?: boolean;
  /** Per-series-label type override (combo). */
  seriesTypes?: Record<string, "bar" | "line" | "area">;
  /** Per-series-label axis override (dual axis). */
  seriesAxes?: Record<string, "left" | "right">;
  referenceLines?: ChartReferenceLine[];
  averageLine?: boolean;
  trend?: "sma" | "ema" | "linear";
  annotations?: ChartAnnotation[];
  yScale?: "linear" | "log";
  timeAxis?: boolean;
  valueFormat?: "number" | "currency" | "percent" | "compact";
  smooth?: boolean;
  orientation?: "vertical" | "horizontal";
  donut?: number | boolean;
  palette?: string[];
  patternFallback?: boolean;
  topN?: number;
  otherLabel?: string;
  sort?: "value-desc" | "value-asc" | "category" | "none";
  dataLabels?: boolean;
  zoom?: boolean;
  brush?: boolean;
  /** Show the chart's PNG/SVG export toolbar. */
  export?: boolean;
  /** Escape hatch: build a fully custom ChartSpec from the (scoped) rows. */
  buildSpec?: (rows: TData[]) => ChartSpec | null;
  /** Server-side aggregation: chart the whole dataset, not just loaded rows. */
  getAggregate?: (
    request: ChartAggregateRequest,
  ) => Promise<ReadonlyArray<ChartAggregateBucket>>;
  /** Bump to force a server-side refetch. */
  refreshKey?: unknown;
};

/**
 * The built-in card detail drawer. Set `board.drawer` (`true` for all fields,
 * or this object to customize) and opening a card shows a drawer with an
 * `SvForm` of its fields, rendered with the UI-kit editors.
 */
export type BoardDrawerConfig<TData extends RowData = RowData> = {
  /** Fields to show, in order. Omit for every column that has a `field`. */
  fields?: ReadonlyArray<keyof TData & string>;
  /** Drawer title - a string or derived from the row. Defaults to the title field. */
  title?: string | ((row: TData) => string);
  /** Which edge the drawer opens from. Defaults to `'right'`. */
  side?: "right" | "left" | "top" | "bottom";
  /** Drawer size (any CSS length). Defaults to `'380px'`. */
  size?: string;
  /** Save button label. Defaults to `'Save'`. */
  submitLabel?: string;
  /** Form columns inside the drawer. Defaults to `1`. */
  columns?: number;
};

/** Board-native helpers passed to `board.cardMenu` for building context items. */
export type BoardMenuContext<TData extends RowData = RowData> = {
  /** The board's lanes (id + title). */
  lanes: BoardLane[];
  /** Move this card to a lane (board-native; fires onCardMove). */
  moveTo: (laneId: string) => void;
  /** Open this card's editor (inline, or your `onCardEdit`). */
  edit: () => void;
};

/** Board-native helpers passed to `board.laneMenu` for building lane context items. */
export type BoardLaneMenuContext<TData extends RowData = RowData> = {
  /** The lane's id. */
  laneId: string;
  /** The lane's current cards (this swimlane's, if any). */
  cards: TData[];
  /** Whether the lane is collapsed. */
  collapsed: boolean;
  /** Collapse / expand the lane (needs `collapsibleLanes`). */
  toggleCollapse: () => void;
  /** Add a card to the lane (fires `onCardAdd`). */
  addCard: (title?: string) => void;
};

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

/** A single Kanban lane (board column). {@link BoardConfig}. */
export type BoardLane = {
  /** Lane id - equals the `groupBy` field value of the cards it holds. */
  id: string;
  /** Header title. Defaults to the id (or `(empty)` for a blank value). */
  title?: string;
  /** Accent color (any CSS color) for the lane header bar + card ring. */
  color?: string;
  /**
   * Soft max number of cards. When exceeded the lane header is flagged
   * over-limit. Enforcement/styling is an enterprise concern; the count is
   * always shown.
   */
  wipLimit?: number;
};

/** A checklist item inside a card. See {@link BoardConfig.subtasks}. */
export type BoardSubtask = {
  id: string | number;
  title: string;
  done: boolean;
};

/** A comment on a card. See {@link BoardConfig.commentsField}. */
export type BoardComment = {
  id: string | number;
  text: string;
  author?: string;
  /** Timestamp label (any string). */
  at?: string;
};

/**
 * The serializable board layout - the per-card position/edit overlay plus
 * collapsed lanes. Persisted by `board.persistKey` and passed to
 * `board.onLayoutChange`.
 */
export type BoardLayout = {
  /** rowId -> lane id. */
  laneOf?: Record<string, string>;
  /** rowId -> sort order within its lane. */
  orderOf?: Record<string, number>;
  /** rowId -> swimlane id. */
  swimOf?: Record<string, string>;
  /** rowId -> edited field values. */
  edits?: Record<string, Record<string, unknown>>;
  /** lane id -> collapsed. */
  collapsed?: Record<string, boolean>;
  /** swimlane id -> collapsed. */
  collapsedSwim?: Record<string, boolean>;
  /** Explicit lane order (ids), when lanes have been drag-reordered. */
  laneOrder?: string[];
  /** rowId -> subtaskId -> done override. */
  subDone?: Record<string, Record<string, boolean>>;
  /** rowId -> subtasks added on the card. */
  subAdded?: Record<string, BoardSubtask[]>;
};

/** Emitted when a card's built-in editor is saved. */
export type BoardCardCommitEvent<TData extends RowData = RowData> = {
  /** The edited row. */
  row: TData;
  /** Only the fields that changed, `{ field: newValue }`. */
  changes: Record<string, unknown>;
  /** The full set of edited field values. */
  values: Record<string, unknown>;
};

/** Emitted when a card is dragged to a new lane and/or position. */
export type BoardCardMoveEvent<TData extends RowData = RowData> = {
  /** The dragged row. */
  row: TData;
  /** Lane the card came from. */
  fromLane: string;
  /** Lane the card was dropped on. */
  toLane: string;
  /** Insertion index within the destination lane. */
  toIndex: number;
  /** Swimlane the card came from (only when `swimlaneBy` is set). */
  fromSwimlane?: string;
  /** Swimlane the card was dropped on (only when `swimlaneBy` is set). */
  toSwimlane?: string;
};

/**
 * Turns the grid into a Kanban board. Set `board` and the grid renders its
 * rows as cards in horizontal lanes (bucketed by the `groupBy` field) instead
 * of a table. Dragging a card between lanes fires {@link BoardConfig.onCardMove}
 * where you reassign the `groupBy` field on your own data.
 */
export type BoardConfig<TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData> = {
  /** Field whose value buckets each row into a lane. */
  groupBy: keyof TData & string;
  /**
   * Explicit, ordered lanes. Omit to derive lanes from the distinct
   * `groupBy` values found in the data (first-seen order).
   */
  lanes?: ReadonlyArray<BoardLane>;
  /** Custom card body. Receives the row. Omit for the built-in default card. */
  card?: Snippet<[TData]>;
  /**
   * Fired when a card is dragged to a new lane/position. Update your data
   * here (reassign the `groupBy` field, and optionally reorder). Without it
   * the board is display-only.
   */
  onCardMove?: (event: BoardCardMoveEvent<TData>) => void;
  /**
   * Add-card affordance. A `+` in the lane header (or, with `composer`, a
   * type-a-title box at the bottom of the lane) fires this with the lane id
   * and - from the composer - the typed title.
   */
  onCardAdd?: (laneId: string, title?: string) => void;
  /**
   * Show a quick-add composer at the bottom of each lane (a "+ Add a card"
   * button that opens an inline title input; Enter calls `onCardAdd(lane,
   * title)`). Without it, `onCardAdd` shows a plain `+` in the header.
   */
  composer?: boolean;
  /**
   * Field holding a card's checklist of sub-tasks (`BoardSubtask[]`). The card
   * shows a progress chip + bar and expands to an inline checklist with a
   * quick-add. Toggles/adds run through an overlay (never mutating your data)
   * and fire the callbacks below.
   */
  subtasks?: keyof TData & string;
  /** Fired when a sub-task checkbox is toggled. */
  onSubtaskToggle?: (row: TData, subtaskId: string | number, done: boolean) => void;
  /** Fired when a sub-task is added from the card. */
  onSubtaskAdd?: (row: TData, title: string) => void;
  /**
   * Field holding label/tag strings (or `{ text, color }`) shown as chips on
   * the default card's badge row.
   */
  labelsField?: keyof TData & string;
  /** Field holding a due date (Date | ISO string); shown as a badge, red when overdue. */
  dueField?: keyof TData & string;
  /**
   * Field holding one or more assignee names (string | string[]); shown as
   * avatar(s) on the default card's badge row.
   */
  assigneesField?: keyof TData & string;
  /**
   * Enable the built-in card editor: double-click a card (or press F2 while
   * it is focused) to edit its fields inline. Fields are rendered from the
   * columns that declare an `editorType` (or all fields if none do). Ignored
   * when `onCardEdit` is set.
   */
  editable?: boolean;
  /**
   * Open your own editor instead of the built-in one. Called on double-click /
   * F2 with the row; you might open a drawer or route to a detail screen.
   */
  onCardEdit?: (row: TData) => void;
  /**
   * Built-in **detail drawer**: opening a card (double-click / F2) shows an
   * `SvDrawer` with an `SvForm` of its fields (kit editors). `true` = all
   * fields; pass a {@link BoardDrawerConfig} to pick a subset / customize.
   * Ignored when `onCardEdit` is set.
   */
  drawer?: boolean | BoardDrawerConfig<TData>;
  /** Fired when the built-in editor is saved. Persist / mirror the changes. */
  onCardCommit?: (event: BoardCardCommitEvent<TData>) => void;
  /** Field used as the card title. Defaults to the first column's field. */
  titleField?: keyof TData & string;
  /**
   * Column fields shown as label:value meta lines on the default card
   * (max 4). Defaults to the first few non-title, non-groupBy columns.
   */
  cardFields?: ReadonlyArray<keyof TData & string>;
  /**
   * Second grouping axis: split the board into horizontal **swimlanes** by
   * this field. Each swimlane band shows the full lane set with only its own
   * cards. Dragging a card into another band reassigns this field too.
   */
  swimlaneBy?: keyof TData & string;
  /** Let users collapse a swimlane band via its header chevron. */
  collapsibleSwimlanes?: boolean;
  /**
   * Field holding a card's comments - `BoardComment[]` (or plain strings, or a
   * number for a count only). Renders a comment-count badge that expands to a
   * thread; provide the callbacks below to let users write / delete comments.
   */
  commentsField?: keyof TData & string;
  /** Fired when a comment is added on the card; append it to your data. */
  onCommentAdd?: (row: TData, text: string) => void;
  /** Fired when a comment's delete button is pressed; remove it from your data. */
  onCommentDelete?: (row: TData, commentId: string | number) => void;
  /**
   * Field holding a card's attachments - an array or a number. Renders an
   * attachment-count badge on the default card.
   */
  attachmentsField?: keyof TData & string;
  /**
   * Field holding a cover colour (any CSS colour string) shown as a strip
   * across the top of the default card.
   */
  coverField?: keyof TData & string;
  /**
   * Enforce `wipLimit`: reject a drop / keyboard move that would push a lane
   * past its limit (the card snaps back). Off by default (the limit is a
   * soft, visual flag only).
   */
  enforceWip?: boolean;
  /** Let users collapse a lane to a slim strip by clicking its header. */
  collapsibleLanes?: boolean;
  /** Let users drag lane headers to reorder lanes (persisted with `persistKey`). */
  reorderableLanes?: boolean;
  /** Fired after a lane drag-reorder, with the new ordered lane ids. */
  onLaneReorder?: (orderedIds: string[]) => void;
  /**
   * Enable inline lane rename: double-click a lane title to edit it. Fires
   * with the lane id and new title - update your own lane config / data.
   */
  onLaneRename?: (laneId: string, title: string) => void;
  /**
   * Per-swimlane summary shown in the band header (e.g. a points/$ total or a
   * WIP count). Receives the swimlane's cards and its id; return a short string.
   */
  swimlaneSummary?: (rows: TData[], swimId: string) => string;
  /**
   * Right-click (or long-press) a card to open a context menu. Return the
   * menu items for that card; `ctx` gives board-native `moveTo(laneId)` and
   * `edit()` helpers plus the lane list. Return empty/undefined for no menu.
   */
  cardMenu?: (row: TData, ctx: BoardMenuContext<TData>) => ReadonlyArray<MenuItem> | undefined;
  /** Right-click a lane header for a lane context menu (rename / clear / add / collapse). */
  laneMenu?: (laneId: string, ctx: BoardLaneMenuContext<TData>) => ReadonlyArray<MenuItem> | undefined;
  /**
   * Truthy field marks a card as **blocked** (waiting on a dependency): a red
   * corner + a "Blocked" badge on the card. If the value is a non-empty string
   * it is used as the blocked **reason** (shown in the badge tooltip). A blocked
   * card is **locked from moving** (drag + keyboard) until it is unblocked - set
   * {@link BoardConfig.flagBlocksMoves} `false` for a purely visual flag.
   */
  flagField?: keyof TData & string;
  /** Whether a blocked (`flagField`) card is locked from moving. Defaults to `true`. */
  flagBlocksMoves?: boolean;
  /**
   * Field holding a created/started date (Date | ISO string); shown as a
   * relative **age** badge (e.g. `3d`).
   */
  ageField?: keyof TData & string;
  /**
   * Fields to expose as a **facet filter bar** above the board - a chip per
   * distinct value; selecting chips filters the visible cards.
   */
  facets?: ReadonlyArray<keyof TData & string>;
  /**
   * Enable card **multi-select**: click to select, Ctrl/Cmd-click to toggle,
   * and dragging a selected card moves the whole selection. Fires
   * `onSelectionChange`.
   */
  selectable?: boolean;
  /** Fired when the selection changes, with the selected rows. */
  onSelectionChange?: (rows: TData[]) => void;
  /**
   * Field holding a card's **child rows** (`TData[]`) - the card gets a
   * children count and expands to show them as nested mini-cards (epic ->
   * stories). Each child renders its title and, if present, its `groupBy` value.
   */
  childrenField?: keyof TData & string;
  /**
   * Optional per-lane summary shown in the lane header (e.g. a story-point or
   * dollar total). Receives the lane's cards (the current swimlane's, when
   * `swimlaneBy` is set) and the lane id; return a short string.
   */
  laneSummary?: (rows: TData[], laneId: string) => string;
  /** Show the built-in card search box (default `true`). */
  searchable?: boolean;
  /** Placeholder for the search box. Defaults to `"Search cards..."`. */
  searchPlaceholder?: string;
  /**
   * Virtualize each lane so only the cards in view are in the DOM - for boards
   * with thousands of cards per lane. Assumes roughly uniform card height; set
   * `cardHeight` to match your cards.
   */
  virtualized?: boolean;
  /** Estimated card height in px used by `virtualized` windowing (default 76). */
  cardHeight?: number;
  /**
   * Persist the board layout (card positions, edits, collapsed lanes) to
   * `localStorage` under this key, restored on load. Requires `getRowId` for
   * stable identity across reloads.
   */
  persistKey?: string;
  /** Called whenever the board layout changes, with the serializable state. */
  onLayoutChange?: (layout: BoardLayout) => void;
};

export type Props<TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData> = {
  data: ReadonlyArray<TData>;
  columns: Array<ColumnDef<TFeatures, TData>>;
  /**
   * Kanban board mode. When set, the grid renders its rows as cards in
   * horizontal lanes (bucketed by `board.groupBy`) instead of a table. See
   * {@link BoardConfig}.
   */
  board?: BoardConfig<TFeatures, TData>;
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
  /**
   * Make the grid usable on narrow screens. When the grid's own width drops
   * below the breakpoint (default `640`px), pinned columns are un-pinned so the
   * whole grid pans, `fitColumns` scaling is suspended (columns keep their
   * natural widths and scroll), touch panning is smoothed, and columns whose
   * `hideBelow` exceeds the width are hidden. `true` uses the default
   * breakpoint; pass `{ breakpoint }` to change it. Off by default.
   */
  responsive?: boolean | { breakpoint?: number };
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
   * Integrated charting: `true` for the zero-config docked chart panel, or a
   * {@link ChartingConfig} object to author defaults + advanced options.
   */
  charting?: boolean | ChartingConfig<TData>;
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
  /**
   * Which rows feed the min/max range that `colorScale` / `dataBar` formats
   * scale against. `visible` (default): the currently displayed rows (after
   * filtering + paging), so the heat map adapts to what's on screen. `all`:
   * the full unfiltered dataset, for a scale that stays put as you filter.
   */
  conditionalStatScope?: "visible" | "all";
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
   * Server-side group / tree keyboard + accessibility, built into the grid. When
   * set, the grid uses the treegrid role and marks matching rows with
   * `aria-level` / `aria-expanded`, and ArrowRight / ArrowLeft expand / collapse
   * the focused group row (no app-level key handling). Pair with `serverGroupRows`
   * + `SvGroupCell` for the visual expander. Every accessor receives the row data.
   */
  serverGroup?: {
    /** Whether a row is an expandable group / branch. */
    isGroup: (row: TData) => boolean;
    /** Tree depth of the row (0 = top level), for `aria-level`. */
    level: (row: TData) => number;
    /** Whether an expandable row is currently expanded. */
    expanded?: (row: TData) => boolean;
    /** Expand / collapse a group row. Called on ArrowRight / ArrowLeft. */
    onToggle: (row: TData) => void;
  };
  /**
   * Server-side set-filter values. When set, a column's filter checklist is
   * populated by fetching the distinct values from the server (once per column,
   * cached) instead of deriving them from the loaded page - so the checklist
   * shows every value, not just those on screen. Return the distinct string
   * values for the column id.
   */
  serverFilterValues?: (columnId: string) => Promise<string[]>;
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
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "regex"
  | "in"
  | "notIn"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "isBlank"
  | "isNotBlank";
export type FilterOption = {
  value: FilterOperator;
  label: string;
  iconName: string;
};
export type MenuPosition = { x: number; y: number };
