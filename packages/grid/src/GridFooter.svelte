<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
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
    } from "./SvGrid.controller.svelte";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let { ctrl }: { ctrl: SvGridController<TFeatures, TData> } = $props();

  // View facade: re-bind the controller's reactive members so the markup
  // (moved verbatim from SvGrid.svelte) stays identical.
  const paginationEnabled = $derived(ctrl.paginationEnabled);
  const grid = $derived(ctrl.grid);
  const paginationState = $derived(ctrl.paginationState);
  const allRowsBeforePagination = $derived(ctrl.allRowsBeforePagination);
  const statusBarEnabled = $derived(ctrl.statusBarEnabled);
  const statusBarAggregates = $derived(ctrl.statusBarAggregates);
  const statusBarStats = $derived(ctrl.statusBarStats);
  const changePage = $derived(ctrl.changePage);
  const goToPage = $derived(ctrl.goToPage);
  const setPageSize = $derived(ctrl.setPageSize);
</script>

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
