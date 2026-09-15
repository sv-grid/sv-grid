// keyboard handlers extracted from the controller. Imperative event handlers
// reading/writing controller state via the `ctx` handle; the reactive core
// ($state/$derived/$effect) stays in the controller.
import {
  type RowData,
  type TableFeatures,
} from "./index";
import "./sv-grid-scrollbar";

import { getKeyboardIntent, getNextActiveCell, getEntryStep, pastCollapsed } from "./keyboard";
import { stepPastMerge } from "./merges";
import { hasGridShortcuts, runGridShortcuts } from "./shortcut-registry";
import { undoHistory, redoHistory } from "./history";
import { buildCommandContext } from "./command-context";

export function createKeyboard<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  function onGridKeyDown(event: KeyboardEvent) {
    // Only the grid root drives navigation - keys on header buttons, menus,
    // or the cell editor are handled by those controls themselves.
    //
    // The command chain runs AFTER this guard, not before. Running it first
    // meant a key typed into a filter-row input reached the sheet commands,
    // so Ctrl+A or Ctrl+D while filtering mutated grid cells. The editor has
    // its own chain call in editing.ts, which is what Alt+Enter needs.
    if (event.target !== event.currentTarget) return;

    // Registered commands get the key BEFORE the grid interprets it. That is
    // how @svgrid/enterprise binds Ctrl+Arrow, Ctrl+D and the rest without
    // widening the closed GridKeyboardIntent union, which is public API. A
    // grid with nothing registered pays one array-length read.
    if (hasGridShortcuts() && runGridShortcuts(event, buildCommandContext(ctx, false))) {
      return;
    }

    if (ctx.editingCell) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const lower = event.key.toLowerCase();
      if (lower === "c") {
        event.preventDefault();
        ctx.copySelectionToClipboard();
        return;
      }
      if (lower === "v") {
        // A consumer taking the paste over wants the browser's own `paste`
        // event, which carries the clipboard's HTML unsanitised; the key is
        // left alone and the async API is armed as the fallback for a
        // browser that never delivers the event to a non-editable element.
        if (ctx.props.onPasteClipboard) {
          ctx.armPasteFallback();
          return;
        }
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
        undoHistory(ctx)
        return
      }
      if ((lower === "z" && event.shiftKey) || lower === "y") {
        event.preventDefault()
        redoHistory(ctx)
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
    const bounds = {
      maxRow: Math.max(ctx.allRows.length - 1, 0),
      maxCol: Math.max(ctx.allColumns.length - 1, 0),
    };
    // Collapsed rows and columns are stepped over, as a sheet's hidden ones.
    const collapsed = {
      isRowCollapsed: (i: number) => ctx.isRowCollapsed(i) as boolean,
      isColumnCollapsed: (i: number) => !!ctx.collapsedColumns[ctx.allColumns[i]?.id],
    };
    // Enter and Tab are entry keys: they remember a Tab run and stay inside
    // a selected block (getEntryStep). ArrowDown shares the moveDown intent
    // and is a plain move, hence the key check.
    if (
      (event.key === "Enter" || event.key === "Tab") &&
      (intent === "moveDown" || intent === "moveUp" || intent === "tabNext" || intent === "tabPrev")
    ) {
      const step = getEntryStep(current, intent, {
        ...bounds,
        tabOrigin: ctx.tabRunOrigin,
        range: ctx.activeRangeRect(),
        collapsed,
      });
      const landed = stepPastMerge(ctx.mergeIndex, current, step.cell, bounds);
      ctx.setActiveCell(landed.rowIndex, landed.colIndex);
      ctx.tabRunOrigin = step.tabOrigin;
      ctx.scrollActiveCellIntoView(landed.rowIndex, landed.colIndex);
      if (!step.withinRange) ctx.setSelection(landed.rowIndex, landed.colIndex);
      return;
    }
    // Shift+Arrow grows the range from its far corner, and the active cell
    // stays where it is, as in Excel: it is the cell the formula bar shows
    // and the one the next keystroke edits. Shift+Home, Shift+End,
    // Shift+PageUp / PageDown and Ctrl+Shift+Home / End grow it the same
    // way, to where the plain key would have moved. Shift+Enter and
    // Shift+Tab never come this way (they are entry keys, above), so
    // hammering Shift+Tab back through a row cannot paint a creeping
    // rectangle. A grid without cell selection has no range to grow and
    // moves the active cell instead.
    const extending =
      event.shiftKey &&
      ctx.enableCellSelectionEffective !== false &&
      (intent === "moveLeft" ||
        intent === "moveRight" ||
        intent === "moveUp" ||
        intent === "moveDown" ||
        intent === "rowStart" ||
        intent === "rowEnd" ||
        intent === "pageUp" ||
        intent === "pageDown" ||
        intent === "gridStart" ||
        intent === "gridEnd");
    if (extending) {
      const anchored = !!ctx.selectionRange?.anchor;
      if (!anchored) ctx.setSelection(current.rowIndex, current.colIndex);
      const from = anchored ? ctx.selectionRange.focus ?? current : current;
      const next = stepPastMerge(ctx.mergeIndex, from, pastCollapsed(from, getNextActiveCell(from, intent, { ...bounds, pageSize: pageStep() }), bounds, collapsed), bounds);
      ctx.extendSelection(next.rowIndex, next.colIndex);
      // Scroll along the axis of the key only, as Excel does: Shift+Right
      // brings the new column into view without moving the rows, so a
      // whole-column selection (its far corner on the last row) stays put.
      const sideways = intent === "moveLeft" || intent === "moveRight" || intent === "rowStart" || intent === "rowEnd";
      ctx.scrollActiveCellIntoView(sideways ? current.rowIndex : next.rowIndex, sideways ? next.colIndex : current.colIndex);
      return;
    }
    const next = stepPastMerge(ctx.mergeIndex, current, pastCollapsed(current, getNextActiveCell(current, intent, { ...bounds, pageSize: pageStep() }), bounds, collapsed), bounds);
    ctx.setActiveCell(next.rowIndex, next.colIndex);
    ctx.scrollActiveCellIntoView(next.rowIndex, next.colIndex);
    ctx.setSelection(next.rowIndex, next.colIndex);
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
