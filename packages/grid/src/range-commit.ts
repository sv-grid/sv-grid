// The commit of a fill and of a range move: what a drag writes when it ends.
// Split from clipboard.ts so it stays out of the base bundle; it loads when a
// drag starts (`loadRangeCommit`). Reads and writes go through the functions
// clipboard.ts passes in, so this file holds no state of its own.
import { buildFillPattern } from "./fill-patterns";
import { pushHistory, nextGroupId, runHistoryGroup, type HistoryStep } from "./history";
import { getGridExtension } from "./grid-extension.svelte";

type FilledCell = { rowIndex: number; columnId: string; value: unknown };

export function createRangeCommit(
  ctx: any,
  readCellRaw: (rowIndex: number, columnId: string) => unknown,
  writeCellsRaw: (cells: ReadonlyArray<{ rowIndex: number; columnId: string; value: unknown }>) => void,
  moveDestRect: (d: any) => { minRow: number; maxRow: number; minCol: number; maxCol: number } | null,
  stopEdgeScroll: () => void,
) {
  /** Apply the pattern fill on pointerup. Each NEW row (or column) is
   *  filled from a pattern derived from the matching column (or row) of
   *  the source. Handles all four drag directions. */
  /**
   * One filled cell, noted so the drag writes and undoes as a unit. The write
   * waits for the end of the fill: a value landing in a sorted column moves its
   * row, and every position after it would name another record.
   */
  function writeFilled(steps: HistoryStep[], cells: FilledCell[], rowIndex: number, columnId: string, value: unknown) {
    const row = ctx.allRows[rowIndex];
    const column = ctx.findColumnById(columnId);
    const field = column?.columnDef.field;
    if (!row || field == null) return;
    const before = readCellRaw(rowIndex, columnId);
    cells.push({ rowIndex, columnId, value });
    if (before !== value) steps.push({ rowId: row.id, columnId, field, before, after: value });
  }

  function applyFillPattern(toggled = false) {
    const drag = ctx.fillDrag;
    if (drag && getGridExtension()?.rangeAction?.(ctx, { kind: "fill", drag, toggled })) {
      ctx.fillDrag = null;
      stopEdgeScroll();
      return;
    }
    const steps: HistoryStep[] = [];
    const cells: FilledCell[] = [];
    runHistoryGroup(ctx, () => {
      applyFillCells(steps, cells, toggled);
      writeCellsRaw(cells);
    });
    if (steps.length) pushHistory(ctx, steps, nextGroupId());
  }

  /**
   * The value for the i-th filled cell: the consumer's, when its hook has
   * one for the source cell the target cycles back to, else the pattern's.
   * `sourceStart` is the row (or column) of the first source value and
   * `targetStart` that of the first target; `step` is -1 filling upward.
   */
  function filledValue(
    sources: unknown[],
    pattern: unknown[],
    i: number,
    sourceStart: number,
    at: number,
    step: 1 | -1,
    axis: "rows" | "cols",
    rowIndex: number,
    columnId: string,
  ): unknown {
    const hook = ctx.props.processCellForFill;
    if (hook && sources.length) {
      const k = i % sources.length;
      // The real distance to the cell being filled, which is not i when a
      // row the fill skips lies between: a formula moves by the rows it
      // actually travelled.
      const distance = at - (sourceStart + step * k);
      const delta = axis === "rows" ? { rows: distance, cols: 0 } : { rows: 0, cols: distance };
      const decided = hook({ value: sources[k], delta, rowIndex, columnId, sources, index: i });
      if (decided !== undefined) return decided;
    }
    return pattern[i];
  }

  /**
   * Double-click on the fill handle: fill down as far as the column beside
   * the selection has data, the way Excel's does. The column to the left
   * decides; when it is blank below the selection (or there is none) the
   * one to the right does. Nothing to follow, nothing filled.
   */
  function fillDownToNeighbour() {
    if (getGridExtension()?.rangeAction?.(ctx, { kind: "fillDown" })) return;
    const anchor = ctx.selectionRange.anchor ?? ctx.grid.getState().activeCell;
    if (!anchor) return;
    const focus = ctx.selectionRange.focus ?? anchor;
    const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
    const minCol = Math.min(anchor.colIndex, focus.colIndex);
    const maxCol = Math.max(anchor.colIndex, focus.colIndex);
    const filled = (r: number, c: number) => {
      const col = ctx.allColumns[c];
      if (!col) return false;
      const v = readCellRaw(r, col.id);
      return v != null && v !== "";
    };
    const extent = (c: number): number => {
      let r = maxRow;
      while (r + 1 < ctx.allRows.length && filled(r + 1, c)) r += 1;
      return r;
    };
    let target = minCol > 0 ? extent(minCol - 1) : maxRow;
    if (target === maxRow) target = extent(maxCol + 1);
    if (target <= maxRow) return;
    ctx.fillDrag = {
      sourceMinRow: minRow, sourceMaxRow: maxRow, sourceMinCol: minCol, sourceMaxCol: maxCol,
      targetRow: target, targetCol: maxCol,
    };
    applyFillPattern();
  }

  /** The fill's values the other way round from the pattern's default. */
  function toggledPattern(sources: unknown[], count: number): unknown[] {
    if (sources.length === 1 && typeof sources[0] === 'number' && Number.isFinite(sources[0])) {
      return Array.from({ length: count }, (_, i) => (sources[0] as number) + i + 1);
    }
    return Array.from({ length: count }, (_, i) => sources[i % sources.length]);
  }

  function applyFillCells(steps: HistoryStep[], cells: FilledCell[], toggled = false) {
    const pattern = (sources: unknown[], count: number) => (toggled ? toggledPattern(sources, count) : buildFillPattern(sources, count));
    const includeCollapsed = ctx.props.includeCollapsedRows as ((rowIndex: number) => boolean) | undefined;
    const skipsRow = (r: number) => ctx.isRowCollapsed?.(r) === true && !(includeCollapsed?.(r) ?? false);
    const d = ctx.fillDrag;
    if (!d) return;
    // Clear fillDrag FIRST so a thrown error doesn't leave the grid
    // stuck tracking the pointer.
    ctx.fillDrag = null;
    stopEdgeScroll();
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
        // A collapsed row the consumer does not count (a filtered row in a
        // spreadsheet) is neither written nor a step of the series: the
        // pattern runs over the rows that are there, as Excel's does.
        if (newMaxRow > d.sourceMaxRow) {
          const targets: number[] = [];
          for (let r = d.sourceMaxRow + 1; r <= newMaxRow; r += 1) if (!skipsRow(r)) targets.push(r);
          const fills = pattern(sourceColValues, targets.length);
          targets.forEach((targetRow, i) => {
            if (ctx.isCellEditableAt(targetRow, c))
              writeFilled(steps, cells, targetRow, column.id,
                filledValue(sourceColValues, fills, i, d.sourceMinRow, targetRow, 1, "rows", targetRow, column.id));
          });
        }
        if (newMinRow < d.sourceMinRow) {
          // Filling upward - reverse-extrapolate.
          const reversed = sourceColValues.slice().reverse();
          const targets: number[] = [];
          for (let r = d.sourceMinRow - 1; r >= newMinRow; r -= 1) if (!skipsRow(r)) targets.push(r);
          const fills = pattern(reversed, targets.length);
          targets.forEach((targetRow, i) => {
            if (ctx.isCellEditableAt(targetRow, c))
              writeFilled(steps, cells, targetRow, column.id,
                filledValue(reversed, fills, i, d.sourceMaxRow, targetRow, -1, "rows", targetRow, column.id));
          });
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
          const fills = pattern(sourceRowValues, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMaxCol + 1 + i;
            const col = ctx.allColumns[targetCol];
            if (col && ctx.isCellEditableAt(r, targetCol))
              writeFilled(steps, cells, r, col.id,
                filledValue(sourceRowValues, fills, i, d.sourceMinCol, targetCol, 1, "cols", r, col.id));
          }
        }
        if (newMinCol < d.sourceMinCol) {
          const reversed = sourceRowValues.slice().reverse();
          const targetCols = d.sourceMinCol - newMinCol;
          const fills = pattern(reversed, targetCols);
          for (let i = 0; i < targetCols; i += 1) {
            const targetCol = d.sourceMinCol - 1 - i;
            const col = ctx.allColumns[targetCol];
            if (col && ctx.isCellEditableAt(r, targetCol))
              writeFilled(steps, cells, r, col.id,
                filledValue(reversed, fills, i, d.sourceMaxCol, targetCol, -1, "cols", r, col.id));
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

  /**
   * Commit a range move (or copy). Refuses the whole operation rather than
   * applying the part that fits: a move that silently skipped a read-only or
   * grouped destination cell would leave the range split across two places
   * with no way to tell which half landed.
   */
  function applyMoveRange() {
    const d = ctx.moveDrag;
    if (!d) return;
    // Clear the drag FIRST so a thrown error can't leave the grid tracking
    // the pointer forever, exactly as applyFillPattern does.
    ctx.moveDrag = null;
    stopEdgeScroll();
    const dest = moveDestRect(d);
    if (!dest || getGridExtension()?.rangeAction?.(ctx, { kind: "move", drag: { ...d, dest } })) return;

    const height = d.sourceMaxRow - d.sourceMinRow + 1;
    const width = d.sourceMaxCol - d.sourceMinCol + 1;

    // Every column the move touches must be field-backed on BOTH sides: a
    // computed / accessor column has nowhere to write the value back to.
    for (let c = 0; c < width; c += 1) {
      if (!ctx.allColumns[d.sourceMinCol + c]?.columnDef.field) return;
      if (!ctx.allColumns[dest.minCol + c]?.columnDef.field) return;
    }
    // Destination must be writable, and so must the source when the values
    // are leaving it. Group rows fail this through isCellEditableAt.
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        if (!ctx.isCellEditableAt(dest.minRow + r, dest.minCol + c)) return;
        if (
          !d.copy &&
          !ctx.isCellEditableAt(d.sourceMinRow + r, d.sourceMinCol + c)
        )
          return;
      }
    }

    // Snapshot the source before touching anything - source and destination
    // overlap on any short drag, so reading lazily would move already-moved
    // values a second time.
    const values: unknown[][] = [];
    for (let r = 0; r < height; r += 1) {
      const rowValues: unknown[] = [];
      for (let c = 0; c < width; c += 1) {
        const column = ctx.allColumns[d.sourceMinCol + c];
        rowValues.push(readCellRaw(d.sourceMinRow + r, column.id));
      }
      values.push(rowValues);
    }

    const steps: Array<{
      rowId: string;
      columnId: string;
      field: string;
      before: unknown;
      after: unknown;
    }> = [];
    // The cells land together at the end: a write into a sorted column moves its
    // row. `planned` is what each one will hold by then.
    const cells: FilledCell[] = [];
    const planned = new Map<string, unknown>();
    const write = (rowIndex: number, colIndex: number, value: unknown) => {
      const column = ctx.allColumns[colIndex];
      if (!column?.columnDef.field) return;
      const cell = `${rowIndex}:${column.id}`;
      const before = planned.has(cell) ? planned.get(cell) : readCellRaw(rowIndex, column.id);
      if (before === value) return;
      const rowId = ctx.allRows[rowIndex]?.id;
      planned.set(cell, value);
      cells.push({ rowIndex, columnId: column.id, value });
      if (rowId) {
        steps.push({
          rowId,
          columnId: column.id,
          field: column.columnDef.field as string,
          before,
          after: value,
        });
      }
    };

    // Clear the whole source first, then write the destination. With the
    // values already snapshotted this is correct even when the rectangles
    // overlap: the destination write always lands after the clear.
    if (!d.copy) {
      for (let r = 0; r < height; r += 1) {
        for (let c = 0; c < width; c += 1) {
          write(d.sourceMinRow + r, d.sourceMinCol + c, null);
        }
      }
    }
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        write(dest.minRow + r, dest.minCol + c, values[r]![c]);
      }
    }
    writeCellsRaw(cells);

    // The whole move is ONE undo entry. It used to be one step per changed
    // cell, so walking a 15x20 move back took 300 presses of Ctrl+Z and blew
    // past UNDO_LIMIT, evicting every step behind it.
    pushHistory(ctx, steps, nextGroupId());

    // Follow the values: the range stays selected where it landed, so a
    // second drag can chain off the first the way it does in a spreadsheet.
    ctx.selectionRanges = [];
    ctx.selectionRange = {
      anchor: { rowIndex: dest.minRow, colIndex: dest.minCol },
      focus: { rowIndex: dest.maxRow, colIndex: dest.maxCol },
    };
    ctx.setActiveCell(dest.minRow, dest.minCol);
  }

  return { applyFillPattern, fillDownToNeighbour, applyMoveRange };
}
