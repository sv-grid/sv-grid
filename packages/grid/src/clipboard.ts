// clipboard handlers extracted from the controller. Imperative event handlers
// that read/write controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  parseEditorValue,
  type CellEditorType,
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import { buildFillPattern } from "./fill-patterns";
import {
  getCellKey,
} from "./SvGrid.helpers";
import {
  getColumnBaseValue,
  isGroupRow,
  toolPanelHeaderLabel,
} from "./cell-values";

export function createClipboard<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  /** Read the raw underlying value for the cell at (rowIndex, columnId)
   *  for pattern extraction. */
  function readCellRaw(rowIndex: number, columnId: string): unknown {
    const row = ctx.internalData[rowIndex];
    const column = ctx.findColumnById(columnId);
    if (!row || !column?.columnDef.field) return undefined;
    return (row as Record<string, unknown>)[column.columnDef.field];
  }

  /** Write a value into (rowIndex, columnId) without going through the
   *  edit lifecycle. Fires `onCellValueChange` per write so consumers
   *  can react (formula recompute, autosave, etc.). */
  function writeCellRaw(rowIndex: number, columnId: string, value: unknown) {
    const row = ctx.internalData[rowIndex];
    const column = ctx.findColumnById(columnId);
    if (!row || !column?.columnDef.field) return;
    const field = column.columnDef.field;
    const oldValue = (row as Record<string, unknown>)[field];
    if (oldValue === value) return;
    // Resolve the row's id BEFORE swapping internalData - otherwise the
    // recomputed `allRows` references the new row object and the
    // `r.original === row` lookup fails, dropping our edit out of the
    // `editedCellValues` map (which getCellDisplayValue consults first).
    const rowId = ctx.allRows.find((r: any) => r.original === row)?.id;
    const next = ctx.internalData.slice() as Array<TData>;
    next[rowIndex] = { ...row, [field]: value } as TData;
    ctx.internalData = next;
    if (rowId) {
      const key = getCellKey(rowId, columnId);
      ctx.editedCellValues = { ...ctx.editedCellValues, [key]: value };
    }
    ctx.props.onCellValueChange?.({
      rowIndex,
      columnId,
      oldValue,
      newValue: value,
      row: next[rowIndex] as TData,
    });
  }

  /** Apply the pattern fill on pointerup. Each NEW row (or column) is
   *  filled from a pattern derived from the matching column (or row) of
   *  the source. Handles all four drag directions. */
  function applyFillPattern() {
    const d = ctx.fillDrag;
    if (!d) return;
    // Clear fillDrag FIRST so a thrown error doesn't leave the grid
    // stuck tracking the pointer.
    ctx.fillDrag = null;
    const newMinRow = Math.min(d.sourceMinRow, d.targetRow);
    const newMaxRow = Math.max(d.sourceMaxRow, d.targetRow);
    const newMinCol = Math.min(d.sourceMinCol, d.targetCol);
    const newMaxCol = Math.max(d.sourceMaxCol, d.targetCol);

    const verticalExtension =
      newMaxRow > d.sourceMaxRow || newMinRow < d.sourceMinRow;
    const horizontalExtension =
      newMaxCol > d.sourceMaxCol || newMinCol < d.sourceMinCol;

    if (verticalExtension) {
      // For each column in the source range, build a pattern from the
      // column's source values and apply to the new rows (above or below).
      for (let c = d.sourceMinCol; c <= d.sourceMaxCol; c += 1) {
        const column = ctx.allColumns[c];
        if (!column?.columnDef.field) continue;
        if (column.columnDef.editable === false) continue;
        const sourceColValues: unknown[] = [];
        for (let r = d.sourceMinRow; r <= d.sourceMaxRow; r += 1) {
          sourceColValues.push(readCellRaw(r, column.id));
        }
        if (newMaxRow > d.sourceMaxRow) {
          const targetRows = newMaxRow - d.sourceMaxRow;
          const fills = buildFillPattern(sourceColValues, targetRows);
          for (let i = 0; i < targetRows; i += 1) {
            const targetRow = d.sourceMaxRow + 1 + i;
            if (ctx.isCellEditableAt(targetRow, c))
              writeCellRaw(targetRow, column.id, fills[i]);
          }
        }
        if (newMinRow < d.sourceMinRow) {
          // Filling upward - reverse-extrapolate.
          const reversed = sourceColValues.slice().reverse();
          const targetRows = d.sourceMinRow - newMinRow;
          const fills = buildFillPattern(reversed, targetRows);
          for (let i = 0; i < targetRows; i += 1) {
            const targetRow = d.sourceMinRow - 1 - i;
            if (ctx.isCellEditableAt(targetRow, c))
              writeCellRaw(targetRow, column.id, fills[i]);
          }
        }
      }
    } else if (horizontalExtension) {
      // For each row in source range, build pattern from the row's source
      // values across columns and apply to new columns.
      for (let r = d.sourceMinRow; r <= d.sourceMaxRow; r += 1) {
        const sourceRowValues: unknown[] = [];
        for (let c = d.sourceMinCol; c <= d.sourceMaxCol; c += 1) {
          const col = ctx.allColumns[c];
          if (!col) continue;
          sourceRowValues.push(readCellRaw(r, col.id));
        }
        if (newMaxCol > d.sourceMaxCol) {
          const targetCols = newMaxCol - d.sourceMaxCol;
          const fills = buildFillPattern(sourceRowValues, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMaxCol + 1 + i;
            const col = ctx.allColumns[targetCol];
            if (col && ctx.isCellEditableAt(r, targetCol))
              writeCellRaw(r, col.id, fills[i]);
          }
        }
        if (newMinCol < d.sourceMinCol) {
          const reversed = sourceRowValues.slice().reverse();
          const targetCols = d.sourceMinCol - newMinCol;
          const fills = buildFillPattern(reversed, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMinCol - 1 - i;
            const col = ctx.allColumns[targetCol];
            if (col && ctx.isCellEditableAt(r, targetCol))
              writeCellRaw(r, col.id, fills[i]);
          }
        }
      }
    }

    // Extend the selection to the new range so the user can immediately
    // see what got filled.
    ctx.selectionRange = {
      anchor: { rowIndex: newMinRow, colIndex: newMinCol },
      focus: { rowIndex: newMaxRow, colIndex: newMaxCol },
    };
  }

  /** Clear the underlying value of every cell in the current selection
   *  range (or just the active cell when nothing is range-selected).
   *  Mirrors Excel's `Delete` key - values go to `null`, formatting and
   *  the row identity stay intact. */
  function clearSelectedCellValues() {
    const anchor = ctx.selectionRange.anchor;
    const focus = ctx.selectionRange.focus;
    if (anchor && focus) {
      const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
      const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
      const minCol = Math.min(anchor.colIndex, focus.colIndex);
      const maxCol = Math.max(anchor.colIndex, focus.colIndex);
      for (let r = minRow; r <= maxRow; r += 1) {
        for (let c = minCol; c <= maxCol; c += 1) {
          const col = ctx.allColumns[c];
          if (col?.columnDef.field && ctx.isCellEditableAt(r, c)) {
            writeCellRaw(r, col.id, null);
          }
        }
      }
      return;
    }
    const a = ctx.grid.getState().activeCell;
    if (a && ctx.userHasActivatedCell) {
      const col = ctx.allColumns[a.colIndex];
      if (col?.columnDef.field && ctx.isCellEditableAt(a.rowIndex, a.colIndex)) {
        writeCellRaw(a.rowIndex, col.id, null);
      }
    }
  }

  /** Fill-handle pointerdown - seed the drag with the current selection
   *  range (or active cell as a 1x1) and start tracking the pointer. */
  function startFillDrag(
    event: PointerEvent,
    rowIndex: number,
    colIndex: number,
  ) {
    event.stopPropagation();
    event.preventDefault();
    const anchor = ctx.selectionRange.anchor;
    const focus = ctx.selectionRange.focus;
    if (anchor && focus) {
      ctx.fillDrag = {
        sourceMinRow: Math.min(anchor.rowIndex, focus.rowIndex),
        sourceMaxRow: Math.max(anchor.rowIndex, focus.rowIndex),
        sourceMinCol: Math.min(anchor.colIndex, focus.colIndex),
        sourceMaxCol: Math.max(anchor.colIndex, focus.colIndex),
        targetRow: rowIndex,
        targetCol: colIndex,
      };
    } else {
      ctx.fillDrag = {
        sourceMinRow: rowIndex,
        sourceMaxRow: rowIndex,
        sourceMinCol: colIndex,
        sourceMaxCol: colIndex,
        targetRow: rowIndex,
        targetCol: colIndex,
      };
    }
    // Don't `setPointerCapture` - we use `elementFromPoint` during the
    // drag to find the hovered cell, and capture would route the events
    // back to the handle, breaking the lookup. Window-level handlers
    // (`onWindowPointerMove` / `endDragSelection`) keep tracking.
  }

  /** Pointermove during fill-drag. We don't get cell coords from the
   *  event directly - find the td under the pointer via elementFromPoint
   *  and read its data-svgrid-row / data-svgrid-col attributes. */
  function onFillPointerMove(event: PointerEvent) {
    if (!ctx.fillDrag) return;
    const el = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;
    const cell = el?.closest(
      "td[data-svgrid-row][data-svgrid-col]",
    ) as HTMLElement | null;
    if (!cell) return;
    const r = Number(cell.dataset.svgridRow);
    const c = Number(cell.dataset.svgridCol);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;
    if (r === ctx.fillDrag.targetRow && c === ctx.fillDrag.targetCol) return;
    ctx.fillDrag = { ...ctx.fillDrag, targetRow: r, targetCol: c };
  }

  function onFillPointerUp() {
    if (!ctx.fillDrag) return;
    applyFillPattern();
  }

  function toggleBooleanCell(rowIndex: number, colIndex: number) {
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column) return;
    if (!column.columnDef.field) return;

    const baseValue = getColumnBaseValue(row, column);
    const currentValue = Boolean(
      ctx.getCellDisplayValue(row.id, column.id, baseValue),
    );
    const nextValue = !currentValue;
    (row.original as Record<string, unknown>)[column.columnDef.field] =
      nextValue;

    const key = getCellKey(row.id, column.id);
    ctx.editedCellValues = {
      ...ctx.editedCellValues,
      [key]: nextValue,
    };
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
  }

  /**
   * Write text to the OS clipboard, with a legacy fallback for insecure
   * contexts. The async Clipboard API requires a secure context (HTTPS or
   * localhost); on plain HTTP - e.g. a grid served by XAMPP/Apache over a LAN
   * host - `navigator.clipboard` is undefined and copy/cut would silently do
   * nothing. There we fall back to a temporary <textarea> + execCommand('copy'),
   * which still works in an insecure context. This MUST be called synchronously
   * from the user gesture (the keydown handler) so execCommand is allowed.
   */
  function writeClipboardText(text: string) {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => legacyCopyText(text));
      return;
    }
    legacyCopyText(text);
  }

  function legacyCopyText(text: string): boolean {
    if (typeof document === "undefined") return false;
    const active = document.activeElement as HTMLElement | null;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Offscreen but still selectable; opacity/0-size can suppress selection.
    ta.style.cssText =
      "position:fixed;top:0;left:-9999px;width:1px;height:1px;padding:0;border:0;";
    document.body.appendChild(ta);
    let ok = false;
    try {
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    // Restore focus to the grid root so keyboard nav keeps working afterward.
    (active ?? (ctx.gridRootEl as HTMLElement | null))?.focus?.({
      preventScroll: true,
    });
    return ok;
  }

  function copySelectionToClipboard() {
    // Copy every selected rectangle. Each range becomes a TSV block; multiple
    // ranges are stacked and separated by a blank line (Sheets-style).
    const rects = ctx.getSelectionRects() as Array<{
      minRow: number;
      maxRow: number;
      minCol: number;
      maxCol: number;
    }>;
    if (!rects.length) return;
    // Optional: prepend a header row (Excel "copy with headers") and/or run
    // each value through a consumer hook before it hits the clipboard.
    const withHeaders = ctx.props.copyHeadersToClipboard === true;
    const processCell = ctx.props.processCellForClipboard as
      | ((params: { value: unknown; column: unknown; row: unknown; rowIndex: number; columnId: string }) => unknown)
      | undefined;
    const blocks: Array<string> = [];
    for (const rect of rects) {
      const lines: Array<string> = [];
      if (withHeaders) {
        const header: Array<string> = [];
        for (let c = rect.minCol; c <= rect.maxCol; c += 1) {
          const column = ctx.allColumns[c];
          header.push(column ? toolPanelHeaderLabel(column) : "");
        }
        lines.push(header.join("\t"));
      }
      for (let r = rect.minRow; r <= rect.maxRow; r += 1) {
        const row = ctx.allRows[r];
        if (!row || isGroupRow(row)) continue;
        const cells: Array<string> = [];
        for (let c = rect.minCol; c <= rect.maxCol; c += 1) {
          const column = ctx.allColumns[c];
          if (!column) {
            cells.push("");
            continue;
          }
          const base = getColumnBaseValue(row, column);
          let value: unknown = ctx.getCellDisplayValue(row.id, column.id, base);
          if (processCell) {
            value = processCell({
              value,
              column,
              row: row.original,
              rowIndex: r,
              columnId: column.id,
            });
          }
          cells.push(String(value ?? ""));
        }
        lines.push(cells.join("\t"));
      }
      blocks.push(lines.join("\n"));
    }
    writeClipboardText(blocks.join("\n\n"));
  }

  /**
   * Clear every editable cell in the current selection range. Used by
   * Ctrl/Cmd+X (after a copy) and by the Delete / Backspace keys.
   * Returns true if anything was changed - the caller uses that to
   * decide whether to call `preventDefault()` and refresh the store.
   */
  function clearSelectedCells(): boolean {
    const anchor = ctx.selectionRange.anchor ?? ctx.grid.getState().activeCell;
    if (!anchor) return false;
    const focus = ctx.selectionRange.focus ?? anchor;
    const startRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const startCol = Math.min(anchor.colIndex, focus.colIndex);
    const endRow   = Math.max(anchor.rowIndex, focus.rowIndex);
    const endCol   = Math.max(anchor.colIndex, focus.colIndex);

    const next = ctx.internalData.slice() as Array<TData>;
    let mutated = false;
    const changes: Array<{
      rowIndex: number
      columnId: string
      oldValue: unknown
      newValue: unknown
      row: TData
    }> = [];
    for (let r = startRow; r <= endRow; r += 1) {
      const row = ctx.allRows[r];
      if (!row || isGroupRow(row)) continue;
      const dataIndex = Number(row.id);
      if (
        !Number.isInteger(dataIndex) ||
        dataIndex < 0 ||
        dataIndex >= next.length
      ) continue;
      const originalRow = next[dataIndex];
      if (!originalRow) continue;
      const updated: Record<string, unknown> = {
        ...(originalRow as Record<string, unknown>),
      };
      let rowChanged = false;
      for (let c = startCol; c <= endCol; c += 1) {
        const column = ctx.allColumns[c];
        if (!column?.columnDef.field) continue;
        if (!ctx.isCellEditableAt(r, c)) continue;
        // Clear means: empty string for text, undefined for everything
        // else. parseEditorValue handles the per-type coercion.
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        const field = column.columnDef.field;
        const oldValue = updated[field];
        const cleared = parseEditorValue(editorType, "");
        updated[field] = cleared;
        rowChanged = true;
        changes.push({
          rowIndex: dataIndex,
          columnId: column.id,
          oldValue,
          newValue: cleared,
          row: updated as TData,
        });
      }
      if (rowChanged) {
        next[dataIndex] = updated as TData;
        mutated = true;
      }
    }
    if (mutated) {
      ctx.internalData = next;
      ctx.grid.store.setState((prev: any) => ({ ...prev }));
      // Fire onCellValueChange per cleared cell - same as paste's writeCellRaw -
      // so consumers (formula engines, autosave) recompute. Clear IS a value
      // change; without this, a HyperFormula-backed grid wouldn't re-evaluate.
      if (ctx.props.onCellValueChange) {
        for (const ch of changes) ctx.props.onCellValueChange(ch);
      }
    }
    return mutated;
  }

  async function cutSelectionToClipboard(): Promise<void> {
    // Cut = copy + clear. Wait for the copy to land on the clipboard so
    // a slow writeText can't race the clear and leave the user with no
    // way to undo via paste.
    copySelectionToClipboard();
    // Best-effort flush; clipboard.writeText is fire-and-forget but we
    // already kicked it off above. The clear is synchronous.
    clearSelectedCells();
  }

  return {
    readCellRaw,
    writeCellRaw,
    applyFillPattern,
    clearSelectedCellValues,
    startFillDrag,
    onFillPointerMove,
    onFillPointerUp,
    toggleBooleanCell,
    copySelectionToClipboard,
    clearSelectedCells,
    cutSelectionToClipboard,
  };
}
