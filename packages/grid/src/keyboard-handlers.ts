// keyboard handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";

import { getKeyboardIntent, getNextActiveCell } from "./keyboard";

export function createKeyboard<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function onGridKeyDown(event: KeyboardEvent) {
    // Only the grid root drives navigation - keys on header buttons, menus,
    // or the cell editor are handled by those controls themselves.
    if (event.target !== event.currentTarget) return;
    if (ctx.editingCell) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const lower = event.key.toLowerCase();
      if (lower === "c") {
        event.preventDefault();
        ctx.copySelectionToClipboard();
        return;
      }
      if (lower === "v") {
        // Secure context: read via the async Clipboard API and swallow the
        // key. Insecure context (no navigator.clipboard): DON'T preventDefault
        // so the browser delivers a native `paste` event to `onGridPaste`.
        if (typeof navigator.clipboard?.readText === "function") {
          event.preventDefault();
          void ctx.pasteFromClipboard();
        }
        return;
      }
      if (lower === "x") {
        event.preventDefault();
        void ctx.cutSelectionToClipboard();
        return;
      }
      // Ctrl+Z (Cmd+Z) undoes the most recent cell edit. Ctrl+Shift+Z
      // and Ctrl+Y both redo. Mirrors VSCode / Sheets / Excel.
      if (lower === "z" && !event.shiftKey) {
        event.preventDefault()
        if (ctx.historyPtr >= 0) {
          const step = ctx.history[ctx.historyPtr]
          if (step) {
            ctx.applyHistoryStep(step, 'undo')
            ctx.historyPtr -= 1
            ctx.historyVersion += 1
          }
        }
        return
      }
      if ((lower === "z" && event.shiftKey) || lower === "y") {
        event.preventDefault()
        if (ctx.historyPtr < ctx.history.length - 1) {
          const step = ctx.history[ctx.historyPtr + 1]
          if (step) {
            ctx.applyHistoryStep(step, 'redo')
            ctx.historyPtr += 1
            ctx.historyVersion += 1
          }
        }
        return
      }
      // Ctrl+F opens the find overlay.
      if (lower === "f") {
        event.preventDefault()
        ctx.findOpen = true
        return
      }
    }
    // Esc closes find when nothing else owns the key.
    if (event.key === "Escape" && ctx.findOpen) {
      event.preventDefault()
      ctx.findOpen = false
      return
    }

    // Delete / Backspace clears every editable cell in the selection
    // range. No clipboard interaction - this is the "blank the cells I
    // have selected" gesture, distinct from Ctrl/Cmd+X.
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      !event.ctrlKey && !event.metaKey && !event.altKey
    ) {
      if (ctx.clearSelectedCells()) {
        event.preventDefault();
        return;
      }
    }

    const current = ctx.grid.getState().activeCell ?? {
      rowIndex: 0,
      colIndex: 0,
      cellId: null,
    };

    if (event.key === "F2") {
      event.preventDefault();
      ctx.onCellDoubleClick(current.rowIndex, current.colIndex);
      return;
    }

    const intent = getKeyboardIntent(event);
    if (intent === "noop") {
      // A printable character on the active cell starts editing seeded with it.
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (
          ctx.startEditingWithChar(current.rowIndex, current.colIndex, event.key)
        ) {
          event.preventDefault();
        }
      }
      return;
    }
    event.preventDefault();

    // Server-side group / tree navigation, built into the grid: ArrowRight
    // expands a collapsed group row, ArrowLeft collapses an expanded one,
    // instead of moving the active cell (treegrid-style). Leaves fall through
    // to normal navigation.
    // Client tree data gets the same ArrowRight/ArrowLeft contract, driven off
    // the row model rather than consumer callbacks.
    if (ctx.props.treeData && (intent === "moveRight" || intent === "moveLeft")) {
      const row = ctx.allRows[current.rowIndex];
      if (row?.getCanExpand?.()) {
        const expanded = row.getIsExpanded?.() ?? false;
        if (intent === "moveRight" && !expanded) {
          row.toggleExpanded?.();
          return;
        }
        if (intent === "moveLeft" && expanded) {
          row.toggleExpanded?.();
          return;
        }
      }
    }

    const serverGroup = ctx.props.serverGroup;
    if (serverGroup && (intent === "moveRight" || intent === "moveLeft")) {
      const data = ctx.allRows[current.rowIndex]?.original;
      if (data !== undefined && serverGroup.isGroup(data)) {
        const expanded = serverGroup.expanded?.(data) ?? false;
        if (intent === "moveRight" && !expanded) {
          serverGroup.onToggle(data);
          return;
        }
        if (intent === "moveLeft" && expanded) {
          serverGroup.onToggle(data);
          return;
        }
      }
    }

    if (intent === "clearCells") {
      // Excel `Delete` - clear contents of every cell in the selection
      // (or the active cell if no range). Formatting is left alone, only
      // the underlying value is wiped.
      ctx.clearSelectedCellValues();
      return;
    }

    if (intent === "activate") {
      const row = ctx.allRows[current.rowIndex];
      const column = ctx.allColumns[current.colIndex];
      if (event.key === " ") {
        row?.toggleSelected?.();
        return;
      }
      if (event.ctrlKey && row?.getCanExpand?.()) {
        row.toggleExpanded?.();
        return;
      }
      if (column?.columnDef.editorType === "checkbox") {
        ctx.toggleBooleanCell(current.rowIndex, current.colIndex);
        return;
      }
      ctx.onCellDoubleClick(current.rowIndex, current.colIndex);
      return;
    }

    // Excel-style page step: PageUp/PageDown jump by ~one visible
    // page minus one row of overlap. Falls back to grid pagination's
    // pageSize when pagination is on, or 10 as a final fallback.
    function pageStep(): number {
      const pageSize = ctx.grid.getState().pagination?.pageSize as number | undefined
      if (pageSize && pageSize > 0) return pageSize
      const clientHeight = ctx.scrollContainer?.clientHeight ?? 0
      const headerHeight = ctx.headerHeight ?? 0
      const rowHeight =
        typeof ctx.props.rowHeight === 'function'
          ? (ctx.props.rowHeight(current.rowIndex) ?? 30)
          : (ctx.props.rowHeight ?? 30)
      const usable = Math.max(0, clientHeight - headerHeight)
      return Math.max(1, Math.floor(usable / Math.max(rowHeight, 1)) - 1)
    }
    const next = getNextActiveCell(current, intent, {
      maxRow: Math.max(ctx.allRows.length - 1, 0),
      maxCol: Math.max(ctx.allColumns.length - 1, 0),
      pageSize: pageStep(),
    });
    ctx.setActiveCell(next.rowIndex, next.colIndex);
    ctx.scrollActiveCellIntoView(next.rowIndex, next.colIndex);
    // Shift extends the selection ONLY for arrow keys (Excel-style).
    // Shift+Enter / Shift+Tab just change direction; they don't grow the
    // range, otherwise hammering Shift+Tab to backspace through a row
    // would paint a creeping rectangle behind the cursor.
    const shouldExtend =
      event.shiftKey &&
      (intent === "moveLeft" ||
        intent === "moveRight" ||
        intent === "moveUp" ||
        intent === "moveDown");
    if (shouldExtend) ctx.extendSelection(next.rowIndex, next.colIndex);
    else ctx.setSelection(next.rowIndex, next.colIndex);
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && (ctx.columnMenuFor || ctx.operatorMenuFor)) {
      ctx.closeMenus();
    }
  }

  function onHeaderSortClick(event: MouseEvent, columnId: string) {
    const column = ctx.allColumns.find((entry: any) => entry.id === columnId);
    if (!column?.getCanSort?.()) return;
    const clauses = ctx.grid.getState().sorting ?? [];
    const current = clauses.find(
      (entry: { id: string; desc: boolean }) => entry.id === columnId,
    );

    if (!event.shiftKey) {
      // Single-sort: cycle this column's direction and clear all other
      // sorts. Cycle order: none → asc → desc → none.
      const nextClause = !current
        ? [{ id: columnId, desc: false }]
        : current.desc
          ? []
          : [{ id: columnId, desc: true }];
      ctx.grid.store.setState((prev: any) => ({ ...prev, sorting: nextClause }));
      return;
    }

    // Shift-click: append/toggle as part of a multi-sort.
    const nextClause = !current
      ? [...clauses, { id: columnId, desc: false }]
      : current.desc
        ? clauses.filter((entry: { id: string }) => entry.id !== columnId)
        : clauses.map((entry: { id: string; desc: boolean }) =>
            entry.id === columnId ? { ...entry, desc: true } : entry,
          );
    ctx.grid.store.setState((prev: any) => ({ ...prev, sorting: nextClause }));
  }

  return {
    onGridKeyDown,
    onWindowKeydown,
    onHeaderSortClick,
  };
}
