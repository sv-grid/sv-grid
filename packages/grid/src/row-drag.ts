// Managed row dragging - reorder rows within a grid and move rows between
// grids that share a `rowDragGroup`. "Managed" means the grid mutates its own
// `internalData` on drop (splice out of the source, splice into the target) so
// consumers get working drag-and-drop with zero wiring; an optional
// `onRowDragEnd` callback lets them mirror the change into their own state.
//
// Cross-grid coordination rides on a module-level singleton (`bus`). Because
// every SvGrid instance in a bundle shares this module, the source grid can
// hand the target grid both the dragged row and a closure that removes it from
// the source - the missing half of an HTML5 drag payload, which only carries
// strings. Rows are matched by object identity, so this works without
// `getRowId`.

type RowDragBus = {
  group: string | null;
  gridId: number;
  row: unknown;
  removeFromSource: () => void;
  sourceProps: { onRowDragEnd?: (e: RowDragEndEvent) => void };
};

export type RowDragEndEvent<TData = unknown> = {
  row: TData;
  toIndex: number;
  sameGrid: boolean;
  fromGridId: number;
  toGridId: number;
};

// Shared across all grids in the bundle - this is what makes grid-to-grid work.
let bus: RowDragBus | null = null;
let gridSeq = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRowDrag<TFeatures, TData>(ctx: any) {
  const gridId = ++gridSeq;

  const managed = () => ctx.props.rowDragManaged === true;
  const group = (): string | null => ctx.props.rowDragGroup ?? null;

  function originalAt(rowIndex: number): unknown {
    const r = ctx.allRows[rowIndex];
    return r ? r.original : null;
  }

  // Can THIS grid accept the row currently on the bus? Same grid always may
  // (a reorder); a different grid only when both opt into the same group.
  function canAccept(): boolean {
    if (!managed() || !bus) return false;
    if (bus.gridId === gridId) return true;
    return bus.group != null && bus.group === group();
  }

  // A `dragleave` is not proof the pointer left the drop area. With row
  // virtualization, scrolling to the viewport edge UNMOUNTS the row under the
  // pointer, which fires its `dragleave`; the replacement row does not fire
  // `dragover` until the next frame. Clearing synchronously made the drop
  // indicator flicker off and the target go missing mid-drag (#69).
  //
  // So a leave only schedules the clear, and any `dragover` on a real row
  // cancels it. If the pointer genuinely left, no dragover arrives and the
  // clear lands a frame later - invisible to the user.
  let leaveFrame: number | null = null;

  function cancelPendingLeave() {
    if (leaveFrame === null) return;
    cancelAnimationFrame(leaveFrame);
    leaveFrame = null;
  }

  function clearIndicators() {
    cancelPendingLeave();
    ctx.rowDragActive = false;
    ctx.rowDropIndex = null;
    ctx.rowDropSide = null;
  }

  function emitEnd(row: unknown, toIndex: number, sameGrid: boolean, fromGridId: number) {
    ctx.props.onRowDragEnd?.({
      row,
      toIndex,
      sameGrid,
      fromGridId,
      toGridId: gridId,
    } as RowDragEndEvent<TData>);
  }

  function onRowDragStart(e: DragEvent, rowIndex: number) {
    if (!managed()) return;
    const row = originalAt(rowIndex);
    if (row == null) return;
    bus = {
      group: group(),
      gridId,
      row,
      sourceProps: ctx.props,
      removeFromSource: () => {
        ctx.internalData = (ctx.internalData as unknown[]).filter((r) => r !== row);
      },
    };
    ctx.rowDragActive = true;
    try {
      e.dataTransfer?.setData("text/plain", String(rowIndex));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    } catch {
      // Some environments (tests) provide a partial dataTransfer.
    }
  }

  function onRowDragOver(e: DragEvent, rowIndex: number) {
    if (!canAccept()) return;
    e.preventDefault();
    // We are demonstrably still over a row, so a leave queued by a row that
    // just unmounted underneath us must not fire.
    cancelPendingLeave();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctx.rowDropIndex = rowIndex;
    ctx.rowDropSide = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function onRowDragLeave(rowIndex: number) {
    // A leave from a row that is not the current target is already stale.
    if (ctx.rowDropIndex !== rowIndex) return;
    cancelPendingLeave();
    // No rAF (SSR, or a jsdom without one): fall back to the old synchronous
    // clear rather than leaving a stale indicator forever.
    if (typeof requestAnimationFrame !== "function") {
      ctx.rowDropIndex = null;
      ctx.rowDropSide = null;
      return;
    }
    leaveFrame = requestAnimationFrame(() => {
      leaveFrame = null;
      // Re-check: an intervening dragover may have moved the target to another
      // row, in which case this leave is stale and must not clear it.
      if (ctx.rowDropIndex !== rowIndex) return;
      ctx.rowDropIndex = null;
      ctx.rowDropSide = null;
    });
  }

  /**
   * Splice the dragged row into position, for a drop on `rowIndex`.
   *
   * Input-agnostic on purpose: HTML5 `drop` and the pointer/touch path (#66)
   * both land here, so the reorder, the cross-grid hand-off and the
   * `onRowDragEnd` payload have exactly one implementation.
   */
  function commitDropOnRow(rowIndex: number, side: "before" | "after") {
    if (!canAccept() || !bus) return;
    const dragged = bus.row;
    const target = originalAt(rowIndex);
    const sourceGridId = bus.gridId;
    const sameGrid = sourceGridId === gridId;
    clearIndicators();

    const data = (ctx.internalData as unknown[]).slice();
    if (sameGrid) {
      const from = data.indexOf(dragged);
      if (from < 0) {
        bus = null;
        return;
      }
      data.splice(from, 1);
    }
    let to = target != null ? data.indexOf(target) : data.length;
    if (to < 0) to = data.length;
    if (side === "after") to += 1;
    data.splice(to, 0, dragged);
    ctx.internalData = data;
    if (!sameGrid) bus.removeFromSource();
    emitEnd(dragged, to, sameGrid, sourceGridId);
    bus = null;
  }

  function onRowDrop(e: DragEvent, rowIndex: number) {
    if (!canAccept() || !bus) return;
    e.preventDefault();
    e.stopPropagation(); // don't let the tbody handler also fire (end-append)
    commitDropOnRow(rowIndex, ctx.rowDropSide ?? "before");
  }

  // Dropping in the empty area below the last row, or into an empty target
  // grid, appends. Row-level drops call stopPropagation so this only fires for
  // genuine empty-space drops.
  function onRowsContainerDragOver(e: DragEvent) {
    if (!canAccept()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }

  function onRowsContainerDrop(e: DragEvent) {
    if (!canAccept() || !bus) return;
    e.preventDefault();
    const dragged = bus.row;
    const sourceGridId = bus.gridId;
    const sameGrid = sourceGridId === gridId;
    clearIndicators();

    const data = (ctx.internalData as unknown[]).slice();
    if (sameGrid) {
      const from = data.indexOf(dragged);
      if (from >= 0) data.splice(from, 1);
    }
    data.push(dragged);
    ctx.internalData = data;
    if (!sameGrid) bus.removeFromSource();
    emitEnd(dragged, data.length - 1, sameGrid, sourceGridId);
    bus = null;
  }

  function onRowDragEnd() {
    clearIndicators();
    bus = null;
  }

  // Touch drag (#66) lives in its own module and is fetched on the first touch
  // that lands on a draggable row, so desktop never downloads it. The 350 ms
  // long press inside it more than covers the fetch - the drag cannot start
  // before that elapses anyway.
  let touchDrag: import("./row-drag-touch").TouchDragHandle | null = null;
  let touchLoading = false;

  function touchDeps() {
    return {
      ctx,
      managed,
      originalAt,
      commitDropOnRow,
      clearIndicators,
      cancelPendingLeave,
      openBus: (row: unknown) => {
        bus = {
          group: group(),
          gridId,
          row,
          sourceProps: ctx.props,
          removeFromSource: () => {
            ctx.internalData = (ctx.internalData as unknown[]).filter((r) => r !== row);
          },
        };
      },
      closeBus: () => {
        bus = null;
      },
    };
  }

  /**
   * Start of a possible touch drag. Ignores mouse and pen so the HTML5 drag
   * handlers above keep owning those inputs.
   */
  function onRowPointerDown(e: PointerEvent, rowIndex: number) {
    if (!managed() || e.pointerType !== "touch") return;
    if (touchDrag) {
      touchDrag.start(e, rowIndex);
      return;
    }
    if (touchLoading) return;
    touchLoading = true;

    // The touch module is not here yet, so nothing is listening. Watch the
    // gesture ourselves for the length of the fetch: if the finger moves (a
    // scroll) or lifts (a tap) before the module lands, the drag must not start
    // when it does - otherwise the fetch window silently swallows the user's
    // scroll and we hijack it.
    const pid = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let aborted = false;
    function stopWatching() {
      window.removeEventListener("pointermove", onEarlyMove);
      window.removeEventListener("pointerup", onEarlyEnd);
      window.removeEventListener("pointercancel", onEarlyEnd);
    }
    function onEarlyMove(ev: PointerEvent) {
      if (ev.pointerId !== pid) return;
      // Same slop the touch module uses once it owns the gesture.
      if (Math.abs(ev.clientY - startY) + Math.abs(ev.clientX - startX) > 10) {
        aborted = true;
        stopWatching();
      }
    }
    function onEarlyEnd(ev: PointerEvent) {
      if (ev.pointerId !== pid) return;
      aborted = true;
      stopWatching();
    }
    window.addEventListener("pointermove", onEarlyMove, { passive: true });
    window.addEventListener("pointerup", onEarlyEnd);
    window.addEventListener("pointercancel", onEarlyEnd);

    // The event object is pooled in some engines, so capture what start() needs
    // before yielding to the import.
    const snapshot = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      clientX: e.clientX,
      clientY: e.clientY,
      currentTarget: e.currentTarget,
      preventDefault: () => {},
    } as unknown as PointerEvent;
    void import("./row-drag-touch").then((m) => {
      touchLoading = false;
      stopWatching();
      if (aborted || !managed()) return;
      touchDrag = m.createTouchDrag(touchDeps());
      touchDrag.start(snapshot, rowIndex);
    });
  }

  return {
    onRowDragStart,
    onRowDragOver,
    onRowDragLeave,
    onRowDrop,
    onRowsContainerDragOver,
    onRowsContainerDrop,
    onRowDragEnd,
    /** Touch entry point (#66) - see the pointer-drag block above. */
    onRowPointerDown,
    rowDragGridId: gridId,
    /**
     * Clear any managed drag this grid currently owns. Call on unmount so an
     * interrupted drag (route change / `{#if}` toggle mid-drag) doesn't leave a
     * stale module-level `bus` that fires `removeFromSource` against a destroyed
     * grid's data on the next grid instance (#68). Guarded by `gridId` so it
     * never disturbs a concurrent drag owned by another grid.
     */
    destroyRowDrag() {
      // Also drop any deferred leave: it would otherwise fire a frame later and
      // write indicator state into a controller whose grid is gone.
      cancelPendingLeave();
      // ...and tear down an in-flight touch drag, which owns window listeners,
      // a long-press timer and an autoscroll frame.
      touchDrag?.destroy();
      touchDrag = null;
      if (bus?.gridId === gridId) bus = null;
    },
  };
}

/** Options for the {@link rowDropZone} action. */
export type RowDropZoneOptions<TData = unknown> = {
  /**
   * Only accept rows dragged from a grid with this `rowDragGroup`. Omit to
   * accept a managed row drag from any grid.
   */
  group?: string;
  /**
   * Called when a managed row is dropped on the element. The row has already
   * been removed from its source grid; add it to your own list/state here.
   */
  onDrop: (payload: { row: TData; fromGridId: number }) => void;
  /** Class toggled on the element while a matching row is dragged over it. */
  overClass?: string;
};

/**
 * Svelte action turning ANY element into an external drop target for managed
 * row dragging - a trash can, an "assign to" bucket, a second pane. Attach with
 * `use:rowDropZone={{ group, onDrop }}`. On drop the dragged row is removed from
 * its source grid and handed to `onDrop`.
 *
 * ```svelte
 * <div use:rowDropZone={{ group: 'board', onDrop: (e) => archive(e.row) }}>Archive</div>
 * ```
 */
export function rowDropZone<TData = unknown>(
  node: HTMLElement,
  options: RowDropZoneOptions<TData>,
) {
  let opts = options;
  const cls = () => opts.overClass ?? "sv-grid-row-dropzone-over";

  function matches(): boolean {
    if (!bus) return false;
    return opts.group == null || bus.group === opts.group;
  }
  function onOver(e: DragEvent) {
    if (!matches()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    node.classList.add(cls());
  }
  function onLeave() {
    node.classList.remove(cls());
  }
  function onDrop(e: DragEvent) {
    if (!matches() || !bus) return;
    e.preventDefault();
    e.stopPropagation();
    node.classList.remove(cls());
    const row = bus.row as TData;
    const fromGridId = bus.gridId;
    bus.removeFromSource();
    bus = null;
    opts.onDrop({ row, fromGridId });
  }

  node.addEventListener("dragover", onOver);
  node.addEventListener("dragleave", onLeave);
  node.addEventListener("drop", onDrop);
  return {
    update(next: RowDropZoneOptions<TData>) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("dragover", onOver);
      node.removeEventListener("dragleave", onLeave);
      node.removeEventListener("drop", onDrop);
    },
  };
}
