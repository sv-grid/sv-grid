<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  import {
    applyExcelFilter,
    normalizeForFilter,
    splitInTokens,
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
  const columnMenuTabsEnabled = $derived(ctrl.props.columnMenuTabs === true);
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
  const filterRowValues = $derived(ctrl.filterRowValues);
  const inSuggestFor = $derived(ctrl.inSuggestFor);
  const inSuggestPos = $derived(ctrl.inSuggestPos);
  const inSuggestValues = $derived(ctrl.inSuggestValues);
  const toggleFilterToken = $derived(ctrl.toggleFilterToken);
  const facetValuesForColumn = $derived(ctrl.facetValuesForColumn);

  // Patch a column's menu filter (used for the optional 2nd condition + join
  // of multi-condition filtering). Merges into the existing entry, creating a
  // base entry from the column's default operator when none exists yet.
  function patchFilter(columnId: string, patch: Record<string, unknown>) {
    const col = allColumns.find((c) => c.id === columnId);
    const cur = ctrl.filterMenuValues[columnId] ?? { operator: defaultOperatorFor(col), value: "" };
    ctrl.filterMenuValues = { ...ctrl.filterMenuValues, [columnId]: { ...cur, ...patch } };
  }
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

  <!-- Shared filter UI: rendered both in the funnel popover and in the column
       menu's Filter tab, so the two never diverge. -->
  {#snippet filterPanelBody(colId: string)}
    {@const menuColumn = allColumns.find((c) => c.id === colId)}
    {@const menuOperatorOptions = operatorsForColumn(menuColumn)}
    {@const menuActiveOperator = filterMenuValues[colId]?.operator ?? defaultOperatorFor(menuColumn)}
    {@const menuInputType = getEditorInputType((menuColumn?.columnDef.editorType ?? "text") as CellEditorType)}
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
          updateFilterOperator(colId, (event.currentTarget as HTMLSelectElement).value as FilterOperator)}
      >
        {#each menuOperatorOptions as option (option.value)}
          <option value={option.value}>{operatorLabelFor(option, menuColumn)}</option>
        {/each}
      </select>
      {#if menuActiveOperator !== "isBlank" && menuActiveOperator !== "isNotBlank"}
        {@const isSetOp =
          menuActiveOperator === "in" || menuActiveOperator === "notIn"}
        <input
          class="sv-grid-menu-condition-value"
          type={menuActiveOperator === "regex" ? "text" : menuInputType}
          list={isSetOp ? `sv-in-list-${colId}` : undefined}
          value={filterMenuValues[colId]?.value ?? ""}
          placeholder={menuActiveOperator === "between"
            ? "From"
            : isSetOp
              ? "value, value..."
              : menuActiveOperator === "regex"
                ? "Pattern..."
                : "Filter value..."}
          oninput={(event) => updateFilterMenuValue(colId, (event.currentTarget as HTMLInputElement).value)}
        />
        {#if isSetOp}
          <datalist id={`sv-in-list-${colId}`}>
            {#each facetValuesForColumn(colId).slice(0, 200) as v (v)}
              <option value={v}></option>
            {/each}
          </datalist>
        {/if}
        {#if menuActiveOperator === "between"}
          <input
            class="sv-grid-menu-condition-value"
            type={menuInputType}
            value={filterMenuValues[colId]?.valueTo ?? ""}
            placeholder="To"
            oninput={(event) => updateFilterMenuValueTo(colId, (event.currentTarget as HTMLInputElement).value)}
          />
        {/if}
        {@const mf = filterMenuValues[colId]}
        {#if mf?.operator2}
          {@const op2 = mf.operator2 ?? defaultOperatorFor(menuColumn)}
          <div class="sv-grid-menu-join" role="radiogroup" aria-label="Combine conditions">
            <button type="button" class:is-on={(mf.join ?? "AND") === "AND"}
              onclick={() => patchFilter(colId, { join: "AND" })}>AND</button>
            <button type="button" class:is-on={mf.join === "OR"}
              onclick={() => patchFilter(colId, { join: "OR" })}>OR</button>
            <button type="button" class="sv-grid-menu-join-x" title="Remove second condition"
              aria-label="Remove second condition"
              onclick={() => patchFilter(colId, { operator2: undefined, value2: undefined, valueTo2: undefined, join: undefined })}>×</button>
          </div>
          <select
            class="sv-grid-menu-operator-select"
            aria-label="Second filter condition"
            value={op2}
            onchange={(event) =>
              patchFilter(colId, { operator2: (event.currentTarget as HTMLSelectElement).value as FilterOperator })}
          >
            {#each menuOperatorOptions as option (option.value)}
              <option value={option.value}>{operatorLabelFor(option, menuColumn)}</option>
            {/each}
          </select>
          {#if op2 !== "isBlank"}
            <input
              class="sv-grid-menu-condition-value"
              type={menuInputType}
              value={mf.value2 ?? ""}
              placeholder={op2 === "between" ? "From" : "Filter value..."}
              oninput={(event) => patchFilter(colId, { value2: (event.currentTarget as HTMLInputElement).value })}
            />
            {#if op2 === "between"}
              <input
                class="sv-grid-menu-condition-value"
                type={menuInputType}
                value={mf.valueTo2 ?? ""}
                placeholder="To"
                oninput={(event) => patchFilter(colId, { valueTo2: (event.currentTarget as HTMLInputElement).value })}
              />
            {/if}
          {/if}
        {:else}
          <button type="button" class="sv-grid-menu-add-cond"
            onclick={() => patchFilter(colId, { operator2: defaultOperatorFor(menuColumn), value2: "", join: "AND" })}>
            + Add condition
          </button>
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
        <input type="checkbox" checked={isAllFacetsChecked(colId)} onchange={() => toggleAllFacets(colId)} />
        <span class="sv-grid-facet-label">(Select all)</span>
      </label>
      <div class="sv-grid-facet-list">
        {#each columnMenuVisibleFacets as value (value)}
          <label class="sv-grid-facet">
            <input type="checkbox" checked={isFacetChecked(colId, value)} onchange={() => toggleFacetValue(colId, value)} />
            <span class="sv-grid-facet-label">{value === "" ? "(Blanks)" : value}</span>
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
          disabled={!isColumnFiltered(colId)}
          onclick={() => clearColumnFilter(colId)}
        >
          Clear filter
        </button>
        <button type="button" class="sv-grid-menu-btn sv-grid-menu-btn-primary" onclick={closeMenus}>
          Done
        </button>
      </div>
    </div>
  {/snippet}

  {#if columnMenuFor}
    {@const menuColumnId = columnMenuFor}
    {@const menuCol = allColumns.find((c) => c.id === menuColumnId)}
    {@const menuCanSort = menuCol?.getCanSort?.() ?? false}
    {@const menuCanFilter = (menuCol?.columnDef.field != null) && (menuCol?.columnDef.filterable !== false)}
    {@const menuTab = ctrl.columnMenuTab}
    <div
      class="sv-grid-menu sv-grid-column-menu"
      role="menu"
      style={`left: ${columnMenuPos.x}px; top: ${columnMenuPos.y}px; max-height: calc(100vh - ${columnMenuPos.y}px - 12px);`}
    >
      {#if columnMenuTabsEnabled}
        <div class="sv-grid-menu-tabs" role="tablist">
          <button type="button" class="sv-grid-menu-tab" class:is-active={menuTab === "general"}
            role="tab" aria-selected={menuTab === "general"}
            onclick={() => (ctrl.columnMenuTab = "general")}>General</button>
          {#if menuCanFilter && showColumnFiltersEffective}
            <button type="button" class="sv-grid-menu-tab" class:is-active={menuTab === "filter"}
              role="tab" aria-selected={menuTab === "filter"}
              onclick={() => (ctrl.columnMenuTab = "filter")}>Filter</button>
          {/if}
          <button type="button" class="sv-grid-menu-tab" class:is-active={menuTab === "columns"}
            role="tab" aria-selected={menuTab === "columns"}
            onclick={() => (ctrl.columnMenuTab = "columns")}>Columns</button>
        </div>
      {/if}
      {#if columnMenuTabsEnabled && menuTab === "filter" && menuCanFilter && showColumnFiltersEffective}
        {@render filterPanelBody(menuColumnId)}
      {:else if columnMenuTabsEnabled && menuTab === "columns"}
        <div class="sv-grid-menu-filter-head">Visible columns</div>
        <div class="sv-grid-facet-list">
          {#each grid.getAllColumns() as column (column.id)}
            <label class="sv-grid-facet">
              <input
                type="checkbox"
                checked={!ctrl.hiddenColumns[column.id]}
                onchange={(event) => {
                  const visible = (event.currentTarget as HTMLInputElement).checked;
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
                >{typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}</span
              >
            </label>
          {/each}
        </div>
      {:else}
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
      {#if !columnMenuTabsEnabled}
        <!-- Flat menu: reach the column chooser via a submenu (tabbed mode has
             a Columns tab instead). -->
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
          <span class="sv-grid-header-icon sv-grid-menu-item-chevron">{@render icon("chevron-down")}</span>
        </button>
      {/if}
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
      {/if}
    </div>
  {/if}

  {#if filterMenuFor && showColumnFiltersEffective}
    <div
      class="sv-grid-menu sv-grid-filter-menu"
      role="menu"
      style={`left: ${filterMenuPos.x}px; top: ${filterMenuPos.y}px; max-height: calc(100vh - ${filterMenuPos.y}px - 12px);`}
    >
      {@render filterPanelBody(filterMenuFor)}
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

  {#if inSuggestFor}
    {@const suggestColId = inSuggestFor}
    {@const selectedTokens = new Set(
      splitInTokens(filterRowValues[suggestColId] ?? ""),
    )}
    <!-- Value suggestions for an `in` / `notIn` chip input. Items use
         `onmousedown` (preventDefault) so clicking one keeps focus in the
         chip input and the dropdown stays open for multi-select; the input's
         own blur handler closes it when focus truly leaves. -->
    <div
      class="sv-grid-menu sv-grid-in-suggest"
      role="listbox"
      aria-multiselectable="true"
      aria-label="Filter values"
      style={`left: ${inSuggestPos.x}px; top: ${inSuggestPos.y}px;`}
    >
      {#each inSuggestValues as value (value)}
        {@const checked = selectedTokens.has(value)}
        <button
          type="button"
          class="sv-grid-menu-item sv-grid-in-suggest-item"
          role="option"
          aria-selected={checked}
          onmousedown={(event) => {
            event.preventDefault();
            toggleFilterToken(suggestColId, value);
          }}
        >
          <span class="sv-grid-in-suggest-check" aria-hidden="true"
            >{checked ? "✓" : ""}</span
          >
          <span class="sv-grid-in-suggest-label"
            >{value === "" ? "(Blanks)" : value}</span
          >
        </button>
      {:else}
        <div class="sv-grid-facet-empty">No values</div>
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
