// editing handlers extracted from the controller. Imperative event handlers
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

type HistoryStep = {
  rowId: string;
  columnId: string;
  field: string;
  before: unknown;
  after: unknown;
};

export function createEditing<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  /**
   * Resolve `columnDef.editable` for one row × column pair.
   *
   *   - `undefined` / `true` → editable
   *   - `false` → not editable (column-level lockdown, fastest path)
   *   - function → call it with the cell's context and honour the
   *     boolean it returns (cell-level lockdown - used for things like
   *     "this field is owned by the server, this one isn't, by row")
   *
   * Called from every editing entry point: double-click, type-to-edit,
   * fill-handle drag, Delete-clear, clipboard paste. A central helper
   * keeps the cell-level callback signature consistent and saves a
   * lookup of CellContext at each site.
   */
  function isCellEditable(column: Column<TData>, row?: Row<TData>): boolean {
    const editable = column.columnDef.editable;
    if (editable === false) return false;
    if (typeof editable !== "function") return true;
    if (!row) return true;
    const cellCtx: CellContext<TData> = {
      cell: {
        id: `${row.id}_${column.id}`,
        row,
        column,
        getValue: () => getColumnBaseValue(row, column),
        getContext: () => cellCtx,
      },
      row,
      column,
      table: ctx.grid,
      getValue: () => getColumnBaseValue(row, column),
    };
    try {
      return editable(cellCtx) !== false;
    } catch {
      // A throwing predicate shouldn't crash the grid - log and treat
      // as not-editable so any error biases toward safety.
      return false;
    }
  }

  /** Variant that takes raw row + column indices for the rare callers
   *  (fill-handle, paste, Delete) that already work in index-space. */
  function isCellEditableAt(rowIndex: number, colIndex: number): boolean {
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!column) return false;
    return isCellEditable(column, row);
  }

  function getRowColumnValue(row: Row<TData>, columnId: string) {
    const column = ctx.allColumns.find((entry: any) => entry.id === columnId);
    return column
      ? getColumnBaseValue(row, column)
      : row.getCellValueByColumnId(columnId);
  }

  function getCellDisplayValue(
    rowId: string,
    columnId: string,
    baseValue: unknown,
  ) {
    const key = getCellKey(rowId, columnId);
    return key in ctx.editedCellValues ? ctx.editedCellValues[key] : baseValue;
  }

  /** Start editing seeded with a typed character (Excel-style type-to-edit). */
  function startEditingWithChar(
    rowIndex: number,
    colIndex: number,
    char: string,
  ): boolean {
    if (!ctx.editingEnabled) return false;
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column || isGroupRow(row)) return false;
    if (!isCellEditable(column, row)) return false;
    const editorType = (column.columnDef.editorType ??
      "text") as CellEditorType;
    if (
      editorType === "checkbox" ||
      editorType === "date" ||
      editorType === "datetime" ||
      editorType === "list" ||
      editorType === "chips"
    ) {
      return false;
    }
    if (editorType === "number" && !/[0-9.+\-]/.test(char)) return false;
    ctx.editorSelectAll = false;
    ctx.editingCell = {
      rowId: row.id,
      columnId: column.id,
      editorType,
      value: char,
    };
    ctx.setActiveCell(rowIndex, colIndex);
    ctx.setSelection(rowIndex, colIndex);
    return true;
  }

  function saveEditingCell() {
    if (!ctx.editingCell) return;
    const row = ctx.allRows.find((entry: any) => entry.id === ctx.editingCell?.rowId);
    const column = ctx.allColumns.find(
      (entry: any) => entry.id === ctx.editingCell?.columnId,
    );
    const parsedValue = parseEditorValue(
      ctx.editingCell.editorType,
      ctx.editingCell.value,
      {
        multiple: column?.columnDef.editorMultiple === true,
      },
    );
    let oldValue: unknown = undefined;
    if (row?.original && column?.columnDef.field) {
      oldValue = (row.original as Record<string, unknown>)[
        column.columnDef.field
      ];
      (row.original as Record<string, unknown>)[column.columnDef.field] =
        parsedValue;
    }
    const key = getCellKey(ctx.editingCell.rowId, ctx.editingCell.columnId);
    ctx.editedCellValues = {
      ...ctx.editedCellValues,
      [key]: parsedValue,
    };
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
    // Record into the history at the current pointer. Any forward
    // history (steps the user could have redone) is truncated - this
    // is the standard "edit invalidates redo" rule.
    if (oldValue !== parsedValue && row?.original && column?.columnDef.field) {
      const step: HistoryStep = {
        rowId:    ctx.editingCell.rowId,
        columnId: ctx.editingCell.columnId,
        field:    column.columnDef.field as string,
        before:   oldValue,
        after:    parsedValue,
      }
      const truncated = ctx.history.slice(0, ctx.historyPtr + 1)
      truncated.push(step)
      // Cap the buffer at UNDO_LIMIT; drop the OLDEST entries so the
      // pointer stays valid relative to the newest steps.
      if (truncated.length > ctx.UNDO_LIMIT) {
        const drop = truncated.length - ctx.UNDO_LIMIT
        ctx.history = truncated.slice(drop)
        ctx.historyPtr = ctx.history.length - 1
      } else {
        ctx.history = truncated
        ctx.historyPtr = ctx.history.length - 1
      }
      ctx.historyVersion += 1
    }
    // Notify the consumer AFTER the row has been updated so any callback-
    // driven recompute (cascade totals, server save, undo stack) sees the
    // post-write state. `rowIndex` matches the position in `props.data`.
    if (ctx.props.onCellValueChange && row?.original && column) {
      const rowIndex = ctx.internalData.indexOf(row.original as TData);
      ctx.props.onCellValueChange({
        rowIndex,
        columnId: column.id,
        oldValue,
        newValue: parsedValue,
        row: row.original as TData,
      });
    }
    ctx.editingCell = null;
  }

  /** Apply an undo / redo step directly to the underlying row, bypassing
   *  the editor pipeline so we don't accidentally re-push to the stack. */
  function applyHistoryStep(step: HistoryStep, direction: 'undo' | 'redo') {
    const row = ctx.allRows.find((r: any) => r.id === step.rowId)
    const col = ctx.allColumns.find((c: any) => c.id === step.columnId)
    if (!row?.original || !col) return
    const value = direction === 'undo' ? step.before : step.after
    ;(row.original as Record<string, unknown>)[step.field] = value
    const key = getCellKey(step.rowId, step.columnId)
    ctx.editedCellValues = { ...ctx.editedCellValues, [key]: value }
    ctx.grid.store.setState((prev: any) => ({ ...prev }))
    if (ctx.props.onCellValueChange) {
      const rowIndex = ctx.internalData.indexOf(row.original as TData)
      ctx.props.onCellValueChange({
        rowIndex,
        columnId: step.columnId,
        oldValue: direction === 'undo' ? step.after : step.before,
        newValue: value,
        row: row.original as TData,
      })
    }
  }

  function updateEditingCellValue(value: string) {
    ctx.editingCell = ctx.editingCell ? { ...ctx.editingCell, value } : ctx.editingCell;
  }

  function onEditorKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      saveEditingCell();
      ctx.gridRootEl?.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      ctx.editingCell = null;
      ctx.gridRootEl?.focus({ preventScroll: true });
    }
  }

  function focusOnMount(node: HTMLInputElement | HTMLTextAreaElement) {
    const selectAll = ctx.editorSelectAll;
    requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      try {
        if (selectAll) {
          node.select();
        } else {
          const end = node.value.length;
          node.setSelectionRange(end, end);
        }
      } catch {
        /* date/number inputs may not support text selection */
      }
    });
  }

  function onCellDoubleClick(rowIndex: number, colIndex: number) {
    if (!ctx.editingEnabled) return;
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column) return;
    if (isGroupRow(row)) return;
    if (!isCellEditable(column, row)) return;
    if (ctx.editingCell?.rowId === row.id && ctx.editingCell?.columnId === column.id)
      return;
    const editorType = (column.columnDef.editorType ??
      "text") as CellEditorType;
    ctx.editorSelectAll = true;
    let initialValue = getCellDisplayValue(
      row.id,
      column.id,
      row.getCellValueByColumnId(column.id),
    );
    if (editorType === "list" || editorType === "chips") {
      if (column.columnDef.editorMultiple) {
        // Seed with an array so the editor can mutate slot-by-slot.
        initialValue = toValueArray(initialValue);
      } else if (Array.isArray(initialValue)) {
        initialValue = initialValue[0] ?? "";
      }
    }
    ctx.editingCell = {
      rowId: row.id,
      columnId: column.id,
      editorType,
      value: initialValue,
    };
    ctx.setActiveCell(rowIndex, colIndex);
    ctx.setSelection(rowIndex, colIndex);
  }

  async function pasteFromClipboard() {
    // Preferred path: the async Clipboard API. Requires a secure context
    // (HTTPS or localhost) AND read permission; it also works on Firefox,
    // where the native `paste` event does NOT fire on a non-editable element.
    // On plain HTTP (a XAMPP/Apache LAN host) `navigator.clipboard` is
    // undefined - there the Ctrl+V keydown handler skips preventDefault and
    // lets the browser deliver a native `paste` event to `onGridPaste`.
    if (!navigator.clipboard?.readText) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    applyPastedText(text);
  }

  /**
   * Native `paste` ClipboardEvent fallback (insecure-context path). A real
   * Ctrl/Cmd+V on the focused grid root fires this with `clipboardData`
   * readable even over plain HTTP and with no permission prompt. Wired on the
   * grid root in SvGrid.svelte; the keydown handler lets the gesture through
   * (no preventDefault) whenever the async API is unavailable.
   */
  function onGridPaste(event: ClipboardEvent) {
    // When the async API is available the keydown handler already pasted via
    // pasteFromClipboard(); ignore the (suppressed) native event so we don't
    // paste twice.
    if (typeof navigator.clipboard?.readText === "function") return;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text) return;
    event.preventDefault();
    applyPastedText(text);
  }

  function applyPastedText(text: string) {
    const anchor = ctx.selectionRange.anchor ?? ctx.grid.getState().activeCell;
    if (!anchor) return;
    const focus = ctx.selectionRange.focus ?? anchor;
    const startRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const startCol = Math.min(anchor.colIndex, focus.colIndex);
    const endRow   = Math.max(anchor.rowIndex, focus.rowIndex);
    const endCol   = Math.max(anchor.colIndex, focus.colIndex);
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    // Excel/Sheets behaviour: when the clipboard holds a single cell and
    // the selection is a range, fill the entire range with that value.
    // For larger clipboards (multi-row/col TSV), paste at the top-left
    // corner and let the clipboard determine the span (the original
    // behaviour).
    const clipboardIsSingleCell =
      lines.length === 1 && (lines[0]?.split("\t").length ?? 0) === 1;
    const selectionIsRange = startRow !== endRow || startCol !== endCol;
    const fillRange = clipboardIsSingleCell && selectionIsRange;

    const rowSpan = fillRange ? endRow - startRow + 1 : lines.length;
    const colSpan = fillRange
      ? endCol - startCol + 1
      : Math.max(...lines.map((l) => l.split("\t").length));

    const next = ctx.internalData.slice() as Array<TData>;
    for (let i = 0; i < rowSpan; i += 1) {
      const targetRowIndex = startRow + i;
      const row = ctx.allRows[targetRowIndex];
      if (!row || isGroupRow(row)) continue;
      // Map the visible row back to its index in the data array via row.id (default = String(index)).
      const dataIndex = Number(row.id);
      if (
        !Number.isInteger(dataIndex) ||
        dataIndex < 0 ||
        dataIndex >= next.length
      )
        continue;
      const originalRow = next[dataIndex];
      if (!originalRow) continue;
      const sourceCells = fillRange
        ? null
        : lines[i]?.split("\t") ?? [];
      const updated: Record<string, unknown> = {
        ...(originalRow as Record<string, unknown>),
      };
      for (let j = 0; j < colSpan; j += 1) {
        const column = ctx.allColumns[startCol + j];
        if (!column?.columnDef.field) continue;
        if (!isCellEditableAt(targetRowIndex, startCol + j)) continue;
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        const raw = fillRange ? lines[0]! : sourceCells?.[j] ?? "";
        updated[column.columnDef.field] = parseEditorValue(editorType, raw);
      }
      next[dataIndex] = updated as TData;
    }
    ctx.internalData = next;
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
  }

  return {
    isCellEditable,
    isCellEditableAt,
    getRowColumnValue,
    getCellDisplayValue,
    startEditingWithChar,
    saveEditingCell,
    applyHistoryStep,
    updateEditingCellValue,
    onEditorKeyDown,
    focusOnMount,
    onCellDoubleClick,
    pasteFromClipboard,
    onGridPaste,
  };
}
