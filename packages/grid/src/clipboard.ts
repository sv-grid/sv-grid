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
import {
  getCellKey,
} from "./SvGrid.helpers";
import {
  rowsToWrite,
  getColumnBaseValue,
  isGroupRow,
  landWrites,
  toolPanelHeaderLabel,
} from "./cell-values";
import { pushHistory, nextGroupId, runHistoryGroup, type HistoryStep } from "./history";
import { getGridExtension } from "./grid-extension.svelte";

// What a drag writes when it ends (a fill, a range move) is the largest part
// of this file and runs only after a drag: it loads when the drag starts, so
// it is here by the release. A grid nobody drags on never fetches it.
let rangeCommit: typeof import("./range-commit") | undefined;
export const loadRangeCommit = () => import("./range-commit").then((m) => (rangeCommit = m));

export function createClipboard<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
>(ctx: any) {
  const claimed = (kind: "copy" | "cut" | "clear") => getGridExtension()?.rangeAction?.(ctx, { kind });
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
    writeCellsRaw([{ rowIndex, columnId, value }]);
  }

  /**
   * Several cells in one write. `rowIndex` is a position in the rows as they
   * stand when this is called: every row is found before the first value lands,
   * because the rows are handed over once, at the end, and a sorted or filtered
   * view orders them again at that moment. A loop of `writeCellRaw` over
   * positions wrote its later cells to whatever had moved into those places.
   *
   * Later cells of the same row build on earlier ones; `onCellValueChange` fires
   * per cell once they have all landed, each with the row as it ended up.
   */
  function writeCellsRaw(cells: ReadonlyArray<{ rowIndex: number; columnId: string; value: unknown }>) {
    // The slot in `data` backing each displayed row, read BEFORE internalData
    // swaps: afterwards `allRows` references the new row objects.
    const { next, dataIndexOf } = rowsToWrite<TData>(ctx);
    const writes: Array<{ at: number; rowId: string; columnId: string; value: unknown; oldValue: unknown }> = [];
    for (const { rowIndex, columnId, value } of cells) {
      const shown = ctx.allRows[rowIndex];
      const field = ctx.findColumnById(columnId)?.columnDef.field;
      if (!shown || !field) continue;
      const at = dataIndexOf(shown);
      const row = next[at] as Record<string, unknown> | undefined;
      if (!row || row[field] === value) continue;
      writes.push({ at, rowId: shown.id, columnId, value, oldValue: row[field] });
      next[at] = { ...row, [field]: value } as TData;
    }
    if (!writes.length) return;
    for (const w of writes) getGridExtension()?.cellEdited?.(ctx, { row: next[w.at], columnId: w.columnId, rowId: w.rowId });
    const rows = landWrites(ctx, next, writes);
    const edits = { ...ctx.editedCellValues };
    for (const w of writes) if (w.rowId) edits[getCellKey(w.rowId, w.columnId)] = w.value;
    ctx.editedCellValues = edits;
    for (const w of writes) {
      ctx.props.onCellValueChange?.({
        // The position in `props.data`, matching what the inline editor reports.
        rowIndex: w.at,
        columnId: w.columnId,
        oldValue: w.oldValue,
        newValue: w.value,
        row: rows[w.at] as TData,
      });
    }
  }

  /** Run one of the drag commits, at once when range-commit.ts is here, else when it lands. */
  function commit(run: (c: ReturnType<typeof import("./range-commit").createRangeCommit>) => void) {
    const go = (m: typeof import("./range-commit")) =>
      run(m.createRangeCommit(ctx, readCellRaw, writeCellsRaw, moveDestRect, stopEdgeScroll));
    if (rangeCommit) go(rangeCommit);
    else void loadRangeCommit().then(go);
  }
  function applyFillPattern(toggled = false) {
    commit((c) => c.applyFillPattern(toggled));
  }
  function fillDownToNeighbour() {
    commit((c) => c.fillDownToNeighbour());
  }
  // Two presses on the handle mean "fill down".
  let handlePressedAt = -Infinity;
  let handlePressedTwice = false;
  // Where the last press on a cell landed: every one passes through startMoveDrag.
  let cellPressX = -Infinity;
  let cellPressY = -Infinity;
  function applyMoveRange() {
    commit((c) => c.applyMoveRange());
  }

  /** Clear the underlying value of every cell in the current selection
   *  range (or just the active cell when nothing is range-selected).
   *  Mirrors Excel's `Delete` key - values go to `null`, formatting and
   *  the row identity stay intact. */
  function clearSelectedCellValues() {
    if (claimed("clear")) return;
    const anchor = ctx.selectionRange.anchor;
    const focus = ctx.selectionRange.focus;
    if (anchor && focus) {
      const minRow = Math.min(anchor.rowIndex, focus.rowIndex);
      const maxRow = Math.max(anchor.rowIndex, focus.rowIndex);
      const minCol = Math.min(anchor.colIndex, focus.colIndex);
      const maxCol = Math.max(anchor.colIndex, focus.colIndex);
      const cells: Array<{ rowIndex: number; columnId: string; value: unknown }> = [];
      for (let r = minRow; r <= maxRow; r += 1) {
        if (ctx.isRowCollapsed?.(r)) continue;
        for (let c = minCol; c <= maxCol; c += 1) {
          const col = ctx.allColumns[c];
          if (col && ctx.collapsedColumns?.[col.id]) continue;
          if (col?.columnDef.field && ctx.isCellEditableAt(r, c)) {
            cells.push({ rowIndex: r, columnId: col.id, value: null });
          }
        }
      }
      writeCellsRaw(cells);
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
    // A double-click on a cell draws the handle under its first press, and its
    // second lands on the handle. That press is the cell's: it goes on to it.
    // Only one in the same spot: a click in the cell and a quick reach for the
    // handle is a fill.
    const shown = Number((event.currentTarget as HTMLElement | null)?.dataset?.shownAt ?? -Infinity);
    if (event.timeStamp - shown < 400 && Math.abs(event.clientX - cellPressX) < 5 && Math.abs(event.clientY - cellPressY) < 5) {
      handlePressedTwice = false;
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    handlePressedTwice = event.timeStamp - handlePressedAt < 600;
    handlePressedAt = event.timeStamp;
    void loadRangeCommit();
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
    // The edge scroll's re-target, which points the fill at the cell under the pointer.
    retargetDrag(event.clientX, event.clientY);
  }

  /**
   * The release. Excel's Ctrl turns the fill the other way: a series
   * becomes a copy of the block, and one number, which copies on its own,
   * becomes a series stepping by one. The modifier is read here, at the
   * release, so holding Ctrl only at the end still counts, as in Excel.
   */
  function onFillPointerUp(event?: PointerEvent) {
    if (!ctx.fillDrag) return;
    applyFillPattern(!!(event && (event.ctrlKey || event.metaKey)));
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
    cellPressX = event.clientX;
    cellPressY = event.clientY;
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
    void loadRangeCommit();
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
   * Click or Space on a checkbox cell. This is an edit like any other, so it
   * takes the same steps as committing the inline editor: write the row, one
   * undo step, then `onCellValueChange`. It used to write `row.original` and
   * stop there, so an app saving edits from that callback lost every checkbox
   * change, and Ctrl+Z could not take one back.
   */
  function toggleBooleanCell(rowIndex: number, colIndex: number) {
    const row = ctx.allRows[rowIndex];
    const column = ctx.allColumns[colIndex];
    if (!row || !column) return;
    const field = column.columnDef.field;
    if (!field) return;

    const rowData = row.original as Record<string, unknown>;
    const oldValue = rowData[field];
    const baseValue = getColumnBaseValue(row, column);
    const currentValue = Boolean(
      ctx.getCellDisplayValue(row.id, column.id, baseValue),
    );
    const nextValue = !currentValue;

    // One group, as saveEditingCell does: a step the consumer's callback
    // records belongs to the same Ctrl+Z as the toggle.
    runHistoryGroup(ctx, () => {
      rowData[field] = nextValue;
      const key = getCellKey(row.id, column.id);
      ctx.editedCellValues = {
        ...ctx.editedCellValues,
        [key]: nextValue,
      };
      ctx.grid.store.setState((prev: any) => ({ ...prev }));
      getGridExtension()?.cellEdited?.(ctx, { row: rowData, columnId: column.id, rowId: row.id });
      // The display can disagree with the row when an edit overlay is set;
      // flipping it back to what the row already holds changes no data.
      if (oldValue === nextValue) return;
      pushHistory(ctx, [{ rowId: row.id, columnId: column.id, field, before: oldValue, after: nextValue }]);
      // `rowIndex` is the position in `props.data`, as the inline editor reports it.
      ctx.props.onCellValueChange?.({
        rowIndex: ctx.internalData.indexOf(rowData as TData),
        columnId: column.id,
        oldValue,
        newValue: nextValue,
        row: rowData as TData,
      });
    });
  }

  /**
   * Write text to the OS clipboard, with a legacy fallback for insecure
   * contexts. The async Clipboard API requires a secure context (HTTPS or
   * localhost); on plain HTTP - e.g. a grid served by XAMPP/Apache over a LAN
   * host - `navigator.clipboard` is undefined and copy/cut would silently do
   * nothing. There we fall back to a temporary <textarea> + execCommand('copy'),
   * which still works in an insecure context. This MUST be called synchronously
   * from the user gesture (the keydown handler) so execCommand is allowed.
   * Resolves true once the text is on the clipboard: a cut waits for that.
   */
  async function writeClipboardText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Refused: the textarea copy below may still take it.
      }
    }
    return legacyCopyText(text);
  }

  /**
   * Text and HTML together. The `copy` event is the first path: a listener
   * armed for this one call puts both types on the event's clipboardData
   * while the legacy textarea copy runs, which works in a secure and an
   * insecure context alike and keeps every attribute of the HTML. Only when
   * the browser refuses that does the async `ClipboardItem` write run, and
   * text alone after that.
   */
  async function writeClipboard(text: string, html: string): Promise<boolean> {
    if (typeof document !== "undefined") {
      let armed = true;
      const onCopy = (event: ClipboardEvent) => {
        if (!armed || !event.clipboardData) return;
        armed = false;
        event.clipboardData.setData("text/plain", text);
        event.clipboardData.setData("text/html", html);
        event.preventDefault();
      };
      document.addEventListener("copy", onCopy, { once: true, capture: true });
      const ok = legacyCopyText(text);
      document.removeEventListener("copy", onCopy, { capture: true });
      if (ok && !armed) return true;
    }
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      try {
        await navigator.clipboard.write([item]);
        return true;
      } catch {
        // Refused: text alone, below.
      }
    }
    return writeClipboardText(text);
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
    if (claimed("copy")) return;
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
    const copyCollapsed = ctx.props.includeCollapsedRows as ((rowIndex: number) => boolean) | undefined;
    const blocks: Array<string> = [];
    for (const rect of rects) {
      const lines: Array<string> = [];
      if (withHeaders) {
        const header: Array<string> = [];
        for (let c = rect.minCol; c <= rect.maxCol; c += 1) {
          const column = ctx.allColumns[c];
          if (column && ctx.collapsedColumns?.[column.id]) continue;
          header.push(column ? toolPanelHeaderLabel(column) : "");
        }
        lines.push(header.join("\t"));
      }
      for (let r = rect.minRow; r <= rect.maxRow; r += 1) {
        const row = ctx.allRows[r];
        if (!row || isGroupRow(row)) continue;
        // A collapsed row is folded to nothing: the user cannot see it and
        // the keyboard walks past it, so a copy leaves it out too. That is
        // what a spreadsheet does with a filtered row, and it is what makes
        // "filter, copy, paste" carry the rows that matched. A consumer that
        // tells hidden from filtered answers per row (`includeCollapsedRows`):
        // Excel copies a row hidden by hand.
        if (ctx.isRowCollapsed?.(r) && !copyCollapsed?.(r)) continue;
        const cells: Array<string> = [];
        for (let c = rect.minCol; c <= rect.maxCol; c += 1) {
          const column = ctx.allColumns[c];
          if (!column) {
            cells.push("");
            continue;
          }
          if (ctx.collapsedColumns?.[column.id]) continue;
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
    const text = blocks.join("\n\n");
    const toHtml = ctx.props.clipboardHtml as
      | ((params: { rects: typeof rects; text: string }) => string | null | undefined)
      | undefined;
    const html = toHtml?.({ rects, text });
    return html ? writeClipboard(text, html) : writeClipboardText(text);
  }

  /**
   * Clear every editable cell in the current selection range. Used by
   * Ctrl/Cmd+X (after a copy) and by the Delete / Backspace keys.
   * Returns true if the range held a cell it may clear, empty or not - the
   * caller uses that to decide whether to call `preventDefault()`.
   */
  function clearSelectedCells(): boolean {
    if (claimed("clear")) return true;
    const anchor = ctx.selectionRange.anchor ?? ctx.grid.getState().activeCell;
    if (!anchor) return false;
    const focus = ctx.selectionRange.focus ?? anchor;
    const startRow = Math.min(anchor.rowIndex, focus.rowIndex);
    const startCol = Math.min(anchor.colIndex, focus.colIndex);
    const endRow   = Math.max(anchor.rowIndex, focus.rowIndex);
    const endCol   = Math.max(anchor.colIndex, focus.colIndex);

    const { next, dataIndexOf } = rowsToWrite<TData>(ctx);
    let mutated = false;
    const changes: Array<{
      rowIndex: number
      columnId: string
      oldValue: unknown
      newValue: unknown
      row: TData
    }> = [];
    // One history step per cleared cell, grouped, so Delete over a block is
    // one Ctrl+Z. Clearing used to record nothing at all: the values were
    // gone and undo skipped straight past them to whatever came before.
    const steps: HistoryStep[] = [];
    let clearable = false;
    for (let r = startRow; r <= endRow; r += 1) {
      const row = ctx.allRows[r];
      if (!row || isGroupRow(row)) continue;
      // A collapsed row is not there as far as the user is concerned, and a
      // Delete over a filtered block must not wipe what the filter hid.
      if (ctx.isRowCollapsed?.(r)) continue;
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
        if (ctx.collapsedColumns?.[column.id]) continue;
        if (!ctx.isCellEditableAt(r, c)) continue;
        // Clear means: empty string for text, undefined for everything
        // else. parseEditorValue handles the per-type coercion.
        const editorType = (column.columnDef.editorType ??
          "text") as CellEditorType;
        const field = column.columnDef.field;
        const oldValue = updated[field];
        // A number goes to null, not through the parser: `Number("")` is 0,
        // so a cleared Revenue cell used to read "$0" instead of empty.
        const cleared = editorType === "number" ? null : parseEditorValue(editorType, "");
        clearable = true;
        // Already empty: no write, and no step for Ctrl+Z to spend on nothing.
        if ((oldValue ?? "") === (cleared ?? "") || (Array.isArray(oldValue) && !oldValue.length)) continue;
        updated[field] = cleared;
        rowChanged = true;
        steps.push({ rowId: row.id, columnId: column.id, field, before: oldValue, after: cleared });
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
      changes.forEach((ch, i) => getGridExtension()?.cellEdited?.(ctx, { row: ch.row, columnId: ch.columnId, rowId: steps[i]!.rowId }));
      const rows = landWrites(ctx, next, changes.map((ch, i) => ({ at: ch.rowIndex, rowId: steps[i]!.rowId, columnId: ch.columnId, value: ch.newValue })));
      ctx.grid.store.setState((prev: any) => ({ ...prev }));
      pushHistory(ctx, steps, nextGroupId());
      // Fire onCellValueChange per cleared cell - same as paste's writeCellRaw -
      // so consumers (formula engines, autosave) recompute. Clear IS a value
      // change; without this, a HyperFormula-backed grid wouldn't re-evaluate.
      if (ctx.props.onCellValueChange) {
        for (const ch of changes) ctx.props.onCellValueChange({ ...ch, row: rows[ch.rowIndex] as TData });
      }
    }
    return clearable;
  }

  async function cutSelectionToClipboard(): Promise<void> {
    if (claimed("cut")) return;
    // Cut = copy + clear, and the clear waits for the copy. A clipboard that
    // refused the text (a page without focus, a denied permission) clears
    // nothing, and neither does a selection that moved while it was written:
    // a cut never clears what it did not copy.
    const at = ctx.selectionRange;
    if ((await copySelectionToClipboard()) && ctx.selectionRange === at) clearSelectedCells();
  }

  return {
    readCellRaw,
    writeCellRaw,
    writeCellsRaw,
    applyFillPattern,
    clearSelectedCellValues,
    startFillDrag,
    onFillPointerMove,
    onFillPointerUp,
    fillDownToNeighbour,
    fillHandlePressedTwice: () => handlePressedTwice,
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
