// editing handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  parseEditorValue,
  type CellContext,
  type CellEditorType,
  type Column,
  type Row,
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";
import { getEntryStep } from "./keyboard";
import {
  getCellKey,
  toValueArray,
} from "./SvGrid.helpers";
import {
  createDataIndexLookup,
  getColumnBaseValue,
  isGroupRow,
} from "./cell-values";
import { pushHistory, nextGroupId, runHistoryGroup, type HistoryStep } from "./history";
import { hasGridShortcuts, runGridShortcuts } from "./shortcut-registry";
import { buildCommandContext } from "./command-context";


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
    if (row) {
      // A server-side group row is a key with aggregates under the leaf
      // columns, and a placeholder row has no data yet: neither takes an
      // edit, whatever the column says.
      const serverGroup = ctx.props.serverGroup;
      if (serverGroup && row.original !== undefined && serverGroup.isGroup(row.original)) return false;
      if (ctx.placeholderStateOf?.(row)) return false;
    }
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
    if (editorType === "number" && !/[0-9.+-]/.test(char)) return false;
    ctx.editorSelectAll = false;
    ctx.editingCell = {
      rowId: row.id,
      columnId: column.id,
      editorType,
      value: char,
      rowRef: row.original,
    };
    ctx.setActiveCell(rowIndex, colIndex);
    selectForEdit(rowIndex, colIndex);
    return true;
  }

  /**
   * The selection an edit starts with. A cell already inside the selection
   * leaves it standing: typing into the active cell of a selected block
   * used to collapse the block to that one cell, so Enter could never walk
   * on inside it. A cell outside the selection becomes the selection.
   */
  function selectForEdit(rowIndex: number, colIndex: number) {
    if (ctx.isCellInSelectedRange(rowIndex, colIndex)) return;
    ctx.setSelection(rowIndex, colIndex);
  }

  function saveEditingCell() {
    // One group: a consumer's onCellValueChange may record a step of its own
    // (a spreadsheet gives "12%" a percent format as it lands), and that
    // belongs to the same Ctrl+Z as the value.
    runHistoryGroup(ctx, () => commitEditingCell());
  }

  function commitEditingCell() {
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
        // A dateString column holds 'YYYY-MM-DD', not a timestamp.
        dateOnly: column?.columnDef.cellDataType === "dateString",
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
      pushHistory(ctx, [step])
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
    if (step.custom) {
      if (direction === 'undo') step.custom.undo()
      else step.custom.redo()
      return
    }
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
  /**
   * Commit the edit and step the cursor the way data entry expects: Tab a
   * column to the right (wrapping at the row's end), Enter a row down, Shift
   * reversing either. Enter used to commit and stay, so a column of numbers
   * took a click or an arrow between every value; Excel and every other
   * sheet move down, and the accessibility page has always said this grid
   * does too. At the last row or column the cursor stays put.
   */
  function commitAndMove(intent: "tabNext" | "tabPrev" | "moveDown" | "moveUp") {
    const active = ctx.activeCell;
    saveEditingCell();
    ctx.gridRootEl?.focus({ preventScroll: true });
    if (!active) return;
    // The same stepping as Enter and Tab on the grid root: a Tab run's Enter
    // goes back to the run's first column, and a selected block keeps the
    // cursor inside it.
    const step = getEntryStep(active, intent, {
      maxRow: ctx.allRows.length - 1,
      maxCol: ctx.allColumns.length - 1,
      tabOrigin: ctx.tabRunOrigin,
      range: ctx.activeRangeRect(),
      collapsed: {
        isRowCollapsed: (i: number) => ctx.isRowCollapsed(i) as boolean,
        isColumnCollapsed: (i: number) => !!ctx.collapsedColumns[ctx.allColumns[i]?.id],
      },
    });
    const next = step.cell;
    ctx.setActiveCell(next.rowIndex, next.colIndex);
    ctx.tabRunOrigin = step.tabOrigin;
    if (!step.withinRange) ctx.setSelection(next.rowIndex, next.colIndex);
    ctx.scrollActiveCellIntoView(next.rowIndex, next.colIndex);
  }

  function commitAndMoveByTab(shiftKey: boolean) {
    commitAndMove(shiftKey ? "tabPrev" : "tabNext");
  }

  /**
   * Ctrl+Enter: the entry goes into every cell of the selected block and the
   * cursor stays where it is, as in Excel, where it is how a block is filled
   * with one value in one go. Each cell takes the same raw entry through the
   * ordinary commit, so its column's parser, the history and
   * `onCellValueChange` all see it, and the whole block is one undo. A cell
   * that cannot be edited is left alone. With nothing but the active cell
   * selected it is a commit that does not move.
   */
  function commitToSelection() {
    const editing = ctx.editingCell;
    if (!editing) return;
    const raw = editing.value;
    const active = ctx.activeCell;
    const range = ctx.activeRangeRect();
    runHistoryGroup(ctx, () => {
      commitEditingCell();
      if (!active || !range) return;
      for (let r = range.minRow; r <= range.maxRow; r += 1) {
        for (let c = range.minCol; c <= range.maxCol; c += 1) {
          if (r === active.rowIndex && c === active.colIndex) continue;
          const row = ctx.allRows[r];
          const column = ctx.allColumns[c];
          if (!row || !column || isGroupRow(row) || !isCellEditable(column, row)) continue;
          ctx.editingCell = {
            rowId: row.id,
            columnId: column.id,
            editorType: (column.columnDef.editorType ?? "text") as CellEditorType,
            value: raw,
            rowRef: row.original,
          };
          commitEditingCell();
        }
      }
    });
    ctx.gridRootEl?.focus({ preventScroll: true });
  }

  function onEditorKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    // Registered commands get the key first here too, with `editing: true`, so
    // a handler can claim a combination that only means something mid-edit
    // (Alt+Enter for a newline, F4 to cycle a reference between relative and
    // absolute) before the editor's own Enter / Tab / Escape handling runs.
    if (hasGridShortcuts() && runGridShortcuts(event, buildCommandContext(ctx, true))) {
      return;
    }
    if (event.key === "Enter" && event.altKey) {
      // A line break, in an editor that can hold one (`editorMultiline`).
      // In a single-line editor Alt+Enter is just Enter.
      const el = event.currentTarget;
      if (el instanceof HTMLTextAreaElement) {
        event.preventDefault();
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        el.value = el.value.slice(0, start) + "\n" + el.value.slice(end);
        el.selectionStart = el.selectionEnd = start + 1;
        updateEditingCellValue(el.value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commitToSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitAndMove(event.shiftKey ? "moveUp" : "moveDown");
    } else if (event.key === "Tab") {
      event.preventDefault();
      commitAndMoveByTab(event.shiftKey);
    } else if (event.key === "Escape") {
      event.preventDefault();
      ctx.editingCell = null;
      ctx.gridRootEl?.focus({ preventScroll: true });
    }
  }

  /**
   * Focus the editor synchronously, as soon as the action runs.
   *
   * This used to be deferred by a `requestAnimationFrame`, which left a window
   * where the cell already carried `sv-grid-cell-editing` but nothing inside it
   * held focus. `onGridKeyDown` returns early while `editingCell` is set, so a
   * keystroke landing in that window reached neither the grid nor the editor
   * and was simply dropped: double-click, type immediately, lose the first
   * characters. The action only runs once the node is in the document, so there
   * is nothing to wait a frame for.
   */
  function focusOnMount(node: HTMLInputElement | HTMLTextAreaElement) {
    const selectAll = ctx.editorSelectAll;
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
    selectForEdit(rowIndex, colIndex);
  }

  async function pasteFromClipboard() {
    // Preferred path: the async Clipboard API. Requires a secure context
    // (HTTPS or localhost) AND read permission; it also works on Firefox,
    // where the native `paste` event does NOT fire on a non-editable element.
    // On plain HTTP (a XAMPP/Apache LAN host) `navigator.clipboard` is
    // undefined - there the Ctrl+V keydown handler skips preventDefault and
    // lets the browser deliver a native `paste` event to `onGridPaste`.
    if (ctx.props.onPasteClipboard && navigator.clipboard?.read) {
      // Both types, for a handler that reads the HTML.
      try {
        const items = await navigator.clipboard.read();
        let text = "";
        let html: string | null = null;
        for (const item of items) {
          if (item.types.includes("text/html")) html = await (await item.getType("text/html")).text();
          if (item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text();
        }
        if (text || html) applyPastedPayload({ text, html, source: "async" });
      } catch {
        // No permission or nothing readable: the text-only read below may still work.
        if (!navigator.clipboard.readText) return;
        try {
          applyPastedPayload({ text: await navigator.clipboard.readText(), html: null, source: "async" });
        } catch {
          return;
        }
      }
      return;
    }
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
   * With `onPasteClipboard` set, Ctrl+V leaves the key to the browser so the
   * `paste` event arrives with the HTML. A browser that does not deliver
   * that event to the grid root (Firefox, a non-editable element) would
   * paste nothing, so the async read is armed to run shortly after unless
   * the event lands first and disarms it.
   */
  let pasteFallback: ReturnType<typeof setTimeout> | null = null;
  function armPasteFallback() {
    if (pasteFallback) clearTimeout(pasteFallback);
    pasteFallback = setTimeout(() => {
      pasteFallback = null;
      void pasteFromClipboard();
    }, 80);
  }
  function disarmPasteFallback() {
    if (pasteFallback) clearTimeout(pasteFallback);
    pasteFallback = null;
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
    if (ctx.props.onPasteClipboard) {
      // The event is the preferred path for a handler: it carries the HTML
      // as the source wrote it, needs no permission, and works over HTTP.
      disarmPasteFallback();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const html = event.clipboardData?.getData("text/html") || null;
      if (!text && !html) return;
      event.preventDefault();
      applyPastedPayload({ text, html, source: "event" });
      return;
    }
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
    // One history group for the whole paste, so whatever a consumer's
    // processCellFromClipboard records alongside the values (a format, via
    // recordUndo) comes back with them on a single Ctrl+Z.
    runHistoryGroup(ctx, () => applyPastedCells(text));
  }

  /** A paste with both types: the handler first, the plain text otherwise. */
  function applyPastedPayload(payload: { text: string; html: string | null; source: "event" | "async" }) {
    runHistoryGroup(ctx, () => {
      const handled = ctx.props.onPasteClipboard?.(payload);
      if (handled === true) return;
      if (payload.text) applyPastedCells(payload.text);
    });
  }

  function applyPastedCells(text: string) {
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
    const dataIndexOf = createDataIndexLookup(next);
    // Every cell the paste changes: one grouped history entry for the lot,
    // so Ctrl+Z takes the whole paste back, and one onCellValueChange each,
    // so a consumer keeping its own model behind the grid (a formula engine)
    // learns the values. The loop used to swap the rows in and stop, which
    // left the undo stack blind to a paste and the consumer never told.
    const changed: Array<{
      row: TData; rowId: string; rowIndex: number; columnId: string; field: string;
      before: unknown; after: unknown;
    }> = [];
    for (let i = 0; i < rowSpan; i += 1) {
      const targetRowIndex = startRow + i;
      const row = ctx.allRows[targetRowIndex];
      if (!row || isGroupRow(row)) continue;
      // Map the visible row back to its slot in the data array by identity -
      // `row.id` is only the index under the default getRowId.
      const dataIndex = dataIndexOf(row);
      if (dataIndex < 0) continue;
      const originalRow = next[dataIndex];
      if (!originalRow) continue;
      const sourceCells = fillRange
        ? null
        : lines[i]?.split("\t") ?? [];
      const updated: Record<string, unknown> = {
        ...(originalRow as Record<string, unknown>),
      };
      const rowChanges: typeof changed = [];
      const record = (column: { id: string; columnDef: { field?: string } }, before: unknown, after: unknown) => {
        if (before === after) return;
        rowChanges.push({
          row: updated as TData, rowId: row.id, rowIndex: dataIndex, columnId: column.id,
          field: column.columnDef.field as string, before, after,
        });
      };
      for (let j = 0; j < colSpan; j += 1) {
        const column = ctx.allColumns[startCol + j];
        if (!column?.columnDef.field) continue;
        if (!isCellEditableAt(targetRowIndex, startCol + j)) continue;
        const before = updated[column.columnDef.field];
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        const raw = fillRange ? lines[0]! : sourceCells?.[j] ?? "";
        const parsedValue = parseEditorValue(editorType, raw, {
          dateOnly: column.columnDef.cellDataType === "dateString",
        });
        // The inbound half of the clipboard pair. A consumer (or a feature
        // pack doing paste-special) gets the raw text AND what the grid would
        // have written, and can return either. `undefined` leaves the cell
        // alone, which is how "paste values only" skips a formula column.
        const hook = ctx.props.processCellFromClipboard;
        if (hook) {
          const decided = hook({
            text: raw,
            parsedValue,
            row: originalRow as TData,
            rowIndex: targetRowIndex,
            columnId: column.id as string,
          });
          if (decided === undefined) continue;
          updated[column.columnDef.field] = decided;
          record(column, before, decided);
          continue;
        }
        updated[column.columnDef.field] = parsedValue;
        record(column, before, parsedValue);
      }
      if (!rowChanges.length) continue;
      next[dataIndex] = updated as TData;
      changed.push(...rowChanges);
    }
    if (!changed.length) return;
    ctx.internalData = next;
    ctx.grid.store.setState((prev: any) => ({ ...prev }));
    pushHistory(
      ctx,
      changed.map((c) => ({
        rowId: c.rowId, columnId: c.columnId, field: c.field, before: c.before, after: c.after,
      })),
      nextGroupId(),
    );
    if (ctx.props.onCellValueChange) {
      for (const c of changed) {
        ctx.props.onCellValueChange({
          rowIndex: c.rowIndex, columnId: c.columnId, oldValue: c.before, newValue: c.after, row: c.row,
        });
      }
    }
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
        dateOnly: column.columnDef.cellDataType === "dateString",
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
      // One full-row commit is ONE undo, not one per changed column.
      pushHistory(
        ctx,
        changed.map((c) => ({
          rowId: fr.rowId, columnId: c.columnId, field: c.field,
          before: c.before, after: c.after,
        })),
        nextGroupId(),
      );
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
    armPasteFallback,
  };
}
