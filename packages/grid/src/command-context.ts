/**
 * Builds the `GridCommandContext` handed to registered keyboard commands.
 *
 * Deliberately a getter object over the controller `ctx` rather than a
 * snapshot: it is constructed on every keystroke that reaches a registered
 * handler, so copying row and column arrays into it would put an allocation
 * proportional to the grid in the hot path. Getters make construction O(1) and
 * charge only for what a handler actually reads.
 *
 * Everything here is display-indexed, matching `SelectionPoint` and the rest of
 * the selection model, so indices follow sort, filter and pagination. That is
 * why `getCellValue` / `setCellValue` exist here rather than being left to
 * `api.getCellValue`: the api pair indexes the DATA array, so handing a handler
 * a selection index and an api that reads a different index space would give
 * the wrong cell the moment the grid is sorted or filtered. `api.refresh()` has
 * no index in it, so that one is left to the api.
 */
import type { GridCommandContext } from "./shortcut-registry";
import { pushHistory, runHistoryGroup } from "./history";

export function buildCommandContext(ctx: any, editing: boolean): GridCommandContext {
  function columnIdAt(colIndex: number): string | null {
    return ctx.allColumns[colIndex]?.id ?? null;
  }

  return {
    get api() {
      return ctx.buildApi();
    },
    editing,
    get activeCell() {
      const active = ctx.grid.getState().activeCell;
      if (!active) return null;
      return {
        rowIndex: active.rowIndex,
        colIndex: active.colIndex,
        columnId: columnIdAt(active.colIndex),
      };
    },
    get rowCount() {
      return ctx.allRows.length;
    },
    get colCount() {
      return ctx.allColumns.length;
    },
    get ranges() {
      // getSelectionRects() already normalises anchor/focus into rectangles
      // and puts the active range last, which is the order a handler wants
      // when it has to pick one.
      return ctx.getSelectionRects().map(
        (r: { minRow: number; minCol: number; maxRow: number; maxCol: number }) =>
          [r.minRow, r.minCol, r.maxRow, r.maxCol] as const,
      );
    },
    columnIdAt,
    getCellValue(rowIndex: number, colIndex: number) {
      const columnId = columnIdAt(colIndex);
      return columnId == null ? undefined : ctx.readCellRaw(rowIndex, columnId);
    },
    setCellValue(rowIndex: number, colIndex: number, value: unknown) {
      const columnId = columnIdAt(colIndex);
      if (columnId == null) return;
      // Record the write so Ctrl+Z walks it back. `writeCellRaw` is the raw
      // writer and deliberately keeps no history of its own - the fill handle
      // and paste call it in loops and push their own entries (or, today, none
      // at all). A command has to push here or every multi-cell command it
      // runs would be silently un-undoable.
      //
      // Both reads happen BEFORE the write: writeCellRaw swaps a fresh row
      // object into `internalData`, so afterwards the id lookup would miss.
      const field = ctx.allColumns[colIndex]?.columnDef?.field;
      const rowId = ctx.allRows[rowIndex]?.id;
      const before = ctx.readCellRaw(rowIndex, columnId);
      ctx.writeCellRaw(rowIndex, columnId, value);
      // Only when something actually changed: writeCellRaw no-ops on an equal
      // value, and a step whose before and after match would make Ctrl+Z look
      // like it had swallowed a press.
      if (field != null && rowId != null && before !== value) {
        pushHistory(ctx, [{ rowId, columnId, field, before, after: value }]);
      }
    },
    setActiveCell(rowIndex: number, colIndex: number) {
      ctx.setActiveCell(rowIndex, colIndex);
    },
    setSelection(rowIndex: number, colIndex: number) {
      ctx.setSelection(rowIndex, colIndex);
    },
    extendSelection(rowIndex: number, colIndex: number) {
      ctx.extendSelection(rowIndex, colIndex);
    },
    scrollIntoView(rowIndex: number, colIndex: number) {
      ctx.scrollActiveCellIntoView(rowIndex, colIndex);
    },
    startEditing(rowIndex: number, colIndex: number, seed?: string) {
      if (seed !== undefined) {
        return ctx.startEditingWithChar(rowIndex, colIndex, seed) === true;
      }
      ctx.onCellDoubleClick(rowIndex, colIndex);
      return true;
    },
    batch<T>(fn: () => T): T {
      return runHistoryGroup(ctx, fn);
    },
  };
}
