// columns handlers extracted from the controller. Imperative event handlers
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

export function createColumns<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function cellPinStyle(columnId: string): string {
    // z-index 30 - higher than the active-cell / selection-range stacking
    // context (z=20) so a selected cell in the scrollable middle never
    // bleeds over the pinned columns during horizontal scroll. Still
    // sits below dropdowns (z=900+) and the column menu.
    const leftOffset = ctx.pinnedOffsets.left[columnId];
    if (leftOffset !== undefined) {
      return `position: sticky; left: ${leftOffset}px; z-index: 30;`;
    }
    const rightOffset = ctx.pinnedOffsets.right[columnId];
    if (rightOffset !== undefined) {
      return `position: sticky; right: ${rightOffset}px; z-index: 30;`;
    }
    return "";
  }

  function isColumnPinned(columnId: string): "left" | "right" | null {
    if (ctx.columnPinning.left.includes(columnId)) return "left";
    if (ctx.columnPinning.right.includes(columnId)) return "right";
    return null;
  }

  /** Compute the current full column order as displayed (pinned-left
   *  first, unpinned in the middle, pinned-right last). The order
   *  emitted via `onColumnOrderChange` matches what the user sees. */
  function getCurrentColumnOrder(): string[] {
    return ctx.allColumns.map((c: any) => c.id);
  }

  function emitColumnOrder() {
    ctx.props.onColumnOrderChange?.(getCurrentColumnOrder());
  }

  function setColumnOrderInternal(ids: ReadonlyArray<string>) {
    ctx.userColumnOrder = [...ids];
    emitColumnOrder();
  }

  /** Drop `dragId` before / after `targetId` in the user order. We
   *  rebuild a clean order out of the currently-displayed columns so
   *  hidden columns are unaffected and pin groups stay logically
   *  separate (you can reorder freely within left-pinned / unpinned /
   *  right-pinned, but a drop across pin zones is allowed - the cell
   *  just lands in whichever zone the target belongs to). */
  function applyColumnDrop(dragId: string, targetId: string, side: "before" | "after") {
    if (dragId === targetId) return;
    const current = getCurrentColumnOrder();
    const without = current.filter((id: any) => id !== dragId);
    let idx = without.indexOf(targetId);
    if (idx < 0) return;
    if (side === "after") idx++;
    without.splice(idx, 0, dragId);
    setColumnOrderInternal(without);
  }

  function onColumnHeaderDragStart(e: DragEvent, columnId: string) {
    if (!(ctx.props.enableColumnReorder ?? false)) return;
    ctx.colDragId = columnId;
    e.dataTransfer?.setData("text/plain", columnId);
    e.dataTransfer!.effectAllowed = "move";
  }

  function onColumnHeaderDragOver(e: DragEvent, columnId: string) {
    if (!ctx.colDragId || ctx.colDragId === columnId) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.colDropSide = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
    ctx.colDropOnId = columnId;
  }

  function onColumnHeaderDragLeave(columnId: string) {
    if (ctx.colDropOnId === columnId) { ctx.colDropOnId = null; ctx.colDropSide = null; }
  }

  function onColumnHeaderDrop(e: DragEvent, columnId: string) {
    e.preventDefault();
    if (ctx.colDragId && ctx.colDropSide) applyColumnDrop(ctx.colDragId, columnId, ctx.colDropSide);
    ctx.colDragId = null; ctx.colDropOnId = null; ctx.colDropSide = null;
  }

  function onColumnHeaderDragEnd() {
    ctx.colDragId = null; ctx.colDropOnId = null; ctx.colDropSide = null;
  }

  function pinColumnLeft(columnId: string) {
    const left = ctx.columnPinning.left.filter((id: any) => id !== columnId);
    const right = ctx.columnPinning.right.filter((id: any) => id !== columnId);
    ctx.columnPinning = { left: [...left, columnId], right };
    ctx.closeMenus();
  }

  function pinColumnRight(columnId: string) {
    const left = ctx.columnPinning.left.filter((id: any) => id !== columnId);
    const right = ctx.columnPinning.right.filter((id: any) => id !== columnId);
    ctx.columnPinning = { left, right: [columnId, ...right] };
    ctx.closeMenus();
  }

  function unpinColumn(columnId: string) {
    ctx.columnPinning = {
      left: ctx.columnPinning.left.filter((id: any) => id !== columnId),
      right: ctx.columnPinning.right.filter((id: any) => id !== columnId),
    };
    ctx.closeMenus();
  }

  function toggleColumnVisibleInPanel(columnId: string) {
    if (ctx.hiddenColumns[columnId]) {
      const next = { ...ctx.hiddenColumns };
      delete next[columnId];
      ctx.hiddenColumns = next;
    } else {
      ctx.hiddenColumns = { ...ctx.hiddenColumns, [columnId]: true };
    }
  }

  function moveColumnInPanel(columnId: string, dir: -1 | 1) {
    const current = ctx.toolPanelColumns.map((c: any) => c.id);
    const i = current.indexOf(columnId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    [current[i], current[j]] = [current[j]!, current[i]!];
    ctx.userColumnOrder = current;
  }

  function toggleGroupInPanel(columnId: string) {
    const g = (ctx.grid.getState().grouping ?? []) as string[];
    ctx.grid.setGrouping(
      g.includes(columnId)
        ? g.filter((x) => x !== columnId)
        : [...g, columnId],
    );
  }

  /** Width before fitColumns scaling - what the columnDef/user actually set. */
  function getColumnBaseWidth(columnId: string) {
    if (ctx.columnWidths[columnId] !== undefined) return ctx.columnWidths[columnId];
    const column = ctx.grid.getAllColumns().find((c: any) => c.id === columnId);
    if (column?.columnDef.width !== undefined) return column.columnDef.width;
    return ctx.props.columnWidth ?? 140;
  }

  function getColumnWidth(columnId: string) {
    const fitted = ctx.fittedColumnWidths?.[columnId];
    if (fitted !== undefined && ctx.columnWidths[columnId] === undefined)
      return fitted;
    return getColumnBaseWidth(columnId);
  }

  function startColumnResize(event: PointerEvent, columnId: string) {
    event.stopPropagation();
    event.preventDefault();
    ctx.resizingColumnId = columnId;
    ctx.resizeStartX = event.clientX;
    ctx.resizeStartWidth = getColumnWidth(columnId);
    document.addEventListener("pointermove", onColumnResizeMove);
    document.addEventListener("pointerup", endColumnResize);
    document.addEventListener("pointercancel", endColumnResize);
  }

  function onColumnResizeMove(event: PointerEvent) {
    if (!ctx.resizingColumnId) return;
    // Coalesce updates onto the animation frame: pointermove can fire many
    // times per frame, and each $state mutation triggers a full reactive
    // recompute of the column-layout pipeline. Without rAF coalescing the
    // grid stutters during the drag.
    ctx.resizePendingWidth = Math.max(
      ctx.MIN_COLUMN_WIDTH,
      ctx.resizeStartWidth + (event.clientX - ctx.resizeStartX),
    );
    if (ctx.resizeRaf !== null) return;
    ctx.resizeRaf = requestAnimationFrame(() => {
      ctx.resizeRaf = null;
      if (!ctx.resizingColumnId) return;
      ctx.columnWidths = {
        ...ctx.columnWidths,
        [ctx.resizingColumnId]: ctx.resizePendingWidth,
      };
    });
  }

  function endColumnResize() {
    if (ctx.resizeRaf !== null) {
      cancelAnimationFrame(ctx.resizeRaf);
      ctx.resizeRaf = null;
    }
    if (ctx.resizingColumnId && ctx.resizePendingWidth) {
      // Make sure the final width is committed even if the last rAF was
      // canceled mid-flight.
      ctx.columnWidths = {
        ...ctx.columnWidths,
        [ctx.resizingColumnId]: ctx.resizePendingWidth,
      };
    }
    ctx.resizingColumnId = null;
    document.removeEventListener("pointermove", onColumnResizeMove);
    document.removeEventListener("pointerup", endColumnResize);
    document.removeEventListener("pointercancel", endColumnResize);
  }

  function measureText(text: string, font: string): number {
    if (!text) return 0;
    if (!ctx.measureCanvas) ctx.measureCanvas = document.createElement("canvas");
    const c2d = ctx.measureCanvas.getContext("2d");
    if (!c2d) return 0;
    c2d.font = font;
    return c2d.measureText(text).width;
  }

  /** Snap a column to the width of its widest visible cell (header + body). */
  function autosizeColumn(columnId: string) {
    if (!ctx.gridRootEl) return;
    const sampleCell = (ctx.gridRootEl as HTMLElement).querySelector<HTMLElement>(
      `[data-col-id="${CSS.escape(columnId)}"]`,
    );
    if (!sampleCell) return;
    const cellFont = getComputedStyle(sampleCell).font;

    let max = ctx.MIN_COLUMN_WIDTH;
    const header = (ctx.gridRootEl as HTMLElement).querySelector<HTMLElement>(
      `[data-svgrid-header-col="${CSS.escape(columnId)}"]`,
    );
    if (header) {
      const labelEl = header.querySelector<HTMLElement>(
        ".sv-grid-header-label",
      );
      const target = labelEl ?? header;
      const text = target.textContent ?? "";
      // +70 reserves room for sort indicator + funnel + 3-dot menu button
      max = Math.max(
        max,
        measureText(text, getComputedStyle(target).font) + 70,
      );
    }

    const cells = (ctx.gridRootEl as HTMLElement).querySelectorAll<HTMLElement>(
      `[data-col-id="${CSS.escape(columnId)}"]`,
    );
    cells.forEach((cell: any) => {
      const text = cell.textContent ?? "";
      const w = measureText(text, cellFont);
      if (w > max) max = w;
    });

    // cell horizontal padding (~16px) + 8px breathing room
    ctx.columnWidths = {
      ...ctx.columnWidths,
      [columnId]: Math.max(ctx.MIN_COLUMN_WIDTH, Math.ceil(max) + 24),
    };
  }

  function autosizeAllColumns() {
    for (const column of ctx.allColumns) autosizeColumn(column.id);
  }

  function resetColumns() {
    ctx.columnWidths = {};
    ctx.hiddenColumns = {};
    ctx.columnPinning = { left: [], right: [] };
  }

  return {
    cellPinStyle,
    isColumnPinned,
    getCurrentColumnOrder,
    emitColumnOrder,
    setColumnOrderInternal,
    applyColumnDrop,
    onColumnHeaderDragStart,
    onColumnHeaderDragOver,
    onColumnHeaderDragLeave,
    onColumnHeaderDrop,
    onColumnHeaderDragEnd,
    pinColumnLeft,
    pinColumnRight,
    unpinColumn,
    toggleColumnVisibleInPanel,
    moveColumnInPanel,
    toggleGroupInPanel,
    getColumnBaseWidth,
    getColumnWidth,
    startColumnResize,
    onColumnResizeMove,
    endColumnResize,
    measureText,
    autosizeColumn,
    autosizeAllColumns,
    resetColumns,
  };
}
