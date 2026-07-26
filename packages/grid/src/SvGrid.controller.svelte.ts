import {
    applyExcelFilter,
    normalizeForFilter,
    createColumnVirtualizer,
    createCoreRowModel,
    createExpandedRowModel,
    createFilteredRowModel,
    createGroupedRowModel,
    createSvelteVirtualizer,
    createSortedRowModel,
    createSvGrid,
    getGridCellDomId,
    rowsToChartSpec,
    sortFns,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    type CellEditorOption,
    type Column,
    type ColumnDef,
    type Row,
    type RowData,
    type TableFeatures,
    type ChartType,
    type ChartSpec,
    type ChartValueFormat,
  } from "./index";
import {
  createRowScrollScaling,
  resolveMaxDomHeight,
} from "./virtualization/scroll-scaling";
import "./sv-grid-scrollbar";
import {
    computeColumnStat,
    formatsNeedingStats,
    type ColumnStat,
  } from "./conditional-formatting";
import SvGridDropdown from "./SvGridDropdown.svelte";
import type {
    Props,
    SelectionRange,
    CellEditState,
    FilterOperator,
    MenuPosition,
    ContextMenuTarget,
    ChartingConfig,
  } from "./SvGrid.types";
import {
    rawToNumber,
  } from "./SvGrid.helpers";
import { createFeatures } from "./features";
import {
    createScrollSync,
  } from "./scroll-sync";
import {
    createKeyboard,
  } from "./keyboard-handlers";
import {
    createSummaries,
  } from "./summaries";
import {
    createMenus,
  } from "./menus";
import {
    createCellRender,
  } from "./cell-render";
import {
    createEditing,
  } from "./editing";
import {
    createSelection,
  } from "./selection";
import {
    createColumns,
  } from "./columns";
import {
    createRowDrag,
  } from "./row-drag";
import {
    createAlignedGrids,
  } from "./aligned-grids";
import {
    resolveColumnTypes,
  } from "./column-types";
import {
    computeColumnGroupMeta,
    hiddenLeavesForCollapse,
  } from "./column-groups";
import {
    createGridApi,
  } from "./build-api";
import {
    createClipboard,
  } from "./clipboard";
import {
    filterOperatorOptions,
    fallbackOperatorOption,
    TEXT_OPERATORS,
    NUMBER_OPERATORS,
    DATE_OPERATORS,
    CHECKBOX_OPERATORS,
    operatorOption,
    operatorsForColumn,
    defaultOperatorFor,
    operatorLabelFor,
  } from "./filter-operators";
import {
    type FacetBucket,
    isBucketableColumn,
    buildBuckets,
    isInBucket,
  } from "./facet-buckets";
import {
    getColumnBaseValue,
    isGroupRow,
    toolPanelHeaderLabel,
    formatSummaryNumeric,
    getColumnAlign,
    getPinnedCellValue,
    getColumnAccessorValue,
    columnDefMatchesId,
  } from "./cell-values";

/**
 * Conservative fallback for the browser's max element height, used during SSR
 * or if runtime detection fails. 8M is below every known engine cap (Firefox
 * ~17.9M, Chrome/Safari ~33.5M) so it is always safe, if coarser than needed.
 */
const MAX_DOM_SCROLL_HEIGHT_FALLBACK = 8_000_000;

/**
 * The browser's actual maximum *scrollable* element height in CSS px. Browsers
 * clamp how tall a single element may be, and the cap is lower on mobile /
 * high-DPR devices (the physical limit is in device px, so a 3x-DPR phone has
 * ~1/3 the CSS-px cap of a 1x desktop). Past that cap a scroll container
 * silently clamps its `scrollHeight` and the tail rows of a huge virtualized
 * grid become unreachable.
 *
 * We measure two signals from one offscreen probe and keep the smaller (see
 * `resolveMaxDomHeight`): the probe's clamped `offsetHeight`, AND the
 * `scrollHeight` a real `overflow:auto` container exposes for it. The second
 * matters because mobile WebKit/Blink can report a generous `offsetHeight` yet
 * expose a smaller scrollable range - trusting the layout height alone is what
 * stranded the last rows on phones. Using a real scroll container also folds in
 * DPR clamping for free. Cached for the page lifetime; constant per browser.
 */
let detectedMaxDomHeight: number | null = null;
/**
 * Seed the `hiddenColumns` map from any column def marked `visible: false`.
 * Walks groups so a hidden group hides all of its leaf columns. Keyed by the
 * same id `setColumnVisible` uses (`id ?? field`), so user toggles afterward
 * stay consistent. Run once at mount; prop changes don't re-apply it.
 */
function initialHiddenColumns<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  defs: ReadonlyArray<ColumnDef<TFeatures, TData>>,
): Record<string, boolean> {
  const hidden: Record<string, boolean> = {};
  const walk = (
    cols: ReadonlyArray<ColumnDef<TFeatures, TData>>,
    inheritedHidden: boolean,
  ) => {
    for (const def of cols) {
      const hide = inheritedHidden || def.visible === false;
      if (def.columns?.length) {
        walk(def.columns, hide);
      } else if (hide) {
        const id = def.id ?? def.field;
        if (id) hidden[id] = true;
      }
    }
  };
  walk(defs, false);
  return hidden;
}

function getMaxDomScrollHeight(): number {
  // Escape hatch: a page may pin the cap via `window.__svgridMaxDomHeight`.
  // Checked before the cache so it always wins. Two uses: reproducing a
  // phone's lower element-height limit on desktop (and our e2e coverage of
  // the huge-list path), and overriding detection on a device where it reads
  // wrong. A non-positive / non-finite value is ignored.
  if (typeof window !== "undefined") {
    const forced = (window as unknown as { __svgridMaxDomHeight?: unknown })
      .__svgridMaxDomHeight;
    if (typeof forced === "number" && Number.isFinite(forced) && forced > 0) {
      return forced;
    }
  }
  if (detectedMaxDomHeight != null) return detectedMaxDomHeight;
  if (typeof document === "undefined" || !document.body) {
    return MAX_DOM_SCROLL_HEIGHT_FALLBACK;
  }
  try {
    // The wrapper is itself an `overflow:auto` scroll container (kept tiny and
    // offscreen so it never affects page layout or scroll), so we can read the
    // height it actually exposes as scrollable - not just the probe's layout
    // height. On high-DPR mobile the two diverge and the scrollable one is the
    // limit that matters.
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;top:0;left:-9999px;width:1px;height:100px;overflow:auto;visibility:hidden;pointer-events:none;";
    const probe = document.createElement("div");
    probe.style.cssText = "width:1px;height:1000000000px;";
    wrap.appendChild(probe);
    document.body.appendChild(wrap);
    const layoutCap = probe.offsetHeight;
    const scrollCap = wrap.scrollHeight;
    document.body.removeChild(wrap);
    detectedMaxDomHeight = resolveMaxDomHeight(
      layoutCap,
      scrollCap,
      MAX_DOM_SCROLL_HEIGHT_FALLBACK,
    );
  } catch {
    detectedMaxDomHeight = MAX_DOM_SCROLL_HEIGHT_FALLBACK;
  }
  return detectedMaxDomHeight;
}

/**
 * Observe an element's size, but run the callback on the next animation frame
 * and coalesce bursts into a single call. This is what keeps the benign but
 * noisy "ResizeObserver loop completed with undelivered notifications" warning
 * out of the console: the browser emits it when an observer callback
 * synchronously mutates layout in a way that would require another notification
 * within the same delivery cycle - which our callbacks do (they bump reactive
 * versions / remeasure, driving a re-layout of the observed element). Deferring
 * the work to the next frame lets the current delivery finish cleanly, so the
 * loop never spans a single cycle. This is especially visible when swapping the
 * whole grid (e.g. switching demos), which remounts everything at once.
 * Returns a disconnect function suitable for an $effect cleanup.
 */
function observeSizeRaf(el: Element, cb: () => void): () => void {
  let frame = 0;
  const observer = new ResizeObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      cb();
    });
  });
  observer.observe(el);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

/**
 * SvGrid controller. The component's entire reactive core - every $state,
 * $derived, $effect and handler - lives here so SvGrid.svelte can stay a thin
 * view. Instantiated once during the component's init (so $effect attaches to
 * the component lifecycle) and consumed through the returned getters.
 */
export type SvGridController<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = ReturnType<typeof createSvGridController<TFeatures, TData>>;

