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
import type { GroupDisplayType } from "./group-display";
import type { GridMessages } from "./grid-messages";
import type { GridPivotConfig } from "./pivot-view.svelte";
import type { GridPredicateExpr } from "./filtering/predicate-expr";
import type { MenuItem } from "./SvMenuList.svelte";

/** The calendar views the scheduler can render. {@link SchedulerConfig}. The
 *  `timeline*` views are horizontal: time runs left→right and resources are
 *  rows (a single "All" row without `resourceField`). */
export type SchedulerView =
  | "month"
  | "week"
  | "day"
  | "agenda"
  | "timelineDay"
  | "timelineWeek"
  | "timelineMonth"
  | "timelineYear";

/**
 * How overlapping ("colliding") time-grid events are laid out:
 * - `split` - every collision divides the column width evenly (default).
 * - `cap`   - show up to `maxColumns` columns; the rest collapse into a
 *             clickable `+N more` overflow tile.
 * - `stack` - overlapping events overlap with a horizontal offset + z-order
 *             instead of shrinking, so each stays readable (hover to raise).
 */
export type SchedulerCollisionMode = "split" | "cap" | "stack";

/** A scheduler resource - a person / room / machine an event can be assigned to. */
export type SchedulerResource = {
  id: string;
  title?: string;
  color?: string;
  /**
   * This resource's own working windows (hours), optionally per weekday - e.g. a
   * doctor available Mon/Wed/Fri 9-13 and Tue/Thu 14-18. Overrides the global
   * `businessHours` / `nonWorkingDays` for this resource's columns: time outside
   * every matching window is shaded, and (with `restrictToBusinessHours`)
   * non-bookable. A weekday with no matching window is a full day off.
   */
  availability?: ReadonlyArray<{ days?: ReadonlyArray<number>; start: number; end: number }>;
  /**
   * Per-date overrides to this resource's weekly `availability` - a specific day
   * off (`off: true`, e.g. vacation) or custom hours (`windows`) for that one
   * date. Matched by calendar date; takes precedence over `availability` for the
   * matching day.
   */
  dateOverrides?: ReadonlyArray<{
    date: Date | number | string;
    off?: boolean;
    windows?: ReadonlyArray<{ start: number; end: number }>;
  }>;
};
import type {
  ChartType,
  ChartSpec,
  ChartAnnotation,
  ChartReferenceLine,
  ChartValueFormat,
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
 * "clear" | "row_above" | "row_below" | "remove_row" | "remove_col" |
 * "chart"`. The `"chart"` item (chart the selected range) is only shown when
 * `charting` is enabled; it is appended to the default menu automatically.
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
/**
 * Chart view of the grid. Setting the `chart` prop on `<SvGrid>` swaps the table
 * for a chart driven by the grid's FILTERED + SORTED rows - so the search box,
 * column filters and sort all flow through to the chart. Unlike the board and
 * scheduler views, the renderer is free: the grid lazy-loads a built-in
 * `SvChart` view unless a host overrides it via `registerChartView`.
 *
 * The config maps directly onto `rowsToChartSpec` - one row field for the
 * category axis, one or more for the value series (or a `series` field to pivot
 * one series per distinct value).
 *
 * ```svelte
 * <SvGrid {data} {columns}
 *   chart={{ type: 'bar', category: 'month', value: 'revenue', reduce: 'sum' }} />
 * ```
 */
export type ChartViewConfig<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = {
  /** Chart type. Default `'bar'`. */
  type?: ChartType;
  /** Row field for the category (x) axis. */
  category: keyof TData & string;
  /** Row field(s) for the value (y) series. */
  value: (keyof TData & string) | Array<keyof TData & string>;
  /** Pivot dimension: one series per distinct value of this field. */
  series?: keyof TData & string;
  /** Aggregation when several rows share a category. Default `'sum'`. */
  reduce?: "sum" | "avg" | "count";
  /** Stack bar / area series instead of grouping them. */
  stacked?: boolean;
  /** Stack to 100% (implies `stacked`). */
  stacked100?: boolean;
  /** Order categories. Default: insertion order (value-desc when `topN` is set). */
  sort?: "value-desc" | "value-asc" | "category" | "none";
  /** Keep only the top N categories; bucket the rest into "Other". */
  topN?: number;
  /** Palette for series without an explicit colour. */
  palette?: string[];
  /** Number format for the value axis, tooltips and data labels. */
  valueFormat?: ChartValueFormat;
  /** Show the clickable legend. Default `true`. */
  legend?: boolean;
  /** Draw the value on each bar / point / slice. Default `false`. */
  dataLabels?: boolean;
  /** Show the search box above the chart (filters rows first). Default `true`. */
  searchable?: boolean;
  /** Placeholder for the search box. */
  searchPlaceholder?: string;
};

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

/**
 * The built-in event detail drawer for the scheduler. Set `scheduler.drawer`
 * (`true` for all fields, or this object) and clicking an event opens a drawer
 * with an `SvForm` of its fields. Mirrors {@link BoardDrawerConfig}.
 */
export type SchedulerDrawerConfig<TData extends RowData = RowData> = {
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

/** Emitted when an event is dragged to a new time (and/or resource). */
export type SchedulerEventMoveEvent<TData extends RowData = RowData> = {
  /** The dragged row. */
  row: TData;
  /** New start / end after the move. */
  start: Date;
  end: Date;
  /** Whether the event is all-day after the move. */
  allDay: boolean;
  /** Resource it came from (only with `resourceField`). */
  fromResource?: string;
  /** Resource it was dropped on (only with `resourceField`). */
  toResource?: string;
};

/** Emitted when an event's start or end edge is dragged to resize it. */
export type SchedulerEventResizeEvent<TData extends RowData = RowData> = {
  row: TData;
  start: Date;
  end: Date;
};

/**
 * A drag-selected range (see `rangeSelectable`). `start`/`end` are a single
 * CONTINUOUS datetime range - dragging across days makes it a longer span, not a
 * per-day rectangle. `days` / `resourceIds` list the days / resources the range
 * touched (for reference); `allDay` is true when the all-day row was dragged.
 */
export type SchedulerRangeSelection = {
  start: Date;
  end: Date;
  allDay?: boolean;
  /** Every day the range touched (one entry for a within-a-day drag). */
  days: Date[];
  /** Every resource the range touched (empty without `resourceField`). */
  resourceIds: string[];
};

/** Emitted when an event's built-in editor/drawer is saved. */
export type SchedulerEventCommitEvent<TData extends RowData = RowData> = {
  row: TData;
  /** Only the fields that changed, `{ field: newValue }`. */
  changes: Record<string, unknown>;
  /** The full set of edited field values. */
  values: Record<string, unknown>;
};

/**
 * One override of a single occurrence of a recurring event (stored in the row's
 * `recurrenceExceptionsField`). `occurrenceStart` identifies the occurrence (its
 * original start, like an iCal `RECURRENCE-ID`); `deleted` removes just that one,
 * otherwise the given fields override it. Times are the same ISO / Date shape you
 * store on the row.
 */
export type SchedulerException = {
  occurrenceStart: string | number | Date;
  deleted?: boolean;
  start?: string | number | Date;
  end?: string | number | Date;
  title?: string;
  allDay?: boolean;
  /**
   * Per-occurrence overrides for ANY other field (e.g. attendees, calendar,
   * color, resource). Merged over the row for just this occurrence, so "This
   * event" can change fields beyond start / end / title / all-day.
   */
  fields?: Record<string, unknown>;
};

/** How a change to a recurring event should apply. */
export type SchedulerEditScope = "occurrence" | "following" | "series";

/**
 * Fired when a single occurrence of a recurring event is edited or deleted (the
 * user chose "This event"). Append/merge `exception` into the row's
 * `recurrenceExceptionsField`; for `deleted` it carries `{ deleted: true }`.
 */
export type SchedulerOccurrenceChangeEvent<TData extends RowData = RowData> = {
  row: TData;
  /** The occurrence's original start (its identity within the series). */
  occurrenceStart: Date;
  /** The override to store (already in real-instant time). */
  exception: SchedulerException;
  /**
   * Which scope the user chose. `'occurrence'` (default): merge `exception` into
   * the row. `'following'` ("this and all following"): split the series - stop
   * the original series before `occurrenceStart` and start a NEW series at it
   * carrying `exception`'s start/end/deleted. `'series'` never reaches here (it
   * edits the base row directly). Handle `'following'` in your own data.
   */
  scope: SchedulerEditScope;
};

/**
 * Turns the grid into a calendar / scheduler. Set `scheduler` and the grid
 * renders its rows as events on a Month / Week / Day / Agenda calendar (bucketed
 * by time, and optionally split into per-resource columns) instead of a table.
 * Dragging an event fires {@link SchedulerConfig.onEventMove} where you reassign
 * the start / end (and resource) on your own data. Like the Kanban board, it is
 * a pure *view of the grid*: it renders the grid's filtered + sorted rows and
 * writes back only through callbacks, never mutating your data.
 */
export type SchedulerConfig<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = {
  /** Field holding each event's start (`Date` | epoch-ms | ISO string). Required. */
  startField: keyof TData & string;
  /** Field holding the end. Omit to use `defaultDurationMin` from the start. */
  endField?: keyof TData & string;
  /** Boolean field marking an event as all-day (rendered in the all-day row). */
  allDayField?: keyof TData & string;
  /** Field for the event title. Defaults to the first column's field. */
  titleField?: keyof TData & string;
  /** Field holding a per-event accent color (any CSS color). Else `color`. */
  colorField?: keyof TData & string;
  /** Fallback accent color for every event. */
  color?: string;
  /**
   * Field holding a SECONDARY accent color, rendered as a strip on the LEFT edge
   * of the event - distinct from the main `colorField`. Lets an event encode two
   * dimensions at once (e.g. main color = person, left strip = role).
   */
  secondaryColorField?: keyof TData & string;
  /**
   * Field holding a free/busy status that drives a distinct visual treatment
   * (Outlook-style): `'busy'` (default solid), `'free'` (hollow / outline),
   * `'tentative'` (hatched), `'oof'` / `'outOfOffice'` (distinct tint). Ties to
   * iCal `STATUS`. Unrecognised values render as busy.
   */
  statusField?: keyof TData & string;
  /**
   * Field holding minutes-before-start for a reminder. When set (and the event
   * is upcoming) the scheduler fires `onReminder` once as that lead time is
   * crossed - pair it with a toast. Ties to iCal `VALARM`.
   */
  reminderField?: keyof TData & string;
  /** Fired once when an event's reminder lead time is crossed (see `reminderField`). */
  onReminder?: (row: TData, minutesUntil: number) => void;
  /**
   * Field holding a {@link RecurrenceRule} (or array) - the row renders as one
   * event per matching day in view, keeping its time-of-day + duration.
   */
  recurrenceField?: keyof TData & string;
  /**
   * Field holding an array of {@link SchedulerException} - per-occurrence
   * overrides of a recurring event (a moved / edited / deleted single instance).
   * When set, editing a recurring occurrence offers "This event" vs "All events"
   * and "This event" fires {@link onOccurrenceChange}.
   */
  recurrenceExceptionsField?: keyof TData & string;
  /** Event length in minutes when a row has a start but no `endField`. Default 60. */
  defaultDurationMin?: number;

  /** Which views to offer in the toolbar. Default all four. */
  views?: ReadonlyArray<SchedulerView>;
  /** The view shown first. Default `'month'`. */
  initialView?: SchedulerView;
  /** The date the calendar opens on. Defaults to "today". */
  initialDate?: Date | number | string;
  /**
   * Controlled anchor date - when this changes the calendar navigates to it (a
   * mini date-picker or external "go to" can drive the view). Pair with
   * {@link onNavigate} for two-way sync.
   */
  date?: Date | number | string;
  /** Fired when the visible date changes (prev / next / today). */
  onNavigate?: (date: Date) => void;
  /** First day of the week, 0-6 (0 = Sunday). Default 0. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Time-grid slot size in minutes (week / day snap granularity). Default 30. */
  slotMinutes?: number;
  /**
   * Slot sizes (minutes) offered as a runtime picker in the Week / Day time-grid
   * ruler, e.g. `[60, 30, 15, 5]`. When set, a size selector appears in the
   * toolbar and the ruler subdivides accordingly; the active size starts at
   * `slotMinutes`. Omit to hide the picker (the ruler still uses `slotMinutes`).
   */
  slotSizes?: ReadonlyArray<number>;
  /** First / last hour shown in the time-grid band (0-24). Default 0..24. */
  dayStartHour?: number;
  dayEndHour?: number;

  // --- booking rules: working hours, non-working days, conflicts -------------
  /**
   * Working-hours window (hours, e.g. `{ start: 9, end: 17 }`). Time outside it
   * is shaded in the Week / Day time-grid. Visual only - see `disableConflicts`
   * to enforce.
   */
  businessHours?: { start: number; end: number };
  /** Weekday numbers (0 = Sun … 6 = Sat) shaded as non-working (e.g. `[0, 6]`). */
  nonWorkingDays?: ReadonlyArray<number>;
  /** Shade elapsed time on today's column (the past is "used up"). */
  shadeUntilNow?: boolean;
  /**
   * Enforce the shaded time: reject a drag / resize / create that lands outside
   * `businessHours` or on a `nonWorkingDays` day (snap back + flash). Without
   * this the shading is a visual hint only.
   */
  restrictToBusinessHours?: boolean;
  /**
   * Prevent double-booking: dragging / resizing / creating an event so it
   * overlaps another event **on the same resource** is rejected and reverted.
   */
  disableConflicts?: boolean;
  /**
   * Hard-blocked hour bands (e.g. a daily maintenance window `[{ start: 12, end: 13 }]`).
   * Unlike `businessHours` these are ALWAYS non-bookable (drop / create rejected,
   * no opt-in needed) and rendered as a distinct restricted (hatched) band.
   */
  restrictedHours?: ReadonlyArray<{ start: number; end: number }>;
  /** Specific calendar dates that are fully blocked (no bookings) - e.g. closures. */
  restrictedDates?: ReadonlyArray<Date | number | string>;
  /**
   * Highlighted dates (holidays, launches …) - a coloured strip + optional label
   * on that day's column / month cell. Decorative; does not block booking.
   */
  specialDates?: ReadonlyArray<{ date: Date | number | string; label?: string; color?: string }>;
  /** Earliest navigable / bookable date. Prev-nav stops here and creates are blocked before it. */
  minDate?: Date | number | string;
  /** Latest navigable / bookable date. Next-nav stops here and creates are blocked after it. */
  maxDate?: Date | number | string;
  /**
   * Cap concurrent events per resource at any moment: a drag / resize / create
   * that would make more than N events overlap on the same resource is rejected.
   */
  maxEventsPerSlot?: number;
  /**
   * Enable **undo / redo** of drag-move + resize with `Ctrl/Cmd+Z` and
   * `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`). The scheduler re-emits the move/resize
   * callbacks with the reversed values, so your data follows.
   */
  history?: boolean;
  /**
   * Show the current-time indicator - a line across today's column(s) in the
   * Week / Day time-grid and the Day timeline, tracking the local time. On by
   * default; set to `false` to hide it.
   */
  nowIndicator?: boolean;
  /**
   * IANA time zone (e.g. `'America/New_York'`) the whole calendar is shown in -
   * the hour ruler, event positions, day boundaries, all-day grouping and the
   * now-line. Defaults to the browser's local zone. Event `start`/`end` must be
   * instant-unambiguous (UTC / offset ISO or epoch ms) for this to be correct;
   * bare local strings are read as wall-clock in this zone.
   */
  timeZone?: string;
  /**
   * Extra read-only hour rulers for other zones (a "world clock"), shown left of
   * the primary ruler in the Week / Day time-grid. Each entry's `label` heads its
   * column (defaults to a short zone abbreviation).
   */
  secondaryTimeZones?: ReadonlyArray<{ id: string; label?: string }>;
  /**
   * How overlapping time-grid events are laid out. `split` (default) divides the
   * width evenly per collision; `cap` shows up to `maxColumns` then a clickable
   * `+N more` tile; `stack` overlaps them with an offset instead of shrinking.
   */
  collisionMode?: SchedulerCollisionMode;
  /** For `collisionMode: 'cap'`: max side-by-side columns before overflow (min 2). Default 3. */
  maxColumns?: number;
  /** How many days the agenda view spans. Default 30. */
  agendaDays?: number;

  /**
   * Field whose value groups events by resource (people, rooms, machines). In
   * the Week / Day time-grid the columns split into resource x day groups; a
   * resource filter/legend appears in every view. See {@link SchedulerResource}.
   */
  resourceField?: keyof TData & string;
  /** Explicit, ordered resources (with colors). Omit to derive from the data. */
  resources?: ReadonlyArray<SchedulerResource>;
  /**
   * Time-grid resource grouping order. `false` (default) groups by resource then
   * day (resource-major); `true` groups by day then resource (date-major), like
   * Smart's `groupByDate`. Only affects Week / Day when `resourceField` is set.
   */
  groupByDate?: boolean;

  /** Timeline views only: width (px) of the left resource-label gutter. Default 160. */
  resourceAreaWidth?: number;
  /** `timelineDay` tick size + move/resize snap, in minutes. Default = `slotMinutes`. */
  timelineSlotMinutes?: number;
  /** Timeline views only: height (px) of one event lane inside a resource row. Default 26. */
  timelineLaneHeight?: number;

  /** Enable drag-to-move and edge-resize. Without it the calendar is read-only. */
  editable?: boolean;
  /** Fired when an event is dragged to a new time / resource. */
  onEventMove?: (event: SchedulerEventMoveEvent<TData>) => void;
  /** Fired when an event edge is dragged to resize it. */
  onEventResize?: (event: SchedulerEventResizeEvent<TData>) => void;
  /**
   * Fired to create an event - double-clicking an empty slot, or confirming a
   * pending range when no {@link onRangeSelect} is set. `allDay` is `true` when
   * the slot / range is an all-day one (the all-day row, a month day cell, or a
   * multi-day timeline zoom), so the handler can set the `allDayField`.
   */
  onEventAdd?: (start: Date, end: Date, resourceId?: string, allDay?: boolean) => void;
  /**
   * Fired when the event's Delete button is used. Setting this shows a Delete
   * button in the detail drawer (and a `Delete` item is easy to add via
   * `eventMenu`). Remove the row from your data in the handler.
   */
  onEventDelete?: (row: TData) => void;
  /**
   * Fired when a single occurrence of a recurring event is moved / resized /
   * deleted with scope "This event". Merge `event.exception` into the row's
   * `recurrenceExceptionsField` array (keyed by `occurrenceStart`).
   */
  onOccurrenceChange?: (event: SchedulerOccurrenceChangeEvent<TData>) => void;

  /**
   * Selecting empty cells: click or drag across the time-grid / timeline to mark
   * a time range (and, across days / resources, a rectangle of cells). Arrow keys
   * move the selection and `Shift`+arrows extend it. Marking only *marks* the
   * range - it does NOT create anything. The event is created on an explicit
   * confirm: press `Enter`, or right-click the selection and choose "Add Event".
   * Confirming fires {@link onRangeSelect}, or falls back to `onEventAdd` for the
   * first cell; `Escape` cancels the marker.
   *
   * On by default; set to `false` to disable.
   */
  rangeSelectable?: boolean;
  /**
   * Fired when a pending cell range is confirmed with `Enter` or the "Add Event"
   * context menu (see {@link rangeSelectable}) - not on drag release.
   */
  onRangeSelect?: (selection: SchedulerRangeSelection) => void;
  /**
   * Multi-selecting existing events: Ctrl/Cmd-click toggles, Shift-click
   * range-selects; a plain click clears. Selected events move together when one
   * is dragged, and `Delete` removes them (via `onEventDelete`).
   *
   * On by default; set to `false` to disable.
   */
  eventSelectable?: boolean;
  /** Fired when the set of multi-selected events changes. */
  onEventSelectionChange?: (rows: TData[]) => void;

  /**
   * An "unscheduled" backlog list shown beside the Week / Day grid: drag an item
   * onto the calendar to schedule it. Each item is `{ id, title, durationMin?,
   * color? }`. Dropping fires {@link onSchedule} with the drop time + resource.
   */
  unscheduled?: ReadonlyArray<{ id: string; title: string; durationMin?: number; color?: string }>;
  /** Optional heading for the unscheduled backlog panel. Default "Unscheduled". */
  backlogTitle?: string;
  /** Fired when an unscheduled item is dropped on the grid - create an event from it. */
  onSchedule?: (item: { id: string; title: string; durationMin?: number; color?: string }, start: Date, resourceId?: string) => void;
  /**
   * Fired when an event is dragged OFF the calendar onto the backlog panel -
   * remove it from the schedule (and typically push it back to `unscheduled`).
   * Requires the backlog panel (an `unscheduled` list) to be visible.
   */
  onUnschedule?: (row: TData) => void;

  /** Custom event body. Receives the row. Omit for the built-in default (title). */
  event?: Snippet<[TData]>;
  /**
   * Hover tooltip for an event. Set a `Snippet<[TData]>` for custom content, or
   * `true` for the built-in tooltip (title + time + resource). Omit to disable.
   */
  tooltip?: boolean | Snippet<[TData]>;
  /** Delay (ms) before the hover tooltip opens. Default 400. */
  tooltipDelay?: number;
  /** Built-in detail drawer: `true` for all fields, or a config object. */
  drawer?: boolean | SchedulerDrawerConfig<TData>;
  /** Fired when the drawer / editor is saved. */
  onEventCommit?: (event: SchedulerEventCommitEvent<TData>) => void;
  /** Right-click menu for an event. Return items or `undefined` to suppress. */
  eventMenu?: (row: TData) => MenuItem[] | undefined;

  /** Show the search box (binds to the grid's global filter). Default `true`. */
  searchable?: boolean;
  searchPlaceholder?: string;
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
   * Scheduler / calendar mode. When set, the grid renders its rows as events on
   * a Month / Week / Day / Agenda calendar instead of a table. See
   * {@link SchedulerConfig}.
   */
  scheduler?: SchedulerConfig<TFeatures, TData>;
  /**
   * Chart view. When set, the grid renders its FILTERED + SORTED rows as a chart
   * instead of a table (search / filters / sort flow through). Unlike board and
   * scheduler, the renderer is free - the grid lazy-loads a built-in `SvChart`
   * view, overridable via `registerChartView`. See {@link ChartViewConfig}.
   */
  chart?: ChartViewConfig<TFeatures, TData>;
  /**
   * Pivot mode. When set (and `pivotMode` is on), the grid renders its rows as a
   * pivot table in place - the same grid, aggregated across `pivot.rows` /
   * `pivot.cols` with nested column headers - instead of the flat table. The
   * pivot ENGINE ships in `@svgrid/enterprise`; call `enablePivot()` (or
   * `installEnterprise(api)`) to register it, otherwise an upsell note shows.
   * See {@link GridPivotConfig}.
   */
  pivot?: GridPivotConfig<TData>;
  /**
   * Whether pivot mode is currently active. Defaults to `true` when `pivot` is
   * set. Bindable so a toolbar toggle can flip between the pivot and the flat
   * table over the same data.
   */
  pivotMode?: boolean;
  /** Fired when the in-grid Pivot toggle flips `pivotMode`. */
  onPivotModeChange?: (on: boolean) => void;
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
   *   `selectable` - cell selection       (alias of `enableCellSelection`)
   *   `groupable`  - row grouping controls(alias of `showGroupingControls`,
   *                  also injects `columnGroupingFeature`)
   *   `pageable`   - pagination footer    (alias of `showPagination`)
   *
   * Fine-grained props (`enableInlineEditing`, `showPagination`, ...) still
   * work; the shortcut wins only when it is explicitly set.
   */
  sortable?: boolean;
  /**
   * Click a header to filter that column. Injects `columnFilteringFeature`,
   * so you do not import it yourself. Which filter surface appears is a
   * separate question - see `filterMode` (default `'menu'`).
   *
   *   <SvGrid {data} {columns} filterable />
   */
  filterable?: boolean;
  /**
   * Inline cell editing. Alias of `enableInlineEditing`, and wins over it when
   * both are set. A column also needs an `editorType` to be editable; without
   * one it falls back to a text editor.
   *
   *   <SvGrid {data} {columns} editable />
   */
  editable?: boolean;
  /**
   * Cell selection - click a cell to select it, drag or shift-click to extend
   * the selection to a range. Alias of `enableCellSelection`, and the highest
   * priority of the three inputs that decide it:
   * `selectable` -> `enableCellSelection` -> `selectionMode`.
   *
   * NOTE the asymmetry with its siblings, which are all off until you opt in:
   * this one is **ON by default**, because `selectionMode` defaults to
   * `'both'`. It is named here so the capability is discoverable next to the
   * other shortcuts, and so `selectable={false}` is a one-word way to turn
   * cell selection off (the longhand being `selectionMode="none"`, which also
   * removes the row-selection surface).
   *
   * This is the CELL surface only. The selection **checkbox column** is the
   * other half of `selectionMode`, controlled by `showRowSelection` - also on
   * by default, and it needs no feature import (verified: the column renders
   * and toggles rows with an empty `features` set). Use `selectionMode` when
   * you want to move both surfaces at once.
   */
  selectable?: boolean;
  /**
   * Client-side tree data: nest rows into a hierarchy by parent id.
   *
   * ```svelte
   * <SvGrid {data} {columns} treeData={{ parentField: 'managerId', column: 'name' }} />
   * ```
   *
   * Unlike grouping, tree rows are real data rows - they keep their cells,
   * editing and selection, and only gain an expander plus indentation in
   * `column`. Rows whose parent is missing become roots rather than vanishing.
   *
   * For NESTED source data (`children: [...]`), flatten it first with
   * `flattenTreeData(data, { childrenField: 'children' })` and point
   * `parentField` at the `__parentId` it stamps on.
   *
   * Setting this replaces row grouping - a row cannot be both.
   */
  treeData?: {
    /** Field holding each row's parent id. */
    parentField: string;
    /** Field holding the row's own id. Defaults to `'id'`. */
    idField?: string;
    /**
     * Column id that carries the expander + indentation. Defaults to the first
     * visible column.
     */
    column?: string;
    /** Indent per depth level, in px. Default `12`. */
    indentPx?: number;
  };
  /**
   * Show the grouping controls: "Group by this column" in the column menu, and
   * the group panel when `showGroupPanel` is on. Alias of
   * `showGroupingControls`, and also injects `columnGroupingFeature`.
   *
   * This turns on the UI for grouping. To group without asking the user, set
   * `groupBy` instead.
   *
   *   <SvGrid {data} {columns} groupable />
   */
  groupable?: boolean;
  /**
   * Group the rows by these column ids, outermost first - `['region',
   * 'country']` rolls country up inside region.
   *
   * ```svelte
   * <SvGrid {data} {columns} {features} groupBy={['department']} />
   * ```
   *
   * The prop seeds the group-by list and re-applies whenever it changes, so it
   * works both as initial state and as a controlled value. The column menu and
   * `api.setGroupBy()` write the same state; a change from either survives
   * until this prop's own value changes.
   *
   * Ignored when `treeData` is set - a row cannot be both a hierarchy node and
   * bucketed under a group banner.
   */
  groupBy?: ReadonlyArray<string>;
  /**
   * Which group / tree rows are expanded, keyed by row id.
   *
   * Expansion is owned by the engine by default; pass this prop to hoist it
   * (saved views, "expand everything on load", persisted UI state). Like
   * `groupBy` it seeds the state and re-applies whenever it changes.
   *
   * Group row ids are built from the grouping path, not the display label:
   * `group_department_Engineering`, and one level deeper
   * `group_department_Engineering_role_Senior`. Tree rows key off the engine's
   * row id instead (set `getRowId` to make that your own id). Prefer capturing
   * the map from `onExpandedChange` over hand-building these keys.
   */
  expanded?: Record<string, boolean>;
  /**
   * Fired whenever the expanded set changes - chevron clicks,
   * `api.setRowExpanded()`, `expandAllGroups()` / `collapseAllGroups()`.
   * Receives the full next map, so it can be written straight back into
   * `expanded` for a controlled setup.
   */
  onExpandedChange?: (expanded: Record<string, boolean>) => void;
  /**
   * Render a subtotal row after each group's children, carrying that group's
   * aggregate values under the columns they belong to (the columns with an
   * `aggregate` set). Off by default.
   *
   * Footers are inserted after paging, so they never count against `pageSize` -
   * a page shows its `pageSize` data rows plus whatever footers close on it.
   */
  groupFooters?: boolean;
  /**
   * Append a grand-total row at the very end, aggregating the whole filtered
   * set (not just the current page) with each column's `aggregate` function.
   *
   * Independent of `groupFooters`: use it on a flat grid for a bottom totals
   * line, or alongside group subtotals for both. Like group footers it is
   * appended after paging, so it never counts against `pageSize` - but it is
   * only appended on the LAST page, so a total never appears mid-dataset.
   * Columns without an `aggregate` are left blank.
   */
  grandTotalRow?: boolean;
  /**
   * How grouped rows are displayed.
   *
   * - `groupRows` (default): a full-width banner row per group. Unchanged
   *   behaviour - existing grids are untouched.
   * - `singleColumn`: one synthetic "Group" column holding every level,
   *   indented by depth.
   * - `multipleColumns`: one synthetic column per grouped field.
   *
   * Both column modes hide the grouped source columns, since their values move
   * into the auto column(s), and render group rows as ordinary rows so their
   * aggregate cells line up under the real columns.
   */
  groupDisplayMode?: GroupDisplayType;
  /** Header for the combined `singleColumn` auto-group column. Default `"Group"`. */
  autoGroupColumnHeader?: string;
  /** Width (px) of each auto-group column. Default `220`. */
  autoGroupColumnWidth?: number;
  /**
   * Show the pagination footer. Alias of `showPagination`, and wins over it
   * when both are set. Page size starts at `pageSize` (default 10).
   *
   *   <SvGrid {data} {columns} pageable pageSize={25} />
   */
  pageable?: boolean;
  /**
   * Show the loading state instead of the rows. By default this replaces the
   * grid body with "Loading..."; set `loadingOverlay` to keep the current rows
   * visible under a dimmed overlay instead, which is what you usually want for
   * a server-paged grid.
   */
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
  /**
   * Render an error message in place of the rows. `null` or omitted means no
   * error. Takes precedence over `loading` and over the empty state.
   */
  error?: string | null;
  /**
   * Text shown when there are no rows to display - either the data is empty or
   * a filter matched nothing. Defaults to the localized `noRows` string, so
   * prefer `localization.text.noRows` when you are translating the whole grid.
   */
  emptyMessage?: string;
  /**
   * The single place to localize the grid. One object with two fields:
   *
   * - `locale` - BCP-47 tag(s) for the DATA: accent/case-insensitive filter
   *   matching AND every column's number / currency / percent / date formatting
   *   (when the column's own `format.locales` is unset). The default for
   *   `filterLocale` and per-column format locales.
   * - `text` - overrides for the grid's own UI STRINGS (empty state, tool panel,
   *   pager, status bar, filter operator labels, context-menu items, upsell
   *   notes). Any subset overrides the English defaults; unset keys stay English.
   *
   * ```svelte
   * <SvGrid localization={{ locale: 'fr-FR', text: { noRows: 'Aucune ligne' } }} />
   * ```
   *
   * Omitting it (or any field) is a no-op. See {@link GridMessages}.
   */
  localization?: GridLocalization;
  /**
   * Show the single search box that filters across every column. Explicitly
   * setting this wins over `filterMode`; leaving it unset means it appears only
   * when `filterMode` is `'global'`.
   */
  showGlobalFilter?: boolean;
  /**
   * Show the filter section inside each column's menu. Explicitly setting this
   * wins over `filterMode`; unset, it follows `filterMode` (default `'menu'`,
   * so this is normally on).
   *
   * Setting it `true` also adds the inline "floating filter" input under each
   * header - that surface requires the explicit opt-in, since it otherwise
   * duplicates the menu's own filter popover.
   */
  showColumnFilters?: boolean;
  /**
   * Quick way to pick a single filtering UI. When set it controls which of
   * the three filter surfaces appears (and is overridden per-surface by the
   * `showGlobalFilter` / `showColumnFilters` / `showFilterRow` props).
   * Defaults to `'menu'` (only the column menu's filter section is shown).
   */
  filterMode?: "row" | "menu" | "global" | "none";
  /**
   * Show the grouping affordances (the column menu's "Group by this column",
   * and the group panel). The `groupable` shortcut sets this and registers the
   * grouping feature in one go; prefer that unless you have already registered
   * `columnGroupingFeature` yourself.
   */
  showGroupingControls?: boolean;
  /**
   * Show the row-selection checkbox column, including the select-all checkbox
   * in the header. Unset, it follows `selectionMode` (default `'both'`, so
   * row selection is on).
   */
  showRowSelection?: boolean;
  /**
   * Show the pagination footer. Off by default. `pageable` is the shortcut
   * alias and wins when both are set.
   */
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
  /**
   * Render only the rows in view instead of all of them. **On by default** -
   * this is what keeps a 100,000-row grid responsive.
   *
   * Turn it off when a row's height cannot be known up front and must not be
   * clipped, such as a variable-height master-detail panel. Expect the DOM to
   * hold every row when you do.
   */
  virtualization?: boolean;
  /** Row height in pixels. Pass a function `(rowIndex) => px` for
   *  per-row variable heights (e.g. an interactive row-resize feature).
   *  Defaults to 30. */
  rowHeight?: number | ((rowIndex: number) => number);
  /**
   * Size each row to its own content instead of a fixed height: cell text wraps
   * and the row grows to fit the tallest cell. Rows are measured after they
   * render, so this works with virtualization - `rowHeight` (or 30) is the
   * estimate used before a row has been measured, which keeps the scrollbar
   * stable while you scroll into new rows.
   *
   * Costs a measurement pass per row, so prefer a fixed `rowHeight` when your
   * content is uniform. Ignored when `rowHeight` is a function (you are already
   * supplying per-row heights).
   */
  autoRowHeight?: boolean;
  /**
   * Let the user drag a row's bottom edge to change its height. **Off by
   * default**, because a resizable row needs somewhere to grab and most grids
   * do not want a drag target on every row.
   *
   * The grid remembers the heights itself, so this works as a bare boolean -
   * no `rowHeight` function required. Drag, or focus the grip and use Up/Down
   * (Shift for 1px steps).
   *
   * Turning this on also turns on the **row header column** ({@link
   * showRowNumbers}), because that is where the grip lives and where a
   * spreadsheet puts it - a drag target on the edge of a data cell works but
   * reads as an accident. An explicit `showRowNumbers={false}` still wins; the
   * grip then falls back to the row's first cell, and a column of your own
   * carrying `cellClass: 'sv-row-gutter'` is used ahead of either.
   *
   * Ignored under `autoRowHeight`, where the content decides the height and a
   * manual one would immediately be overwritten. For full control of the
   * heights - persisting them, sharing them between grids - pass a
   * function-valued {@link rowHeight} and use the `rowResize` action directly.
   */
  rowResize?: boolean;
  /**
   * Height (px) of a single column-header level row. With multi-level
   * (grouped) headers the total header height is `levels * headerHeight`,
   * since each level renders as its own row. When omitted, header rows size
   * to their content (the default). Does not affect the filter row.
   */
  headerHeight?: number;
  /**
   * Extra rows rendered above and below the viewport, so fast scrolling does
   * not reach empty space before the next batch renders. Defaults to 8.
   * Raise it for very tall rows, lower it to trim DOM work.
   */
  overscan?: number;
  /**
   * Height of the grid's scrollable shell. A number is treated as pixels;
   * a string is used as-is, so callers can pass `'100%'` or `'auto'` to
   * make the grid fill its parent. Defaults to 520 px.
   */
  containerHeight?: number | string;
  /**
   * Render only the columns in view, the horizontal counterpart of
   * `virtualization`. **On by default**, which is what makes a 100-column grid
   * scroll smoothly.
   *
   * It recycles column DOM nodes, so it cannot coexist with sticky pinned
   * columns - turn it off if you need pinning to survive horizontal scrolling.
   */
  columnVirtualization?: boolean;
  /**
   * Extra columns rendered either side of the viewport when
   * `columnVirtualization` is on. Defaults to 3.
   */
  columnOverscan?: number;
  /**
   * Fallback width in pixels for columns whose `ColumnDef` sets no `width`.
   * Defaults to 140.
   */
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
   * Let the user drag a column's edge to change its width. **Off by default**,
   * so `width` means the width you asked for until you say otherwise.
   *
   * Turn it on for grids the reader is meant to arrange - a spreadsheet, a
   * dense report, anything with columns whose content varies in length. Leave
   * it off for layouts you control, and for columns that must keep their size:
   * a row-number gutter, a checkbox column, an icon column.
   *
   * It is grid-wide rather than per-column: there is no `resizable: false` on a
   * single column definition. `api.autosizeColumn()`, `fitColumns` and
   * programmatic width changes work either way - this only governs the drag
   * handle.
   *
   * The handles come from the `columnResize` action, loaded on demand: a grid
   * that leaves this off never fetches that code.
   */
  columnResize?: boolean;
  /**
   * Make the grid usable on narrow screens. When the grid's own width drops
   * below the breakpoint (default `640`px), pinned columns are un-pinned so the
   * whole grid pans, `fitColumns` scaling is suspended (columns keep their
   * natural widths and scroll), touch panning is smoothed, and columns whose
   * `hideBelow` exceeds the width are hidden. `true` uses the default
   * breakpoint; pass `{ breakpoint }` to change it. Off by default.
   */
  responsive?: boolean | { breakpoint?: number };
  /**
   * @deprecated Has no effect - nothing in the grid reads this prop. It is kept
   * only so existing code keeps compiling. The column menu's filter section is
   * controlled by `showColumnFilters`, or by `filterMode="menu"` (the default).
   */
  showFilterMenu?: boolean;
  /**
   * Show the always-visible filter row under the header. Explicitly setting
   * this wins over `filterMode`; unset, it appears only when `filterMode` is
   * `'row'`.
   */
  showFilterRow?: boolean;
  /**
   * Cell selection - click to select, drag or shift-click to extend to a range,
   * which is what clipboard copy and the range fill handle operate on. Unset,
   * it follows `selectionMode` (default `'both'`, so this is on). `selectable`
   * is the shortcut alias and wins over it.
   */
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
  /**
   * Inline cell editing: F2 or double-click opens an editor in the active cell,
   * Enter commits, Esc cancels. Off by default.
   *
   * A column still needs an `editorType` to pick its editor (text, number,
   * date, checkbox, list, ...); without one it gets a plain text editor.
   * `editable` is the shortcut alias and wins over this.
   */
  enableInlineEditing?: boolean;
  /**
   * Full-row editing. When `true`, starting an edit puts the WHOLE row into
   * edit mode - every editable cell shows an inline editor at once - and a
   * single Enter (or focus leaving the row) commits all of them; Esc cancels
   * the whole row. Requires `enableInlineEditing`. The full-row editor covers
   * text / number / date / datetime / checkbox / list-select editor types.
   */
  fullRowEditing?: boolean;
  /**
   * Append a sticky footer row aggregating every filtered row: the sum of a
   * numeric column, `Count: N` otherwise. Choose a different aggregate per
   * column with that column's own `summary` option, or set it to `false` there
   * to leave the cell blank.
   *
   * Off by default. `summary` is the shortcut alias and wins when both are set.
   *
   *   <SvGrid {data} {columns} summary />
   */
  enableRowSummaries?: boolean;
  /**
   * Shortcut alias for {@link enableRowSummaries}. Wins over it when both are
   * set, the same precedence `selectable` has over `enableCellSelection`.
   */
  summary?: boolean;
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
   * **Filter**, and **Columns** tabs (the tabbed layout). Defaults to `false`,
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
   * The sort state to start in - `{ id, desc }` entries. Use with `externalSort`
   * when the initial ordering is decided server-side (e.g. a URL `?sort=` param
   * read in a SvelteKit `load`), so the header sort indicators match the already-
   * sorted data on first render. Applied once at mount; user sorting takes over.
   */
  initialSorting?: Array<{ id: string; desc: boolean }>;
  /**
   * The advanced-filter expression to start in (Pro). Applied once at mount;
   * change it afterwards through `api.setAdvancedFilter()`.
   *
   * Filtering only happens once `@svgrid/enterprise`'s `enableAdvancedFilter()`
   * has registered a compiler - without it the expression is stored and
   * reported but no rows are removed, so the free grid degrades to a no-op
   * rather than to a wrong row set.
   */
  initialAdvancedFilter?: GridPredicateExpr | null;
  /**
   * Fires whenever the advanced-filter expression changes, whatever changed it:
   * `api.setAdvancedFilter()`, `clearAllFilters()`, or the toolbar's clear
   * control.
   *
   * The panel that authors the expression is mounted by you, outside the grid,
   * so it cannot see a change the grid made on its own. Without this, clearing
   * from the toolbar leaves that panel showing a filter the grid is no longer
   * applying. Feed this back into the panel's `expression` prop to keep them
   * agreeing.
   */
  onAdvancedFilterChange?: (expr: GridPredicateExpr | null) => void;
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
   * scale against.
   *
   * - `filtered` (default): every row that survives the filters, ignoring the
   *   page slice. The scale follows what you filtered to but does not shift
   *   when you page, so the same value keeps the same colour on page 1 and
   *   page 2.
   * - `visible`: only the rows currently on screen. Rescales per page - use it
   *   when you want each page's heat map normalized to that page.
   * - `all`: the full unfiltered dataset, for a scale that stays put as you
   *   filter.
   */
  conditionalStatScope?: "filtered" | "visible" | "all";
  /**
   * Fires after an inline edit commits, with the cell's old and new value and
   * the row it belongs to. This is where you persist the change.
   *
   * The grid has already applied the edit to its own state by the time this
   * runs, so it is a notification, not a veto - reject a value with the
   * column's `valueParser` or a validation rule instead.
   */
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

/**
 * The grid's single localization surface (see {@link Props.localization}):
 * `locale` handles the data (filter matching + number/date formatting) and
 * `text` handles the UI strings.
 */
export type GridLocalization = {
  /** BCP-47 tag(s) for filter matching + number / date formatting. */
  locale?: string | ReadonlyArray<string>;
  /** Overrides for the grid's own UI strings. */
  text?: Partial<GridMessages>;
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
  /**
   * The row's underlying data object, captured when the edit started. The
   * commit path resolves the row by id first; this is the fallback for when
   * the row has left the row model mid-edit (a filter typed into the filter
   * row while an editor is open), so the typed value still lands instead of
   * being silently dropped.
   */
  rowRef?: unknown;
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
