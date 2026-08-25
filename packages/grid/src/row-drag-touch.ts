// Touch / pointer row dragging (#66).
//
// HTML5 drag events do not exist for touch input on iOS Safari or Android
// Chrome - `dragstart` never fires - so the drag path in `row-drag.ts` is dead
// on a phone. This is a second INPUT path onto the same model: it populates the
// same cross-grid `bus` and the same `rowDropIndex` / `rowDropSide`, and commits
// through the same `commitDropOnRow`, so reorder, cross-grid hand-off and the
// `onRowDragEnd` payload cannot drift between mouse and touch.
//
// Loaded with `import()` on the first touch that lands on a draggable row, so
// desktop users never download it. The 350 ms long press below more than covers
// the fetch, and the drag cannot begin before it elapses anyway.
//
// A touch that starts on a row must still be able to SCROLL the grid, so the
// drag only begins after a long press; moving before that threshold hands the
// gesture back to the browser.

/** Everything the touch path needs from the `createRowDrag` closure. */
export type TouchDragDeps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any;
  managed: () => boolean;
  originalAt: (rowIndex: number) => unknown;
  commitDropOnRow: (rowIndex: number, side: "before" | "after") => void;
  clearIndicators: () => void;
  cancelPendingLeave: () => void;
  /** Publish the dragged row on the shared cross-grid bus. */
  openBus: (row: unknown) => void;
  closeBus: () => void;
};

const LONG_PRESS_MS = 350;
/** Movement (px) before the long press is treated as a scroll instead. */
const SCROLL_SLOP_PX = 10;
/** Distance from an edge (px) at which the grid starts auto-scrolling. */
const EDGE_PX = 48;
const EDGE_SPEED_PX = 12;

type TouchState = {
  pointerId: number;
  rowIndex: number;
  startX: number;
  startY: number;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  scrollFrame: number | null;
  scroller: HTMLElement | null;
  root: HTMLElement | null;
};

/** What {@link createTouchDrag} returns. */
export type TouchDragHandle = {
  start: (e: PointerEvent, rowIndex: number) => void;
  destroy: () => void;
};

export function createTouchDrag(deps: TouchDragDeps): TouchDragHandle {
  const { ctx } = deps;
  let touch: TouchState | null = null;

  /** Resolve the row under a viewport point, and which half of it. */
  function rowAtPoint(x: number, y: number): { index: number; side: "before" | "after" } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const tr = el?.closest?.("tr.sv-grid-row") as HTMLElement | null;
    if (!tr) return null;
    const marker = tr.querySelector<HTMLElement>("[data-svgrid-row]");
    const raw = marker?.dataset.svgridRow;
    if (raw == null) return null;
    const index = Number(raw);
    if (!Number.isFinite(index)) return null;
    const rect = tr.getBoundingClientRect();
    return { index, side: y < rect.top + rect.height / 2 ? "before" : "after" };
  }

  function stopEdgeScroll() {
    if (touch?.scrollFrame != null) {
      cancelAnimationFrame(touch.scrollFrame);
      touch.scrollFrame = null;
    }
  }

  /** Keep scrolling while the finger is parked near the top or bottom edge. */
  function edgeScroll(clientY: number) {
    const scroller = touch?.scroller;
    if (!touch || !scroller) return;
    const rect = scroller.getBoundingClientRect();
    let dy = 0;
    if (clientY < rect.top + EDGE_PX) dy = -EDGE_SPEED_PX;
    else if (clientY > rect.bottom - EDGE_PX) dy = EDGE_SPEED_PX;
    stopEdgeScroll();
    if (dy === 0) return;
    const step = () => {
      if (!touch?.started) return;
      scroller.scrollTop += dy;
      // Re-hit-test as rows move under a stationary finger, otherwise the
      // indicator freezes on whichever row happened to be there at touch time.
      const hit = rowAtPoint(touch.startX, clientY);
      if (hit) {
        ctx.rowDropIndex = hit.index;
        ctx.rowDropSide = hit.side;
      }
      touch.scrollFrame = requestAnimationFrame(step);
    };
    touch.scrollFrame = requestAnimationFrame(step);
  }

  // `pointermove.preventDefault()` does NOT stop iOS scrolling; only a
  // non-passive `touchmove` does. Registered for the life of the drag.
  function blockTouchScroll(e: TouchEvent) {
    if (touch?.started) e.preventDefault();
  }

  function detach() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("touchmove", blockTouchScroll);
  }

  function end(commit: boolean) {
    if (!touch) return;
    const t = touch;
    if (t.timer) clearTimeout(t.timer);
    stopEdgeScroll();
    touch = null;
    detach();
    t.root?.classList.remove("sv-grid-row-drag-active");
    if (!t.started) return;
    if (commit && ctx.rowDropIndex != null) {
      deps.commitDropOnRow(
        ctx.rowDropIndex as number,
        (ctx.rowDropSide ?? "before") as "before" | "after",
      );
    } else {
      deps.clearIndicators();
      deps.closeBus();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!touch || e.pointerId !== touch.pointerId) return;
    if (!touch.started) {
      // Still inside the long press: a real move means the user is scrolling.
      const moved = Math.abs(e.clientY - touch.startY) + Math.abs(e.clientX - touch.startX);
      if (moved > SCROLL_SLOP_PX) end(false);
      return;
    }
    e.preventDefault();
    const hit = rowAtPoint(e.clientX, e.clientY);
    if (hit) {
      deps.cancelPendingLeave();
      ctx.rowDropIndex = hit.index;
      ctx.rowDropSide = hit.side;
    }
    touch.startX = e.clientX;
    edgeScroll(e.clientY);
  }

  function onPointerUp(e: PointerEvent) {
    if (!touch || e.pointerId !== touch.pointerId) return;
    end(true);
  }

  function onPointerCancel(e: PointerEvent) {
    if (!touch || e.pointerId !== touch.pointerId) return;
    end(false);
  }

  return {
    /** Begin a press that may become a drag. Caller has already checked touch. */
    start(e: PointerEvent, rowIndex: number) {
      if (!deps.managed() || touch) return;
      const row = deps.originalAt(rowIndex);
      if (row == null) return;
      const target = e.currentTarget as HTMLElement | null;
      touch = {
        pointerId: e.pointerId,
        rowIndex,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        timer: null,
        scrollFrame: null,
        scroller: target?.closest?.<HTMLElement>(".sv-grid-container") ?? null,
        root: target?.closest?.<HTMLElement>(".sv-grid-root") ?? null,
      };
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("touchmove", blockTouchScroll, { passive: false });
      touch.timer = setTimeout(() => {
        if (!touch) return;
        touch.started = true;
        touch.timer = null;
        touch.root?.classList.add("sv-grid-row-drag-active");
        try {
          target?.setPointerCapture?.(e.pointerId);
        } catch {
          // Not every environment implements pointer capture (tests, old WebViews).
        }
        deps.openBus(row);
        ctx.rowDragActive = true;
        ctx.rowDropIndex = rowIndex;
        ctx.rowDropSide = "before";
      }, LONG_PRESS_MS);
    },
    destroy() {
      end(false);
    },
  };
}
