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
import { runHistoryGroup } from "./history";

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
      if (columnId != null) ctx.writeCellRaw(rowIndex, columnId, value);
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
