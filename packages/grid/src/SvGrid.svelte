<script
  lang="ts"
  generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData"
>
  import {
    getGridCellA11yProps,
    getGridCellDomId,
    getGridHeaderA11yProps,
    getGridRootA11yProps,
    getGridRowA11yProps,
    type EditorContext,
    type CellEditorOption,
    type Column,
    type Row,
    type RowData,
    type TableFeatures,
  } from "./index";
  import "./sv-grid-scrollbar";
  import "./SvGrid.css";
  import type { Snippet } from "svelte";
  import {
    RenderSnippetConfig,
    RenderComponentConfig,
  } from "./render-component";
  import { buildSparkline, toSparklineValues } from "./sparkline";
  import { localizeOperatorLabel } from "./filter-operators";
  // SvGridDropdown (list/chips cell editor) and SvDateTimePicker (date/time cell
  // editors) are lazy-loaded below - they only mount while a cell of that type is
  // actively being edited, so they stay out of the base <SvGrid> bundle.
  import {
    hasCellEditor,
    getCellEditor,
    resolveEditorProps,
    type CellEditorContext,
  } from "./editor-registry";
  import { timeStringToDate, dateToTimeString } from "./SvGrid.helpers";
  import type {
    Props,
    SelectionPoint,
    SelectionRange,
    CellEditState,
    FilterOperator,
    FilterOption,
    MenuPosition,
  } from "./SvGrid.types";
  import {
    cfTextStyle,
    fmtStat,
    getEditableInputValue,
    getEditorInputType,
    toValueArray,
    getOptionLabel,
    getOptionColor,
    colorfulChipStyle,
    getEditorClass,
  } from "./SvGrid.helpers";
  import {
    splitInTokens,
    trailingInToken,
    joinInTokens,
  } from "./filtering/excel-filters";
  import { createSvGridController } from "./SvGrid.controller.svelte";
  // GridMenus hosts tooltips + all column/filter/context menu overlays - none of
  // which exist until the user hovers or opens a menu, so it too is lazy-loaded.
  import GridFooter from "./GridFooter.svelte";
  // SvGridChartPanel (charting) and SvGridBoard (Kanban) are heavy, prop-gated
  // views - lazy-loaded below so they stay out of the base <SvGrid> bundle.
  import { getSchedulerView } from "./scheduler-view.svelte";
  import { getBoardView } from "./board-view.svelte";
  import { getChartView } from "./chart-view.svelte";
  let props: Props<TFeatures, TData> = $props();
  // Per-instance base for every DOM id the grid mints. `$props.id()` is stable
  // across SSR and hydration, so two grids on one page no longer collide on
  // `svgrid_cell_0_0` and point `aria-activedescendant` at each other (#77).
  // `$props.id()` must be its own declaration initializer - it can't be passed
  // inline as a call argument.
  const gridInstanceId = $props.id();
  const ctrl = createSvGridController(props, gridInstanceId);
  // Effective props: the controller's `override ?? prop` proxy that backs
  // `api.setOption(...)`. Reading `opt.X` (instead of `props.X`) makes a view-direct
  // prop honor a runtime override. Svelte binds template `props.X` reads to the prop
  // signal (so reassigning `props` would not reroute them); `opt` is a separate
  // binding the template reads by name. Behavioral props (sortable/filterable/...) are
  // already resolved through the controller, so they honor overrides without `opt`.
  const opt = ctrl.props as Props<TFeatures, TData>;
  // Localized chrome strings (English defaults merged with `localeText`).
  const messages = $derived(ctrl.messages);
  // Kanban board mode: when `board` is set the grid renders lanes of cards
  // instead of the table (see SvGridBoard). Narrowed derived so the template
  // branch can pass it non-null.
  const boardConfig = $derived(opt.board);
  // Scheduler / calendar mode: same "view of the grid" seam as the board.
  const schedulerConfig = $derived(opt.scheduler);
  // Chart mode: another "view of the grid". Unlike board/scheduler, the renderer
  // is free - a built-in default (SvGridChartView, lazy-loaded below) wraps the
  // standalone SvChart, overridable via the `chart-view` seam (getChartView).
  const chartViewConfig = $derived(opt.chart);
  // Lazy views + editors: charting (SvGridChart engine), the Kanban board, the
  // list/date cell editors and the menu/tooltip overlay host are all large and
  // only used behind a prop or an interaction, so each loads as its own chunk the
  // first time its feature is actually reached - keeping them out of the base
  // <SvGrid> bundle. Held in $state and mounted as dynamic components once
  // resolved (client-only, mirroring the scheduler-view seam above).
  // Holder types use type-only `import(...)` so each keeps full prop inference
  // (callback param types) while the *runtime* import stays lazy - the type
  // import is erased by the compiler and adds nothing to the bundle.
  // The Kanban board renderer ships in @svgrid/enterprise and plugs in through
  // the `board-view` seam (getBoardView) - same model as the scheduler view.
  let ChartPanelView = $state<typeof import("./SvGridChartPanel.svelte").default | null>(null);
  // Built-in chart-view renderer, lazy-loaded the first time the `chart` prop is
  // set (it pulls in the charting engine, so it stays out of the base bundle).
  // Typed as Component<any> - same as the board/scheduler view holders - so the
  // grid's generic <TData> doesn't clash with the renderer's base prop types.
  let ChartView = $state<import("svelte").Component<any> | null>(null);
  $effect(() => {
    if (chartViewConfig && !ChartView)
      import("./SvGridChartView.svelte").then((m) => (ChartView = m.default));
  });
  let DropdownEditor = $state<typeof import("./SvGridDropdown.svelte").default | null>(null);
  let DateEditor = $state<typeof import("./SvDateTimePicker.svelte").default | null>(null);
  let MenusOverlay = $state<typeof import("./GridMenus.svelte").default | null>(null);
  $effect(() => {
    if (ctrl.chartingEnabled && ctrl.chartPanelOpen && !ChartPanelView)
      import("./SvGridChartPanel.svelte").then((m) => (ChartPanelView = m.default));
  });

  // When the chart panel is docked (not floating), reserve space on the root so
  // the panel sits in a gutter beside/below the grid instead of overlaying the
  // data rows. The panel is absolutely positioned, and absolute offsets are
  // measured from the padding box - so padding on the root pushes the grid
  // content (toolbar + shell + footer) inward and leaves exactly `size` px of
  // gutter for the panel to fill. Mirrors the panel's own position/size logic.
  const chartDockReserveStyle = $derived.by(() => {
    if (!ctrl.chartingEnabled || !ctrl.chartPanelOpen || ctrl.chartFloating)
      return "";
    const cfg = ctrl.chartingConfig;
    const pos = cfg?.position ?? "right";
    const size =
      ctrl.chartSize ??
      (pos === "right" ? (cfg?.width ?? 460) : (cfg?.height ?? 300));
    const edge = pos === "right" ? "padding-right" : "padding-bottom";
    return `${edge}:${size}px; transition:${edge} 180ms cubic-bezier(0.33,1,0.68,1);`;
  });
  $effect(() => {
    const t = ctrl.editingCell?.editorType;
    if (
      (t === "list" || t === "chips" || t === "select" || t === "rich-select") &&
      !DropdownEditor
    )
      import("./SvGridDropdown.svelte").then((m) => (DropdownEditor = m.default));
    if ((t === "date" || t === "datetime" || t === "time") && !DateEditor)
      import("./SvDateTimePicker.svelte").then((m) => (DateEditor = m.default));
  });
  $effect(() => {
    const menuOpen =
      ctrl.tooltip ||
      ctrl.columnMenuFor ||
      ctrl.contextMenuFor ||
      ctrl.filterMenuFor ||
      ctrl.operatorMenuFor ||
      // The value-suggestions dropdown lives in the overlay too, and it can be
      // the FIRST thing a user opens (focusing an in/notIn filter input), so it
      // has to pull the chunk in rather than assume a menu already did.
      ctrl.inSuggestFor ||
      ctrl.chooseColumnsPos;
    if (menuOpen && !MenusOverlay)
      import("./GridMenus.svelte").then((m) => (MenusOverlay = m.default));
  });
  // In-grid pivot mode: when active, the grid renders the pivot result (over its
  // filtered + sorted rows) as a nested grid in place of the flat table.
  const pivotViewOn = $derived(!!ctrl.pivotConfig && ctrl.pivotModeOn);
  const pivotResult = $derived(ctrl.pivotResult);
  // The board / scheduler render the grid's FILTERED + SORTED rows (not raw
  // data), so the search box / column filters / sort all flow through to them.
  const boardData = $derived(
    ctrl.allRowsBeforePagination
      .filter((r) => !ctrl.isGroupRow(r))
      .map((r) => r.original),
  );

  // ---- View facade: re-bind the controller's reactive members as locals so the
  //      markup stays identical. Assignable state + bindings + DOM refs use c.* directly.
  const paginationEnabled = $derived(ctrl.paginationEnabled);
  const filterRowValues = $derived(ctrl.filterRowValues);
  const filterMenuValues = $derived(ctrl.filterMenuValues);
  const tooltip = $derived(ctrl.tooltip);
  const showTooltipFor = $derived(ctrl.showTooltipFor);
  const hideTooltip = $derived(ctrl.hideTooltip);
  const findHits = $derived(ctrl.findHits);
  const headerHeight = $derived(ctrl.headerHeight);
  const resizingColumnId = $derived(ctrl.resizingColumnId);
  const selectionColumnWidth = $derived(ctrl.selectionColumnWidth);
  const rowNumberColumnWidth = $derived(ctrl.rowNumberColumnWidth);
  const showRowNumbersEffective = $derived(ctrl.showRowNumbersEffective);
  const columnMenuFor = $derived(ctrl.columnMenuFor);
  const filterMenuFor = $derived(ctrl.filterMenuFor);
  const operatorMenuFor = $derived(ctrl.operatorMenuFor);
  const viewportWidth = $derived(ctrl.viewportWidth);
  const viewportHeight = $derived(ctrl.viewportHeight);
  const scrollMetrics = $derived(ctrl.scrollMetrics);
  const hasVerticalOverflow = $derived(ctrl.hasVerticalOverflow);
  const showGlobalFilterEffective = $derived(ctrl.showGlobalFilterEffective);
  const showFilterRowEffective = $derived(ctrl.showFilterRowEffective);
  const showInlineColumnFilterEffective = $derived(
    ctrl.showInlineColumnFilterEffective,
  );
  const showRowSelectionEffective = $derived(ctrl.showRowSelectionEffective);
  const grid = $derived(ctrl.grid);
  const allColumns = $derived(ctrl.allColumns);
  const headerGroups = $derived(ctrl.headerGroups);
  const groupHeaderRows = $derived(ctrl.groupHeaderRowsWindowed);
  const cellPinStyle = $derived(ctrl.cellPinStyle);
  const isColumnPinned = $derived(ctrl.isColumnPinned);
  const colDragId = $derived(ctrl.colDragId);
  const colDropOnId = $derived(ctrl.colDropOnId);
  const colDropSide = $derived(ctrl.colDropSide);
  const onColumnHeaderDragStart = $derived(ctrl.onColumnHeaderDragStart);
  const onColumnHeaderDragOver = $derived(ctrl.onColumnHeaderDragOver);
  const onColumnHeaderDragLeave = $derived(ctrl.onColumnHeaderDragLeave);
  const onColumnHeaderDrop = $derived(ctrl.onColumnHeaderDrop);
  const onColumnHeaderDragEnd = $derived(ctrl.onColumnHeaderDragEnd);
  // Managed row dragging
  const rowDragManagedEffective = $derived(opt.rowDragManaged === true);
  const rowDropIndex = $derived(ctrl.rowDropIndex);
  const rowDropSide = $derived(ctrl.rowDropSide);
  const onRowDragStart = $derived(ctrl.onRowDragStart);
  const onRowDragOver = $derived(ctrl.onRowDragOver);
  const onRowDragLeave = $derived(ctrl.onRowDragLeave);
  const onRowDrop = $derived(ctrl.onRowDrop);
  const onRowsContainerDragOver = $derived(ctrl.onRowsContainerDragOver);
  const onRowsContainerDrop = $derived(ctrl.onRowsContainerDrop);
  const onRowDragEndHandler = $derived(ctrl.onRowDragEnd);
  // Drag attributes spread onto each body <tr>; empty object when disabled so
  // rows stay non-draggable and no handlers fire.
  function rowDragAttrs(rowIndex: number) {
    if (!rowDragManagedEffective) return {};
    return {
      draggable: true,
      ondragstart: (e: DragEvent) => onRowDragStart(e, rowIndex),
      ondragover: (e: DragEvent) => onRowDragOver(e, rowIndex),
      ondragleave: () => onRowDragLeave(rowIndex),
      ondrop: (e: DragEvent) => onRowDrop(e, rowIndex),
      ondragend: () => onRowDragEndHandler(),
    };
  }
  function rowDropClass(rowIndex: number) {
    if (!rowDragManagedEffective || rowDropIndex !== rowIndex) return "";
    return rowDropSide === "after"
      ? "sv-grid-row-drop-after"
      : "sv-grid-row-drop-before";
  }
  const getColumnBaseValue = $derived(ctrl.getColumnBaseValue);
  const hasConditionalFormats = $derived(ctrl.hasConditionalFormats);
  const cellConditionalFormat = $derived(ctrl.cellConditionalFormat);
  const isGroupRow = $derived(ctrl.isGroupRow);
  // Server-side group / tree a11y: aria-level on every tree row, aria-expanded
  // on the expandable ones. Undefined (attribute omitted) when serverGroup is off.
  const serverGroup = $derived(opt.serverGroup);
  function sgAriaLevel(row: Row<TData>): number | undefined {
    return serverGroup ? serverGroup.level(row.original as TData) + 1 : undefined;
  }
  function sgAriaExpanded(row: Row<TData>): boolean | undefined {
    if (!serverGroup || !serverGroup.isGroup(row.original as TData)) return undefined;
    return serverGroup.expanded?.(row.original as TData) ?? false;
  }
  const sortDirectionByColumn = $derived(ctrl.sortDirectionByColumn);
  const groupingColumns = $derived(ctrl.groupingColumns);
  const paginationState = $derived(ctrl.paginationState);
  const allRowsBeforePagination = $derived(ctrl.allRowsBeforePagination);
  const allRows = $derived(ctrl.allRows);
  const statusBarEnabled = $derived(ctrl.statusBarEnabled);
  const statusBarAggregates = $derived(ctrl.statusBarAggregates);
  const statusBarStats = $derived(ctrl.statusBarStats);
  const toolPanelEnabled = $derived(ctrl.toolPanelEnabled);
  const toolPanelColumns = $derived(ctrl.toolPanelColumns);
  const toolPanelHeaderLabel = $derived(ctrl.toolPanelHeaderLabel);
  const toggleColumnVisibleInPanel = $derived(ctrl.toggleColumnVisibleInPanel);
  const moveColumnInPanel = $derived(ctrl.moveColumnInPanel);
  const toggleGroupInPanel = $derived(ctrl.toggleGroupInPanel);
  const virtualizer = $derived(ctrl.virtualizer);
  const rowVirtualizationEnabled = $derived(ctrl.rowVirtualizationEnabled);
  // The fixed row height, matching what the virtualized path takes from the virtualizer.
  // The non-virtualized (`virtualization={false}`) body must apply this too, else its rows
  // fall back to content height and look shorter than a virtualized grid's.
  const rowSizePx = (i: number): number => {
    const rh = opt.rowHeight;
    return typeof rh === "function" ? rh(i) : (rh ?? 30);
  };
  const columnVirtualizationEnabled = $derived(
    ctrl.columnVirtualizationEnabled,
  );
  const virtualRows = $derived(ctrl.virtualRows);
  // DOM-space spacer heights + capped total: identical to the logical
  // virtualizer values for normal grids, scaled down past
  // MAX_DOM_SCROLL_HEIGHT so huge grids stay scrollable to the last row on
  // mobile (where the max element height is lowest).
  const rowTopSpacer = $derived(ctrl.rowTopSpacer);
  const rowBottomSpacer = $derived(ctrl.rowBottomSpacer);
  const rowDomTotalSize = $derived(ctrl.rowDomTotalSize);
  const renderedColumns = $derived(ctrl.renderedColumns);
  const totalColumnWidth = $derived(ctrl.totalColumnWidth);

  // ---- Built-in cell flash (ColumnDef `cellFlash`) ----------------------
  // Flashes a cell when its value changes (edits, streaming feeds, server
  // pushes). Keyed by rowId so virtualization recycling a <td> into a new row
  // on scroll does NOT trigger a spurious flash - only a same-row value change
  // does. Inert (active:false) for columns without `cellFlash`.
  function cellFlashAction(
    node: HTMLElement,
    params: {
      rowId: string;
      value: unknown;
      active: boolean;
      className: string;
    },
  ) {
    let prevRow = params.rowId;
    let prev = params.value;
    return {
      update(next: {
        rowId: string;
        value: unknown;
        active: boolean;
        className: string;
      }) {
        if (next.rowId !== prevRow) {
          // A different row scrolled into this recycled slot - reset, no flash.
          prevRow = next.rowId;
          prev = next.value;
          return;
        }
        if (next.active && next.className && !Object.is(next.value, prev)) {
          node.classList.remove(next.className);
          void node.offsetWidth; // reflow so the animation restarts
          node.classList.add(next.className);
        }
        prev = next.value;
      },
    };
  }
  function flashClassFor(
    cfg: boolean | { className?: string } | undefined,
  ): string {
    if (cfg && typeof cfg === "object" && cfg.className) return cfg.className;
    return "sv-grid-cell-flash";
  }

  // Keyboard-accessible column resize (#79): focus a resize handle and use the
  // arrow keys (Shift = fine 1px step). Complements the pointer-drag resize.
  function resizeColumnByKeyboard(e: KeyboardEvent, columnId: string) {
    let delta = 0;
    const step = e.shiftKey ? 1 : 10;
    if (e.key === "ArrowLeft") delta = -step;
    else if (e.key === "ArrowRight") delta = step;
    else return;
    e.preventDefault();
    const current = ctrl.getColumnWidth(columnId);
    ctrl.columnWidths = {
      ...ctrl.columnWidths,
      [columnId]: Math.max(40, current + delta),
    };
  }

  // ---- Full-row editing -------------------------------------------------
  const fullRowEdit = $derived(ctrl.fullRowEdit);
  // Commit the whole row when the user clicks away from its editors (Excel /
  // AG-Grid feel). Clicking within any full-row editor keeps editing.
  $effect(() => {
    if (!fullRowEdit) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest(".sv-grid-fr-editor")) return;
      ctrl.commitFullRowEdit();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  });
  function fullRowKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      ctrl.commitFullRowEdit();
      ctrl.gridRootEl?.focus({ preventScroll: true });
    } else if (e.key === "Escape") {
      e.preventDefault();
      ctrl.cancelFullRowEdit();
      ctrl.gridRootEl?.focus({ preventScroll: true });
    }
  }
  function optionValueOf(o: unknown): string {
    return typeof o === "object" && o !== null && "value" in o
      ? String((o as { value: unknown }).value)
      : String(o);
  }
  function optionLabelOf(o: unknown): string {
    return typeof o === "object" && o !== null && "label" in o
      ? String((o as { label: unknown }).label)
      : String(o);
  }
  const hasHorizontalOverflow = $derived(ctrl.hasHorizontalOverflow);
  const columnWindowStart = $derived(ctrl.columnWindowStart);
  const columnWindowRightSpacer = $derived(ctrl.columnWindowRightSpacer);
  const activeCell = $derived(ctrl.activeCell);
  const activeDescendantId = $derived(ctrl.activeDescendantId);
  const summaryByColumn = $derived(ctrl.summaryByColumn);
  const hasMeasured = $derived(ctrl.hasMeasured);
  const onBodyScroll = $derived(ctrl.onBodyScroll);
  const computeRowClass = $derived(ctrl.computeRowClass);
  const computeCellClass = $derived(ctrl.computeCellClass);
  const computeCellTooltip = $derived(ctrl.computeCellTooltip);
  const computeCellValidity = $derived(ctrl.computeCellValidity);
  const computeCellNote = $derived(ctrl.computeCellNote);
  const getCellDisplayValue = $derived(ctrl.getCellDisplayValue);
  const getColumnAlign = $derived(ctrl.getColumnAlign);
  const getColumnEditorOptions = $derived(ctrl.getColumnEditorOptions);
  const formatListCellValue = $derived(ctrl.formatListCellValue);
  const formatCellValue = $derived(ctrl.formatCellValue);
  const getPinnedCellValue = $derived(ctrl.getPinnedCellValue);
  const formatPinnedValue = $derived(ctrl.formatPinnedValue);
  const computePinnedCellClass = $derived(ctrl.computePinnedCellClass);
  const isRowSelected = $derived(ctrl.isRowSelected);
  const toggleRowSelectionById = $derived(ctrl.toggleRowSelectionById);
  const headerSelectionState = $derived(ctrl.headerSelectionState);
  const toggleSelectAllRows = $derived(ctrl.toggleSelectAllRows);
  const setActiveCell = $derived(ctrl.setActiveCell);
  const scrollActiveCellIntoView = $derived(ctrl.scrollActiveCellIntoView);
  const getColumnWidth = $derived(ctrl.getColumnWidth);
  const startColumnResize = $derived(ctrl.startColumnResize);
  const getCellRangeEdges = $derived(ctrl.getCellRangeEdges);
  const fillHandleCell = $derived(ctrl.fillHandleCell);
  const isInFillPreview = $derived(ctrl.isInFillPreview);
  const fillMarqueeEdges = $derived(ctrl.fillMarqueeEdges);
  const startFillDrag = $derived(ctrl.startFillDrag);
  const onCellPointerDown = $derived(ctrl.onCellPointerDown);
  const onCellPointerEnter = $derived(ctrl.onCellPointerEnter);
  const endDragSelection = $derived(ctrl.endDragSelection);
  const onWindowPointerMove = $derived(ctrl.onWindowPointerMove);
  const onCellClick = $derived(ctrl.onCellClick);
  const emitCellDoubleClick = $derived(ctrl.emitCellDoubleClick);
  const openContextMenu = $derived(ctrl.openContextMenu);
  const saveEditingCell = $derived(ctrl.saveEditingCell);
  const updateEditingCellValue = $derived(ctrl.updateEditingCellValue);
  const onEditorKeyDown = $derived(ctrl.onEditorKeyDown);
  const focusOnMount = $derived(ctrl.focusOnMount);

  // Build the interaction context handed to a CUSTOM cell editor registered via
  // `registerCellEditor`. Maps the grid's editing lifecycle onto the uniform
  // change / commit / cancel contract every registered editor speaks.
  function buildRegisteredEditorContext(): CellEditorContext {
    const cell = ctrl.editingCell;
    return {
      value: cell?.value,
      rowId: cell?.rowId ?? "",
      columnId: cell?.columnId ?? "",
      onChange: (v: unknown) => updateEditingCellValue(v),
      onCommit: (v?: unknown) => {
        if (v !== undefined) updateEditingCellValue(v);
        saveEditingCell();
      },
      onCancel: () => {
        ctrl.editingCell = null;
        ctrl.gridRootEl?.focus({ preventScroll: true });
      },
    };
  }
  const onHeaderSortClick = $derived(ctrl.onHeaderSortClick);
  const onGridKeyDown = $derived(ctrl.onGridKeyDown);
  const onGridPaste = $derived(ctrl.onGridPaste);
  const changePage = $derived(ctrl.changePage);
  const goToPage = $derived(ctrl.goToPage);
  const setPageSize = $derived(ctrl.setPageSize);
  const updateFilterRow = $derived(ctrl.updateFilterRow);
  const updateFilterMenuValue = $derived(ctrl.updateFilterMenuValue);
  const updateFilterMenuValueTo = $derived(ctrl.updateFilterMenuValueTo);
  const updateFilterOperator = $derived(ctrl.updateFilterOperator);
  const operatorsForColumn = $derived(ctrl.operatorsForColumn);
  const clearColumnFilter = $derived(ctrl.clearColumnFilter);
  const toggleCheckboxWithKeyboard = $derived(ctrl.toggleCheckboxWithKeyboard);
  const operatorOption = $derived(ctrl.operatorOption);
  const defaultOperatorFor = $derived(ctrl.defaultOperatorFor);
  const isColumnFiltered = $derived(ctrl.isColumnFiltered);
  const openColumnMenu = $derived(ctrl.openColumnMenu);
  const openFilterMenu = $derived(ctrl.openFilterMenu);
  const openOperatorMenu = $derived(ctrl.openOperatorMenu);
  const openInSuggest = $derived(ctrl.openInSuggest);
  const closeInSuggest = $derived(ctrl.closeInSuggest);
  const addFilterToken = $derived(ctrl.addFilterToken);
  const removeFilterToken = $derived(ctrl.removeFilterToken);
  const onWindowKeydown = $derived(ctrl.onWindowKeydown);

  // True when a `regex` filter's pattern won't compile - used to flag the
  // input so the user sees a half-typed pattern isn't being applied.
  function isInvalidRegex(pattern: string): boolean {
    if (!pattern) return false;
    try {
      new RegExp(pattern);
      return false;
    } catch {
      return true;
    }
  }

  // Commit the token currently typed in an `in` / `notIn` chip input,
  // appending it to the column's token list and clearing the box.
  function commitFilterChip(columnId: string, input: HTMLInputElement): void {
    const raw = input.value.trim();
    if (!raw) return;
    addFilterToken(columnId, raw);
    input.value = "";
    ctrl.inSuggestQuery = "";
  }

  function removeFilterChip(columnId: string, token: string): void {
    removeFilterToken(columnId, token);
  }

  // Focus opens the value-suggestions dropdown under this input; typing
  // narrows it via `inSuggestQuery`.
  function onFilterChipFocus(
    event: FocusEvent,
    columnId: string,
  ): void {
    openInSuggest(event.currentTarget as HTMLInputElement, columnId);
  }

  function onFilterChipInput(
    event: Event,
    columnId: string,
  ): void {
    const input = event.currentTarget as HTMLInputElement;
    ctrl.inSuggestQuery = input.value;
    // Reopen the dropdown if a prior selection/blur had closed it.
    if (ctrl.inSuggestFor !== columnId) openInSuggest(input, columnId);
  }

  // The tool-panel / filter-menu `in` / `notIn` inputs hold the WHOLE token
  // list ("AAPL, MSFT"), unlike the chip input which holds one token. So the
  // suggestion query is the trailing fragment being typed, not the full value.
  function onSetOpFilterFocus(event: FocusEvent, columnId: string): void {
    const input = event.currentTarget as HTMLInputElement;
    openInSuggest(input, columnId);
    ctrl.inSuggestQuery = trailingInToken(input.value);
  }

  function onSetOpFilterInput(event: Event, columnId: string): void {
    const input = event.currentTarget as HTMLInputElement;
    ctrl.inSuggestQuery = trailingInToken(input.value);
    if (ctrl.inSuggestFor !== columnId) openInSuggest(input, columnId);
  }

  // Overflow layout for the `in` / `notIn` chip row: render every chip, then
  // measure how many fit on one line and collapse the rest into the "+N" pill.
  // A guess-by-width heuristic can't work (labels vary), so we measure real
  // element widths and re-run on column resize (ResizeObserver) and whenever
  // the token set or width changes (action param -> update()).
  function fitChips(node: HTMLElement, _param?: string) {
    const INPUT_MIN = 14; // small sliver kept clickable to focus + type
    const recompute = () => {
      const chips = Array.from(
        node.querySelectorAll<HTMLElement>("[data-chip]"),
      );
      const more = node.querySelector<HTMLElement>("[data-more]");
      if (!more) return;
      // Reset to the all-visible baseline before measuring.
      for (const chip of chips) chip.style.display = "";
      more.style.display = "none";
      if (!chips.length || node.clientWidth === 0) return;

      const style = getComputedStyle(node);
      const padX =
        parseFloat(style.paddingLeft || "0") +
        parseFloat(style.paddingRight || "0");
      const gap = parseFloat(style.columnGap || style.gap || "0") || 3;
      const avail = node.clientWidth - padX - INPUT_MIN;

      // Do all chips fit without needing a "+N" pill?
      let used = 0;
      let fit = 0;
      for (const chip of chips) {
        const w = chip.offsetWidth + gap;
        if (used + w <= avail) {
          used += w;
          fit++;
        } else break;
      }
      if (fit >= chips.length) return; // everything fits

      // Reserve space for the "+N" pill, then re-fit.
      more.style.display = "";
      more.textContent = `+${chips.length}`; // widest label, for measuring
      const budget = avail - (more.offsetWidth + gap);
      used = 0;
      fit = 0;
      for (const chip of chips) {
        const w = chip.offsetWidth + gap;
        if (used + w <= budget) {
          used += w;
          fit++;
        } else break;
      }
      if (fit < 1) fit = 1;
      for (const chip of chips.slice(fit)) chip.style.display = "none";
      const hidden = chips.length - fit;
      more.textContent = `+${hidden}`;
      more.title = chips
        .slice(fit)
        .map((c) => c.textContent?.replace(/×$/, "").trim() ?? "")
        .join(", ");
    };
    // Measure after layout settles.
    const schedule = () =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(recompute)
        : recompute();
    schedule();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    ro?.observe(node);
    return {
      update: schedule,
      destroy: () => ro?.disconnect(),
    };
  }

  function onFilterChipKeydown(
    event: KeyboardEvent,
    columnId: string,
  ): void {
    const input = event.currentTarget as HTMLInputElement;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitFilterChip(columnId, input);
    } else if (event.key === "Escape") {
      closeInSuggest();
    } else if (event.key === "Backspace" && input.value === "") {
      const tokens = splitInTokens(filterRowValues[columnId] ?? "");
      if (tokens.length) removeFilterChip(columnId, tokens[tokens.length - 1]!);
    }
  }
