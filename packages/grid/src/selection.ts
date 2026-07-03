// selection handlers extracted from the controller. Imperative event handlers
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

export function createSelection<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function isRowSelected(rowId: string) {
    return Boolean(ctx.rowSelectionState[rowId]);
  }

  function toggleRowSelectionById(rowId: string) {
    ctx.grid.setRowSelection((prev: any) => ({ ...prev, [rowId]: !prev[rowId] }));
  }

  function toggleSelectAllRows() {
    const selectable = ctx.allRows.filter((row: any) => !isGroupRow(row));
    const select = ctx.headerSelectionState !== "all";
    ctx.grid.setRowSelection((prev: any) => {
      const next = { ...prev };
      for (const row of selectable) {
        if (select) next[row.id] = true;
        else delete next[row.id];
      }
      return next;
    });
  }

  function setActiveCell(rowIndex: number, colIndex: number) {
    ctx.userHasActivatedCell = true;
    ctx.grid.setActiveCell({
      rowIndex,
      colIndex,
      cellId: getGridCellDomId("svgrid", rowIndex, colIndex),
    });
    // Notify consumers (toolbars, ribbons) so they stay synced without
    // having to listen on the DOM. Fired on EVERY active-cell move -
    // click, arrow key, Tab, Enter, page-up/down, fill release.
    if (ctx.props.onActiveCellChange) {
      const column = ctx.allColumns[colIndex];
      ctx.props.onActiveCellChange({
        rowIndex,
        colIndex,
        columnId: column?.id ?? "",
      });
    }
  }

  function scrollActiveCellIntoView(rowIndex: number, colIndex: number) {
    if (!ctx.scrollContainer) return;
    if (rowIndex < 0 || rowIndex >= ctx.allRows.length) return;
    if (colIndex < 0 || colIndex >= ctx.allColumns.length) return;

    if (ctx.rowVirtualizationEnabled) {
      // Prefer the browser's native `scrollIntoView({ block: 'nearest' })`
      // when the target row is already mounted. It does Excel-style
      // minimum-scroll, respects the sticky thead via the
      // `scroll-padding-top` we set on the scroll container, and runs
      // on the compositor so it doesn't jump.
      const root = ctx.scrollContainer as HTMLElement
      const trEl = root.querySelector<HTMLElement>(
        `tr.sv-grid-row [data-svgrid-row="${rowIndex}"]`,
      )?.closest('tr.sv-grid-row') as HTMLElement | null
      if (trEl) {
        // `behavior: 'instant'` skips any user-agent smooth-scroll
        // animation. Without it, fast key-repeat queues multiple
        // overlapping animated scrolls and the viewport visibly
        // overshoots / jumps as they collide.
        trEl.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'instant' as ScrollBehavior,
        })
      } else if (ctx.rowScrollScalingActive) {
        // Huge-list scroll scaling: the logical row offset does NOT map 1:1
        // to a DOM scrollTop (the DOM scroll range is capped), so the plain
        // offset math below would clamp and never reach the target. Map the
        // logical offset into DOM space and align the row just under the
        // sticky header. Rows are sub-pixel tall in DOM space here, so exact
        // minimum-scroll is meaningless; once the row mounts the native
        // `scrollIntoView` path above fine-tunes on the next navigation.
        const headerHeight = (ctx.theadEl as HTMLElement | null)?.offsetHeight
          ?? ctx.headerHeight ?? 0
        const rowLogicalTop = ctx.virtualizer.getOffsetForIndex(rowIndex)
        const nextTop = Math.max(
          ctx.logicalToDomRowOffset(rowLogicalTop) - headerHeight,
          0,
        )
        if (Math.abs(nextTop - root.scrollTop) > 0.5) {
          root.scrollTop = nextTop
        }
      } else {
        // Row outside the rendered virtualizer window. Compute the
        // scroll-coordinate target manually and set scrollTop. On the
        // next render the row will mount and subsequent navigations
        // use the native path above.
        const currentTop   = root.scrollTop
        const clientHeight = root.clientHeight
        const headerHeight = (ctx.theadEl as HTMLElement | null)?.offsetHeight
          ?? ctx.headerHeight ?? 0
        const rowTopScroll = headerHeight + ctx.virtualizer.getOffsetForIndex(rowIndex)
        const rowHeight    = ctx.virtualizer.getSizeForIndex(rowIndex)
        const rowBottom    = rowTopScroll + rowHeight
        let nextTop = currentTop
        if (rowTopScroll < currentTop + headerHeight) {
          nextTop = rowTopScroll - headerHeight
        } else if (rowBottom > currentTop + clientHeight) {
          nextTop = rowBottom - clientHeight
        }
        nextTop = Math.max(nextTop, 0)
        if (nextTop !== currentTop) {
          root.scrollTop = nextTop
        }
      }
    } else {
      // Non-virtualized mode: the cell's <td> is already in the DOM.
      // Read its actual rect and bring it into view when it overlaps
      // with the sticky header or is past the visible bottom. Without
      // this branch, arrow keys move the active cell off-screen and
      // the scrollbar never follows.
      const cellEl = (ctx.scrollContainer as HTMLElement).querySelector<HTMLElement>(
        `td[data-svgrid-row="${rowIndex}"][data-svgrid-col="${colIndex}"]`,
      );
      if (cellEl) {
        const headerHeight   = ctx.theadEl?.offsetHeight ?? 0;
        const containerRect  = ctx.scrollContainer.getBoundingClientRect();
        const cellRect       = cellEl.getBoundingClientRect();
        const cellTopInView  = cellRect.top    - containerRect.top;
        const cellBotInView  = cellRect.bottom - containerRect.top;
        const clientHeight   = ctx.scrollContainer.clientHeight;
        let nextTop = ctx.scrollContainer.scrollTop;
        if (cellTopInView < ctx.headerHeight) {
          nextTop = ctx.scrollContainer.scrollTop + cellTopInView - ctx.headerHeight;
        } else if (cellBotInView > clientHeight) {
          nextTop = ctx.scrollContainer.scrollTop + cellBotInView - clientHeight;
        }
        nextTop = Math.max(nextTop, 0);
        if (nextTop !== ctx.scrollContainer.scrollTop) {
          ctx.scrollContainer.scrollTop = nextTop;
        }
      }
    }

    // Prefer the rendered item (cached size from the layout pass).
    // Fall back to the column virtualizer's offset helper - that
    // handles per-column variable widths correctly, unlike the
    // previous flat `colIndex * fallbackWidth` estimate.
    const item = ctx.renderedColumnItems.find((entry: any) => entry.index === colIndex);
    const fallbackWidth = ctx.props.columnWidth ?? 140;
    const cellStart = item?.start ?? ctx.columnVirtualizer?.getOffsetForIndex?.(colIndex) ?? (colIndex * fallbackWidth);
    const cellSize  = item?.size  ?? ctx.columnVirtualizer?.getSizeForIndex?.(colIndex)  ?? fallbackWidth;
    const cellEnd = cellStart + cellSize;
    const viewStart = ctx.scrollContainer.scrollLeft;
    const viewEnd = viewStart + ctx.scrollContainer.clientWidth;
    if (cellStart < viewStart) {
      ctx.scrollContainer.scrollLeft = cellStart;
    } else if (cellEnd > viewEnd) {
      ctx.scrollContainer.scrollLeft = cellEnd - ctx.scrollContainer.clientWidth;
    }
    // No inline scrollVersion bump - the `scroll` event triggers
    // onBodyScroll which flushes via rAF, doing one batched update.
  }

  // Normalize a range to a rectangle, or null when incomplete.
  function rangeRect(range: SelectionRange | null) {
    const a = range?.anchor;
    const f = range?.focus;
    if (!a || !f) return null;
    return {
      minRow: Math.min(a.rowIndex, f.rowIndex),
      maxRow: Math.max(a.rowIndex, f.rowIndex),
      minCol: Math.min(a.colIndex, f.colIndex),
      maxCol: Math.max(a.colIndex, f.colIndex),
    };
  }

  // Every selected rectangle: the committed extra ranges plus the active one.
  // Order matters for copy (added-order); the active range comes last.
  function getSelectionRects() {
    const rects = [] as Array<{ minRow: number; maxRow: number; minCol: number; maxCol: number }>;
    for (const r of (ctx.selectionRanges as SelectionRange[]) ?? []) {
      const rect = rangeRect(r);
      if (rect) rects.push(rect);
    }
    const active = rangeRect(ctx.selectionRange);
    if (active) rects.push(active);
    return rects;
  }

  function setSelection(rowIndex: number, colIndex: number, additive = false) {
    if (!ctx.enableCellSelectionEffective) return;
    if (additive) {
      // Commit the current active range (if any) and start a fresh one, so the
      // previous rectangle stays highlighted alongside the new Ctrl+drag.
      const active = ctx.selectionRange as SelectionRange;
      if (active.anchor && active.focus) {
        ctx.selectionRanges = [...(ctx.selectionRanges as SelectionRange[]), active];
      }
    } else {
      ctx.selectionRanges = [];
    }
    const point = { rowIndex, colIndex };
    ctx.selectionRange = { anchor: point, focus: point };
  }

  function extendSelection(rowIndex: number, colIndex: number) {
    if (!ctx.enableCellSelectionEffective) return;
    const anchor = ctx.selectionRange.anchor ?? { rowIndex, colIndex };
    ctx.selectionRange = { anchor, focus: { rowIndex, colIndex } };
  }

  function isCellInSelectedRange(rowIndex: number, colIndex: number) {
    for (const rect of getSelectionRects()) {
      if (
        rowIndex >= rect.minRow &&
        rowIndex <= rect.maxRow &&
        colIndex >= rect.minCol &&
        colIndex <= rect.maxCol
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns which sides of a selection rectangle a cell sits on, for the
   * Excel-style outline. With multiple ranges, the edges of the FIRST range
   * that contains the cell are returned (active range checked last so its
   * outline wins on overlap). Returns null when the cell is in no range.
   */
  function getCellRangeEdges(rowIndex: number, colIndex: number) {
    for (const rect of getSelectionRects()) {
      if (
        rowIndex < rect.minRow ||
        rowIndex > rect.maxRow ||
        colIndex < rect.minCol ||
        colIndex > rect.maxCol
      ) {
        continue;
      }
      return {
        top: rowIndex === rect.minRow,
        bottom: rowIndex === rect.maxRow,
        left: colIndex === rect.minCol,
        right: colIndex === rect.maxCol,
      };
    }
    return null;
  }

  /** Returns true when the given cell is inside the fill-drag preview
   *  range BUT outside the original source range. Used to paint a
   *  dashed-outline preview while the user is dragging the handle. */
  function isInFillPreview(rowIndex: number, colIndex: number) {
    const d = ctx.fillDrag;
    if (!d) return false;
    const minR = Math.min(d.sourceMinRow, d.targetRow);
    const maxR = Math.max(d.sourceMaxRow, d.targetRow);
    const minC = Math.min(d.sourceMinCol, d.targetCol);
    const maxC = Math.max(d.sourceMaxCol, d.targetCol);
    if (
      rowIndex < minR ||
      rowIndex > maxR ||
      colIndex < minC ||
      colIndex > maxC
    )
      return false;
    const inSource =
      rowIndex >= d.sourceMinRow &&
      rowIndex <= d.sourceMaxRow &&
      colIndex >= d.sourceMinCol &&
      colIndex <= d.sourceMaxCol;
    return !inSource;
  }

  /** Look up a column by id without depending on `buildApi`'s private
   *  closure (those helpers don't exist at this scope). */
  function findColumnById(columnId: string) {
    return ctx.allColumns.find((c: any) => c.id === columnId);
  }

  function onCellPointerDown(
    rowIndex: number,
    colIndex: number,
    event: PointerEvent,
  ) {
    if (event.button !== 0) return;
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column || isGroupRow(row)) return;
    const cellValue = ctx.getCellDisplayValue(
      row.id,
      column.id,
      getColumnBaseValue(row, column),
    );
    const isCheckboxColumn =
      column.columnDef.editorType === "checkbox" ||
      typeof cellValue === "boolean";
    if (isCheckboxColumn) return; // let onCellClick toggle the checkbox

    const active = ctx.grid.getState().activeCell;
    ctx.activeAtPointerDown = active
      ? { rowIndex: active.rowIndex, colIndex: active.colIndex }
      : null;
    if (event.shiftKey) {
      extendSelection(rowIndex, colIndex);
      setActiveCell(rowIndex, colIndex);
    } else {
      setActiveCell(rowIndex, colIndex);
      // Ctrl/Cmd starts an ADDITIONAL range, keeping prior ranges highlighted.
      setSelection(rowIndex, colIndex, event.ctrlKey || event.metaKey);
      // Range drag-select is a mouse/pen affordance. On touch, starting a drag
      // here would rubber-band a selection AND fight the browser's native
      // scroll (we never preventDefault), so a finger-drag to scroll the grid
      // instead selected cells. Tap still selects the single cell above; we
      // just don't enter drag-select mode for touch. (issue #23)
      if (event.pointerType !== "touch") ctx.isDraggingSelection = true;
    }
  }

  function onCellPointerEnter(rowIndex: number, colIndex: number) {
    if (!ctx.isDraggingSelection) return;
    const row = ctx.allRows[rowIndex];
    if (!row || isGroupRow(row)) return;
    extendSelection(rowIndex, colIndex);
    setActiveCell(rowIndex, colIndex);
  }

  function endDragSelection() {
    ctx.isDraggingSelection = false;
    // Also commit a fill-handle drag if one was in progress - the user
    // released the mouse, time to apply the pattern.
    if (ctx.fillDrag) ctx.onFillPointerUp();
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (ctx.fillDrag) {
      ctx.onFillPointerMove(event);
      return;
    }
    if (!ctx.isDraggingSelection) return;
    // Safety: if no mouse button is held the drag is over (we may have
    // missed pointerup because the user lifted outside the window).
    if (event.buttons === 0) {
      endDragSelection();
    }
  }

  function onCellClick(rowIndex: number, colIndex: number) {
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column) return;

    ctx.gridRootEl?.focus({ preventScroll: true });

    if (isGroupRow(row)) {
      setActiveCell(rowIndex, colIndex);
      row.toggleExpanded?.();
      return;
    }

    const baseValue = getColumnBaseValue(row, column);
    const cellValue = ctx.getCellDisplayValue(row.id, column.id, baseValue);

    // Emit the public click events for data cells/rows (before any
    // checkbox-toggle / edit-entry side effects below).
    ctx.props.onCellClick?.({
      rowIndex,
      colIndex,
      columnId: column.id,
      value: cellValue,
      row: row.original as TData,
    });
    ctx.props.onRowClick?.({
      rowIndex,
      columnId: column.id,
      row: row.original as TData,
    });

    const isCheckboxColumn =
      column.columnDef.editorType === "checkbox" ||
      typeof cellValue === "boolean";

    if (isCheckboxColumn) {
      ctx.toggleBooleanCell(rowIndex, colIndex);
      setActiveCell(rowIndex, colIndex);
      setSelection(rowIndex, colIndex);
      ctx.editingCell = null;
      return;
    }

    // onCellPointerDown already set active+selection for data cells. Only
    // decide whether to enter edit mode (click on the previously-active cell).
    const wasActive =
      ctx.activeAtPointerDown !== null &&
      ctx.activeAtPointerDown.rowIndex === rowIndex &&
      ctx.activeAtPointerDown.colIndex === colIndex;
    if (wasActive && ctx.editingEnabled) {
      ctx.onCellDoubleClick(rowIndex, colIndex);
      return;
    }
    ctx.editingCell = null;
  }

  /**
   * Real double-click handler wired to the cell `ondblclick`. Emits the
   * public double-click events (independent of editability) and then runs
   * the edit-entry logic. Kept separate from `onCellDoubleClick` so the
   * single-click-to-edit path in `onCellClick` does NOT emit a dblclick.
   */
  function emitCellDoubleClick(rowIndex: number, colIndex: number) {
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (row && column && !isGroupRow(row)) {
      const value = ctx.getCellDisplayValue(
        row.id,
        column.id,
        getColumnBaseValue(row, column),
      );
      ctx.props.onCellDoubleClick?.({
        rowIndex,
        colIndex,
        columnId: column.id,
        value,
        row: row.original as TData,
      });
      ctx.props.onRowDoubleClick?.({
        rowIndex,
        columnId: column.id,
        row: row.original as TData,
      });
    }
    ctx.onCellDoubleClick(rowIndex, colIndex);
  }

  return {
    isRowSelected,
    toggleRowSelectionById,
    toggleSelectAllRows,
    setActiveCell,
    scrollActiveCellIntoView,
    setSelection,
    extendSelection,
    isCellInSelectedRange,
    getCellRangeEdges,
    getSelectionRects,
    isInFillPreview,
    findColumnById,
    onCellPointerDown,
    onCellPointerEnter,
    endDragSelection,
    onWindowPointerMove,
    onCellClick,
    emitCellDoubleClick,
  };
}
