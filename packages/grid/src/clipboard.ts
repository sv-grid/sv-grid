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
  createDataIndexLookup,
  getColumnBaseValue,
  isGroupRow,
  toolPanelHeaderLabel,
} from "./cell-values";

export function createClipboard<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  /**
   * `rowIndex` here is a DISPLAY index - a position in `allRows`, the space the
   * selection rectangle, the fill drag and `isCellEditableAt` all work in.
   * These two functions used to index `internalData` with it directly, which is
   * the same row only while the grid is unsorted, unfiltered and unpaginated.
   * Sort a column and the fill handle read its pattern from one row and wrote
   * to another; enterprise bulk edit wrote to the wrong rows the same way.
   *
   * `row.original` IS the object in `data`, so identity resolves the slot no
   * matter how the view is ordered.
   */
  function rowDataAt(rowIndex: number): Record<string, unknown> | undefined {
    return ctx.allRows[rowIndex]?.original as Record<string, unknown> | undefined;
  }

  /** Read the raw underlying value for the cell at (rowIndex, columnId)
   *  for pattern extraction. */
  function readCellRaw(rowIndex: number, columnId: string): unknown {
    const row = rowDataAt(rowIndex);
    const column = ctx.findColumnById(columnId);
    if (!row || !column?.columnDef.field) return undefined;
    return row[column.columnDef.field];
  }

  /** Write a value into (rowIndex, columnId) without going through the
   *  edit lifecycle. Fires `onCellValueChange` per write so consumers
   *  can react (formula recompute, autosave, etc.). */
  function writeCellRaw(rowIndex: number, columnId: string, value: unknown) {
    const row = rowDataAt(rowIndex);
    const column = ctx.findColumnById(columnId);
    if (!row || !column?.columnDef.field) return;
    const field = column.columnDef.field;
    const oldValue = row[field];
    if (oldValue === value) return;
    // The slot in `data` backing this displayed row. Also read BEFORE swapping
    // internalData: afterwards the recomputed `allRows` references the new row
    // object, so an `original`-based lookup would miss and drop the edit out of
    // `editedCellValues` (which getCellDisplayValue consults first).
    const dataIndex = ctx.internalData.indexOf(row as TData);
    if (dataIndex < 0) return;
    const rowId = ctx.allRows[rowIndex]?.id;
    const next = ctx.internalData.slice() as Array<TData>;
    next[dataIndex] = { ...row, [field]: value } as TData;
    ctx.internalData = next;
    if (rowId) {
      const key = getCellKey(rowId, columnId);
      ctx.editedCellValues = { ...ctx.editedCellValues, [key]: value };
    }
    ctx.props.onCellValueChange?.({
      // The position in `props.data`, matching what the inline editor reports.
      rowIndex: dataIndex,
      columnId,
      oldValue,
      newValue: value,
      row: next[dataIndex] as TData,
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

  /** The grid cell under a viewport point, or null. Drags cannot read their
   *  target off the event: the pointer is over whatever `<td>` happens to be
   *  there, and during a fill/move drag the event target is the cell the drag
   *  STARTED on. */
  function cellAtPoint(x: number, y: number): { row: number; col: number } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest(
      "td[data-svgrid-row][data-svgrid-col]",
    ) as HTMLElement | null;
    if (!cell) return null;
    const row = Number(cell.dataset.svgridRow);
    const col = Number(cell.dataset.svgridCol);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  }

  // ---- Edge auto-scroll -------------------------------------------------
  // Shared by all three drags that extend a rectangle - fill, range move, and
  // plain drag-select. Without it a drag can only reach cells that are already
  // on screen, which on a grid the size this one is built for means most of
  // them are unreachable.

  /** How far from the viewport edge the scroll starts, in CSS pixels. */
  const EDGE_BAND_PX = 40;
  /** Fastest scroll, in pixels per frame, reached at the very edge. */
  const EDGE_MAX_PX = 20;

  let edgeFrame: number | null = null;
  let edgePointer: { x: number; y: number } | null = null;

  function stopEdgeScroll() {
    if (edgeFrame != null) cancelAnimationFrame(edgeFrame);
    edgeFrame = null;
    edgePointer = null;
  }

  /**
   * Pixels to scroll this frame along one axis. Zero in the middle, ramping to
   * EDGE_MAX_PX at the edge and staying there once the pointer leaves the
   * container entirely - a linear ramp rather than a constant step, so nudging
   * one row past the edge creeps instead of lurching.
   */
  function edgeVelocity(pos: number, min: number, max: number) {
    if (pos < min + EDGE_BAND_PX) {
      const depth = Math.min(EDGE_BAND_PX, min + EDGE_BAND_PX - pos);
      return -Math.ceil((depth / EDGE_BAND_PX) * EDGE_MAX_PX);
    }
    if (pos > max - EDGE_BAND_PX) {
      const depth = Math.min(EDGE_BAND_PX, pos - (max - EDGE_BAND_PX));
      return Math.ceil((depth / EDGE_BAND_PX) * EDGE_MAX_PX);
    }
    return 0;
  }

  /** Point the in-flight drag at whatever cell is under (x, y) now. */
  function retargetDrag(x: number, y: number) {
    const hit = cellAtPoint(x, y);
    if (!hit) return;
    if (ctx.moveDrag) {
      if (hit.row === ctx.moveDrag.targetRow && hit.col === ctx.moveDrag.targetCol) return;
      ctx.moveDrag = { ...ctx.moveDrag, targetRow: hit.row, targetCol: hit.col };
    } else if (ctx.fillDrag) {
      if (hit.row === ctx.fillDrag.targetRow && hit.col === ctx.fillDrag.targetCol) return;
      ctx.fillDrag = { ...ctx.fillDrag, targetRow: hit.row, targetCol: hit.col };
    } else if (ctx.isDraggingSelection) {
      ctx.extendSelection(hit.row, hit.col);
      ctx.setActiveCell(hit.row, hit.col);
    }
  }

  function stepEdgeScroll() {
    edgeFrame = null;
    const scroller = ctx.scrollContainer as HTMLElement | null;
    const p = edgePointer;
    const dragging = ctx.moveDrag || ctx.fillDrag || ctx.isDraggingSelection;
    if (!scroller || !p || !dragging) {
      stopEdgeScroll();
      return;
    }
    const rect = scroller.getBoundingClientRect();
    const dx = edgeVelocity(p.x, rect.left, rect.right);
    const dy = edgeVelocity(p.y, rect.top, rect.bottom);
    if (dx || dy) {
      const fromX = scroller.scrollLeft;
      const fromY = scroller.scrollTop;
      scroller.scrollLeft += dx;
      scroller.scrollTop += dy;
      // Only re-target when the view actually moved. At either end the scroll
      // clamps, and re-targeting then would fight a pointer that is parked
      // still - the selection would flicker between two cells every frame.
      if (scroller.scrollLeft !== fromX || scroller.scrollTop !== fromY) {
        retargetDrag(p.x, p.y);
      }
    }
    edgeFrame = requestAnimationFrame(stepEdgeScroll);
  }

  /**
   * Record where the pointer is and make sure the scroll loop is running. The
   * loop keeps going after the pointer stops moving, which is the whole point:
   * a user parks the cursor at the edge and expects the grid to keep coming.
   */
  function trackEdgeScroll(event: PointerEvent) {
    edgePointer = { x: event.clientX, y: event.clientY };
    if (edgeFrame == null) edgeFrame = requestAnimationFrame(stepEdgeScroll);
  }

  /** Pointermove during fill-drag. */
  function onFillPointerMove(event: PointerEvent) {
    if (!ctx.fillDrag) return;
    trackEdgeScroll(event);
    const hit = cellAtPoint(event.clientX, event.clientY);
    if (!hit) return;
    if (hit.row === ctx.fillDrag.targetRow && hit.col === ctx.fillDrag.targetCol) return;
    ctx.fillDrag = { ...ctx.fillDrag, targetRow: hit.row, targetCol: hit.col };
  }

  function onFillPointerUp() {
    if (!ctx.fillDrag) return;
    applyFillPattern();
  }

  // ---- Range move / copy (drag the selection border) --------------------

  /** How thick the draggable strip on a range border is, in CSS pixels.
   *  Anything further inside the cell keeps its old behaviour of starting a
   *  fresh selection, so this only claims the outer sliver. */
  const MOVE_GRAB_PX = 4;

  /** Is (clientX, clientY) on the grab strip of the range border that the
   *  cell at (rowIndex, colIndex) sits on? Returns false for any cell that
   *  is not on a range edge, so the common case costs one call to
   *  `getCellRangeEdges` - which itself bails immediately with no selection. */
  function isOnMoveGrabStrip(
    cell: HTMLElement,
    rowIndex: number,
    colIndex: number,
    clientX: number,
    clientY: number,
  ): boolean {
    if (!ctx.moveCellsEffective) return false;
    const edges = ctx.getCellRangeEdges(rowIndex, colIndex);
    if (!edges) return false;
    // One layout read per pointermove, and only once the pointer is over a
    // cell that IS on a range edge. Reading a single rect is cheap unless
    // the DOM is dirty, and the only write this path makes is a boolean flag
    // that changes at most twice per border crossing.
    const box = cell.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    return (
      (edges.top && y >= 0 && y <= MOVE_GRAB_PX) ||
      (edges.bottom && box.height - y >= 0 && box.height - y <= MOVE_GRAB_PX) ||
      (edges.left && x >= 0 && x <= MOVE_GRAB_PX) ||
      (edges.right && box.width - x >= 0 && box.width - x <= MOVE_GRAB_PX)
    );
  }

  /** Border pointerdown - seed a range move. Returns false when the pointer
   *  was not on the grab strip, which is the caller's signal to fall through
   *  to normal selection behaviour. */
  function startMoveDrag(
    event: PointerEvent,
    rowIndex: number,
    colIndex: number,
  ): boolean {
    if (event.button !== 0) return false;
    // Mouse and pen only, the same policy drag-select uses (issue #23) and for
    // a worse reason: this path DOES preventDefault, so a finger that happened
    // to land within 4px of a selection border would start a move and kill the
    // browser's native scroll for that gesture. There is no hover on touch
    // either, so the border carries no affordance to find in the first place.
    // Touch already has cut/paste for the same job.
    if (event.pointerType === "touch") return false;
    // `event.target`, not `currentTarget`: Svelte 5 delegates pointerdown to
    // the root, and the strip test needs the cell's own rect - the target can
    // be a span inside the cell, so walk up to the td.
    const cell = (event.target as HTMLElement | null)?.closest?.(
      "td[data-svgrid-row][data-svgrid-col]",
    ) as HTMLElement | null;
    if (!cell) return false;
    if (!isOnMoveGrabStrip(cell, rowIndex, colIndex, event.clientX, event.clientY))
      return false;
    const rect = moveSourceRect(rowIndex, colIndex);
    if (!rect) return false;
    event.stopPropagation();
    // preventDefault stops the drag from rubber-banding a text selection over
    // the rows it passes, which also means the grid never gets focus from the
    // gesture - so take it explicitly, or the keyboard stops working after a
    // move.
    event.preventDefault();
    ctx.gridRootEl?.focus({ preventScroll: true });
    ctx.moveDrag = {
      ...rect,
      grabRow: rowIndex,
      grabCol: colIndex,
      targetRow: rowIndex,
      targetCol: colIndex,
      copy: event.ctrlKey || event.metaKey,
    };
    // No `setPointerCapture`, for the same reason the fill handle skips it:
    // the drag finds its target cell with `elementFromPoint`, and capture
    // would route every move back to the cell the drag started on.
    return true;
  }

  /** The selection rectangle that CONTAINS (rowIndex, colIndex), which is the
   *  one whose border the user grabbed. With several committed ranges the
   *  grabbed one is the one that moves, not whichever happens to be active. */
  function moveSourceRect(rowIndex: number, colIndex: number) {
    for (const rect of ctx.getSelectionRects()) {
      if (
        rowIndex >= rect.minRow &&
        rowIndex <= rect.maxRow &&
        colIndex >= rect.minCol &&
        colIndex <= rect.maxCol
      ) {
        return {
          sourceMinRow: rect.minRow,
          sourceMaxRow: rect.maxRow,
          sourceMinCol: rect.minCol,
          sourceMaxCol: rect.maxCol,
        };
      }
    }
    return null;
  }

  function onMovePointerMove(event: PointerEvent) {
    const d = ctx.moveDrag;
    if (!d) return;
    trackEdgeScroll(event);
    const hit = cellAtPoint(event.clientX, event.clientY);
    // Track the modifier even when the pointer is between cells, so releasing
    // Ctrl over a gap still flips a copy back to a move.
    const copy = event.ctrlKey || event.metaKey;
    if (!hit) {
      if (copy !== d.copy) ctx.moveDrag = { ...d, copy };
      return;
    }
    if (hit.row === d.targetRow && hit.col === d.targetCol && copy === d.copy) return;
    ctx.moveDrag = { ...d, targetRow: hit.row, targetCol: hit.col, copy };
  }

  function onMovePointerUp(event?: PointerEvent) {
    if (!ctx.moveDrag) return;
    // Take the modifier from the RELEASE. Reading it only on pointermove made
    // "drag, then press Ctrl, then let go" a move - which is the natural way
    // to do it, and is a copy in every spreadsheet.
    if (event) {
      const copy = event.ctrlKey || event.metaKey;
      if (copy !== ctx.moveDrag.copy) ctx.moveDrag = { ...ctx.moveDrag, copy };
    }
    applyMoveRange();
  }

  /** Where a move would land, or null when the drag has not left the spot it
   *  started on. Shared by the drop and by the preview marquee so the outline
   *  can never promise a rectangle the drop would refuse. */
  function moveDestRect(d: {
    sourceMinRow: number;
    sourceMaxRow: number;
    sourceMinCol: number;
    sourceMaxCol: number;
    grabRow: number;
    grabCol: number;
    targetRow: number;
    targetCol: number;
  }) {
    const dr = d.targetRow - d.grabRow;
    const dc = d.targetCol - d.grabCol;
    if (dr === 0 && dc === 0) return null;
    const minRow = d.sourceMinRow + dr;
    const maxRow = d.sourceMaxRow + dr;
    const minCol = d.sourceMinCol + dc;
    const maxCol = d.sourceMaxCol + dc;
    if (minRow < 0 || minCol < 0) return null;
    if (maxRow >= ctx.allRows.length) return null;
    if (maxCol >= ctx.allColumns.length) return null;
    return { minRow, maxRow, minCol, maxCol };
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
    if (!dest) return;

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
    const write = (rowIndex: number, colIndex: number, value: unknown) => {
      const column = ctx.allColumns[colIndex];
      if (!column?.columnDef.field) return;
      const before = readCellRaw(rowIndex, column.id);
      if (before === value) return;
      // Resolve the row id BEFORE the write: writeCellRaw swaps in a fresh
      // row object, so an `original`-based lookup afterwards would miss.
      const rowId = ctx.allRows[rowIndex]?.id;
      writeCellRaw(rowIndex, column.id, value);
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

    // One undo entry per changed cell, appended together so a single Ctrl+Z
    // sequence walks the whole move back. Same shape and truncation rule as
    // a whole-row commit.
    if (steps.length) {
      let hist = ctx.history.slice(0, ctx.historyPtr + 1);
      for (const step of steps) hist.push(step);
      if (hist.length > ctx.UNDO_LIMIT) hist = hist.slice(hist.length - ctx.UNDO_LIMIT);
      ctx.history = hist;
      ctx.historyPtr = ctx.history.length - 1;
      ctx.historyVersion += 1;
    }

    // Follow the values: the range stays selected where it landed, so a
    // second drag can chain off the first the way it does in a spreadsheet.
    ctx.selectionRanges = [];
    ctx.selectionRange = {
      anchor: { rowIndex: dest.minRow, colIndex: dest.minCol },
      focus: { rowIndex: dest.maxRow, colIndex: dest.maxCol },
    };
    ctx.setActiveCell(dest.minRow, dest.minCol);
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
    const dataIndexOf = createDataIndexLookup(next);
    for (let r = startRow; r <= endRow; r += 1) {
      const row = ctx.allRows[r];
      if (!row || isGroupRow(row)) continue;
      // By identity, not `Number(row.id)` - that is the array index only under
      // the default getRowId, so a custom one cleared the wrong row.
      const dataIndex = dataIndexOf(row);
      if (dataIndex < 0) continue;
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
    isOnMoveGrabStrip,
    startMoveDrag,
    onMovePointerMove,
    onMovePointerUp,
    trackEdgeScroll,
    stopEdgeScroll,
    applyMoveRange,
    moveDestRect,
    toggleBooleanCell,
    copySelectionToClipboard,
    clearSelectedCells,
    cutSelectionToClipboard,
  };
}
