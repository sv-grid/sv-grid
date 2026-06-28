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
  import {
      buildSparkline,
      toSparklineValues,
    } from "./sparkline";
  import SvGridDropdown from "./SvGridDropdown.svelte";
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
      createSvGridController,
    } from "./SvGrid.controller.svelte";
  import GridMenus from "./GridMenus.svelte";
  import GridFooter from "./GridFooter.svelte";
  let props: Props<TFeatures, TData> = $props();
  const ctrl = createSvGridController(props);

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
  const showInlineColumnFilterEffective = $derived(ctrl.showInlineColumnFilterEffective);
  const showRowSelectionEffective = $derived(ctrl.showRowSelectionEffective);
  const grid = $derived(ctrl.grid);
  const allColumns = $derived(ctrl.allColumns);
  const headerGroups = $derived(ctrl.headerGroups);
  const groupHeaderRows = $derived(ctrl.groupHeaderRows);
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
  const getColumnBaseValue = $derived(ctrl.getColumnBaseValue);
  const hasConditionalFormats = $derived(ctrl.hasConditionalFormats);
  const cellConditionalFormat = $derived(ctrl.cellConditionalFormat);
  const isGroupRow = $derived(ctrl.isGroupRow);
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
  const columnVirtualizationEnabled = $derived(ctrl.columnVirtualizationEnabled);
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
  const onHeaderSortClick = $derived(ctrl.onHeaderSortClick);
  const onGridKeyDown = $derived(ctrl.onGridKeyDown);
  const changePage = $derived(ctrl.changePage);
  const goToPage = $derived(ctrl.goToPage);
  const setPageSize = $derived(ctrl.setPageSize);
  const updateFilterRow = $derived(ctrl.updateFilterRow);
  const toggleCheckboxWithKeyboard = $derived(ctrl.toggleCheckboxWithKeyboard);
  const operatorOption = $derived(ctrl.operatorOption);
  const defaultOperatorFor = $derived(ctrl.defaultOperatorFor);
  const isColumnFiltered = $derived(ctrl.isColumnFiltered);
  const openColumnMenu = $derived(ctrl.openColumnMenu);
  const openFilterMenu = $derived(ctrl.openFilterMenu);
  const openOperatorMenu = $derived(ctrl.openOperatorMenu);
  const onWindowKeydown = $derived(ctrl.onWindowKeydown);
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

  <!-- Active cell editor. Branches on `ctrl.editingCell.editorType`. Rendered
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
        getValue: () => ctrl.editingCell?.value,
        value: ctrl.editingCell?.value,
        update: (next: unknown) => {
          // Stage the draft without closing. Live-preview controls
          // (sliders, color pickers) call this on every input tick.
          ctrl.editingCell = ctrl.editingCell ? { ...ctrl.editingCell, value: next } : ctrl.editingCell
        },
        commit: (next?: unknown) => {
          // Write + close. If the caller passed a value, stage it
          // first; otherwise save whatever update() last wrote.
          if (next !== undefined) {
            ctrl.editingCell = ctrl.editingCell ? { ...ctrl.editingCell, value: next } : ctrl.editingCell
          }
          saveEditingCell()
        },
        cancel: () => {
          ctrl.editingCell = null
          ctrl.gridRootEl?.focus({ preventScroll: true })
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
      <SvGridDropdown
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
    {:else if ctrl.editingCell?.editorType === "chips"}
      {@const opts = getColumnEditorOptions(column, row)}
      {@const multi = column.columnDef.editorMultiple === true}
      {@const selectedArr = toValueArray(ctrl.editingCell?.value)}
      {@render chipsEditor(opts, multi, selectedArr)}
    {:else if ctrl.editingCell?.editorType === "rating"}
      {@const ratingVal = Math.max(0, Math.min(5, Math.round(Number(ctrl.editingCell?.value) || 0)))}
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
              ctrl.editingCell = ctrl.editingCell
                ? { ...ctrl.editingCell, value: n }
                : ctrl.editingCell;
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
            ctrl.editingCell = ctrl.editingCell
              ? { ...ctrl.editingCell, value: 0 }
              : ctrl.editingCell;
            saveEditingCell();
          }}
        >×</button>
      </span>
    {:else if ctrl.editingCell?.editorType === "select"}
      <!-- Custom dropdown: opens a themed popover identical in feel to
           the existing 'list' editor (single-select, no typeahead). -->
      {@const selectOpts = getColumnEditorOptions(column, row)}
      <SvGridDropdown
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
    {:else if ctrl.editingCell?.editorType === "rich-select"}
      <!-- Searchable combobox: same popover as 'select' with a
           typeahead filter input baked in at the top. -->
      {@const richOpts = getColumnEditorOptions(column, row)}
      <SvGridDropdown
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
          event.stopPropagation()
          if (event.key === "Escape") {
            event.preventDefault()
            ctrl.editingCell = null
            ctrl.gridRootEl?.focus({ preventScroll: true })
            return
          }
          // Tab and Ctrl/Cmd+Enter both commit. Plain Enter inserts a newline.
          if (event.key === "Tab" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
            event.preventDefault()
            saveEditingCell()
            ctrl.gridRootEl?.focus({ preventScroll: true })
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
                }}
              >{opt.label}</button>
            {/each}
          </div>
        {/if}
      </div>
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
        <input bind:value={ctrl.globalFilter} placeholder="Type to filter..." />
      </label>
    {/if}

    <div
      class="sv-grid-shell"
      style={`height: ${
        typeof props.containerHeight === "string"
          ? props.containerHeight
          : `${props.containerHeight ?? 520}px`
      }; --sg-thead-h: ${headerHeight}px; --sg-pinned-row-h: ${(typeof props.rowHeight === 'number' ? props.rowHeight : 30)}px;`}
    >
      <div
        class="sv-grid-container sv-grid-container-custom-scrollbars"
        bind:this={ctrl.scrollContainer}
        onscroll={onBodyScroll}
        style={`overflow: auto; position: relative; height: calc(100% - ${hasMeasured && hasHorizontalOverflow ? 16 : 0}px);`}
      >
        <table
          bind:this={ctrl.gridRootEl}
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
          <thead class="sv-grid-head" bind:this={ctrl.theadEl} role="rowgroup">
            <!-- Multi-level group header rows. Only present when the
                 consumer's column tree has `columns: [...]` nesting.
                 Each TH spans the leaf widths underneath via the
                 precomputed `widthPx` + `colSpan` from groupHeaderRows. -->
            {#each groupHeaderRows as row (row.id)}
              <tr
                class="sv-grid-row sv-grid-header-row sv-grid-group-header-row"
                {...getGridRowA11yProps()}
                style={props.headerHeight
                  ? `height: ${props.headerHeight}px;`
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
                style={props.headerHeight
                  ? `height: ${props.headerHeight}px;`
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
                          ctrl.editingCell?.rowId === row.id &&
                          ctrl.editingCell?.columnId === rendered.column.id}
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
                          oncontextmenu={(event) =>
                            openContextMenu(event, rowIndex, colIndex, rendered.column.id)}
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
                        ctrl.editingCell?.rowId === row.id &&
                        ctrl.editingCell?.columnId === rendered.column.id}
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
                        oncontextmenu={(event) =>
                          openContextMenu(event, rowIndex, colIndex, rendered.column.id)}
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
          bind:this={ctrl.verticalScrollbarEl}
          orientation="vertical"
          viewport-size={viewportHeight}
          content-size={scrollMetrics.scrollHeight ||
            rowDomTotalSize + headerHeight}
          value={scrollMetrics.scrollTop}
          step={typeof props.rowHeight === 'number' ? props.rowHeight : 30}
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
          step={props.columnWidth ?? 140}
          style={`width: calc(100% - ${hasVerticalOverflow ? 16 : 0}px);`}
        ></sv-grid-scrollbar>
      {/if}
      {#if hasMeasured && hasVerticalOverflow && hasHorizontalOverflow}
        <div class="sv-grid-scrollbar-corner-br" aria-hidden="true"></div>
      {/if}
    </div>

    <GridFooter {ctrl} />

    {#if ctrl.findOpen}
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
          bind:value={ctrl.findQuery}
          oninput={() => (ctrl.findHitIndex = 0)}
          onkeydown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              if (findHits.length === 0) return
              ctrl.findHitIndex = (ctrl.findHitIndex + (event.shiftKey ? -1 : 1) + findHits.length) % findHits.length
              const hit = findHits[ctrl.findHitIndex]
              if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
            }
            if (event.key === 'Escape') { event.preventDefault(); ctrl.findOpen = false; ctrl.findQuery = '' }
          }}
        />
        <span class="sv-grid-find-count">
          {findHits.length === 0 && ctrl.findQuery.trim()
            ? 'No matches'
            : findHits.length === 0
              ? ''
              : `${ctrl.findHitIndex + 1} of ${findHits.length}`}
        </span>
        <button type="button" class="sv-grid-find-step" aria-label="Previous match"
          disabled={findHits.length === 0}
          onclick={() => {
            ctrl.findHitIndex = (ctrl.findHitIndex - 1 + findHits.length) % findHits.length
            const hit = findHits[ctrl.findHitIndex]
            if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
          }}>↑</button>
        <button type="button" class="sv-grid-find-step" aria-label="Next match"
          disabled={findHits.length === 0}
          onclick={() => {
            ctrl.findHitIndex = (ctrl.findHitIndex + 1) % findHits.length
            const hit = findHits[ctrl.findHitIndex]
            if (hit) { setActiveCell(hit.rowIndex, hit.colIndex); scrollActiveCellIntoView(hit.rowIndex, hit.colIndex) }
          }}>↓</button>
        <button type="button" class="sv-grid-find-close" aria-label="Close find"
          onclick={() => { ctrl.findOpen = false; ctrl.findQuery = '' }}>✕</button>
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
        class:is-open={ctrl.toolPanelOpen}
        aria-label={ctrl.toolPanelOpen ? "Close columns panel" : "Open columns panel"}
        aria-expanded={ctrl.toolPanelOpen}
        onclick={() => (ctrl.toolPanelOpen = !ctrl.toolPanelOpen)}
        title="Columns"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="6" height="16" rx="1" />
          <rect x="11" y="4" width="4" height="16" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>
      {#if ctrl.toolPanelOpen}
        <aside class="sv-grid-tool-panel" aria-label="Columns tool panel">
          <div class="sv-grid-tool-panel-head">
            <span>Columns</span>
            <button
              type="button"
              class="sv-grid-tool-panel-close"
              aria-label="Close"
              onclick={() => (ctrl.toolPanelOpen = false)}>✕</button
            >
          </div>
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

  <GridMenus {ctrl} {icon} />
{/if}