export function createSvGridController<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(props: Props<TFeatures, TData>) {

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
    Record<
      string,
      {
        operator: FilterOperator;
        value: string;
        valueTo?: string;
        // Optional second condition + join for multi-condition filtering
        // within a single column (AND / OR).
        operator2?: FilterOperator;
        value2?: string;
        valueTo2?: string;
        join?: "AND" | "OR";
      }
    >
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
  // Extra committed ranges for multi-range (Ctrl+drag) selection. The
  // `selectionRange` above is always the ACTIVE range being manipulated; these
  // are the finished ones. Full selection = these + the active range.
  let selectionRanges = $state.raw<SelectionRange[]>([]);
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
  // Full-row editing: the row currently in whole-row edit + its per-column
  // draft (keyed by column id). Null when not in full-row mode.
  let fullRowEdit = $state<{ rowId: string; draft: Record<string, unknown> } | null>(null);
  let editedCellValues = $state<Record<string, unknown>>({});

  // ---- Undo / redo (history + pointer model) ---------------------------
  // VSCode-style: one ordered history array, plus a pointer to the index
  // of the NEXT undo step. Avoids the dual-stack edge cases where
  // multiple undo-redo cycles can lose entries.
  // exported for the editing slice (undo/redo)
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
  // Bumps only when a row-model-affecting slice changes (see the store
  // subscription below) - the row-model derivation depends on THIS, not the
  // catch-all gridStateVersion, so navigation doesn't rebuild 1M rows.
  let dataStateVersion = $state(0);
  const selectionColumnWidth = 44;
  const rowNumberColumnWidth = $derived(props.rowNumberWidth ?? 56);
  const showRowNumbersEffective = $derived(props.showRowNumbers ?? false);
  let columnMenuFor = $state<string | null>(null);
  let columnMenuTab = $state<"general" | "filter" | "columns">("general");
  let columnMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let columnMenuSearch = $state("");
  let filterMenuFor = $state<string | null>(null);
  let filterMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let operatorMenuFor = $state<string | null>(null);
  let operatorMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  let chooseColumnsPos = $state<MenuPosition | null>(null);
  let contextMenuFor = $state<ContextMenuTarget<TData> | null>(null);
  let contextMenuPos = $state<MenuPosition>({ x: 0, y: 0 });
  // Editable comments: internal overlay (rowId -> columnId -> note) merged on
  // top of props.notes for immediate feedback, plus the open-editor state.
  let noteOverrides = $state<Record<string, Record<string, string>>>({});
  let commentEditFor = $state<{ rowId: string; columnId: string; x: number; y: number } | null>(null);
  let commentDraft = $state("");
  let valueFilters = $state<Record<string, Set<string>>>({});
  const viewportWidth = $derived.by(() => {
    viewportVersion;
    return scrollContainer ? scrollContainer.clientWidth : 0;
  });
  const viewportHeight = $derived.by(() => {
    viewportVersion;
    return scrollContainer ? scrollContainer.clientHeight : 0;
  });

  // --- responsive (narrow-container) mode ---
  const responsiveBreakpoint = $derived(
    props.responsive && typeof props.responsive === "object" && props.responsive.breakpoint != null
      ? props.responsive.breakpoint
      : 640,
  );
  // Below the breakpoint: un-pin columns (pan the whole grid), suspend
  // fitColumns, and hide `hideBelow` columns. Guarded on width > 0 so it never
  // triggers before the grid has measured.
  const isNarrowResponsive = $derived(
    !!props.responsive && viewportWidth > 0 && viewportWidth < responsiveBreakpoint,
  );
  const EMPTY_PINNING = { left: [] as string[], right: [] as string[] };
  const effectivePinning = $derived(isNarrowResponsive ? EMPTY_PINNING : columnPinning);
  // A column with `hideBelow: N` is dropped while `responsive` is on and the
  // grid is narrower than N px (reads viewportWidth so it re-runs on resize).
  function isHiddenByResponsive(column: { columnDef?: { hideBelow?: number } }): boolean {
    if (!props.responsive) return false;
    const hb = column.columnDef?.hideBelow;
    return hb != null && viewportWidth > 0 && viewportWidth < hb;
  }
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
   *  NOT from `scrollMetrics.scrollHeight` alone. Reading DOM dimensions
   *  during a Svelte derived runs BEFORE the browser paints - the table
   *  hasn't laid out the new rows yet, so `scrollHeight` is briefly 0
   *  even after data loads. That made the overflow flag return false,
   *  hid the scrollbar, and broke dragging.
   *
   *  However, virtualizer.getTotalSize() uses rowHeight * numRows which
   *  underestimates when variable-height rows are present (e.g. master-detail
   *  expanded rows). We therefore take the MAX of the two sources:
   *  - virtualizer.getTotalSize(): correct at initial load (before first paint)
   *  - scrollMetrics.scrollHeight: correct after detail rows expand (DOM is live,
   *    ResizeObserver on gridRootEl already bumps scrollVersion at that point) */
  const hasVerticalOverflow = $derived.by(() => {
    virtualizer.version;
    const virtualizerSize = virtualizer.getTotalSize();
    // scrollMetrics.scrollHeight is 0 before initial paint; once the table
    // is in the DOM it reflects the true content height including expanded rows.
    const domSize = scrollMetrics.scrollHeight;
    return Math.max(virtualizerSize, domSize) > viewportHeight + 1;
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



  // Internal source-of-truth for data and column defs. Seeded from props and
  // re-synced whenever the parent passes a new array; the imperative API
  // mutates these so add/remove operations don't need a callback round-trip.
  // svelte-ignore state_referenced_locally
  let internalData = $state.raw<ReadonlyArray<TData>>(props.data);
  // Resolve `cellDataType` / `inferColumnTypes` into concrete editorType +
  // format defaults once, up front, so every downstream reader sees a normal
  // column. Explicit fields on the ColumnDef always win.
  // svelte-ignore state_referenced_locally
  const resolveCols = (cols: Array<ColumnDef<TFeatures, TData>>) =>
    resolveColumnTypes(cols, props.data?.[0], props.inferColumnTypes === true);
  // svelte-ignore state_referenced_locally
  let internalColumns = $state.raw<Array<ColumnDef<TFeatures, TData>>>(
    resolveCols(props.columns),
  );
  // svelte-ignore state_referenced_locally
  let hiddenColumns = $state<Record<string, boolean>>(
    initialHiddenColumns(props.columns),
  );

  // Collapsible column groups (columnGroupShow). Meta is derived from the tree;
  // `collapsedColumnGroups` is the live set of collapsed group ids, seeded once
  // from each collapsible group's `openByDefault` (default: collapsed).
  const columnGroupMeta = $derived(computeColumnGroupMeta(props.columns as unknown as Array<any>));
  // svelte-ignore state_referenced_locally
  let collapsedColumnGroups = $state<Set<string>>(
    (() => {
      const meta = computeColumnGroupMeta(props.columns as unknown as Array<any>);
      const s = new Set<string>();
      for (const id of meta.collapsibleGroupIds) if (!meta.defaultOpen.get(id)) s.add(id);
      return s;
    })(),
  );
  // Leaf ids hidden right now because their group is collapsed/expanded.
  const hiddenByGroupCollapse = $derived(
    hiddenLeavesForCollapse(columnGroupMeta, collapsedColumnGroups),
  );
  function toggleColumnGroup(groupId: string) {
    const next = new Set(collapsedColumnGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    collapsedColumnGroups = next;
  }
  function isColumnGroupCollapsed(groupId: string) {
    return collapsedColumnGroups.has(groupId);
  }

  $effect(() => {
    // When the consumer replaces `data` (e.g. a "Reset" button), drop any
    // accumulated cell-edit overrides - otherwise `getCellDisplayValue`
    // would keep returning the old edited values from `editedCellValues`
    // even though the underlying data has been replaced.
    internalData = props.data;
    editedCellValues = {};
  });
  $effect(() => {
    internalColumns = resolveCols(props.columns);
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
  // Server-side pagination: the footer reads rowCount/pageIndex from props and
  // emits onPaginationChange instead of slicing locally. Controlled by the
  // consumer. Reactive (unlike sort/filter) so pageIndex/rowCount can change.
  const externalPaginationEnabled = $derived(props.externalPagination === true);
  const passthroughSortedRowModel = ({ rows }: { rows: Array<Row<TData>> }) =>
    rows;


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

  // `gridStateVersion` bumps on EVERY store change (incl. moving the active
  // cell). `dataStateVersion` bumps ONLY when a slice that actually changes the
  // row model changes (sort / filter / pagination / grouping / expansion /
  // selection) - so the O(rows) row-model derivation does NOT re-run on plain
  // keyboard navigation. Without this, arrow-keying a 1,000,000-row grid re-ran
  // the entire core->filter->sort->group pipeline on every keystroke.
  let prevDataSlices:
    | { sorting: unknown; columnFilters: unknown; pagination: unknown; grouping: unknown; expanded: unknown; rowSelection: unknown }
    | null = null;
  $effect(() => {
    const unsubscribe = grid.store.subscribe(() => {
      gridStateVersion += 1;
      const s = grid.getState();
      if (
        !prevDataSlices ||
        prevDataSlices.sorting !== s.sorting ||
        prevDataSlices.columnFilters !== s.columnFilters ||
        prevDataSlices.pagination !== s.pagination ||
        prevDataSlices.grouping !== s.grouping ||
        prevDataSlices.expanded !== s.expanded ||
        prevDataSlices.rowSelection !== s.rowSelection
      ) {
        dataStateVersion += 1;
        prevDataSlices = {
          sorting: s.sorting,
          columnFilters: s.columnFilters,
          pagination: s.pagination,
          grouping: s.grouping,
          expanded: s.expanded,
          rowSelection: s.rowSelection,
        };
      }
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
      .filter(
        (column) =>
          !hiddenColumns[column.id] &&
          !hiddenByGroupCollapse[column.id] &&
          !isHiddenByResponsive(column),
      );
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
    const leftIds = effectivePinning.left;
    const rightIds = effectivePinning.right;
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
    /** Set when this group cell has a collapse toggle. */
    groupId?: string;
    collapsible: boolean;
    collapsed: boolean;
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
    // Leaves hidden by a collapsed/expanded group are skipped everywhere here,
    // so group colSpan + widthPx exclude them and stay aligned with the leaves
    // the body actually renders.
    const hiddenLeaf = hiddenByGroupCollapse;
    function collectLeaves(
      defs: Array<ColumnDef<any, TData>>,
      parentId: string | undefined,
      depthHere: number,
    ): void {
      defs.forEach((def, ix) => {
        const id = buildId(def, parentId, ix);
        if (def.columns?.length) {
          collectLeaves(def.columns, id, depthHere + 1);
        } else if (!hiddenLeaf[id]) {
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
        // Skip leaves the collapse state hides, so leaf indices/colSpans match
        // `leafEntries` (and the body's rendered columns) exactly.
        if (!def.columns?.length && hiddenLeaf[id]) continue;
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
        const collapsible = columnGroupMeta.collapsibleGroupIds.has(n.id);
        return {
          key: `${n.id}_d${d}`,
          label: isLeafEarly ? '' : headerText,
          colSpan: Math.max(1, n.leafEnd - n.leafStart),
          widthPx: sumLeafWidths(n.leafStart, n.leafEnd),
          firstLeafIndex: n.leafStart,
          isPlaceholder: isLeafEarly,
          groupId: collapsible ? n.id : undefined,
          collapsible,
          collapsed: collapsible && collapsedColumnGroups.has(n.id),
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
    for (const id of effectivePinning.left) {
      left[id] = leftAcc;
      leftAcc += getColumnWidth(id);
    }
    const right: Record<string, number> = {};
    let rightAcc = 0;
    for (let i = effectivePinning.right.length - 1; i >= 0; i -= 1) {
      const id = effectivePinning.right[i];
      if (!id) continue;
      right[id] = rightAcc;
      rightAcc += getColumnWidth(id);
    }
    return { left, right };
  });



  // ---- Column reorder (drag headers) ----------------------------------
  // Live drag state for the built-in header drag-to-reorder. Only set
  // when `props.enableColumnReorder` is true.
  let colDragId    = $state<string | null>(null);
  let colDropOnId  = $state<string | null>(null);
  let colDropSide  = $state<"before" | "after" | null>(null);

  // Live drag state for managed row dragging. Only meaningful while a row is
  // being dragged (`props.rowDragManaged`). `rowDropIndex` is the visible row
  // index currently hovered; `rowDropSide` says which edge the drop line paints.
  let rowDragActive = $state<boolean>(false);
  let rowDropIndex  = $state<number | null>(null);
  let rowDropSide   = $state<"before" | "after" | null>(null);









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
      const fieldFn = def.fieldFn;
      const field = def.field;
      const stat = computeColumnStat(
        (function* () {
          for (const row of allRows) {
            yield fieldFn
              ? fieldFn(row.original)
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


  /**
   * Rows AFTER all filtering but BEFORE pagination. Used by the pager to
   * compute the correct "X to Y of Z" range and total page count when
   * filters reduce the dataset.
   */
  const allRowsBeforePagination = $derived.by(() => {
    // Depend on dataStateVersion (row-model-affecting store changes) NOT
    // gridStateVersion - so moving the active cell / selection does not force
    // this O(rows) pipeline to re-run. Filter-input state (globalFilter etc.)
    // and internalData are read below and tracked as their own dependencies.
    dataStateVersion;
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

    // A single condition is "active" if it has the value(s) it needs.
    const condActive = (op: FilterOperator, value: string, valueTo?: string): boolean => {
      if (op === "isBlank") return true;
      if (op === "between") return value.trim().length > 0 && (valueTo ?? "").trim().length > 0;
      return value.trim().length > 0;
    };
    const evalCond = (
      cellValue: unknown,
      columnId: string,
      op: FilterOperator,
      value: string,
      valueTo?: string,
    ): boolean =>
      applyExcelFilter(
        cellValue,
        { id: columnId, operator: op, value, valueTo: op === "between" ? valueTo : undefined },
        { locale: props.filterLocale },
      );
    // A column filter is active if either of its (up to two) conditions is.
    const menuFilters = Object.entries(filterMenuValues).filter(([_, f]) => {
      const a = condActive(f.operator, f.value, f.valueTo);
      const b = !!f.operator2 && condActive(f.operator2, f.value2 ?? "", f.valueTo2);
      return a || b;
    });
    if (menuFilters.length) {
      rows = rows.filter((row) =>
        menuFilters.every(([columnId, f]) => {
          const cellValue = getRowColumnValue(row, columnId);
          const aActive = condActive(f.operator, f.value, f.valueTo);
          const bActive = !!f.operator2 && condActive(f.operator2, f.value2 ?? "", f.valueTo2);
          const ra = aActive ? evalCond(cellValue, columnId, f.operator, f.value, f.valueTo) : null;
          const rb = bActive
            ? evalCond(cellValue, columnId, f.operator2 as FilterOperator, f.value2 ?? "", f.valueTo2)
            : null;
          if (ra === null) return rb ?? true;
          if (rb === null) return ra;
          return f.join === "OR" ? ra || rb : ra && rb;
        }),
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
    // External pagination: `data` already IS the current page - never slice.
    if (!paginationEnabled || externalPaginationEnabled) return rows;
    const { pageIndex, pageSize } = paginationState;
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  });

  // When a filter reduces the dataset, the stored pageIndex can point beyond
  // the last valid page. Reset to page 0 so the grid never shows a blank body.
  // Skipped for external pagination, where the consumer owns pageIndex.
  $effect(() => {
    if (!paginationEnabled || externalPaginationEnabled) return;
    const { pageIndex, pageSize } = paginationState;
    const pageCount = Math.ceil(allRowsBeforePagination.length / pageSize);
    if (pageCount > 0 && pageIndex >= pageCount) {
      grid.setPagination({ pageIndex: 0, pageSize });
    }
  });

  // Footer-facing pagination values. In external mode they come from the
  // consumer-controlled props; otherwise from the local row model + state.
  const paginationTotalRows = $derived(
    externalPaginationEnabled ? (props.rowCount ?? 0) : allRowsBeforePagination.length,
  );
  const paginationPageIndex = $derived(
    externalPaginationEnabled ? (props.pageIndex ?? 0) : paginationState.pageIndex,
  );
  const paginationPageSize = $derived(
    externalPaginationEnabled ? (props.pageSize ?? 10) : paginationState.pageSize,
  );
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


  // ---- Tool panel (docked columns sidebar) -------------------------------
  // svelte-ignore state_referenced_locally
  let toolPanelOpen = $state(props.toolPanelDefaultOpen === true);
  // svelte-ignore state_referenced_locally
  let toolPanelTab = $state<"columns" | "filters">(props.toolPanelDefaultTab ?? "columns");
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

  // ===================================================================
  // Integrated charting (the `charting` prop)
  // ===================================================================
  const chartCfg = $derived.by<ChartingConfig<TData> | null>(() => {
    const c = props.charting;
    if (!c) return null;
    return c === true ? ({} as ChartingConfig<TData>) : (c as ChartingConfig<TData>);
  });
  const chartingEnabled = $derived(!!chartCfg);
  const chartIsCustom = $derived(typeof chartCfg?.buildSpec === "function");
  const chartingConfig = $derived(
    chartCfg
      ? {
          position: chartCfg.position ?? "right",
          defaultOpen: chartCfg.defaultOpen === true,
          defaultType: chartCfg.defaultType ?? "bar",
          height: chartCfg.height ?? 300,
          width: chartCfg.width ?? 460,
          crossFilter: chartCfg.crossFilter !== false,
        }
      : null,
  );

  let chartPanelOpen = $state(
    !!props.charting && props.charting !== true && (props.charting as ChartingConfig).defaultOpen === true,
  );
  let chartSize = $state<number | null>(null);
  let chartFloating = $state(false);
  let chartMaximized = $state(false);
  let chartFloatRect = $state.raw<{ x: number; y: number; w: number; h: number } | null>(null);
  let chartAiHandler = $state<
    ((prompt: string) => Promise<Record<string, unknown> | null>) | null
  >(null);

  // Multiple charts, each an independently-configured working set switched by a
  // tab strip. Pickers / spec read the ACTIVE chart.
  type ChartTabState = {
    id: string;
    title: string;
    type: ChartType;
    reduce: "sum" | "avg" | "count";
    dimensionId: string | null;
    measureId: string | null;
    seriesId: string | null | undefined;
    stacked: boolean | null;
    dataLabels: boolean | null;
    logScale: boolean | null;
    timeAxis: boolean | null;
    valueFormat: ChartValueFormat | null;
  };
  let chartSeq = 0;
  const makeChart = (title: string): ChartTabState => ({
    id: `chart-${chartSeq++}`,
    title,
    type:
      (props.charting && props.charting !== true && (props.charting as ChartingConfig).defaultType) || "bar",
    reduce:
      (props.charting && props.charting !== true && (props.charting as ChartingConfig).reduce) || "sum",
    dimensionId: null,
    measureId: null,
    seriesId: undefined,
    stacked: null,
    dataLabels: null,
    logScale: null,
    timeAxis: null,
    valueFormat: null,
  });
  // svelte-ignore state_referenced_locally
  let charts = $state<ChartTabState[]>([makeChart("Chart 1")]);
  let activeChartIndex = $state(0);
  const activeChart = $derived(
    (charts[Math.min(activeChartIndex, charts.length - 1)] ?? charts[0])!,
  );
  const chartType = $derived(activeChart.type);
  const chartReduce = $derived(activeChart.reduce);
  const chartDimensionId = $derived(activeChart.dimensionId);
  const chartMeasureId = $derived(activeChart.measureId);
  const chartSeriesId = $derived(activeChart.seriesId);
  const chartStacked = $derived(activeChart.stacked);
  const chartDataLabels = $derived(activeChart.dataLabels);
  const chartLogScale = $derived(activeChart.logScale);
  const chartTimeAxis = $derived(activeChart.timeAxis);
  const chartValueFormat = $derived(activeChart.valueFormat);

  const asMeasureList = (m: string | string[] | undefined): string[] =>
    m == null ? [] : Array.isArray(m) ? m : [m];
  const isNumericColumn = (col: Column<TData>): boolean => {
    const dt = col.columnDef.cellDataType;
    if (dt === "number") return true;
    if (dt) return false;
    for (const row of allRows) {
      const v = row.getCellValueByColumnId(col.id);
      if (v == null || v === "") continue;
      return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)));
    }
    return false;
  };
  const columnLabel = (col: Column<TData>): string => {
    const h = col.columnDef.header;
    return typeof h === "string" && h ? h : (col.columnDef.field ?? col.id);
  };
  const chartableColumns = $derived.by(() => {
    const dims: Array<{ id: string; field: string; label: string }> = [];
    const measures: Array<{ id: string; field: string; label: string }> = [];
    for (const col of allColumns) {
      const field = col.columnDef.field;
      if (!field) continue;
      const entry = { id: col.id, field, label: columnLabel(col) };
      if (isNumericColumn(col)) measures.push(entry);
      else dims.push(entry);
    }
    return { dims, measures };
  });
  const chartColumnDefaults = $derived.by(() => {
    const { dims, measures } = chartableColumns;
    let dimId = dims[0]?.id ?? null;
    let seriesId: string | null = null;
    let measureIds = measures[0] ? [measures[0].id] : [];
    const rects = getSelectionRects();
    if (rects.length) {
      let minCol = Infinity;
      let maxCol = -Infinity;
      for (const r of rects) {
        minCol = Math.min(minCol, r.minCol);
        maxCol = Math.max(maxCol, r.maxCol);
      }
      const span = allColumns.slice(minCol, maxCol + 1);
      const spanDims = span.filter((c) => dims.some((d) => d.id === c.id));
      const spanMeasures = span.filter((c) => measures.some((m) => m.id === c.id));
      if (maxCol > minCol) {
        if (spanDims[0]) dimId = spanDims[0].id;
        if (spanDims[1]) seriesId = spanDims[1].id;
        if (spanMeasures.length) measureIds = spanMeasures.map((c) => c.id);
      } else {
        if (spanDims[0]) dimId = spanDims[0].id;
        if (spanMeasures[0]) measureIds = [spanMeasures[0].id];
      }
    }
    return { dimId, seriesId, measureIds, measureId: measureIds[0] ?? null };
  });
  const effectiveChartDimensionId = $derived(
    chartDimensionId ?? chartCfg?.dimension ?? chartColumnDefaults.dimId,
  );
  const effectiveChartMeasureId = $derived(
    chartMeasureId ?? asMeasureList(chartCfg?.measures)[0] ?? chartColumnDefaults.measureId,
  );
  const effectiveChartSeriesId = $derived(
    chartSeriesId !== undefined ? chartSeriesId : (chartCfg?.series ?? chartColumnDefaults.seriesId),
  );
  const effectiveChartMeasureIds = $derived.by<string[]>(() => {
    if (chartMeasureId) return [chartMeasureId];
    const configured = asMeasureList(chartCfg?.measures);
    if (configured.length) return configured;
    return chartColumnDefaults.measureIds;
  });
  const effectiveChartStacked = $derived(chartStacked ?? chartCfg?.stacked ?? false);
  const effectiveChartDataLabels = $derived(chartDataLabels ?? chartCfg?.dataLabels ?? false);
  const effectiveChartLogScale = $derived(chartLogScale ?? chartCfg?.yScale === "log");
  const effectiveChartTimeAxis = $derived(chartTimeAxis ?? chartCfg?.timeAxis === true);
  const chartMeasureFormatDefault = $derived.by<ChartValueFormat | undefined>(() => {
    const col = allColumns.find((c) => c.id === effectiveChartMeasureId);
    const t = (col?.columnDef.format as { type?: string } | undefined)?.type;
    if (t === "currency") return "currency";
    if (t === "percent") return "percent";
    return undefined;
  });
  const effectiveChartValueFormat = $derived<ChartValueFormat | undefined>(
    chartValueFormat ?? chartCfg?.valueFormat ?? chartMeasureFormatDefault,
  );
  const chartAutoYAxisTitle = $derived.by<string | undefined>(() => {
    if (effectiveChartMeasureIds.length !== 1) return undefined;
    const col = allColumns.find((c) => c.id === effectiveChartMeasureId);
    const label = col ? columnLabel(col) : "";
    if (!label) return undefined;
    return chartReduce === "count"
      ? "Count"
      : `${chartReduce === "avg" ? "Average" : "Sum"} of ${label}`;
  });
  const chartDimensionIsDate = $derived.by<boolean>(() => {
    const col = allColumns.find((c) => c.id === effectiveChartDimensionId);
    if (!col) return false;
    if (col.columnDef.cellDataType === "date") return true;
    if (col.columnDef.cellDataType) return false;
    for (const row of allRows) {
      const v = row.getCellValueByColumnId(col.id);
      if (v == null || v === "") continue;
      if (v instanceof Date) return true;
      return typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(v);
    }
    return false;
  });
  const chartRows = $derived.by<TData[]>(() => {
    const rects = getSelectionRects();
    const pushLeaf = (out: TData[], row: Row<TData> | undefined) => {
      if (!row || (row.subRows && row.subRows.length > 0)) return;
      out.push(row.original as TData);
    };
    if (!rects.length) {
      const out: TData[] = [];
      for (const row of allRows) pushLeaf(out, row);
      return out;
    }
    const idx = new Set<number>();
    for (const r of rects) for (let i = r.minRow; i <= r.maxRow; i += 1) idx.add(i);
    const out: TData[] = [];
    for (const i of Array.from(idx).sort((a, b) => a - b)) pushLeaf(out, allRows[i]);
    return out;
  });
  const fieldOf = (id: string | null | undefined): string | undefined =>
    id ? allColumns.find((c) => c.id === id)?.columnDef.field : undefined;

  // ---- Server-side aggregation (charting.getAggregate) ----
  let chartServerBuckets = $state.raw<ReadonlyArray<{ category: string; series?: string; value: number }> | null>(null);
  let chartReqSeq = 0;
  $effect(() => {
    const fn = chartCfg?.getAggregate;
    if (!fn) return;
    const category = fieldOf(effectiveChartDimensionId);
    const measure = fieldOf(effectiveChartMeasureIds[0]) ?? null;
    const series = fieldOf(effectiveChartSeriesId);
    // Read valueFilters + filterMenuValues so the fetch re-runs when either
    // changes; hand the model the facet checklists + operator filters + global.
    const facets = Object.fromEntries(
      Object.entries(valueFilters).map(([k, set]) => [k, Array.from(set)]),
    );
    const filterModel = {
      facets,
      columns: { ...filterMenuValues },
      global: globalFilter,
    } as Record<string, unknown>;
    void chartCfg?.refreshKey;
    const seq = ++chartReqSeq;
    Promise.resolve(fn({ dimension: category, measure, series, reduce: chartReduce, filterModel }))
      .then((buckets) => {
        if (seq === chartReqSeq) chartServerBuckets = buckets;
      })
      .catch(() => {
        if (seq === chartReqSeq) chartServerBuckets = [];
      });
  });
  const bucketsToSpec = (
    buckets: ReadonlyArray<{ category: string; series?: string; value: number }>,
    type: ChartType,
    hasSeries: boolean,
  ): ChartSpec => {
    const cats: string[] = [];
    const catIdx = new Map<string, number>();
    const ensureCat = (c: string) => {
      let i = catIdx.get(c);
      if (i === undefined) { i = cats.length; catIdx.set(c, i); cats.push(c); }
      return i;
    };
    const seriesMap = new Map<string, number[]>();
    for (const b of buckets) {
      const ci = ensureCat(b.category);
      const key = hasSeries ? (b.series ?? "") : "value";
      let arr = seriesMap.get(key);
      if (!arr) { arr = []; seriesMap.set(key, arr); }
      arr[ci] = (arr[ci] ?? 0) + b.value;
    }
    return {
      type,
      categories: cats,
      series: [...seriesMap.entries()].map(([label, values]) => ({
        label,
        values: cats.map((_, i) => values[i] ?? 0),
      })),
    };
  };

  const chartSpec = $derived.by<ChartSpec | null>(() => {
    if (!chartingEnabled || !chartCfg) return null;
    if (chartCfg.getAggregate) {
      if (!chartServerBuckets) return null;
      const spec = bucketsToSpec(chartServerBuckets, chartType, !!effectiveChartSeriesId);
      if (effectiveChartStacked || chartCfg.stacked100) spec.stacked = true;
      if (chartCfg.stacked100) spec.stacked100 = true;
      if (chartCfg.palette) spec.palette = chartCfg.palette;
      if (effectiveChartTimeAxis) spec.xType = "time";
      if (effectiveChartLogScale) spec.yScale = "log";
      if (effectiveChartValueFormat) spec.valueFormat = effectiveChartValueFormat;
      return spec;
    }
    if (chartCfg.buildSpec) return chartCfg.buildSpec(chartRows) ?? null;

    const category = fieldOf(effectiveChartDimensionId);
    const values = effectiveChartMeasureIds.map((id) => fieldOf(id)).filter((f): f is string => !!f);
    if (!category || !values.length) return null;
    const seriesField = fieldOf(effectiveChartSeriesId);

    const spec = rowsToChartSpec<Record<string, unknown>>(chartRows as Array<Record<string, unknown>>, {
      type: chartType,
      category: category as string,
      value: values.length === 1 ? values[0]! : values,
      ...(seriesField ? { series: seriesField } : {}),
      reduce: chartReduce,
      stacked: effectiveChartStacked || chartCfg.stacked100 === true,
      stacked100: chartCfg.stacked100 === true,
      ...(chartCfg.palette ? { palette: chartCfg.palette } : {}),
      ...(chartCfg.topN ? { topN: chartCfg.topN } : {}),
      ...(chartCfg.otherLabel ? { otherLabel: chartCfg.otherLabel } : {}),
      ...(chartCfg.sort ? { sort: chartCfg.sort } : {}),
    });

    if (chartCfg.orientation) spec.orientation = chartCfg.orientation;
    if (effectiveChartTimeAxis) spec.xType = "time";
    if (effectiveChartLogScale) spec.yScale = "log";
    if (effectiveChartValueFormat) spec.valueFormat = effectiveChartValueFormat;
    if (chartType !== "pie" && spec.orientation !== "horizontal" && !spec.yAxisTitle && chartAutoYAxisTitle) {
      spec.yAxisTitle = chartAutoYAxisTitle;
    }
    if (effectiveChartValueFormat && activeChart.valueFormat === null) { /* inherited default */ }
    if (chartType === "pie") {
      if (chartCfg.donut) spec.innerRadius = typeof chartCfg.donut === "number" ? chartCfg.donut : 0.6;
    }
    if (chartCfg.annotations) spec.annotations = chartCfg.annotations;
    if (chartCfg.patternFallback) spec.patternFallback = true;
    const refLines = [...(chartCfg.referenceLines ?? [])];
    if (chartCfg.averageLine && spec.series[0]?.values.length) {
      const vals = spec.series[0].values;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      refLines.push({ value: avg, label: "Average", dashed: true });
    }
    if (refLines.length) spec.referenceLines = refLines;
    for (const s of spec.series) {
      if (chartCfg.trend) s.overlay = chartCfg.trend === "linear" ? "linear" : `${chartCfg.trend}:7`;
      if (chartCfg.smooth) s.smooth = true;
      if (chartCfg.seriesTypes?.[s.label]) s.type = chartCfg.seriesTypes[s.label];
      if (chartCfg.seriesAxes?.[s.label]) s.axis = chartCfg.seriesAxes[s.label];
    }
    return spec;
  });

  function applyChartCrossFilter(category: string) {
    const dimId = effectiveChartDimensionId;
    if (!dimId) return;
    const existing = valueFilters[dimId];
    const next = new Set(existing && existing.has(category) ? existing : []);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    valueFilters = { ...valueFilters, [dimId]: next };
  }
  function clearChartCrossFilter() {
    const dimId = effectiveChartDimensionId;
    if (!dimId) return;
    const next = { ...valueFilters };
    delete next[dimId];
    valueFilters = next;
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

  // --- Huge-list scroll scaling -----------------------------------------
  // Browsers cap how tall a single element may be, and mobile caps sit well
  // below desktop. Past a few hundred thousand rows the true content height
  // (count * rowHeight) exceeds that cap, the scroll container silently
  // clamps its scrollHeight, and the last rows become unreachable - e.g. a
  // 1,000,000-row grid that only scrolls to ~994,000 on a phone.
  //
  // When the true height exceeds the browser's max element height we cap the
  // DOM scroll height and map between the limited DOM scroll range and the
  // full logical range (the "scaling" technique from react-virtualized): the
  // spacers are sized in the capped DOM space, while the virtualizer keeps
  // working in true logical pixels. We detect the real per-browser cap at
  // runtime (Chrome ~33.5M, Firefox ~17.9M, mobile lower) rather than guess a
  // constant, so scaling activates only when genuinely needed and stays as
  // fine-grained as the browser allows. For normal-sized grids scaling is
  // inert and every value below reduces to the original behavior.
  // Build the scaling mapping from the current true height + detected browser
  // cap + viewport. The pure, unit-tested math lives in
  // ./virtualization/scroll-scaling; here we only feed it reactive inputs.
  // Inert (identity) for normal-sized grids.
  const rowScrollScaling = $derived(
    createRowScrollScaling(
      virtualRowTotalSize,
      getMaxDomScrollHeight(),
      viewportHeight,
    ),
  );
  const rowDomTotalSize = $derived(rowScrollScaling.domTotal);
  const rowScrollScalingActive = $derived(rowScrollScaling.active);
  // Map a DOM scrollTop to the virtualizer's logical scroll offset, and back.
  function domToLogicalRowOffset(domTop: number): number {
    return rowScrollScaling.domToLogical(domTop);
  }
  function logicalToDomRowOffset(logical: number): number {
    return rowScrollScaling.logicalToDom(logical);
  }
  // px the logical row positions must shift to land inside the capped DOM
  // coordinate space (0 when not scaling). Derived from the virtualizer's
  // OWN committed scroll offset - not the live DOM scrollTop - so the spacer
  // shift and the rendered window are always computed from the same state and
  // can never skew by a frame (which would jitter at extreme scale).
  const rowOffsetAdjustment = $derived.by(() => {
    if (!rowScrollScalingActive) return 0;
    virtualizer.version;
    const logical = virtualizer.getState().scrollOffset;
    return logical - rowScrollScaling.logicalToDom(logical);
  });
  // Spacer heights in DOM space. With scaling inert these equal the original
  // virtualRowStart / virtualRowBottomSpacer.
  const rowTopSpacer = $derived(Math.max(virtualRowStart - rowOffsetAdjustment, 0));
  const rowBottomSpacer = $derived(
    Math.max(rowDomTotalSize - (virtualRowEnd - rowOffsetAdjustment), 0),
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
    if (!columnVirtualizationEnabled) {
      let start = 0;
      return allColumns.map((column, index) => {
        const size = getColumnWidth(column.id);
        const item = { index, key: index, size, start, end: start + size };
        start += size;
        return item;
      });
    }
    // Pinned columns are position:sticky, so they only stay pinned while their
    // cell is in the DOM. Plain column virtualization drops them once they leave
    // the scroll window, and the pinned column vanishes. Because allColumns is
    // ordered [pinnedLeft, unpinned, pinnedRight], we keep the rendered window
    // CONTIGUOUS from the pinned-left prefix (index 0) through the pinned-right
    // suffix (last index) whenever those exist. The pinned cells are then always
    // rendered - the existing single-spacer layout positions everything, so no
    // markup changes are needed. (Cost: with a pinned side, the columns between
    // that edge and the window are also rendered; negligible for typical grids,
    // and correctness beats shaving a few off-screen cells.)
    const window = virtualColumns;
    const hasLeft = effectivePinning.left.length > 0;
    const hasRight = effectivePinning.right.length > 0;
    if ((!hasLeft && !hasRight) || window.length === 0) return window;

    const firstIdx = window[0]!.index;
    const lastIdx = window[window.length - 1]!.index;
    const startIndex = hasLeft ? 0 : firstIdx;
    const endIndex = hasRight ? allColumns.length - 1 : lastIdx;
    if (startIndex === firstIdx && endIndex === lastIdx) return window;

    const items: Array<{ index: number; key: number; size: number; start: number; end: number }> = [];
    let offset = 0;
    for (let i = 0; i < startIndex; i += 1) offset += getColumnWidth(allColumns[i]!.id);
    for (let i = startIndex; i <= endIndex; i += 1) {
      const size = getColumnWidth(allColumns[i]!.id);
      items.push({ index: i, key: i, size, start: offset, end: offset + size });
      offset += size;
    }
    return items;
  });
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



  // Above this many cells (rows x columns) the summary aggregation is
  // deferred one animation frame so it never blocks first paint - a
  // 100k x 50 grid would otherwise spend seconds summing reactive cells
  // before the grid ever appears. Smaller grids compute inline so the
  // footer is correct on the first frame (no flicker).
  const SUMMARY_DEFER_CELL_LIMIT = 50_000;

  let summaryByColumn = $state<Record<string, string>>({});
  $effect(() => {
    // Re-aggregate whenever the data / columns / edits change. We depend on
    // `allRows` / `allColumns` / `editedCellValues` DIRECTLY - not the
    // catch-all `gridStateVersion` - because that version bumps on EVERY store
    // change, including moving the active cell or selection. `allRows` stays
    // referentially stable across those (sort/filter/paginate produce a new
    // rows array; navigation does not), so this now skips the
    // O(rows x cols) aggregation on plain keyboard navigation - which was
    // making arrow-key movement crawl on huge grids (e.g. 1,000,000 rows).
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
    return observeSizeRaf(theadEl, () => {
      headerHeight = theadEl?.offsetHeight ?? 0;
    });
  });

  // Bump scrollVersion when the table's layout size changes so scrollbar
  // visibility (and the thumb math that depends on scroll metrics) updates
  // after column resize / show-hide / add-remove.
  $effect(() => {
    if (!gridRootEl) return;
    return observeSizeRaf(gridRootEl, () => {
      scrollVersion += 1;
    });
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
    selectionRanges = [];
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
    const rh = props.rowHeight;
    virtualizer.setOptions({
      count: allRows.length,
      estimateSize: typeof rh === "function" ? rh : (rh ?? 30),
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
    return observeSizeRaf(scrollContainer, () => {
      viewportVersion += 1;
      if (!hasMeasured) hasMeasured = true;
    });
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
      virtualizer.setScrollOffset(domToLogicalRowOffset(scrollContainer.scrollTop));
    if (columnVirtualizationEnabled)
      columnVirtualizer.setHorizontalOffset(scrollContainer.scrollLeft);
  });

  // Re-arms once the user scrolls away from the bottom, so a long lazy-load
  // run only fires `onScrollBottomReached` once per arrival at the end.
  let scrollBottomArmed = true;













  /** Cached normalized options keyed by columnId - only used when the column
   *  has a static (non-function) `editorOptions`. Dynamic (per-row) options
   *  are resolved on every call because they can change as other cells in
   *  the same row change (the whole point of cascading editors). */
  const editorOptionsCache: Record<string, CellEditorOption[]> = {};














  const headerSelectionState = $derived.by(() => {
    gridStateVersion;
    const selectable = allRows.filter((row) => !isGroupRow(row));
    if (!selectable.length) return "none";
    let selected = 0;
    for (const row of selectable) if (rowSelectionState[row.id]) selected += 1;
    if (selected === 0) return "none";
    return selected === selectable.length ? "all" : "some";
  });


  /** True once a real interaction (click, keyboard nav, or a public-API
   *  call) has activated a cell. Distinct from `activeCell.cellId`, which
   *  the on-mount seed effect populates straight on the grid state without
   *  going through `setActiveCell` - so it can't tell a seeded (0,0) apart
   *  from a user-focused (0,0). The fill handle keys off this flag so it
   *  stays hidden until the user actually selects something. */
  let userHasActivatedCell = $state(false);




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
    // Narrow responsive mode pans instead of scaling, so skip fit scaling.
    if (!props.fitColumns || isNarrowResponsive) return null;
    const cols = grid.getAllColumns().filter((c) => !hiddenColumns[c.id]);
    if (!cols.length) return null;
    const rowNumberWidth = showRowNumbersEffective ? rowNumberColumnWidth : 0;
    const selectionWidth = showRowSelectionEffective ? selectionColumnWidth : 0;
    // Reserve the custom vertical scrollbar's width when it's visible. It
    // overlays the right 16px of the viewport (absolute, z-index 40) and
    // does NOT shrink clientWidth, so without this the last fitted column
    // slides under it and its right-aligned content (e.g. a number column)
    // is hidden behind the opaque scrollbar.
    const scrollbarWidth = hasVerticalOverflow ? 16 : 0;
    const target =
      (scrollContainer?.clientWidth ?? 0) -
      rowNumberWidth -
      selectionWidth -
      scrollbarWidth;
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


  let resizePendingWidth = 0;
  let resizeRaf: number | null = null;








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












































  /**
   * Lazily-created canvas used to measure text width via the 2D context.
   * Canvas measurement bypasses the cell's `overflow: hidden; white-space:
   * nowrap` constraint, which makes the body's `scrollWidth` useless here.
   */
  let measureCanvas: HTMLCanvasElement | null = null;












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







  /** Buckets for every column that should be bucketed, computed once and
   *  reused by both the facet UI and the row filter. Computing them lazily
   *  in a $derived means columns with no filter menu open and no active
   *  filter never pay the iteration cost. */
  const facetBucketsByColumn = $derived.by(() => {
    const map = new Map<string, Array<FacetBucket>>();
    for (const column of allColumns) {
      const meta = isBucketableColumn(column);
      if (!meta) continue;
      const buckets = buildBuckets(column, meta.isDate, props.data, getColumnAccessorValue);
      if (buckets) map.set(column.id, buckets);
    }
    return map;
  });

  // Server-side set-filter values: when a column's filter menu opens and the
  // consumer provides `serverFilterValues`, fetch the distinct values from the
  // server once (cached per column) instead of deriving them from the loaded
  // page - so the checklist shows every value, not just what's on screen.
  let serverFacetValues = $state<Record<string, Array<string>>>({});
  let serverFacetLoading = $state<string | null>(null);
  $effect(() => {
    const columnId = filterMenuFor ?? columnMenuFor;
    const fetcher = props.serverFilterValues;
    if (!columnId || !fetcher || serverFacetValues[columnId]) return;
    serverFacetLoading = columnId;
    let cancelled = false;
    void fetcher(columnId)
      .then((values) => {
        if (cancelled) return;
        serverFacetValues = { ...serverFacetValues, [columnId]: values };
        serverFacetLoading = null;
      })
      .catch(() => {
        if (!cancelled) serverFacetLoading = null;
      });
    return () => {
      cancelled = true;
    };
  });

  const columnMenuFacetValues = $derived.by(() => {
    // The funnel popover drives via `filterMenuFor`; the column menu's Filter
    // tab drives via `columnMenuFor`. Support whichever is open.
    const columnId = filterMenuFor ?? columnMenuFor;
    if (!columnId) return [] as Array<string>;
    // Server-provided distinct values win (fetched + cached above).
    if (props.serverFilterValues) return serverFacetValues[columnId] ?? [];
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

  const ctx = {
    get props() { return props; },
    get editingEnabled() { return editingEnabled; },
    get paginationEnabled() { return paginationEnabled; },
    get groupingControlsEnabled() { return groupingControlsEnabled; },
    get globalFilter() { return globalFilter; },
    set globalFilter(v) { globalFilter = v as never; },
    get scrollContainer() { return scrollContainer; },
    set scrollContainer(v) { scrollContainer = v as never; },
    get gridRootEl() { return gridRootEl; },
    set gridRootEl(v) { gridRootEl = v as never; },
    get filterRowValues() { return filterRowValues; },
    set filterRowValues(v) { filterRowValues = v as never; },
    get filterMenuValues() { return filterMenuValues; },
    set filterMenuValues(v) { filterMenuValues = v as never; },
    get verticalScrollbarEl() { return verticalScrollbarEl; },
    set verticalScrollbarEl(v) { verticalScrollbarEl = v as never; },
    get horizontalScrollbarEl() { return horizontalScrollbarEl; },
    set horizontalScrollbarEl(v) { horizontalScrollbarEl = v as never; },
    get scrollVersion() { return scrollVersion; },
    set scrollVersion(v) { scrollVersion = v as never; },
    get viewportVersion() { return viewportVersion; },
    set viewportVersion(v) { viewportVersion = v as never; },
    get lastResetSignature() { return lastResetSignature; },
    set lastResetSignature(v) { lastResetSignature = v as never; },
    get pendingScrollTop() { return pendingScrollTop; },
    set pendingScrollTop(v) { pendingScrollTop = v as never; },
    get pendingScrollLeft() { return pendingScrollLeft; },
    set pendingScrollLeft(v) { pendingScrollLeft = v as never; },
    get scrollSyncRaf() { return scrollSyncRaf; },
    set scrollSyncRaf(v) { scrollSyncRaf = v as never; },
    get selectionRange() { return selectionRange; },
    set selectionRange(v) { selectionRange = v as never; },
    get selectionRanges() { return selectionRanges; },
    set selectionRanges(v) { selectionRanges = v as never; },
    get isDraggingSelection() { return isDraggingSelection; },
    set isDraggingSelection(v) { isDraggingSelection = v as never; },
    get fillDrag() { return fillDrag; },
    set fillDrag(v) { fillDrag = v as never; },
    get activeAtPointerDown() { return activeAtPointerDown; },
    set activeAtPointerDown(v) { activeAtPointerDown = v as never; },
    get editingCell() { return editingCell; },
    set editingCell(v) { editingCell = v as never; },
    get fullRowEdit() { return fullRowEdit; },
    set fullRowEdit(v) { fullRowEdit = v as never; },
    get editedCellValues() { return editedCellValues; },
    set editedCellValues(v) { editedCellValues = v as never; },
    get UNDO_LIMIT() { return UNDO_LIMIT; },
    get history() { return history; },
    set history(v) { history = v as never; },
    get historyPtr() { return historyPtr; },
    set historyPtr(v) { historyPtr = v as never; },
    get historyVersion() { return historyVersion; },
    set historyVersion(v) { historyVersion = v as never; },
    get tooltip() { return tooltip; },
    set tooltip(v) { tooltip = v as never; },
    get tooltipTimer() { return tooltipTimer; },
    set tooltipTimer(v) { tooltipTimer = v as never; },
    get showTooltipFor() { return showTooltipFor; },
    get hideTooltip() { return hideTooltip; },
    get findOpen() { return findOpen; },
    set findOpen(v) { findOpen = v as never; },
    get findQuery() { return findQuery; },
    set findQuery(v) { findQuery = v as never; },
    get findHitIndex() { return findHitIndex; },
    set findHitIndex(v) { findHitIndex = v as never; },
    get findHits() { return findHits; },
    get theadEl() { return theadEl; },
    set theadEl(v) { theadEl = v as never; },
    get headerHeight() { return headerHeight; },
    set headerHeight(v) { headerHeight = v as never; },
    get editorSelectAll() { return editorSelectAll; },
    set editorSelectAll(v) { editorSelectAll = v as never; },
    get columnWidths() { return columnWidths; },
    set columnWidths(v) { columnWidths = v as never; },
    get resizingColumnId() { return resizingColumnId; },
    set resizingColumnId(v) { resizingColumnId = v as never; },
    get resizeStartX() { return resizeStartX; },
    set resizeStartX(v) { resizeStartX = v as never; },
    get resizeStartWidth() { return resizeStartWidth; },
    set resizeStartWidth(v) { resizeStartWidth = v as never; },
    get MIN_COLUMN_WIDTH() { return MIN_COLUMN_WIDTH; },
    get columnPinning() { return columnPinning; },
    set columnPinning(v) { columnPinning = v as never; },
    get effectivePinning() { return effectivePinning; },
    get isNarrowResponsive() { return isNarrowResponsive; },
    get columnVirtualizerVersion() { return columnVirtualizerVersion; },
    set columnVirtualizerVersion(v) { columnVirtualizerVersion = v as never; },
    get gridStateVersion() { return gridStateVersion; },
    set gridStateVersion(v) { gridStateVersion = v as never; },
    get selectionColumnWidth() { return selectionColumnWidth; },
    get rowNumberColumnWidth() { return rowNumberColumnWidth; },
    get showRowNumbersEffective() { return showRowNumbersEffective; },
    get filterOperatorOptions() { return filterOperatorOptions; },
    get TEXT_OPERATORS() { return TEXT_OPERATORS; },
    get NUMBER_OPERATORS() { return NUMBER_OPERATORS; },
    get DATE_OPERATORS() { return DATE_OPERATORS; },
    get CHECKBOX_OPERATORS() { return CHECKBOX_OPERATORS; },
    get columnMenuFor() { return columnMenuFor; },
    get columnMenuTab() { return columnMenuTab; },
    set columnMenuTab(v) { columnMenuTab = v as never; },
    set columnMenuFor(v) { columnMenuFor = v as never; },
    get columnMenuPos() { return columnMenuPos; },
    set columnMenuPos(v) { columnMenuPos = v as never; },
    get columnMenuSearch() { return columnMenuSearch; },
    set columnMenuSearch(v) { columnMenuSearch = v as never; },
    get filterMenuFor() { return filterMenuFor; },
    set filterMenuFor(v) { filterMenuFor = v as never; },
    get filterMenuPos() { return filterMenuPos; },
    set filterMenuPos(v) { filterMenuPos = v as never; },
    get operatorMenuFor() { return operatorMenuFor; },
    set operatorMenuFor(v) { operatorMenuFor = v as never; },
    get operatorMenuPos() { return operatorMenuPos; },
    set operatorMenuPos(v) { operatorMenuPos = v as never; },
    get chooseColumnsPos() { return chooseColumnsPos; },
    set chooseColumnsPos(v) { chooseColumnsPos = v as never; },
    get contextMenuFor() { return contextMenuFor; },
    set contextMenuFor(v) { contextMenuFor = v as never; },
    get contextMenuPos() { return contextMenuPos; },
    set contextMenuPos(v) { contextMenuPos = v as never; },
    get noteOverrides() { return noteOverrides; },
    set noteOverrides(v) { noteOverrides = v as never; },
    get commentEditFor() { return commentEditFor; },
    set commentEditFor(v) { commentEditFor = v as never; },
    get commentDraft() { return commentDraft; },
    set commentDraft(v) { commentDraft = v as never; },
    get valueFilters() { return valueFilters; },
    set valueFilters(v) { valueFilters = v as never; },
    get viewportWidth() { return viewportWidth; },
    get viewportHeight() { return viewportHeight; },
    get scrollMetrics() { return scrollMetrics; },
    get hasVerticalOverflow() { return hasVerticalOverflow; },
    get showGlobalFilterEffective() { return showGlobalFilterEffective; },
    get showFilterRowEffective() { return showFilterRowEffective; },
    get showColumnFiltersEffective() { return showColumnFiltersEffective; },
    get showInlineColumnFilterEffective() { return showInlineColumnFilterEffective; },
    get showRowSelectionEffective() { return showRowSelectionEffective; },
    get enableCellSelectionEffective() { return enableCellSelectionEffective; },
    get flushScheduledScrollSync() { return flushScheduledScrollSync; },
    get scheduleScrollSync() { return scheduleScrollSync; },
    get internalData() { return internalData; },
    set internalData(v) { internalData = v as never; },
    get internalColumns() { return internalColumns; },
    set internalColumns(v) { internalColumns = v as never; },
    get hiddenColumns() { return hiddenColumns; },
    set hiddenColumns(v) { hiddenColumns = v as never; },
    get toggleColumnGroup() { return toggleColumnGroup; },
    get isColumnGroupCollapsed() { return isColumnGroupCollapsed; },
    get externalSortEnabled() { return externalSortEnabled; },
    get externalFilterEnabled() { return externalFilterEnabled; },
    get passthroughSortedRowModel() { return passthroughSortedRowModel; },
    get resolveEffectiveFeatures() { return resolveEffectiveFeatures; },
    get grid() { return grid; },
    get userColumnOrder() { return userColumnOrder; },
    set userColumnOrder(v) { userColumnOrder = v as never; },
    get lastSeededOrder() { return lastSeededOrder; },
    set lastSeededOrder(v) { lastSeededOrder = v as never; },
    get allColumns() { return allColumns; },
    get headerGroups() { return headerGroups; },
    get groupHeaderRows() { return groupHeaderRows; },
    get pinnedOffsets() { return pinnedOffsets; },
    get cellPinStyle() { return cellPinStyle; },
    get isColumnPinned() { return isColumnPinned; },
    get colDragId() { return colDragId; },
    set colDragId(v) { colDragId = v as never; },
    get colDropOnId() { return colDropOnId; },
    set colDropOnId(v) { colDropOnId = v as never; },
    get colDropSide() { return colDropSide; },
    set colDropSide(v) { colDropSide = v as never; },
    get rowDragActive() { return rowDragActive; },
    set rowDragActive(v) { rowDragActive = v as never; },
    get rowDropIndex() { return rowDropIndex; },
    set rowDropIndex(v) { rowDropIndex = v as never; },
    get rowDropSide() { return rowDropSide; },
    set rowDropSide(v) { rowDropSide = v as never; },
    get onRowDragStart() { return onRowDragStart; },
    get onRowDragOver() { return onRowDragOver; },
    get onRowDragLeave() { return onRowDragLeave; },
    get onRowDrop() { return onRowDrop; },
    get onRowsContainerDragOver() { return onRowsContainerDragOver; },
    get onRowsContainerDrop() { return onRowsContainerDrop; },
    get onRowDragEnd() { return onRowDragEnd; },
    get broadcastAlignedScroll() { return broadcastAlignedScroll; },
    get getCurrentColumnOrder() { return getCurrentColumnOrder; },
    get emitColumnOrder() { return emitColumnOrder; },
    get setColumnOrderInternal() { return setColumnOrderInternal; },
    get applyColumnDrop() { return applyColumnDrop; },
    get onColumnHeaderDragStart() { return onColumnHeaderDragStart; },
    get onColumnHeaderDragOver() { return onColumnHeaderDragOver; },
    get onColumnHeaderDragLeave() { return onColumnHeaderDragLeave; },
    get onColumnHeaderDrop() { return onColumnHeaderDrop; },
    get onColumnHeaderDragEnd() { return onColumnHeaderDragEnd; },
    get pinColumnLeft() { return pinColumnLeft; },
    get pinColumnRight() { return pinColumnRight; },
    get unpinColumn() { return unpinColumn; },
    get getColumnBaseValue() { return getColumnBaseValue; },
    get hasConditionalFormats() { return hasConditionalFormats; },
    get conditionalColumnStats() { return conditionalColumnStats; },
    get cellConditionalFormat() { return cellConditionalFormat; },
    get isGroupRow() { return isGroupRow; },
    get isCellEditable() { return isCellEditable; },
    get isCellEditableAt() { return isCellEditableAt; },
    get sortDirectionByColumn() { return sortDirectionByColumn; },
    get groupingColumns() { return groupingColumns; },
    get paginationState() { return paginationState; },
    get externalPaginationEnabled() { return externalPaginationEnabled; },
    get paginationTotalRows() { return paginationTotalRows; },
    get paginationPageIndex() { return paginationPageIndex; },
    get paginationPageSize() { return paginationPageSize; },
    get getRowColumnValue() { return getRowColumnValue; },
    get allRowsBeforePagination() { return allRowsBeforePagination; },
    get allRows() { return allRows; },
    get rowSelectionState() { return rowSelectionState; },
    get lastSelectionSerialized() { return lastSelectionSerialized; },
    set lastSelectionSerialized(v) { lastSelectionSerialized = v as never; },
    get lastCellRangeSerialized() { return lastCellRangeSerialized; },
    set lastCellRangeSerialized(v) { lastCellRangeSerialized = v as never; },
    get statusBarEnabled() { return statusBarEnabled; },
    get statusBarAggregates() { return statusBarAggregates; },
    get statusBarStats() { return statusBarStats; },
    get toolPanelOpen() { return toolPanelOpen; },
    set toolPanelOpen(v) { toolPanelOpen = v as never; },
    get toolPanelTab() { return toolPanelTab; },
    set toolPanelTab(v) { toolPanelTab = v as never; },
    get toolPanelEnabled() { return toolPanelEnabled; },
    get toolPanelColumns() { return toolPanelColumns; },
    get toolPanelHeaderLabel() { return toolPanelHeaderLabel; },
    get toggleColumnVisibleInPanel() { return toggleColumnVisibleInPanel; },
    get moveColumnInPanel() { return moveColumnInPanel; },
    // ---- Integrated charting ----
    get chartingEnabled() { return chartingEnabled; },
    get chartingConfig() { return chartingConfig; },
    get chartCfg() { return chartCfg; },
    get chartIsCustom() { return chartIsCustom; },
    get chartPanelOpen() { return chartPanelOpen; },
    set chartPanelOpen(v) { chartPanelOpen = v as never; },
    get chartType() { return chartType; },
    set chartType(v) { activeChart.type = v as never; },
    get chartReduce() { return chartReduce; },
    set chartReduce(v) { activeChart.reduce = v as never; },
    get chartDimensionId() { return effectiveChartDimensionId; },
    set chartDimensionId(v) { activeChart.dimensionId = v as never; },
    get chartMeasureId() { return effectiveChartMeasureId; },
    set chartMeasureId(v) { activeChart.measureId = v as never; },
    get chartSeriesId() { return effectiveChartSeriesId; },
    set chartSeriesId(v) { activeChart.seriesId = v as never; },
    get chartStacked() { return effectiveChartStacked; },
    set chartStacked(v) { activeChart.stacked = v as never; },
    get chartDataLabels() { return effectiveChartDataLabels; },
    set chartDataLabels(v) { activeChart.dataLabels = v as never; },
    get chartLogScale() { return effectiveChartLogScale; },
    set chartLogScale(v) { activeChart.logScale = v as never; },
    get chartTimeAxis() { return effectiveChartTimeAxis; },
    set chartTimeAxis(v) { activeChart.timeAxis = v as never; },
    get chartValueFormat() { return effectiveChartValueFormat ?? "number"; },
    set chartValueFormat(v) { activeChart.valueFormat = v as never; },
    get chartDimensionIsDate() { return chartDimensionIsDate; },
    get chartSize() { return chartSize; },
    set chartSize(v) { chartSize = v as never; },
    get chartFloating() { return chartFloating; },
    set chartFloating(v) { chartFloating = v as never; },
    get chartMaximized() { return chartMaximized; },
    set chartMaximized(v) { chartMaximized = v as never; },
    get chartFloatRect() { return chartFloatRect; },
    set chartFloatRect(v) { chartFloatRect = v as never; },
    get chartableColumns() { return chartableColumns; },
    get chartSpec() { return chartSpec; },
    applyChartCrossFilter,
    clearChartCrossFilter,
    // Multiple charts (tab strip)
    get charts() { return charts.map((c) => ({ id: c.id, title: c.title })); },
    get activeChartIndex() { return Math.min(activeChartIndex, charts.length - 1); },
    set activeChartIndex(v) { activeChartIndex = Math.max(0, Math.min(charts.length - 1, v as number)); },
    addChart() {
      charts = [...charts, makeChart(`Chart ${charts.length + 1}`)];
      activeChartIndex = charts.length - 1;
    },
    removeChart(index?: number) {
      if (charts.length <= 1) return;
      const idx = index ?? activeChartIndex;
      charts = charts.filter((_, k) => k !== idx);
      if (activeChartIndex >= charts.length) activeChartIndex = charts.length - 1;
    },
    renameChart(index: number, title: string) {
      const c = charts[index];
      if (c) c.title = title;
    },
    getChartsState() {
      return charts.map((c) => ({
        title: c.title,
        type: c.type,
        dimension: c.dimensionId,
        series: c.seriesId ?? null,
        measure: c.measureId,
        reduce: c.reduce,
        stacked: c.stacked,
        dataLabels: c.dataLabels,
        logScale: c.logScale,
        timeAxis: c.timeAxis,
        valueFormat: c.valueFormat,
      }));
    },
    applyChartsState(list: ReadonlyArray<Record<string, unknown>>, active?: number) {
      const restored = list.map((c, i) => ({
        id: `chart-${chartSeq++}`,
        title: typeof c.title === "string" ? c.title : `Chart ${i + 1}`,
        type: (c.type as ChartType) ?? "bar",
        reduce: (c.reduce as "sum" | "avg" | "count") ?? "sum",
        dimensionId: (c.dimension as string | null) ?? null,
        measureId: (c.measure as string | null) ?? null,
        seriesId: c.series as string | null | undefined,
        stacked: (c.stacked as boolean | null) ?? null,
        dataLabels: (c.dataLabels as boolean | null) ?? null,
        logScale: (c.logScale as boolean | null) ?? null,
        timeAxis: (c.timeAxis as boolean | null) ?? null,
        valueFormat: (c.valueFormat as ChartValueFormat | null) ?? null,
      }));
      charts = restored.length ? restored : [makeChart("Chart 1")];
      activeChartIndex = Math.max(0, Math.min(charts.length - 1, active ?? 0));
    },
    get chartAiHandler() { return chartAiHandler; },
    set chartAiHandler(v) { chartAiHandler = v as never; },
    applyChartConfig(config: {
      open?: boolean;
      type?: ChartType;
      dimension?: string | null;
      series?: string | null;
      measure?: string | null;
      reduce?: "sum" | "avg" | "count";
      stacked?: boolean;
      dataLabels?: boolean;
      logScale?: boolean;
      timeAxis?: boolean;
      valueFormat?: ChartValueFormat;
    }) {
      const cols = [...chartableColumns.dims, ...chartableColumns.measures];
      const resolve = (v: string | null | undefined): string | null => {
        if (v == null) return null;
        const byId = cols.find((c) => c.id === v);
        if (byId) return byId.id;
        const byField = cols.find((c) => c.field === v);
        return byField ? byField.id : v;
      };
      if (config.open !== false) chartPanelOpen = true;
      if (config.type) activeChart.type = config.type;
      if ("dimension" in config) activeChart.dimensionId = resolve(config.dimension);
      if ("series" in config) activeChart.seriesId = config.series == null ? null : resolve(config.series);
      if ("measure" in config) activeChart.measureId = resolve(config.measure);
      if (config.reduce) activeChart.reduce = config.reduce;
      if (typeof config.stacked === "boolean") activeChart.stacked = config.stacked;
      if (typeof config.dataLabels === "boolean") activeChart.dataLabels = config.dataLabels;
      if (typeof config.logScale === "boolean") activeChart.logScale = config.logScale;
      if (typeof config.timeAxis === "boolean") activeChart.timeAxis = config.timeAxis;
      if (config.valueFormat) activeChart.valueFormat = config.valueFormat;
    },
    get toggleGroupInPanel() { return toggleGroupInPanel; },
    get lastSortingSerialized() { return lastSortingSerialized; },
    set lastSortingSerialized(v) { lastSortingSerialized = v as never; },
    get lastFiltersSerialized() { return lastFiltersSerialized; },
    set lastFiltersSerialized(v) { lastFiltersSerialized = v as never; },
    get virtualizer() { return virtualizer; },
    get columnVirtualizer() { return columnVirtualizer; },
    get rowVirtualizationEnabled() { return rowVirtualizationEnabled; },
    get columnVirtualizationEnabled() { return columnVirtualizationEnabled; },
    get virtualRows() { return virtualRows; },
    get virtualRowTotalSize() { return virtualRowTotalSize; },
    get virtualRowStart() { return virtualRowStart; },
    get virtualRowEnd() { return virtualRowEnd; },
    get virtualRowBottomSpacer() { return virtualRowBottomSpacer; },
    get rowDomTotalSize() { return rowDomTotalSize; },
    get rowScrollScalingActive() { return rowScrollScalingActive; },
    get rowTopSpacer() { return rowTopSpacer; },
    get rowBottomSpacer() { return rowBottomSpacer; },
    get domToLogicalRowOffset() { return domToLogicalRowOffset; },
    get logicalToDomRowOffset() { return logicalToDomRowOffset; },
    get virtualColumns() { return virtualColumns; },
    get virtualColumnTotalSize() { return virtualColumnTotalSize; },
    get renderedColumnItems() { return renderedColumnItems; },
    get hasRenderedColumn() { return hasRenderedColumn; },
    get renderedColumns() { return renderedColumns; },
    get totalColumnWidth() { return totalColumnWidth; },
    get hasHorizontalOverflow() { return hasHorizontalOverflow; },
    get columnWindowStart() { return columnWindowStart; },
    get columnWindowEnd() { return columnWindowEnd; },
    get columnWindowRightSpacer() { return columnWindowRightSpacer; },
    get activeCell() { return activeCell; },
    get activeDescendantId() { return activeDescendantId; },
    get formatSummaryNumeric() { return formatSummaryNumeric; },
    get computeSummaries() { return computeSummaries; },
    get SUMMARY_DEFER_CELL_LIMIT() { return SUMMARY_DEFER_CELL_LIMIT; },
    get summaryByColumn() { return summaryByColumn; },
    set summaryByColumn(v) { summaryByColumn = v as never; },
    get hasMeasured() { return hasMeasured; },
    set hasMeasured(v) { hasMeasured = v as never; },
    get scrollBottomArmed() { return scrollBottomArmed; },
    set scrollBottomArmed(v) { scrollBottomArmed = v as never; },
    get onBodyScroll() { return onBodyScroll; },
    get computeRowClass() { return computeRowClass; },
    get computeCellClass() { return computeCellClass; },
    get computeCellTooltip() { return computeCellTooltip; },
    get computeCellValidity() { return computeCellValidity; },
    get computeCellNote() { return computeCellNote; },
    get getCellDisplayValue() { return getCellDisplayValue; },
    get getColumnAlign() { return getColumnAlign; },
    get editorOptionsCache() { return editorOptionsCache; },
    get getColumnEditorOptions() { return getColumnEditorOptions; },
    get formatListCellValue() { return formatListCellValue; },
    get formatCellValue() { return formatCellValue; },
    get getPinnedCellValue() { return getPinnedCellValue; },
    get formatPinnedValue() { return formatPinnedValue; },
    get computePinnedCellClass() { return computePinnedCellClass; },
    get isRowSelected() { return isRowSelected; },
    get toggleRowSelectionById() { return toggleRowSelectionById; },
    get headerSelectionState() { return headerSelectionState; },
    get toggleSelectAllRows() { return toggleSelectAllRows; },
    get userHasActivatedCell() { return userHasActivatedCell; },
    set userHasActivatedCell(v) { userHasActivatedCell = v as never; },
    get setActiveCell() { return setActiveCell; },
    get scrollActiveCellIntoView() { return scrollActiveCellIntoView; },
    get getColumnBaseWidth() { return getColumnBaseWidth; },
    get fittedColumnWidths() { return fittedColumnWidths; },
    get getColumnWidth() { return getColumnWidth; },
    get resizePendingWidth() { return resizePendingWidth; },
    set resizePendingWidth(v) { resizePendingWidth = v as never; },
    get resizeRaf() { return resizeRaf; },
    set resizeRaf(v) { resizeRaf = v as never; },
    get startColumnResize() { return startColumnResize; },
    get onColumnResizeMove() { return onColumnResizeMove; },
    get endColumnResize() { return endColumnResize; },
    get setSelection() { return setSelection; },
    get extendSelection() { return extendSelection; },
    get isCellInSelectedRange() { return isCellInSelectedRange; },
    get getCellRangeEdges() { return getCellRangeEdges; },
    get getSelectionRects() { return getSelectionRects; },
    get fillHandleCell() { return fillHandleCell; },
    get isInFillPreview() { return isInFillPreview; },
    get fillMarqueeEdges() { return fillMarqueeEdges; },
    get findColumnById() { return findColumnById; },
    get readCellRaw() { return readCellRaw; },
    get writeCellRaw() { return writeCellRaw; },
    get applyFillPattern() { return applyFillPattern; },
    get clearSelectedCellValues() { return clearSelectedCellValues; },
    get startFillDrag() { return startFillDrag; },
    get onFillPointerMove() { return onFillPointerMove; },
    get onFillPointerUp() { return onFillPointerUp; },
    get toggleBooleanCell() { return toggleBooleanCell; },
    get onCellPointerDown() { return onCellPointerDown; },
    get onCellPointerEnter() { return onCellPointerEnter; },
    get endDragSelection() { return endDragSelection; },
    get onWindowPointerMove() { return onWindowPointerMove; },
    get onCellClick() { return onCellClick; },
    get emitCellDoubleClick() { return emitCellDoubleClick; },
    get copySelectionToClipboard() { return copySelectionToClipboard; },
    get cutSelectionToClipboard() { return cutSelectionToClipboard; },
    get pasteFromClipboard() { return pasteFromClipboard; },
    get onGridPaste() { return onGridPaste; },
    get clearSelectedCells() { return clearSelectedCells; },
    get onCellDoubleClick() { return onCellDoubleClick; },
    get startEditingWithChar() { return startEditingWithChar; },
    get startEditing() { return startEditing; },
    get stopEditing() { return stopEditing; },
    get startFullRowEdit() { return startFullRowEdit; },
    get setFullRowDraft() { return setFullRowDraft; },
    get commitFullRowEdit() { return commitFullRowEdit; },
    get cancelFullRowEdit() { return cancelFullRowEdit; },
    get saveEditingCell() { return saveEditingCell; },
    get applyHistoryStep() { return applyHistoryStep; },
    get updateEditingCellValue() { return updateEditingCellValue; },
    get onEditorKeyDown() { return onEditorKeyDown; },
    get focusOnMount() { return focusOnMount; },
    get onHeaderSortClick() { return onHeaderSortClick; },
    get onGridKeyDown() { return onGridKeyDown; },
    get changePage() { return changePage; },
    get goToPage() { return goToPage; },
    get setPageSize() { return setPageSize; },
    get openContextMenu() { return openContextMenu; },
    get closeContextMenu() { return closeContextMenu; },
    get contextMenuItems() { return contextMenuItems; },
    get saveComment() { return saveComment; },
    get removeComment() { return removeComment; },
    get closeCommentEditor() { return closeCommentEditor; },
    get updateFilterRow() { return updateFilterRow; },
    get updateFilterOperator() { return updateFilterOperator; },
    get updateFilterMenuValue() { return updateFilterMenuValue; },
    get updateFilterMenuValueTo() { return updateFilterMenuValueTo; },
    get toggleCheckboxWithKeyboard() { return toggleCheckboxWithKeyboard; },
    get getColumnAccessorValue() { return getColumnAccessorValue; },
    get fallbackOperatorOption() { return fallbackOperatorOption; },
    get operatorOption() { return operatorOption; },
    get operatorsForColumn() { return operatorsForColumn; },
    get defaultOperatorFor() { return defaultOperatorFor; },
    get operatorLabelFor() { return operatorLabelFor; },
    get isColumnFiltered() { return isColumnFiltered; },
    get closeMenus() { return closeMenus; },
    get measureCanvas() { return measureCanvas; },
    set measureCanvas(v) { measureCanvas = v as never; },
    get measureText() { return measureText; },
    get autosizeColumn() { return autosizeColumn; },
    get autosizeAllColumns() { return autosizeAllColumns; },
    get resetColumns() { return resetColumns; },
    get openChooseColumns() { return openChooseColumns; },
    get openColumnMenu() { return openColumnMenu; },
    get openFilterMenu() { return openFilterMenu; },
    get openOperatorMenu() { return openOperatorMenu; },
    get sortColumnFromMenu() { return sortColumnFromMenu; },
    get clearColumnSort() { return clearColumnSort; },
    get groupByColumnFromMenu() { return groupByColumnFromMenu; },
    get clearGroupingFromMenu() { return clearGroupingFromMenu; },
    get isBucketableColumn() { return isBucketableColumn; },
    get buildBuckets() { return buildBuckets; },
    get isInBucket() { return isInBucket; },
    get facetBucketsByColumn() { return facetBucketsByColumn; },
    get serverFacetLoading() { return serverFacetLoading; },
    get columnMenuFacetValues() { return columnMenuFacetValues; },
    get columnMenuVisibleFacets() { return columnMenuVisibleFacets; },
    get isFacetChecked() { return isFacetChecked; },
    get toggleFacetValue() { return toggleFacetValue; },
    get isAllFacetsChecked() { return isAllFacetsChecked; },
    get toggleAllFacets() { return toggleAllFacets; },
    get clearColumnFilter() { return clearColumnFilter; },
    get onWindowKeydown() { return onWindowKeydown; },
    get columnDefMatchesId() { return columnDefMatchesId; },
    get buildApi() { return buildApi; },
    get apiNotified() { return apiNotified; },
    set apiNotified(v) { apiNotified = v as never; },
  };
  const { resolveEffectiveFeatures } = createFeatures<TFeatures, TData>(ctx);
  const { showTooltipFor, hideTooltip, flushScheduledScrollSync, scheduleScrollSync, onBodyScroll } = createScrollSync<TFeatures, TData>(ctx);
  const { onGridKeyDown, onWindowKeydown, onHeaderSortClick } = createKeyboard<TFeatures, TData>(ctx);
  const { computeSummaries, hasRenderedColumn } = createSummaries<TFeatures, TData>(ctx);
  const { updateFilterRow, updateFilterOperator, updateFilterMenuValue, updateFilterMenuValueTo, toggleCheckboxWithKeyboard, isColumnFiltered, closeMenus, openChooseColumns, openColumnMenu, openFilterMenu, openOperatorMenu, sortColumnFromMenu, clearColumnSort, groupByColumnFromMenu, clearGroupingFromMenu, isFacetChecked, toggleFacetValue, isAllFacetsChecked, toggleAllFacets, clearColumnFilter, changePage, goToPage, setPageSize, openContextMenu, closeContextMenu, contextMenuItems, saveComment, removeComment, closeCommentEditor } = createMenus<TFeatures, TData>(ctx);
  const { cellConditionalFormat, computeRowClass, computeCellClass, computeCellTooltip, computeCellValidity, computeCellNote, getColumnEditorOptions, formatListCellValue, formatCellValue, formatPinnedValue, computePinnedCellClass } = createCellRender<TFeatures, TData>(ctx);
  const { isCellEditable, isCellEditableAt, getRowColumnValue, getCellDisplayValue, startEditingWithChar, startEditing, stopEditing, startFullRowEdit, setFullRowDraft, commitFullRowEdit, cancelFullRowEdit, saveEditingCell, applyHistoryStep, updateEditingCellValue, onEditorKeyDown, focusOnMount, onCellDoubleClick, pasteFromClipboard, onGridPaste } = createEditing<TFeatures, TData>(ctx);
  const { isRowSelected, toggleRowSelectionById, toggleSelectAllRows, setActiveCell, scrollActiveCellIntoView, setSelection, extendSelection, isCellInSelectedRange, getCellRangeEdges, getSelectionRects, isInFillPreview, fillMarqueeEdges, findColumnById, onCellPointerDown, onCellPointerEnter, endDragSelection, onWindowPointerMove, onCellClick, emitCellDoubleClick } = createSelection<TFeatures, TData>(ctx);
  const { cellPinStyle, isColumnPinned, getCurrentColumnOrder, emitColumnOrder, setColumnOrderInternal, applyColumnDrop, onColumnHeaderDragStart, onColumnHeaderDragOver, onColumnHeaderDragLeave, onColumnHeaderDrop, onColumnHeaderDragEnd, pinColumnLeft, pinColumnRight, unpinColumn, toggleColumnVisibleInPanel, moveColumnInPanel, toggleGroupInPanel, getColumnBaseWidth, getColumnWidth, startColumnResize, onColumnResizeMove, endColumnResize, measureText, autosizeColumn, autosizeAllColumns, resetColumns } = createColumns<TFeatures, TData>(ctx);
  const { onRowDragStart, onRowDragOver, onRowDragLeave, onRowDrop, onRowsContainerDragOver, onRowsContainerDrop, onRowDragEnd } = createRowDrag<TFeatures, TData>(ctx);
  const { register: registerAlignedGrid, broadcastScroll: broadcastAlignedScroll, broadcastWidths: broadcastAlignedWidths } = createAlignedGrids<TFeatures, TData>(ctx);
  const { buildApi } = createGridApi<TFeatures, TData>(ctx);
  const { readCellRaw, writeCellRaw, applyFillPattern, clearSelectedCellValues, startFillDrag, onFillPointerMove, onFillPointerUp, toggleBooleanCell, copySelectionToClipboard, clearSelectedCells, cutSelectionToClipboard } = createClipboard(ctx);

  // Aligned grids: register in the shared group on mount, and mirror column
  // resizes to peers whenever columnWidths changes. Horizontal-scroll mirroring
  // is driven from onBodyScroll (via ctx.broadcastAlignedScroll).
  $effect(() => {
    if (props.alignedGridGroup == null) return;
    return registerAlignedGrid();
  });
  $effect(() => {
    // Track columnWidths reactively, then broadcast to aligned peers.
    void columnWidths;
    broadcastAlignedWidths();
  });

  return ctx;
}
