<script lang="ts" generics="TFeatures extends TableFeatures = TableFeatures, TData extends RowData = RowData">
  import {
      type RowData,
      type TableFeatures,
    } from "./index";
  import "./sv-grid-scrollbar";
  import {
      fmtStat,
    } from "./SvGrid.helpers";
  import type { SvGridController } from "./SvGrid.controller.svelte";

  let {
    ctrl,
    pager = true,
    showStatus = true,
    top = false,
    pageSizeOptions,
  }: {
    ctrl: SvGridController<TFeatures, TData>;
    /** Render the pagination controls in this instance. */
    pager?: boolean;
    /** Render the status bar in this instance. */
    showStatus?: boolean;
    /** This is a top-positioned footer (styling only). */
    top?: boolean;
    /** Page-size choices for the selector. Defaults to `[10, 25, 50, 100]`. */
    pageSizeOptions?: number[];
  } = $props();

  // SvGridDropdown is ~22 KB and exists here only to pick one of four numbers.
  // Importing it statically also dragged it into the base bundle and silently
  // defeated the lazy `import()` in SvGrid.svelte, which loads the same
  // component as a cell editor. So the closed trigger below is plain markup
  // reusing the dropdown's own classes (identical appearance), and the real
  // component is fetched on first open. Keep this lazy: a static import here
  // re-breaks the cell-editor split too, not just the footer.
  let PageSizeDropdown = $state<typeof import("./SvGridDropdown.svelte").default | null>(null);
  let loadingPageSize = $state(false);

  async function openPageSize() {
    if (PageSizeDropdown || loadingPageSize) return;
    loadingPageSize = true;
    try {
      PageSizeDropdown = (await import("./SvGridDropdown.svelte")).default;
    } finally {
      loadingPageSize = false;
    }
  }

  // View facade: re-bind the controller's reactive members so the markup
  // (moved verbatim from SvGrid.svelte) stays identical.
  const paginationEnabled = $derived(ctrl.paginationEnabled);
  const statusBarEnabled = $derived(ctrl.statusBarEnabled);
  const statusBarAggregates = $derived(ctrl.statusBarAggregates);
  const statusBarStats = $derived(ctrl.statusBarStats);
  const changePage = $derived(ctrl.changePage);
  const goToPage = $derived(ctrl.goToPage);
  const setPageSize = $derived(ctrl.setPageSize);
  const messages = $derived(ctrl.messages);
</script>

    {#if showStatus && statusBarEnabled && statusBarStats}
      {@const s = statusBarStats}
      <div class="sv-grid-status-bar" role="status" aria-live="polite">
        {#each statusBarAggregates as agg (agg)}
          {#if agg === "count"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">{messages.statCount}</span>{fmtStat(s.count)}</span
            >
          {:else if agg === "numericCount"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">Numeric</span>{fmtStat(s.numericCount)}</span
            >
          {:else if s.numericCount > 0 && agg === "sum"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">{messages.statSum}</span>{fmtStat(s.sum)}</span
            >
          {:else if s.numericCount > 0 && agg === "avg"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">{messages.statAvg}</span>{fmtStat(s.avg)}</span
            >
          {:else if s.numericCount > 0 && agg === "min"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">{messages.statMin}</span>{fmtStat(s.min)}</span
            >
          {:else if s.numericCount > 0 && agg === "max"}
            <span class="sv-grid-status-item"
              ><span class="sv-grid-status-label">{messages.statMax}</span>{fmtStat(s.max)}</span
            >
          {/if}
        {/each}
      </div>
    {/if}

    {#if pager && paginationEnabled}
      {@const totalRows = ctrl.paginationTotalRows}
      {@const pageSize = ctrl.paginationPageSize}
      {@const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))}
      {@const currentPage = Math.min(ctrl.paginationPageIndex + 1, pageCount)}
      {@const rangeStart =
        totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}
      {@const rangeEnd = Math.min(totalRows, currentPage * pageSize)}
      {@const onFirst = currentPage <= 1}
      {@const onLast = currentPage >= pageCount}
      {@const sizes = pageSizeOptions && pageSizeOptions.length ? pageSizeOptions : [10, 25, 50, 100]}
      <div class="sv-grid-pagination" class:sv-grid-pagination-top={top} role="navigation" aria-label="Pagination">
        <div class="sv-grid-pagination-pagesize">
          <span>{messages.pageSize}</span>
          <div class="sv-grid-pagination-pagesize-dd">
            {#if PageSizeDropdown}
              <!-- autoOpen so the click that triggered the load also opens the
                   panel, rather than making the user click a second time. -->
              <PageSizeDropdown
                options={sizes.map((n) => ({ value: n, label: String(n) }))}
                value={pageSize}
                autoOpen={true}
                onChange={(v) => setPageSize(Number(v))}
              />
            {:else}
              <!-- Mirrors SvGridDropdown's closed trigger (same classes, same
                   ARIA). Its box styling comes from the global
                   .sv-grid-pagination-pagesize-dd rules in SvGrid.css, NOT from
                   SvGridDropdown's scoped styles (those only exist once the chunk
                   loads) - so keep the two in step or the placeholder renders as
                   a stock <button> until the first click. -->
              <div class="sv-grid-dropdown">
                <button
                  type="button"
                  class="sv-grid-dropdown-trigger"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  onclick={openPageSize}
                >
                  <span class="sv-grid-dropdown-label">{pageSize}</span>
                  <span class="sv-grid-dropdown-caret" aria-hidden="true">▾</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
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
            aria-label={messages.firstPage}>⇤</button
          >
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onFirst}
            onclick={() => changePage(-1)}
            aria-label={messages.prevPage}>‹</button
          >
          <span class="sv-grid-pagination-label">
            {messages.page} <strong>{currentPage.toLocaleString()}</strong> {messages.of}
            <strong>{pageCount.toLocaleString()}</strong>
          </span>
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onLast}
            onclick={() => changePage(1)}
            aria-label={messages.nextPage}>›</button
          >
          <button
            type="button"
            class="sv-grid-pagination-btn"
            disabled={onLast}
            onclick={() => goToPage(pageCount - 1)}
            aria-label={messages.lastPage}>⇥</button
          >
        </div>
      </div>
    {/if}
