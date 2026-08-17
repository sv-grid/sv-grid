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
      rowRef: row.original,
    };
    ctx.setActiveCell(rowIndex, colIndex);
    ctx.setSelection(rowIndex, colIndex);
    return true;
  }

  function saveEditingCell() {
    if (!ctx.editingCell) return;
    const editing = ctx.editingCell;
    // Resolve the row this edit belongs to. `allRows` is only the current page,
    // so fall back to the full filtered model, then to the data object captured
    // when the edit started. Without that last hop an edit is silently dropped
    // when a filter typed mid-edit hides the row from both models (#49).
    const row =
      ctx.allRows.find((entry: any) => entry.id === editing.rowId) ??
      ctx.allRowsBeforePagination.find((entry: any) => entry.id === editing.rowId);
    const rowData = (row?.original ?? editing.rowRef) as
      | Record<string, unknown>
      | undefined;
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
    let finalValue: unknown = parsedValue;
    if (rowData && column?.columnDef.field) {
      oldValue = rowData[column.columnDef.field];
      // Per-column valueParser refines the type-coerced value before storing.
      const parser = (
        column.columnDef as { valueParser?: (p: unknown) => unknown }
      ).valueParser;
      if (parser) {
        finalValue = parser({
          newValue: parsedValue,
          oldValue,
          rawInput: ctx.editingCell.value,
          data: rowData,
          columnId: ctx.editingCell.columnId,
        });
      }
      rowData[column.columnDef.field] = finalValue;
    }
    const key = getCellKey(ctx.editingCell.rowId, ctx.editingCell.columnId);
    ctx.editedCellValues = {
      ...ctx.editedCellValues,
      [key]: finalValue,
    };
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
    // Record into the history at the current pointer. Any forward
    // history (steps the user could have redone) is truncated - this
    // is the standard "edit invalidates redo" rule.
    if (oldValue !== finalValue && rowData && column?.columnDef.field) {
      const step: HistoryStep = {
        rowId:    ctx.editingCell.rowId,
        columnId: ctx.editingCell.columnId,
        field:    column.columnDef.field as string,
        before:   oldValue,
        after:    finalValue,
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
    if (ctx.props.onCellValueChange && rowData && column) {
      const rowIndex = ctx.internalData.indexOf(rowData as TData);
      ctx.props.onCellValueChange({
        rowIndex,
        columnId: column.id,
        oldValue,
        newValue: finalValue,
        row: rowData as TData,
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

  function updateEditingCellValue(value: unknown) {
    ctx.editingCell = ctx.editingCell ? { ...ctx.editingCell, value } : ctx.editingCell;
  }

  /**
   * Commit the open editor and move the active cell one column along, wrapping
   * at row boundaries the way Excel does. Editors `stopPropagation()` every key
   * so the grid's own Tab handler never sees this one - without the explicit
   * move, Tab committed the edit and then let the browser walk focus out of the
   * grid entirely (#48). Shared by every editor type, including the textarea.
   */
  function commitAndMoveByTab(shiftKey: boolean) {
    const active = ctx.activeCell;
    saveEditingCell();
    ctx.gridRootEl?.focus({ preventScroll: true });
    if (!active) return;
    const next = getNextActiveCell(active, shiftKey ? "tabPrev" : "tabNext", {
      maxRow: ctx.allRows.length - 1,
      maxCol: ctx.allColumns.length - 1,
    });
    ctx.setActiveCell(next.rowIndex, next.colIndex);
    ctx.setSelection(next.rowIndex, next.colIndex);
    ctx.scrollActiveCellIntoView(next.rowIndex, next.colIndex);
  }

  function onEditorKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      saveEditingCell();
      ctx.gridRootEl?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      event.preventDefault();
      commitAndMoveByTab(event.shiftKey);
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
    // Full-row editing: put the whole row into edit instead of one cell.
    if (ctx.props.fullRowEditing) {
      if (ctx.fullRowEdit?.rowId === row.id) return;
      startFullRowEdit(rowIndex);
      return;
    }
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
      rowRef: row.original,
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
    // A cell is being edited: the focused editor input handles its own paste
    // natively. Never hijack it for a range paste - doing so (on Firefox /
    // insecure contexts, where the async Clipboard API is unavailable) would
    // preventDefault the editor's paste and write to the data cell instead,
    // so the edit "wouldn't update".
    if (ctx.editingCell) return;
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

  /** Programmatically begin editing a cell (mirrors a double-click). */
  function startEditing(rowIndex: number, columnId: string): boolean {
    if (!ctx.editingEnabled) return false;
    const row = ctx.allRows[rowIndex];
    if (!row || isGroupRow(row)) return false;
    const colIndex = ctx.allColumns.findIndex((c: any) => c.id === columnId);
    if (colIndex < 0) return false;
    const column = ctx.allColumns[colIndex];
    if (!isCellEditable(column, row)) return false;
    if (
      ctx.editingCell?.rowId === row.id &&
      ctx.editingCell?.columnId === columnId
    )
      return true;
    onCellDoubleClick(rowIndex, colIndex);
    return (
      ctx.editingCell?.rowId === row.id &&
      ctx.editingCell?.columnId === columnId
    );
  }

  /** Commit (default) or cancel the active edit, if any. */
  function stopEditing(cancel = false): boolean {
    if (!ctx.editingCell) return false;
    if (cancel) {
      ctx.editingCell = null;
    } else {
      saveEditingCell();
    }
    return true;
  }

  // ---- Full-row editing -------------------------------------------------
  /** Put the whole row into edit mode, seeding a draft per editable column. */
  function startFullRowEdit(rowIndex: number): boolean {
    if (!ctx.editingEnabled || !ctx.props.fullRowEditing) return false;
    const row = ctx.allRows[rowIndex];
    if (!row || isGroupRow(row)) return false;
    if (ctx.fullRowEdit && ctx.fullRowEdit.rowId !== row.id) commitFullRowEdit();
    ctx.editingCell = null; // never both at once
    const draft: Record<string, unknown> = {};
    for (const column of ctx.allColumns) {
      if (!column.columnDef.field) continue;
      if (!isCellEditable(column, row)) continue;
      draft[column.id] = getCellDisplayValue(
        row.id,
        column.id,
        row.getCellValueByColumnId(column.id),
      );
    }
    ctx.fullRowEdit = { rowId: row.id, draft };
    ctx.setActiveCell(rowIndex, Math.max(0, ctx.allColumns.findIndex((c: any) => c.id in draft)));
    return true;
  }

  /** Stage one column's draft value during full-row editing. */
  function setFullRowDraft(columnId: string, value: unknown): void {
    const fr = ctx.fullRowEdit;
    if (!fr) return;
    ctx.fullRowEdit = { rowId: fr.rowId, draft: { ...fr.draft, [columnId]: value } };
  }

  /** Commit every drafted column of the full-row edit in one data update. */
  function commitFullRowEdit(): void {
    const fr = ctx.fullRowEdit;
    if (!fr) return;
    const row = ctx.allRows.find((r: any) => r.id === fr.rowId);
    if (!row?.original) {
      ctx.fullRowEdit = null;
      return;
    }
    const changed: Array<{ columnId: string; field: string; before: unknown; after: unknown }> = [];
    for (const column of ctx.allColumns) {
      if (!(column.id in fr.draft)) continue;
      const field = column.columnDef.field as string | undefined;
      if (!field) continue;
      const editorType = (column.columnDef.editorType ?? "text") as CellEditorType;
      const parsed = parseEditorValue(editorType, fr.draft[column.id], {
        multiple: column.columnDef.editorMultiple === true,
      });
      const oldValue = (row.original as Record<string, unknown>)[field];
      const parser = (column.columnDef as { valueParser?: (p: unknown) => unknown }).valueParser;
      const finalValue = parser
        ? parser({
            newValue: parsed,
            oldValue,
            rawInput: String(fr.draft[column.id] ?? ""),
            data: row.original,
            columnId: column.id,
          })
        : parsed;
      if (oldValue !== finalValue) {
        (row.original as Record<string, unknown>)[field] = finalValue;
        const key = getCellKey(fr.rowId, column.id);
        ctx.editedCellValues = { ...ctx.editedCellValues, [key]: finalValue };
        changed.push({ columnId: column.id, field, before: oldValue, after: finalValue });
      }
    }
    // Record the whole-row change as consecutive history steps.
    if (changed.length) {
      let hist = ctx.history.slice(0, ctx.historyPtr + 1);
      for (const c of changed) {
        hist.push({ rowId: fr.rowId, columnId: c.columnId, field: c.field, before: c.before, after: c.after });
      }
      if (hist.length > ctx.UNDO_LIMIT) hist = hist.slice(hist.length - ctx.UNDO_LIMIT);
      ctx.history = hist;
      ctx.historyPtr = ctx.history.length - 1;
      ctx.historyVersion += 1;
    }
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
    if (ctx.props.onCellValueChange && changed.length) {
      const rowIndex = ctx.internalData.indexOf(row.original as TData);
      for (const c of changed) {
        ctx.props.onCellValueChange({
          rowIndex,
          columnId: c.columnId,
          oldValue: c.before,
          newValue: c.after,
          row: row.original as TData,
        });
      }
    }
    ctx.fullRowEdit = null;
  }

  /** Discard the full-row edit. */
  function cancelFullRowEdit(): void {
    ctx.fullRowEdit = null;
  }

  return {
    isCellEditable,
    isCellEditableAt,
    getRowColumnValue,
    getCellDisplayValue,
    startEditingWithChar,
    startEditing,
    stopEditing,
    startFullRowEdit,
    setFullRowDraft,
    commitFullRowEdit,
    cancelFullRowEdit,
    saveEditingCell,
    applyHistoryStep,
    updateEditingCellValue,
    onEditorKeyDown,
    commitAndMoveByTab,
    focusOnMount,
    onCellDoubleClick,
    pasteFromClipboard,
    onGridPaste,
  };
}