</script>

<svelte:window
  onkeydown={onWindowKeydown}
  onpointerup={endDragSelection}
  onpointermove={onWindowPointerMove}
/>

{#if opt.loading && !opt.loadingOverlay && !hasMeasured}
  <!-- Full-screen loading state only on the *initial* load, before the grid
       has ever rendered. Once measured, a `loading` flip (from a server-mode
       sort / filter / page refetch) keeps the table mounted so header inputs
       and focus survive - the empty-row message + optional `loadingOverlay`
       cover the in-place refresh. -->
  <div class="sv-grid-state sv-grid-state-loading" role="status">
    {messages.loading}
  </div>
{:else if opt.error}
  <div class="sv-grid-state sv-grid-state-error" role="alert">
    {opt.error}
  </div>
{:else if boardConfig}
  <div
    class="sv-grid-root sv-grid-board-root"
    class:sv-grid-root-fill={opt.containerHeight === "100%"}
    style={`height: ${
      typeof opt.containerHeight === "string"
        ? opt.containerHeight
        : `${opt.containerHeight ?? 520}px`
    }; display: flex; flex-direction: column;`}
  >
    {#if boardConfig.searchable !== false}
      <label class="sv-grid-board-search">
        <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          placeholder={boardConfig.searchPlaceholder ?? "Search cards..."}
          bind:value={ctrl.globalFilter}
          aria-label="Search cards"
        />
      </label>
    {/if}
    <div style="flex: 1 1 auto; min-height: 0;">
      {#if getBoardView()}
        {@const BoardView = getBoardView()}
        <BoardView
          data={boardData}
          columns={opt.columns}
          board={boardConfig}
          getRowId={opt.getRowId}
        />
      {:else}
        <!-- The Kanban board renderer ships in @svgrid/enterprise. Call
             `enableBoardView()` (or `installEnterprise(api)`) to register it. -->
        <div class="sv-grid-scheduler-upsell" role="note">
          <strong>Kanban board view</strong>
          <p>
            The Kanban board view is an Enterprise feature. Install
            <code>@svgrid/enterprise</code> and call <code>enableBoardView()</code>
            to render it.
          </p>
        </div>
      {/if}
    </div>
  </div>
{:else if schedulerConfig}
  <div
    class="sv-grid-root sv-grid-scheduler-root"
    class:sv-grid-root-fill={opt.containerHeight === "100%"}
    style={`height: ${
      typeof opt.containerHeight === "string"
        ? opt.containerHeight
        : `${opt.containerHeight ?? 520}px`
    }; display: flex; flex-direction: column;`}
  >
    {#if schedulerConfig.searchable !== false}
      <label class="sv-grid-board-search">
        <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          placeholder={schedulerConfig.searchPlaceholder ?? "Search events..."}
          bind:value={ctrl.globalFilter}
          aria-label="Search events"
        />
      </label>
    {/if}
    <div style="flex: 1 1 auto; min-height: 0;">
      {#if getSchedulerView()}
        {@const SchedulerView = getSchedulerView()}
        <SchedulerView
          data={boardData}
          columns={opt.columns}
          scheduler={schedulerConfig}
          getRowId={opt.getRowId}
        />
      {:else}
        <!-- The scheduler renderer ships in @svgrid/enterprise. Call
             `enableSchedulerView()` (or `installEnterprise(api)`) to register it. -->
        <div class="sv-grid-scheduler-upsell" role="note">
          <strong>Scheduler view</strong>
          <p>
            The calendar / scheduler view is an Enterprise feature. Install
            <code>@svgrid/enterprise</code> and call <code>enableSchedulerView()</code>
            to render it.
          </p>
        </div>
      {/if}
    </div>
  </div>
{:else if chartViewConfig}
  <div
    class="sv-grid-root sv-grid-chart-root"
    class:sv-grid-root-fill={opt.containerHeight === "100%"}
    style={`height: ${
      typeof opt.containerHeight === "string"
        ? opt.containerHeight
        : `${opt.containerHeight ?? 520}px`
    }; display: flex; flex-direction: column;`}
  >
    {#if chartViewConfig.searchable !== false}
      <label class="sv-grid-board-search">
        <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          placeholder={chartViewConfig.searchPlaceholder ?? "Search data..."}
          bind:value={ctrl.globalFilter}
          aria-label="Search data"
        />
      </label>
    {/if}
    <div style="flex: 1 1 auto; min-height: 0;">
      {#if getChartView()}
        {@const RegisteredChartView = getChartView()}
        <RegisteredChartView
          data={boardData}
          columns={opt.columns}
          chart={chartViewConfig}
          getRowId={opt.getRowId}
        />
      {:else if ChartView}
        <ChartView
          data={boardData}
          columns={opt.columns}
          chart={chartViewConfig}
          getRowId={opt.getRowId}
        />
      {:else}
        <!-- The built-in chart view is loading (lazy chunk). -->
        <div class="sv-grid-state" role="status">Loading chart...</div>
      {/if}
    </div>
  </div>
{:else if pivotViewOn}
  <div
    class="sv-grid-root sv-grid-pivot-root"
    class:sv-grid-root-fill={opt.containerHeight === "100%"}
    style={`height: ${
      typeof opt.containerHeight === "string"
        ? opt.containerHeight
        : `${opt.containerHeight ?? 520}px`
    }; display: flex; flex-direction: column;`}
  >
    <div class="sv-grid-pivot-bar">
      <span class="sv-grid-pivot-badge">{messages.group}</span>
      <button
        type="button"
        class="sv-grid-pivot-toggle"
        aria-pressed="true"
        onclick={() => ctrl.togglePivotMode()}
      >{messages.pivotUpsellTitle}</button>
    </div>
    <div style="flex: 1 1 auto; min-height: 0;">
      {#if pivotResult}
        <svelte:self
          data={pivotResult.rows}
          columns={pivotResult.columns}
          containerHeight="100%"
        />
      {:else}
        <!-- The pivot engine ships in @svgrid/enterprise. Call `enablePivot()`
             (or `installEnterprise(api)`) to register it. -->
        <div class="sv-grid-scheduler-upsell sv-grid-pivot-upsell" role="note">
          <strong>{messages.pivotUpsellTitle}</strong>
          <p>{messages.pivotUpsellBody}</p>
        </div>
      {/if}
    </div>
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
      {:else if name === "op-isNotBlank"}
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      {:else if name === "op-notContains"}
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" />
        <path d="M7 11h8" />
      {:else if name === "op-notEquals"}
        <path d="M5 9.5h14" />
        <path d="M5 14.5h14" />
        <path d="M16 5l-8 14" />
      {:else if name === "op-endsWith"}
        <path d="M19 5v14" />
        <path d="M15 9H5" />
        <path d="M15 15H8" />
      {:else if name === "op-regex"}
        <path d="M12 5v9" />
        <path d="M8.1 7.4l7.8 4.5" />
        <path d="M15.9 7.4l-7.8 4.5" />
        <circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none" />
      {:else if name === "op-in"}
        <path d="M14 5a7 7 0 1 0 0 14" />
        <path d="M6 12h9" />
        <path d="M12 9l3 3-3 3" />
      {:else if name === "op-notIn"}
        <path d="M14 5a7 7 0 1 0 0 14" />
        <path d="M15 12H6" />
        <path d="M9 9l-3 3 3 3" />
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
          style={`width:${cf.dataBar.percent}%;background:${
            cf.dataBar.gradient
              ? `linear-gradient(90deg, color-mix(in srgb, ${cf.dataBar.color} 35%, transparent), ${cf.dataBar.color})`
              : cf.dataBar.color
          }`}
        ></div>
      {/if}
      <span
        class="sv-grid-cf-content"
        style={cfTextStyle(cf)}
        title={cf.title ?? undefined}
      >
        {#if cf.icon}<span class="sv-grid-cf-icon">{cf.icon}</span>{/if}
        {#if !cf.iconOnly}{@render cellBody(row, column, cellValue)}{/if}
      </span>
    {:else}
      {@render cellBody(row, column, cellValue)}
    {/if}
  {/snippet}

  <!-- Active cell editor. Branches on `ctrl.editingCell.editorType`. Rendered
       only when a cell is in edit mode; the call site supplies the column
       AND row so we can resolve row-dependent `editorOptions` (cascade). -->
  {#snippet editorBody(column: Column<TData>, row: Row<TData>)}
    {#if column.columnDef.cellEditor}
      <!-- Custom editor slot. The columnDef provides a snippet that
           receives the editor context (value + commit + cancel) so the
           consumer fully owns the in-cell UI. -->
      {@const customEditor = column.columnDef
        .cellEditor as unknown as import("svelte").Snippet<
        [EditorContext<TData>]
      >}
      {@render customEditor({
        cell: row.getAllCells().find((c) => c.column.id === column.id)!,
        row,
        column,
        table: grid,
        getValue: () => ctrl.editingCell?.value,
        value: ctrl.editingCell?.value,
        update: (next: unknown) => {
          // Stage the draft without closing. Live-preview controls
          // (sliders, color pickers) call this on every input tick.
          ctrl.editingCell = ctrl.editingCell
            ? { ...ctrl.editingCell, value: next }
            : ctrl.editingCell;
        },
        commit: (next?: unknown) => {
          // Write + close. If the caller passed a value, stage it
          // first; otherwise save whatever update() last wrote.
          if (next !== undefined) {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }
          saveEditingCell();
        },
        cancel: () => {
          ctrl.editingCell = null;
          ctrl.gridRootEl?.focus({ preventScroll: true });
        },
      })}
    {:else if ctrl.editingCell?.editorType === "checkbox"}
      <button
        type="button"
        class="sv-grid-checkbox"
        role="checkbox"
        aria-checked={Boolean(ctrl.editingCell.value)}
        aria-label="Edit checkbox value"
        onclick={(event) => {
          event.stopPropagation();
          const nextValue = !Boolean(ctrl.editingCell?.value);
          ctrl.editingCell = ctrl.editingCell
            ? { ...ctrl.editingCell, value: nextValue }
            : ctrl.editingCell;
          saveEditingCell();
        }}
        onkeydown={(event) =>
          toggleCheckboxWithKeyboard(event, () => {
            event.stopPropagation();
            const nextValue = !Boolean(ctrl.editingCell?.value);
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: nextValue }
              : ctrl.editingCell;
            saveEditingCell();
          })}
        onblur={() => saveEditingCell()}
      ></button>
    {:else if ctrl.editingCell?.editorType === "list"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {#if DropdownEditor}
        <DropdownEditor
          options={opts}
          value={ctrl.editingCell?.value}
          multiple={multi}
          placeholder="Select…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "chips"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {@const selectedArr = toValueArray(ctrl.editingCell?.value)}
      {@render chipsEditor(opts, multi, selectedArr)}
    {:else if ctrl.editingCell?.editorType === "rating"}
      {@const ratingVal = Math.max(
        0,
        Math.min(5, Math.round(Number(ctrl.editingCell?.value) || 0)),
      )}
      <span class="sv-grid-rating-editor" role="radiogroup" aria-label="Rating">
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
              ctrl.editingCell = ctrl.editingCell
                ? { ...ctrl.editingCell, value: n }
                : ctrl.editingCell;
              saveEditingCell();
            }}
            onkeydown={onEditorKeyDown}>★</button
          >
        {/each}
        <button
          type="button"
          aria-label="Clear rating"
          class="sv-grid-rating-clear"
          onmousedown={(event) => event.preventDefault()}
          onclick={(event) => {
            event.stopPropagation();
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: 0 }
              : ctrl.editingCell;
            saveEditingCell();
          }}>×</button
        >
      </span>
    {:else if ctrl.editingCell?.editorType === "select"}
      <!-- Custom dropdown: opens a themed popover identical in feel to
           the existing 'list' editor (single-select, no typeahead). -->
      {@const selectOpts = getColumnEditorOptions(column, row)}
      {#if DropdownEditor}
        <DropdownEditor
          options={selectOpts}
          value={ctrl.editingCell?.value}
          multiple={false}
          placeholder="Select…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "rich-select"}
      <!-- Searchable combobox: same popover as 'select' with a
           typeahead filter input baked in at the top. -->
      {@const richOpts = getColumnEditorOptions(column, row)}
      {#if DropdownEditor}
        <DropdownEditor
          options={richOpts}
          value={ctrl.editingCell?.value}
          multiple={false}
          searchable={true}
          placeholder="Search…"
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "textarea"}
      <!-- Multi-line editor. Commits on Tab, Ctrl/Cmd+Enter, or blur.
           Plain Enter inserts a newline (the whole point of textarea).
           Esc cancels. -->
      <textarea
        use:focusOnMount
        class="sv-grid-cell-editor sv-grid-cell-editor-textarea"
        rows="4"
        value={String(ctrl.editingCell?.value ?? "")}
        onpointerdown={(event) => event.stopPropagation()}
        oninput={(event) =>
          updateEditingCellValue(
            (event.currentTarget as HTMLTextAreaElement).value,
          )}
        onkeydown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
            return;
          }
          // Tab and Ctrl/Cmd+Enter both commit. Plain Enter inserts a newline.
          // Tab goes through the shared helper so it advances the active cell
          // like every other editor does (#48).
          if (event.key === "Tab") {
            event.preventDefault();
            ctrl.commitAndMoveByTab(event.shiftKey);
            return;
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            saveEditingCell();
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }
        }}
        onblur={() => saveEditingCell()}
      ></textarea>
    {:else if ctrl.editingCell?.editorType === "autocomplete"}
      <!-- Free-text autocomplete: a text input with a live-filtered
           suggestion list. Typing edits the value freely; clicking a
           suggestion (or blur) commits. Accepts values not in the list. -->
      {@const acOpts = getColumnEditorOptions(column, row)}
      {@const acText = String(ctrl.editingCell?.value ?? "")}
      {@const acFiltered = acText.trim()
        ? acOpts.filter((o) =>
            String(o.label).toLowerCase().includes(acText.toLowerCase()),
          )
        : acOpts}
      <div class="sv-grid-autocomplete">
        <input
          use:focusOnMount
          class="sv-grid-cell-editor sv-grid-cell-editor-autocomplete"
          type="text"
          value={acText}
          onpointerdown={(event) => event.stopPropagation()}
          oninput={(event) =>
            updateEditingCellValue(
              (event.currentTarget as HTMLInputElement).value,
            )}
          onblur={() => saveEditingCell()}
          onkeydown={onEditorKeyDown}
        />
        {#if acFiltered.length > 0}
          <div class="sv-grid-autocomplete-list" role="listbox">
            {#each acFiltered.slice(0, 50) as opt (opt.value)}
              <button
                type="button"
                class="sv-grid-autocomplete-option"
                role="option"
                aria-selected={String(opt.value) === acText}
                onmousedown={(event) => {
                  event.preventDefault();
                  ctrl.editingCell = ctrl.editingCell
                    ? { ...ctrl.editingCell, value: opt.value }
                    : ctrl.editingCell;
                  saveEditingCell();
                }}>{opt.label}</button
              >
            {/each}
          </div>
        {/if}
      </div>
    {:else if ctrl.editingCell?.editorType === "date"}
      <!-- Rich date editor: SvCalendar popover over a formatted input. Opts
           out to the native <input type="date"> via editorType 'date-native'. -->
      {#if DateEditor}
        <DateEditor
          value={ctrl.editingCell?.value as string | number | Date | null}
          formatString="yyyy-MM-dd"
          dropDownDisplayMode="calendar"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(d)}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "datetime"}
      {#if DateEditor}
        <DateEditor
          value={ctrl.editingCell?.value as string | number | Date | null}
          formatString="yyyy-MM-dd HH:mm"
          dropDownDisplayMode="both"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(d)}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "time"}
      <!-- Rich time editor: SvTimePicker dial. Stores the 'HH:MM' string the
           `time` parser expects; opts out via editorType 'time-native'. -->
      {#if DateEditor}
        <DateEditor
          value={timeStringToDate(ctrl.editingCell?.value)}
          formatString="HH:mm"
          dropDownDisplayMode="time"
          autoOpen
          block
          onChange={(d) => updateEditingCellValue(dateToTimeString(d))}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else if ctrl.editingCell?.editorType === "color"}
      <!-- Native <input type="color"> opens its picker in a separate OS
           overlay; once the picker closes, focus stays on the input so
           `blur` never fires on its own. Commit on `change` (which fires
           exactly once when the picker is dismissed) so the chosen color
           is saved without needing the user to click elsewhere. -->
      <input
        use:focusOnMount
        class={getEditorClass("color")}
        type="color"
        value={getEditableInputValue("color", ctrl.editingCell?.value)}
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
    {:else if hasCellEditor(String(ctrl.editingCell?.editorType ?? ""))}
      <!-- Custom editor registered via `registerCellEditor(type, Component)`:
           mount it and hand it the uniform change / commit / cancel context. -->
      {@const _reg = getCellEditor(String(ctrl.editingCell?.editorType))!}
      {@const CustomCellEditor = _reg.component}
      <CustomCellEditor {...resolveEditorProps(_reg, buildRegisteredEditorContext())} />
    {:else}
      <input
        use:focusOnMount
        class={getEditorClass(ctrl.editingCell?.editorType ?? "text")}
        type={getEditorInputType(ctrl.editingCell?.editorType ?? "text")}
        value={getEditableInputValue(
          ctrl.editingCell?.editorType ?? "text",
          ctrl.editingCell?.value,
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

  <!-- Full-row editor: a lightweight inline editor per editable cell, shown
       for every editable column of the row in full-row edit. Kept separate
       from `editorBody` (which owns the 14 rich single-cell editors) so
       cell editing is untouched. Covers the common editor types. -->
  {#snippet fullRowEditor(column: Column<TData>, row: Row<TData>)}
    {@const et = column.columnDef.editorType ?? "text"}
    {@const val = fullRowEdit?.draft[column.id]}
    {#if et === "checkbox"}
      <input
        type="checkbox"
        class="sv-grid-fr-editor sv-grid-fr-checkbox"
        checked={Boolean(val)}
        onchange={(e) =>
          ctrl.setFullRowDraft(column.id, e.currentTarget.checked)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      />
    {:else if et === "list" || et === "select" || et === "rich-select"}
      {@const opts = getColumnEditorOptions(column, row)}
      <select
        class="sv-grid-cell-editor sv-grid-fr-editor"
        value={String(val ?? "")}
        onchange={(e) => ctrl.setFullRowDraft(column.id, e.currentTarget.value)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
      >
        {#each opts as o (optionValueOf(o))}
          <option value={optionValueOf(o)}>{optionLabelOf(o)}</option>
        {/each}
      </select>
    {:else}
      {@const inputType =
        et === "number"
          ? "number"
          : et === "date"
            ? "date"
            : et === "datetime"
              ? "datetime-local"
              : et === "time"
                ? "time"
                : et === "password"
                  ? "password"
                  : "text"}
      <input
        type={inputType}
        class="sv-grid-cell-editor sv-grid-fr-editor"
        value={String(val ?? "")}
        oninput={(e) => ctrl.setFullRowDraft(column.id, e.currentTarget.value)}
        onkeydown={fullRowKeydown}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}
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
      {#if DropdownEditor}
        <DropdownEditor
          options={opts}
          value={ctrl.editingCell?.value}
          multiple={multi}
          placeholder="Pick…"
          renderChipsInTrigger={true}
          onChange={(next) => {
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: next }
              : ctrl.editingCell;
          }}
          onCommit={() => saveEditingCell()}
          onCancel={() => {
            ctrl.editingCell = null;
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}
        />
      {/if}
    {:else}
      <!-- Free-form chips: typed tags. Enter / comma commits a chip,
           Backspace on empty input removes the last chip, blur saves. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
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
                  ctrl.editingCell = ctrl.editingCell
                    ? {
                        ...ctrl.editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : ctrl.editingCell;
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
                  ctrl.editingCell = ctrl.editingCell
                    ? { ...ctrl.editingCell, value: multi ? next : raw }
                    : ctrl.editingCell;
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
                  ctrl.editingCell = ctrl.editingCell
                    ? {
                        ...ctrl.editingCell,
                        value: multi ? next : (next[0] ?? null),
                      }
                    : ctrl.editingCell;
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
        {#if opt.renderDetailRow}
          {@render opt.renderDetailRow({
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
  {#snippet pinnedRowBody(
    rowData: TData,
    where: "top" | "bottom",
    index: number,
  )}
    <tr
      class={`sv-grid-row sv-grid-pinned-row sv-grid-pinned-row-${where}`}
      data-pinned-row={where}
      data-pinned-index={index}
    >
      {#if showRowNumbersEffective}
        <td
          class="sv-grid-cell sv-grid-row-number-cell"
          style={`width: ${rowNumberColumnWidth}px; min-width: ${rowNumberColumnWidth}px; max-width: ${rowNumberColumnWidth}px; left: 0;`}
          >{where === "top" ? "↑" : "↓"}</td
        >
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
        {@const userCellClass = computePinnedCellClass(
          rowData,
          rendered.column,
        )}
        <td
          class={`sv-grid-cell ${userCellClass}`}
          data-col-id={rendered.column.id}
          data-pinned={isColumnPinned(rendered.column.id) ?? undefined}
          style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
          >{formatPinnedValue(rendered.column, value)}</td
        >
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
    class:sv-grid-root-fill={opt.containerHeight === "100%"}
    style={chartDockReserveStyle}
  >
    {#if showGlobalFilterEffective}
      <label class="sv-grid-global-filter">
        Filter all rows
        <input bind:value={ctrl.globalFilter} placeholder="Type to filter..." />
      </label>
    {/if}

    {#if toolPanelEnabled || ctrl.chartingEnabled}
      <div class="sv-grid-toolbar">
        {#if toolPanelEnabled}
          <button
            type="button"
            class="sv-grid-toolbar-btn"
            class:is-active={ctrl.toolPanelOpen}
            aria-label={ctrl.toolPanelOpen
              ? "Close tool panel"
              : "Open tool panel (columns & filters)"}
            aria-expanded={ctrl.toolPanelOpen}
            onclick={() => (ctrl.toolPanelOpen = !ctrl.toolPanelOpen)}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="6" height="16" rx="1" />
              <rect x="11" y="4" width="4" height="16" rx="1" />
              <rect x="17" y="4" width="4" height="16" rx="1" />
            </svg>
            Columns &amp; Filters
          </button>
        {/if}
        {#if ctrl.chartingEnabled}
          <button
            type="button"
            class="sv-grid-toolbar-btn sv-grid-chart-toggle"
            class:is-active={ctrl.chartPanelOpen}
            aria-label={ctrl.chartPanelOpen ? "Close chart" : "Open chart"}
            aria-expanded={ctrl.chartPanelOpen}
            onclick={() => (ctrl.chartPanelOpen = !ctrl.chartPanelOpen)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
            </svg>
            Chart
          </button>
        {/if}
      </div>
    {/if}

    {#if hasMeasured && (opt.paginationPosition === "top" || opt.paginationPosition === "both")}
      <GridFooter {ctrl} showStatus={false} top pager pageSizeOptions={opt.pageSizeOptions} />
    {/if}

    <div
      class="sv-grid-shell"
      style={`height: ${
        typeof opt.containerHeight === "string"
          ? opt.containerHeight
          : `${opt.containerHeight ?? 520}px`
      }; --sg-thead-h: ${headerHeight}px; --sg-pinned-row-h: ${typeof opt.rowHeight === "number" ? opt.rowHeight : 30}px;`}
    >
      <div
        class="sv-grid-container sv-grid-container-custom-scrollbars"
        class:sv-grid-has-vscroll={hasMeasured && hasVerticalOverflow}
        class:sv-grid-has-hscroll={hasMeasured && hasHorizontalOverflow}
        class:sv-grid-narrow={ctrl.isNarrowResponsive}
        bind:this={ctrl.scrollContainer}
        onscroll={onBodyScroll}
        style={`overflow: auto; position: relative; height: calc(100% - ${hasMeasured && hasHorizontalOverflow ? 16 : 0}px);`}
      >
        <table
          bind:this={ctrl.gridRootEl}
          class="sv-grid-table"
          class:sv-grid-no-row-hover={opt.enableRowHover !== true}
          {...getGridRootA11yProps({
            activeDescendantId,
            rowCount: allRows.length,
            colCount: allColumns.length,
            treegrid: !!opt.serverGroup,
          })}
          onkeydown={onGridKeyDown}
          onpaste={onGridPaste}
          style={`min-width: ${totalColumnWidth}px;`}
        >
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <thead class="sv-grid-head" bind:this={ctrl.theadEl} role="rowgroup">
            <!-- Multi-level group header rows. Only present when the
                 consumer's column tree has `columns: [...]` nesting.
                 Each TH spans the leaf widths underneath via the
                 precomputed `widthPx` + `colSpan` from groupHeaderRows. -->
            {#each groupHeaderRows as row (row.id)}
              <tr
                class="sv-grid-row sv-grid-header-row sv-grid-group-header-row"
                {...getGridRowA11yProps()}
                style={opt.headerHeight
                  ? `height: ${opt.headerHeight}px;`
                  : undefined}
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
                {#if columnVirtualizationEnabled && columnWindowStart > 0}
                  <th
                    class="sv-grid-column sv-grid-column-spacer"
                    aria-hidden="true"
                    style={`width: ${columnWindowStart}px; min-width: ${columnWindowStart}px; max-width: ${columnWindowStart}px;`}
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
                      {#if cell.collapsible}
                        <button
                          type="button"
                          class="sv-grid-group-toggle"
                          class:is-collapsed={cell.collapsed}
                          aria-expanded={!cell.collapsed}
                          aria-label={cell.collapsed
                            ? `Expand ${cell.label}`
                            : `Collapse ${cell.label}`}
                          title={cell.collapsed
                            ? "Expand group"
                            : "Collapse group"}
                          onclick={() => ctrl.toggleColumnGroup(cell.groupId!)}
                        >
                          <span class="sv-grid-group-header-label"
                            >{cell.label}</span
                          >
                          <svg
                            class="sv-grid-group-caret"
                            viewBox="0 0 16 16"
                            width="10"
                            height="10"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="4 6 8 10 12 6"></polyline>
                          </svg>
                        </button>
                      {:else}
                        <span class="sv-grid-group-header-label"
                          >{cell.label}</span
                        >
                      {/if}
                    {/if}
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
            {/each}
            {#each headerGroups as headerGroup (headerGroup.id)}
              <tr
                class="sv-grid-row sv-grid-header-row"
                {...getGridRowA11yProps()}
                style={opt.headerHeight
                  ? `height: ${opt.headerHeight}px;`
                  : undefined}
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
                      class:is-drag-target-before={colDropOnId ===
                        header.column.id && colDropSide === "before"}
                      class:is-drag-target-after={colDropOnId ===
                        header.column.id && colDropSide === "after"}
                      class:is-dragging={colDragId === header.column.id}
                      data-svgrid-header-col={header.column.id}
                      data-align={getColumnAlign(rendered.column)}
                      data-pinned={isColumnPinned(rendered.column.id) ??
                        undefined}
                      draggable={(opt.enableColumnReorder ?? false)
                        ? true
                        : undefined}
                      ondragstart={(e) =>
                        (opt.enableColumnReorder ?? false) &&
                        onColumnHeaderDragStart(e, header.column.id)}
                      ondragover={(e) =>
                        (opt.enableColumnReorder ?? false) &&
                        onColumnHeaderDragOver(e, header.column.id)}
                      ondragleave={() =>
                        (opt.enableColumnReorder ?? false) &&
                        onColumnHeaderDragLeave(header.column.id)}
                      ondrop={(e) =>
                        (opt.enableColumnReorder ?? false) &&
                        onColumnHeaderDrop(e, header.column.id)}
                      ondragend={() =>
                        (opt.enableColumnReorder ?? false) &&
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
                            {@const rendered = header.column.columnDef.header(
                              header.getContext(),
                            )}
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
                                if (!header.column.getCanSort()) return;
                                // If the click landed on an interactive
                                // element inside the custom header, let
                                // that element handle it.
                                const t = event.target as HTMLElement | null;
                                if (
                                  t &&
                                  t.closest(
                                    'button, a, input, select, textarea, [role="button"], [role="menuitem"]',
                                  ) &&
                                  !t.classList.contains("sv-grid-header-custom")
                                )
                                  return;
                                onHeaderSortClick(event, header.column.id);
                              }}
                              onkeydown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ")
                                  return;
                                if (!header.column.getCanSort()) return;
                                event.preventDefault();
                                onHeaderSortClick(
                                  event as unknown as MouseEvent,
                                  header.column.id,
                                );
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
                                    >{@render icon("sort-asc")}</span
                                  >
                                {:else if sortDirection === "desc"}
                                  <span class="sv-grid-header-icon"
                                    >{@render icon("sort-desc")}</span
                                  >
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
                                {typeof header.column.columnDef.header ===
                                "string"
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
                              aria-label={`Filter ${toolPanelHeaderLabel(header.column)}`}
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
                            aria-label={`${toolPanelHeaderLabel(header.column)} column menu`}
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
                          aria-label={`Resize ${toolPanelHeaderLabel(header.column)}`}
                          tabindex="0"
                          onpointerdown={(event) =>
                            startColumnResize(event, header.column.id)}
                          onkeydown={(event) =>
                            resizeColumnByKeyboard(event, header.column.id)}
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
                          title={`Condition: ${localizeOperatorLabel(operatorOption(activeOperator), rendered.column, messages)}`}
                          aria-label={`Filter condition: ${localizeOperatorLabel(operatorOption(activeOperator), rendered.column, messages)}`}
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
                        {#if activeOperator === "in" || activeOperator === "notIn"}
                          {@const frTokens = splitInTokens(
                            filterRowValues[rendered.column.id] ?? "",
                          )}
                          <div
                            class="sv-grid-filter-chips"
                            use:fitChips={`${frTokens.length}:${rendered.item.size}`}
                          >
                            {#each frTokens as token (token)}
                              <span class="sv-grid-filter-chip" data-chip>
                                <span class="sv-grid-filter-chip-label"
                                  >{token}</span
                                >
                                <button
                                  type="button"
                                  class="sv-grid-filter-chip-x"
                                  aria-label={`Remove ${token}`}
                                  onmousedown={(event) => {
                                    event.preventDefault();
                                    removeFilterChip(rendered.column.id, token);
                                  }}>×</button
                                >
                              </span>
                            {/each}
                            <!-- Overflow pill: the fitChips action shows/labels
                                 it when chips don't fit; click opens the list. -->
                            <button
                              type="button"
                              class="sv-grid-filter-chip sv-grid-filter-chip-more"
                              data-more
                              style="display: none;"
                              aria-label="More selected values. Open value list"
                              onclick={(event) => {
                                (
                                  event.currentTarget as HTMLElement
                                ).parentElement
                                  ?.querySelector<HTMLInputElement>("input")
                                  ?.focus();
                              }}
                            ></button>
                            <input
                              class="sv-grid-filter-value sv-grid-filter-chip-input"
                              type="text"
                              placeholder={frTokens.length ? "" : "Add value…"}
                              data-svgrid-filter-col={rendered.column.id}
                              onfocus={(event) =>
                                onFilterChipFocus(event, rendered.column.id)}
                              oninput={(event) =>
                                onFilterChipInput(event, rendered.column.id)}
                              onkeydown={(event) =>
                                onFilterChipKeydown(event, rendered.column.id)}
                              onblur={(event) => {
                                commitFilterChip(
                                  rendered.column.id,
                                  event.currentTarget as HTMLInputElement,
                                );
                                closeInSuggest();
                              }}
                            />
                          </div>
                        {:else if activeOperator !== "isBlank" && activeOperator !== "isNotBlank"}
                          {@const frType = getEditorInputType(
                            rendered.column.columnDef.editorType ?? "text",
                          )}
                          {@const frValue =
                            filterRowValues[rendered.column.id] ?? ""}
                          <input
                            class="sv-grid-filter-value"
                            class:sv-grid-filter-value-invalid={activeOperator ===
                              "regex" && isInvalidRegex(frValue)}
                            type={activeOperator === "regex" ? "text" : frType}
                            placeholder={activeOperator === "between"
                              ? "From"
                              : activeOperator === "regex"
                                ? "Pattern…"
                                : "Filter…"}
                            data-svgrid-filter-col={rendered.column.id}
                            value={frValue}
                            oninput={(event) =>
                              updateFilterRow(
                                rendered.column.id,
                                (event.currentTarget as HTMLInputElement).value,
                              )}
                          />
                          {#if activeOperator === "between"}
                            <input
                              class="sv-grid-filter-value sv-grid-filter-value-to"
                              type={frType}
                              placeholder="To"
                              value={filterMenuValues[rendered.column.id]
                                ?.valueTo ?? ""}
                              oninput={(event) =>
                                updateFilterMenuValueTo(
                                  rendered.column.id,
                                  (event.currentTarget as HTMLInputElement)
                                    .value,
                                )}
                            />
                          {/if}
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
          {#if opt.pinnedTopRows && opt.pinnedTopRows.length > 0}
            <!-- svelte-ignore a11y_no_redundant_roles -->
            <tbody
              class="sv-grid-pinned sv-grid-pinned-top-body"
              role="rowgroup"
            >
              {#each opt.pinnedTopRows as r, i (i)}
                {@render pinnedRowBody(r, "top", i)}
              {/each}
            </tbody>
          {/if}
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <tbody
            class="sv-grid-body"
            role="rowgroup"
            ondragover={rowDragManagedEffective
              ? onRowsContainerDragOver
              : undefined}
            ondrop={rowDragManagedEffective ? onRowsContainerDrop : undefined}
          >
            {#if !allRows.length && !(opt.loading && opt.loadingOverlay)}
              <tr class="sv-grid-row sv-grid-empty-row">
                <td
                  class="sv-grid-cell sv-grid-empty-cell"
                  colSpan={allColumns.length +
                    (showRowNumbersEffective ? 1 : 0) +
                    (showRowSelectionEffective ? 1 : 0)}
                >
                  {opt.emptyMessage ?? messages.noRows}
                </td>
              </tr>
            {:else if rowVirtualizationEnabled}
              {#if rowTopSpacer > 0}
                <tr class="sv-grid-row sv-grid-row-spacer" aria-hidden="true">
                  <td
                    class="sv-grid-cell sv-grid-cell-spacer"
                    style={`height: ${rowTopSpacer}px; padding: 0; border: 0;`}
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
                  {#if opt.isDetailRow?.(row.original as TData, rowIndex)}
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
                      class={`sv-grid-row ${userRowClass} ${rowDropClass(rowIndex)}`}
                      class:sv-grid-row-selected={isRowSelected(row.id)}
                      class:sv-grid-row-alt={opt.zebraRows &&
                        rowIndex % 2 === 1}
                      class:sv-grid-row-draggable={rowDragManagedEffective}
                      {...getGridRowA11yProps(rowIndex + 1)}
                      aria-level={sgAriaLevel(row)}
                      aria-expanded={sgAriaExpanded(row)}
                      {...rowDragAttrs(rowIndex)}
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
                          ctrl.editingCell?.rowId === row.id &&
                          ctrl.editingCell?.columnId === rendered.column.id}
                        {@const inRowEdit =
                          !!fullRowEdit &&
                          fullRowEdit.rowId === row.id &&
                          rendered.column.id in fullRowEdit.draft}
                        {@const rangeEdges = getCellRangeEdges(
                          rowIndex,
                          colIndex,
                        )}
                        {@const fillEdges = fillMarqueeEdges(rowIndex, colIndex)}
                        {@const hasFillHandle =
                          fillHandleCell &&
                          fillHandleCell.rowIndex === rowIndex &&
                          fillHandleCell.colIndex === colIndex}
                        {@const userCellClass = computeCellClass(
                          row,
                          rendered.column,
                        )}
                        {@const cellTooltip = computeCellTooltip(
                          row,
                          rendered.column,
                        )}
                        {@const cellValidity = computeCellValidity(
                          row,
                          rendered.column,
                        )}
                        {@const cellNote = computeCellNote(
                          row,
                          rendered.column,
                        )}
                        <td
                          class={`sv-grid-cell ${userCellClass}`}
                          class:sv-grid-cell-editing={isEditing || inRowEdit}
                          class:sv-grid-cell-active={activeCell.rowIndex ===
                            rowIndex && activeCell.colIndex === colIndex}
                          class:sv-grid-cell-has-fill-handle={hasFillHandle}
                          class:sv-grid-cell-cf={hasConditionalFormats}
                          class:sv-grid-cell-invalid={cellValidity.invalid}
                          class:sv-grid-cell-has-note={cellNote != null}
                          title={cellValidity.message ?? undefined}
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
                          data-fill-top={fillEdges?.top ? "true" : undefined}
                          data-fill-bottom={fillEdges?.bottom ? "true" : undefined}
                          data-fill-left={fillEdges?.left ? "true" : undefined}
                          data-fill-right={fillEdges?.right ? "true" : undefined}
                          style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                          onpointerdown={(event) =>
                            onCellPointerDown(rowIndex, colIndex, event)}
                          onpointerenter={() =>
                            onCellPointerEnter(rowIndex, colIndex)}
                          ondblclick={() =>
                            emitCellDoubleClick(rowIndex, colIndex)}
                          onclick={() => onCellClick(rowIndex, colIndex)}
                          oncontextmenu={(event) =>
                            openContextMenu(
                              event,
                              rowIndex,
                              colIndex,
                              rendered.column.id,
                            )}
                          use:cellFlashAction={{
                            rowId: row.id,
                            value: cellValue,
                            active: !!rendered.column.columnDef.cellFlash,
                            className: flashClassFor(
                              rendered.column.columnDef.cellFlash,
                            ),
                          }}
                          {...getGridCellA11yProps({
                            id: getGridCellDomId(ctrl.gridDomId, rowIndex, colIndex),
                            rowIndex: rowIndex + 1,
                            colIndex: colIndex + 1,
                            selected: isRowSelected(row.id),
                          })}
                        >
                          {#if inRowEdit}
                            {@render fullRowEditor(rendered.column, row)}
                          {:else if isEditing}
                            {@render editorBody(rendered.column, row)}
                          {:else}
                            {@render cellBodyWithFormat(
                              row,
                              rendered.column,
                              cellValue,
                            )}
                          {/if}
                          {#if !isEditing && fillHandleCell && fillHandleCell.rowIndex === rowIndex && fillHandleCell.colIndex === colIndex}
                            <!-- Excel-style fill handle: drag down/right to
                           extend the selection and pattern-fill the new
                           cells on release. Rendered inside the bottom-
                           right cell of the selection range (or active
                           cell if there's no range). -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                              class="sv-grid-fill-handle"
                              role="button"
                              aria-label="Fill handle"
                              tabindex={-1}
                              onpointerdown={(event) =>
                                startFillDrag(event, rowIndex, colIndex)}
                            ></div>
                          {/if}
                          {#if cellNote != null && !isEditing}
                            <span
                              class="sv-grid-cell-note-corner"
                              aria-label="Note"
                              onpointerenter={(event) => {
                                event.stopPropagation();
                                showTooltipFor(
                                  event.currentTarget as HTMLElement,
                                  cellNote,
                                );
                              }}
                              onpointerleave={(event) => {
                                event.stopPropagation();
                                hideTooltip();
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
              {#if rowBottomSpacer > 0}
                <tr class="sv-grid-row sv-grid-row-spacer" aria-hidden="true">
                  <td
                    class="sv-grid-cell sv-grid-cell-spacer"
                    style={`height: ${rowBottomSpacer}px; padding: 0; border: 0;`}
                    colSpan={allColumns.length +
                      (showRowNumbersEffective ? 1 : 0) +
                      (showRowSelectionEffective ? 1 : 0)}
                  ></td>
                </tr>
              {/if}
            {:else}
              {#each allRows as row, rowIndex (row.id)}
                {#if opt.isDetailRow?.(row.original as TData, rowIndex)}
                  {@render detailRowMarkup(row, rowIndex)}
                {:else if isGroupRow(row)}
                  <tr
                    class="sv-grid-row sv-grid-group-row"
                    class:sv-grid-row-selected={isRowSelected(row.id)}
                    aria-level={row.depth + 1}
                    aria-expanded={row.getIsExpanded?.() ? "true" : "false"}
                    {...getGridRowA11yProps(rowIndex + 1)}
                    style={`height: ${rowSizePx(rowIndex)}px;`}
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
                    class={`sv-grid-row ${userRowClass} ${rowDropClass(rowIndex)}`}
                    class:sv-grid-row-selected={isRowSelected(row.id)}
                    class:sv-grid-row-alt={opt.zebraRows &&
                      rowIndex % 2 === 1}
                    class:sv-grid-row-draggable={rowDragManagedEffective}
                    {...getGridRowA11yProps(rowIndex + 1)}
                    aria-level={sgAriaLevel(row)}
                    aria-expanded={sgAriaExpanded(row)}
                    {...rowDragAttrs(rowIndex)}
                    style={`height: ${rowSizePx(rowIndex)}px;`}
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
                        ctrl.editingCell?.rowId === row.id &&
                        ctrl.editingCell?.columnId === rendered.column.id}
                      {@const inRowEdit =
                        !!fullRowEdit &&
                        fullRowEdit.rowId === row.id &&
                        rendered.column.id in fullRowEdit.draft}
                      {@const rangeEdges = getCellRangeEdges(
                        rowIndex,
                        colIndex,
                      )}
                      {@const userCellClass = computeCellClass(
                        row,
                        rendered.column,
                      )}
                      {@const cellTooltip = computeCellTooltip(
                        row,
                        rendered.column,
                      )}
                      {@const cellValidity = computeCellValidity(
                        row,
                        rendered.column,
                      )}
                      {@const cellNote = computeCellNote(row, rendered.column)}
                      <td
                        class={`sv-grid-cell ${userCellClass}`}
                        class:sv-grid-cell-editing={isEditing || inRowEdit}
                        class:sv-grid-cell-active={activeCell.rowIndex ===
                          rowIndex && activeCell.colIndex === colIndex}
                        class:sv-grid-cell-cf={hasConditionalFormats}
                        class:sv-grid-cell-invalid={cellValidity.invalid}
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
                        data-range-left={rangeEdges?.left ? "true" : undefined}
                        data-range-right={rangeEdges?.right
                          ? "true"
                          : undefined}
                        style={`width: ${rendered.item.size}px; min-width: ${rendered.item.size}px; max-width: ${rendered.item.size}px; ${cellPinStyle(rendered.column.id)}`}
                        onpointerdown={(event) =>
                          onCellPointerDown(rowIndex, colIndex, event)}
                        onpointerenter={(event) => {
                          onCellPointerEnter(rowIndex, colIndex);
                          // Column tooltip fires on whole-cell hover.
                          // Per-cell notes are gated on the corner hot-
                          // zone below (Excel-style: hover the small
                          // triangle to read the note). A validation
                          // message (when the cell is invalid) wins over
                          // the plain column tooltip.
                          const tip =
                            cellValidity.invalid && cellValidity.message
                              ? cellValidity.message
                              : cellTooltip;
                          if (tip)
                            showTooltipFor(
                              event.currentTarget as HTMLElement,
                              tip,
                            );
                        }}
                        onpointerleave={hideTooltip}
                        ondblclick={() =>
                          emitCellDoubleClick(rowIndex, colIndex)}
                        onclick={() => onCellClick(rowIndex, colIndex)}
                        oncontextmenu={(event) =>
                          openContextMenu(
                            event,
                            rowIndex,
                            colIndex,
                            rendered.column.id,
                          )}
                        use:cellFlashAction={{
                          rowId: row.id,
                          value: cellValue,
                          active: !!rendered.column.columnDef.cellFlash,
                          className: flashClassFor(
                            rendered.column.columnDef.cellFlash,
                          ),
                        }}
                        {...getGridCellA11yProps({
                          id: getGridCellDomId(ctrl.gridDomId, rowIndex, colIndex),
                          rowIndex: rowIndex + 1,
                          colIndex: colIndex + 1,
                          selected: isRowSelected(row.id),
                        })}
                      >
                        {#if inRowEdit}
                          {@render fullRowEditor(rendered.column, row)}
                        {:else if isEditing}
                          {@render editorBody(rendered.column, row)}
                        {:else}
                          {@render cellBodyWithFormat(
                            row,
                            rendered.column,
                            cellValue,
                          )}
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
                              event.stopPropagation();
                              showTooltipFor(
                                event.currentTarget as HTMLElement,
                                cellNote,
                              );
                            }}
                            onpointerleave={(event) => {
                              event.stopPropagation();
                              hideTooltip();
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
          {#if opt.pinnedBottomRows && opt.pinnedBottomRows.length > 0}
            <!-- svelte-ignore a11y_no_redundant_roles -->
            <tbody
              class="sv-grid-pinned sv-grid-pinned-bottom-body"
              role="rowgroup"
            >
              {#each opt.pinnedBottomRows as r, i (i)}
                {@render pinnedRowBody(r, "bottom", i)}
              {/each}
            </tbody>
          {/if}
          {#if opt.enableRowSummaries ?? true}
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
          bind:this={ctrl.verticalScrollbarEl}
          orientation="vertical"
          viewport-size={viewportHeight}
          content-size={scrollMetrics.scrollHeight ||
            rowDomTotalSize + headerHeight}
          value={scrollMetrics.scrollTop}
          step={typeof opt.rowHeight === "number" ? opt.rowHeight : 30}
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
          bind:this={ctrl.horizontalScrollbarEl}
          orientation="horizontal"
          viewport-size={viewportWidth}
          content-size={scrollMetrics.scrollWidth || horizontalContentSize}
          value={scrollMetrics.scrollLeft}
          step={opt.columnWidth ?? 140}
          style={`width: calc(100% - ${hasVerticalOverflow ? 16 : 0}px);`}
        ></sv-grid-scrollbar>
      {/if}
      {#if hasMeasured && hasVerticalOverflow && hasHorizontalOverflow}
        <div class="sv-grid-scrollbar-corner-br" aria-hidden="true"></div>
      {/if}
    </div>

    <GridFooter {ctrl} pager={(opt.paginationPosition ?? "bottom") !== "top"} pageSizeOptions={opt.pageSizeOptions} />

    {#if ctrl.findOpen}
      <!-- Find-in-grid overlay. Anchored to the TOP of the grid root so
           it tracks the grid even when the page scrolls. Ctrl+F opens;
           Enter cycles to the next hit; Esc closes. -->
      <div class="sv-grid-find" role="search" aria-label="Find in grid">
        <svg class="sv-grid-find-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="7"
            cy="7"
            r="4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <line
            x1="10.2"
            y1="10.2"
            x2="14"
            y2="14"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <input
          class="sv-grid-find-input"
          type="search"
          placeholder="Find in grid…"
          autofocus
          bind:value={ctrl.findQuery}
          oninput={() => (ctrl.findHitIndex = 0)}
          onkeydown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              if (findHits.length === 0) return;
              ctrl.findHitIndex =
                (ctrl.findHitIndex +
                  (event.shiftKey ? -1 : 1) +
                  findHits.length) %
                findHits.length;
              const hit = findHits[ctrl.findHitIndex];
              if (hit) {
                setActiveCell(hit.rowIndex, hit.colIndex);
                scrollActiveCellIntoView(hit.rowIndex, hit.colIndex);
              }
            }
            if (event.key === "Escape") {
              event.preventDefault();
              ctrl.findOpen = false;
              ctrl.findQuery = "";
              // Return focus to the grid instead of letting it fall to <body> (#80).
              ctrl.gridRootEl?.focus({ preventScroll: true });
            }
          }}
        />
        <span class="sv-grid-find-count">
          {findHits.length === 0 && ctrl.findQuery.trim()
            ? "No matches"
            : findHits.length === 0
              ? ""
              : `${ctrl.findHitIndex + 1} of ${findHits.length}`}
        </span>
        <button
          type="button"
          class="sv-grid-find-step"
          aria-label="Previous match"
          disabled={findHits.length === 0}
          onclick={() => {
            ctrl.findHitIndex =
              (ctrl.findHitIndex - 1 + findHits.length) % findHits.length;
            const hit = findHits[ctrl.findHitIndex];
            if (hit) {
              setActiveCell(hit.rowIndex, hit.colIndex);
              scrollActiveCellIntoView(hit.rowIndex, hit.colIndex);
            }
          }}>↑</button
        >
        <button
          type="button"
          class="sv-grid-find-step"
          aria-label="Next match"
          disabled={findHits.length === 0}
          onclick={() => {
            ctrl.findHitIndex = (ctrl.findHitIndex + 1) % findHits.length;
            const hit = findHits[ctrl.findHitIndex];
            if (hit) {
              setActiveCell(hit.rowIndex, hit.colIndex);
              scrollActiveCellIntoView(hit.rowIndex, hit.colIndex);
            }
          }}>↓</button
        >
        <button
          type="button"
          class="sv-grid-find-close"
          aria-label="Close find"
          onclick={() => {
            ctrl.findOpen = false;
            ctrl.findQuery = "";
            // Return focus to the grid instead of letting it fall to <body> (#80).
            ctrl.gridRootEl?.focus({ preventScroll: true });
          }}>✕</button
        >
      </div>
    {/if}

    {#if opt.loading && opt.loadingOverlay}
      <div class="sv-grid-loading-overlay" role="status" aria-live="polite">
        <div class="sv-grid-loading-bar"></div>
        {#if allRows.length === 0}
          <div class="sv-grid-skeleton" aria-hidden="true">
            {#each Array(opt.loadingSkeletonRows ?? 8) as _, r (r)}
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
      {#if ctrl.toolPanelOpen}
        {@const panelTab = ctrl.toolPanelTab}
        <aside class="sv-grid-tool-panel" aria-label="Tool panel">
          <div class="sv-grid-tool-panel-head">
            <span>{panelTab === "filters" ? "Filters" : "Columns"}</span>
            <button
              type="button"
              class="sv-grid-tool-panel-close"
              aria-label="Close"
              onclick={() => (ctrl.toolPanelOpen = false)}>✕</button
            >
          </div>
          <div class="sv-grid-tool-panel-tabs" role="tablist">
            <button
              type="button"
              class="sv-grid-tool-panel-tab"
              class:is-active={panelTab === "columns"}
              role="tab"
              aria-selected={panelTab === "columns"}
              onclick={() => (ctrl.toolPanelTab = "columns")}>{messages.columns}</button
            >
            <button
              type="button"
              class="sv-grid-tool-panel-tab"
              class:is-active={panelTab === "filters"}
              role="tab"
              aria-selected={panelTab === "filters"}
              onclick={() => (ctrl.toolPanelTab = "filters")}>{messages.filters}</button
            >
          </div>
          {#if panelTab === "columns"}
            <ul class="sv-grid-tool-panel-list">
              {#each toolPanelColumns as column, i (column.id)}
                {@const visible = !ctrl.hiddenColumns[column.id]}
                {@const grouped = groupingColumns.includes(column.id)}
                <li class="sv-grid-tool-panel-item">
                  <label class="sv-grid-tool-panel-vis">
                    <input
                      type="checkbox"
                      checked={visible}
                      onchange={() => toggleColumnVisibleInPanel(column.id)}
                    />
                    <span class="sv-grid-tool-panel-name"
                      >{toolPanelHeaderLabel(column)}</span
                    >
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
          {:else}
            <!-- Filters tab: one filter control per filterable column, sharing
                 the same filterMenuValues state as the column menu / filter row. -->
            <div class="sv-grid-tool-panel-filters">
              {#each toolPanelColumns as column (column.id)}
                {#if column.columnDef.field && column.columnDef.filterable !== false}
                  {@const active =
                    filterMenuValues[column.id]?.operator ??
                    defaultOperatorFor(column)}
                  {@const fType = getEditorInputType(
                    column.columnDef.editorType ?? "text",
                  )}
                  <div
                    class="sv-grid-tp-filter"
                    class:is-filtered={isColumnFiltered(column.id)}
                  >
                    <div class="sv-grid-tp-filter-head">
                      <span class="sv-grid-tp-filter-name"
                        >{toolPanelHeaderLabel(column)}</span
                      >
                      {#if isColumnFiltered(column.id)}
                        <button
                          type="button"
                          class="sv-grid-tp-filter-clear"
                          aria-label={`Clear ${toolPanelHeaderLabel(column)} filter`}
                          title={messages.clearFilter}
                          onclick={() => clearColumnFilter(column.id)}>✕</button
                        >
                      {/if}
                    </div>
                    <select
                      class="sv-grid-tp-filter-op"
                      aria-label={`${toolPanelHeaderLabel(column)} filter condition`}
                      value={active}
                      onchange={(e) =>
                        updateFilterOperator(
                          column.id,
                          e.currentTarget.value as FilterOperator,
                        )}
                    >
                      {#each operatorsForColumn(column) as option (option.value)}
                        <option value={option.value}
                          >{localizeOperatorLabel(operatorOption(option.value), column, messages)}</option
                        >
                      {/each}
                    </select>
                    {#if active !== "isBlank" && active !== "isNotBlank"}
                      {@const tpIsSetOp = active === "in" || active === "notIn"}
                      <!-- in/notIn drives the shared value-suggestions dropdown
                           (a windowed checklist) rather than a native datalist,
                           which capped at 200 values and couldn't show which
                           are already selected. -->
                      <input
                        class="sv-grid-tp-filter-input"
                        type={active === "regex" ? "text" : fType}
                        placeholder={active === "between"
                          ? "From"
                          : tpIsSetOp
                            ? "value, value…"
                            : active === "regex"
                              ? "Pattern…"
                              : "Filter…"}
                        value={filterMenuValues[column.id]?.value ?? ""}
                        onfocus={tpIsSetOp
                          ? (e) => onSetOpFilterFocus(e, column.id)
                          : undefined}
                        onblur={tpIsSetOp ? () => closeInSuggest() : undefined}
                        oninput={(e) => {
                          updateFilterMenuValue(column.id, e.currentTarget.value);
                          if (tpIsSetOp) onSetOpFilterInput(e, column.id);
                        }}
                      />
                      {#if active === "between"}
                        <input
                          class="sv-grid-tp-filter-input"
                          type={fType}
                          placeholder="To"
                          value={filterMenuValues[column.id]?.valueTo ?? ""}
                          oninput={(e) =>
                            updateFilterMenuValueTo(
                              column.id,
                              e.currentTarget.value,
                            )}
                        />
                      {/if}
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </aside>
      {/if}
    {/if}

    {#if ctrl.chartingEnabled && ctrl.chartPanelOpen && ChartPanelView}
      <ChartPanelView {ctrl} />
    {/if}
  </div>
  <!-- /.sv-grid-root -->

  {#if MenusOverlay}
    <MenusOverlay {ctrl} {icon} />
  {/if}
{/if}
