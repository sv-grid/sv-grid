// scroll-sync handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
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
import { createKeyboard } from "./keyboard-handlers";
import { createSummaries } from "./summaries";
import { createMenus } from "./menus";
import { createCellRender } from "./cell-render";
import { createEditing } from "./editing";
import { createSelection } from "./selection";
import { createColumns } from "./columns";
import { createGridApi } from "./build-api";
import { createClipboard } from "./clipboard";
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

export function createScrollSync<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function showTooltipFor(el: HTMLElement, text: string) {
    if (!text) return
    if (ctx.tooltipTimer) window.clearTimeout(ctx.tooltipTimer)
    ctx.tooltipTimer = window.setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const vw   = window.innerWidth
      const vh   = window.innerHeight
      const below = rect.bottom + 64 < vh
      // Clamp x so the 280px-wide tooltip doesn't fall off the viewport.
      const x = Math.min(Math.max(rect.left + 6, 10), vw - 290)
      const y = below ? rect.bottom + 6 : rect.top - 6
      ctx.tooltip = { text, x, y, below }
    }, 250)
  }

  function hideTooltip() {
    if (ctx.tooltipTimer) { window.clearTimeout(ctx.tooltipTimer); ctx.tooltipTimer = null }
    ctx.tooltip = null
  }

  function flushScheduledScrollSync() {
    ctx.scrollSyncRaf = null;
    ctx.scrollVersion += 1;
    if (ctx.rowVirtualizationEnabled)
      ctx.virtualizer.setScrollOffset(ctx.domToLogicalRowOffset(ctx.pendingScrollTop));
    if (ctx.columnVirtualizationEnabled)
      ctx.columnVirtualizer.setHorizontalOffset(ctx.pendingScrollLeft);
  }

  /**
   * Sync the virtualizer to the user's scroll position once per frame.
   *
   * The browser's smooth-scroll animation fires a `scroll` event on
   * every frame of the ~250 ms ramp after each wheel notch - so a
   * single wheel notch produces ~16 calls to `onBodyScroll`. Without
   * batching, each one ran a full virtualizer recalc + Svelte re-render
   * synchronously, which (a) made the work pile up on heavy demos and
   * (b) read on screen as "the grid keeps scrolling after the wheel
   * stopped" because each scroll event ticked the rendered window one
   * row at a time over a quarter-second.
   *
   * Batching to a single rAF flush per frame means each animation
   * frame produces ONE virtualizer update at the latest known scroll
   * position. Smooth-scroll still feels smooth (the browser is still
   * animating `scrollTop`), but the grid's per-frame cost is bounded
   * and the visible rows match the current `scrollTop` exactly when
   * the wheel stops - no trailing updates.
   */
  function scheduleScrollSync(scrollTop: number, scrollLeft: number) {
    ctx.pendingScrollTop = scrollTop;
    ctx.pendingScrollLeft = scrollLeft;
    if (ctx.scrollSyncRaf !== null) return;
    ctx.scrollSyncRaf = requestAnimationFrame(flushScheduledScrollSync);
  }

  function onBodyScroll(event: Event) {
    const container = event.currentTarget as HTMLDivElement | null;
    if (!container) return;
    if (ctx.columnMenuFor || ctx.operatorMenuFor) ctx.closeMenus();
    scheduleScrollSync(container.scrollTop, container.scrollLeft);
    // Mirror horizontal scroll to any aligned grids in the same group.
    if (ctx.props.alignedGridGroup != null) ctx.broadcastAlignedScroll(container.scrollLeft);

    if (ctx.props.onScrollBottomReached) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 32;
      if (atBottom && ctx.scrollBottomArmed) {
        ctx.scrollBottomArmed = false;
        ctx.props.onScrollBottomReached({ scrollTop, scrollHeight, clientHeight });
      } else if (!atBottom && !ctx.scrollBottomArmed) {
        ctx.scrollBottomArmed = true;
      }
    }
  }

  return {
    showTooltipFor,
    hideTooltip,
    flushScheduledScrollSync,
    scheduleScrollSync,
    onBodyScroll,
  };
}
