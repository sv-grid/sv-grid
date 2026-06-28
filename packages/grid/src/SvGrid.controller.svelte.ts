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
  } from "./index";
import { createRowScrollScaling } from "./virtualization/scroll-scaling";
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
 * The browser's actual maximum element height in CSS px. Browsers clamp how
 * tall a single element may be (and mobile / high-DPR caps differ), so we
 * measure it once by reading the clamped `offsetHeight` of an absurdly tall
 * probe kept inside a 1x1 `overflow:hidden` wrapper (so it never affects page
 * layout or scroll). Cached for the page lifetime; constant per browser.
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
  if (detectedMaxDomHeight != null) return detectedMaxDomHeight;
  if (typeof document === "undefined" || !document.body) {
    return MAX_DOM_SCROLL_HEIGHT_FALLBACK;
  }
  try {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;top:0;left:-9999px;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;";
    const probe = document.createElement("div");
    probe.style.cssText = "width:1px;height:1000000000px;";
    wrap.appendChild(probe);
    document.body.appendChild(wrap);
    const measured = probe.offsetHeight;
    document.body.removeChild(wrap);
    // A clamped read is a large finite number well under the 1e9 we asked for.
    // If the browser did not clamp (returned ~1e9) or returned junk, fall back.
    detectedMaxDomHeight =
      measured > 100_000 && measured < 900_000_000
        ? measured
        : MAX_DOM_SCROLL_HEIGHT_FALLBACK;
  } catch {
    detectedMaxDomHeight = MAX_DOM_SCROLL_HEIGHT_FALLBACK;
  }
  return detectedMaxDomHeight;
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
  const selectionColumnWidth = 44;
  const rowNumberColumnWidth = $derived(props.rowNumberWidth ?? 56);
  const showRowNumbersEffective = $derived(props.showRowNumbers ?? false);
  let columnMenuFor = $state<string | null>(null);
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



  // Internal source-of-truth for data and column defs. Seeded from props and
  // re-synced whenever the parent passes a new array; the imperative API
  // mutates these so add/remove operations don't need a callback round-trip.
  // svelte-ignore state_referenced_locally
  let internalData = $state.raw<ReadonlyArray<TData>>(props.data);
  // svelte-ignore state_referenced_locally
  let internalColumns = $state.raw<Array<ColumnDef<TFeatures, TData>>>(
    props.columns,
  );
  // svelte-ignore state_referenced_locally
  let hiddenColumns = $state<Record<string, boolean>>(
    initialHiddenColumns(props.columns),
  );

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



  // ---- Column reorder (drag headers) ----------------------------------
  // Live drag state for the built-in header drag-to-reorder. Only set
  // when `props.enableColumnReorder` is true.
  let colDragId    = $state<string | null>(null);
  let colDropOnId  = $state<string | null>(null);
  let colDropSide  = $state<"before" | "after" | null>(null);









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
    if (columnVirtualizationEnabled) return virtualColumns;
    let start = 0;
    return allColumns.map((column, index) => {
      const size = getColumnWidth(column.id);
      const item = { index, key: index, size, start, end: start + size };
      start += size;
      return item;
    });
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
    get isDraggingSelection() { return isDraggingSelection; },
    set isDraggingSelection(v) { isDraggingSelection = v as never; },
    get fillDrag() { return fillDrag; },
    set fillDrag(v) { fillDrag = v as never; },
    get activeAtPointerDown() { return activeAtPointerDown; },
    set activeAtPointerDown(v) { activeAtPointerDown = v as never; },
    get editingCell() { return editingCell; },
    set editingCell(v) { editingCell = v as never; },
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
    get toolPanelEnabled() { return toolPanelEnabled; },
    get toolPanelColumns() { return toolPanelColumns; },
    get toolPanelHeaderLabel() { return toolPanelHeaderLabel; },
    get toggleColumnVisibleInPanel() { return toggleColumnVisibleInPanel; },
    get moveColumnInPanel() { return moveColumnInPanel; },
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
    get fillHandleCell() { return fillHandleCell; },
    get isInFillPreview() { return isInFillPreview; },
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
    get clearSelectedCells() { return clearSelectedCells; },
    get onCellDoubleClick() { return onCellDoubleClick; },
    get startEditingWithChar() { return startEditingWithChar; },
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
  const { cellConditionalFormat, computeRowClass, computeCellClass, computeCellTooltip, computeCellNote, getColumnEditorOptions, formatListCellValue, formatCellValue, formatPinnedValue, computePinnedCellClass } = createCellRender<TFeatures, TData>(ctx);
  const { isCellEditable, isCellEditableAt, getRowColumnValue, getCellDisplayValue, startEditingWithChar, saveEditingCell, applyHistoryStep, updateEditingCellValue, onEditorKeyDown, focusOnMount, onCellDoubleClick, pasteFromClipboard } = createEditing<TFeatures, TData>(ctx);
  const { isRowSelected, toggleRowSelectionById, toggleSelectAllRows, setActiveCell, scrollActiveCellIntoView, setSelection, extendSelection, isCellInSelectedRange, getCellRangeEdges, isInFillPreview, findColumnById, onCellPointerDown, onCellPointerEnter, endDragSelection, onWindowPointerMove, onCellClick, emitCellDoubleClick } = createSelection<TFeatures, TData>(ctx);
  const { cellPinStyle, isColumnPinned, getCurrentColumnOrder, emitColumnOrder, setColumnOrderInternal, applyColumnDrop, onColumnHeaderDragStart, onColumnHeaderDragOver, onColumnHeaderDragLeave, onColumnHeaderDrop, onColumnHeaderDragEnd, pinColumnLeft, pinColumnRight, unpinColumn, toggleColumnVisibleInPanel, moveColumnInPanel, toggleGroupInPanel, getColumnBaseWidth, getColumnWidth, startColumnResize, onColumnResizeMove, endColumnResize, measureText, autosizeColumn, autosizeAllColumns, resetColumns } = createColumns<TFeatures, TData>(ctx);
  const { buildApi } = createGridApi<TFeatures, TData>(ctx);
  const { readCellRaw, writeCellRaw, applyFillPattern, clearSelectedCellValues, startFillDrag, onFillPointerMove, onFillPointerUp, toggleBooleanCell, copySelectionToClipboard, clearSelectedCells, cutSelectionToClipboard } = createClipboard(ctx);
  return ctx;
}
