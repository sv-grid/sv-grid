<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
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
    type ColumnStat,
    type ResolvedCellFormat,
  } from "./conditional-formatting";
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
    getCellKey,
    resolveClassList,
    toDateInputValue,
    toDateTimeLocalInputValue,
    getEditableInputValue,
    getEditorInputType,
    toValueArray,
    getOptionLabel,
    getOptionColor,
    colorfulChipStyle,
    getEditorClass,
    asDate,
    clampMenuX,
    cssEscape,
    rawToNumber,
    formatFacetNumber,
    formatFacetDate,
  } from "./SvGrid.helpers";

  import type { SvGridController } from "./SvGrid.controller.svelte";

  let { ctrl, icon }: { ctrl: SvGridController<TFeatures, TData>; icon: Snippet<[string]> } = $props();

  // View facade: re-bind the controller's reactive members so the markup
  // (moved verbatim from SvGrid.svelte) stays identical.
  const groupingControlsEnabled = $derived(ctrl.groupingControlsEnabled);
  const filterMenuValues = $derived(ctrl.filterMenuValues);
  const tooltip = $derived(ctrl.tooltip);
  const showTooltipFor = $derived(ctrl.showTooltipFor);
  const columnMenuFor = $derived(ctrl.columnMenuFor);
  const columnMenuPos = $derived(ctrl.columnMenuPos);
  const filterMenuFor = $derived(ctrl.filterMenuFor);
  const filterMenuPos = $derived(ctrl.filterMenuPos);
  const operatorMenuFor = $derived(ctrl.operatorMenuFor);
  const operatorMenuPos = $derived(ctrl.operatorMenuPos);
  const chooseColumnsPos = $derived(ctrl.chooseColumnsPos);
  const showColumnFiltersEffective = $derived(ctrl.showColumnFiltersEffective);
  const grid = $derived(ctrl.grid);
  const allColumns = $derived(ctrl.allColumns);
  const isColumnPinned = $derived(ctrl.isColumnPinned);
  const pinColumnLeft = $derived(ctrl.pinColumnLeft);
  const pinColumnRight = $derived(ctrl.pinColumnRight);
  const unpinColumn = $derived(ctrl.unpinColumn);
  const sortDirectionByColumn = $derived(ctrl.sortDirectionByColumn);
  const groupingColumns = $derived(ctrl.groupingColumns);
  const columnVirtualizationEnabled = $derived(ctrl.columnVirtualizationEnabled);
  const updateFilterOperator = $derived(ctrl.updateFilterOperator);
  const updateFilterMenuValue = $derived(ctrl.updateFilterMenuValue);
  const updateFilterMenuValueTo = $derived(ctrl.updateFilterMenuValueTo);
  const operatorsForColumn = $derived(ctrl.operatorsForColumn);
  const defaultOperatorFor = $derived(ctrl.defaultOperatorFor);
  const operatorLabelFor = $derived(ctrl.operatorLabelFor);
  const isColumnFiltered = $derived(ctrl.isColumnFiltered);
  const closeMenus = $derived(ctrl.closeMenus);
  const autosizeColumn = $derived(ctrl.autosizeColumn);
  const autosizeAllColumns = $derived(ctrl.autosizeAllColumns);
  const resetColumns = $derived(ctrl.resetColumns);
  const openChooseColumns = $derived(ctrl.openChooseColumns);
  const sortColumnFromMenu = $derived(ctrl.sortColumnFromMenu);
  const clearColumnSort = $derived(ctrl.clearColumnSort);
  const groupByColumnFromMenu = $derived(ctrl.groupByColumnFromMenu);
  const clearGroupingFromMenu = $derived(ctrl.clearGroupingFromMenu);
  const columnMenuFacetValues = $derived(ctrl.columnMenuFacetValues);
  const columnMenuVisibleFacets = $derived(ctrl.columnMenuVisibleFacets);
  const isFacetChecked = $derived(ctrl.isFacetChecked);
  const toggleFacetValue = $derived(ctrl.toggleFacetValue);
  const isAllFacetsChecked = $derived(ctrl.isAllFacetsChecked);
  const toggleAllFacets = $derived(ctrl.toggleAllFacets);
  const clearColumnFilter = $derived(ctrl.clearColumnFilter);
  const contextMenuFor = $derived(ctrl.contextMenuFor);
  const contextMenuPos = $derived(ctrl.contextMenuPos);
  const contextMenuItems = $derived(ctrl.contextMenuItems);
  const closeContextMenu = $derived(ctrl.closeContextMenu);
  const commentEditFor = $derived(ctrl.commentEditFor);
  const saveComment = $derived(ctrl.saveComment);
  const removeComment = $derived(ctrl.removeComment);
  const closeCommentEditor = $derived(ctrl.closeCommentEditor);
</script>

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
          bind:value={ctrl.columnMenuSearch}
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
              checked={!ctrl.hiddenColumns[column.id]}
              onchange={(event) => {
                const visible = (event.currentTarget as HTMLInputElement)
                  .checked;
                if (visible) {
                  const next = { ...ctrl.hiddenColumns };
                  delete next[column.id];
                  ctrl.hiddenColumns = next;
                } else {
                  ctrl.hiddenColumns = { ...ctrl.hiddenColumns, [column.id]: true };
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

  {#if contextMenuFor}
    <div
      class="sv-grid-menu-backdrop"
      role="presentation"
      oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}
      onclick={closeContextMenu}
    ></div>
    <div
      class="sv-grid-menu sv-grid-context-menu"
      role="menu"
      style={`left: ${contextMenuPos.x}px; top: ${contextMenuPos.y}px;`}
    >
      {#each contextMenuItems() as item (item.key)}
        {#if item.separator}
          <div class="sv-grid-menu-sep"></div>
        {:else}
          <button
            type="button"
            class="sv-grid-menu-item"
            role="menuitem"
            disabled={item.disabled}
            onclick={() => { item.run?.(); closeContextMenu(); }}
          >{item.label}</button>
        {/if}
      {/each}
    </div>
  {/if}

  {#if commentEditFor}
    <div
      class="sv-grid-menu-backdrop"
      role="presentation"
      onclick={closeCommentEditor}
    ></div>
    <div
      class="sv-grid-menu sv-grid-comment-editor"
      role="dialog"
      aria-label="Edit comment"
      style={`left: ${commentEditFor.x}px; top: ${commentEditFor.y}px;`}
    >
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        class="sv-grid-comment-textarea"
        rows="3"
        placeholder="Add a comment…"
        autofocus
        bind:value={ctrl.commentDraft}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") { e.preventDefault(); closeCommentEditor(); }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveComment(); }
        }}
      ></textarea>
      <div class="sv-grid-comment-actions">
        <button type="button" class="sv-grid-comment-remove" onclick={removeComment}>Remove</button>
        <span class="sv-grid-comment-spacer"></span>
        <button type="button" class="sv-grid-comment-cancel" onclick={closeCommentEditor}>Cancel</button>
        <button type="button" class="sv-grid-comment-save" onclick={saveComment}>Save</button>
      </div>
    </div>
  {/if}
