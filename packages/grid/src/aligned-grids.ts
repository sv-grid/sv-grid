// Aligned grids - keep two or more independent grids in lockstep on horizontal
// scroll and column widths. Grids that share the same `alignedGridGroup` string
// register with a module-level registry (same pattern as managed row dragging);
// when one scrolls horizontally or a column is resized, the others follow.
//
// Loop-safety without flags: scroll sync no-ops when the target already has the
// value (so the echo scroll event never fires); width sync compares a serialized
// snapshot and pre-seeds it on apply, so the reactive effect that fires after
// applying a peer's widths sees "no change" and doesn't echo.

type Member = {
  id: number;
  applyScroll: (left: number) => void;
  applyWidths: (widths: Record<string, number>) => void;
};

// Shared across every grid in the bundle.
const groups = new Map<string, Map<number, Member>>();
let seq = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAlignedGrids<TFeatures, TData>(ctx: any) {
  const id = ++seq;
  let lastWidthsSerial = "";

  const group = (): string | null => ctx.props.alignedGridGroup ?? null;

  function peers(): Member[] {
    const g = group();
    if (!g) return [];
    const m = groups.get(g);
    if (!m) return [];
    const out: Member[] = [];
    for (const member of m.values()) if (member.id !== id) out.push(member);
    return out;
  }

  const self: Member = {
    id,
    applyScroll(left: number) {
      const el = ctx.scrollContainer as HTMLElement | null;
      // Only set when it differs, so no echo scroll event fires -> no loop.
      if (el && el.scrollLeft !== left) el.scrollLeft = left;
    },
    applyWidths(widths: Record<string, number>) {
      const merged = { ...(ctx.columnWidths as Record<string, number>), ...widths };
      // Pre-seed the serial so the columnWidths effect that fires after this
      // set sees an unchanged snapshot and skips its own broadcast.
      lastWidthsSerial = JSON.stringify(merged);
      ctx.columnWidths = merged;
    },
  };

  // Register on mount; returns the unregister for the effect's cleanup.
  function register(): () => void {
    const g = group();
    if (!g) return () => {};
    let m = groups.get(g);
    if (!m) {
      m = new Map();
      groups.set(g, m);
    }
    m.set(id, self);
    return () => {
      const mm = groups.get(g);
      if (!mm) return;
      mm.delete(id);
      if (!mm.size) groups.delete(g);
    };
  }

  function broadcastScroll(left: number) {
    const p = peers();
    for (const member of p) member.applyScroll(left);
  }

  function broadcastWidths() {
    if (!group()) return;
    const serial = JSON.stringify((ctx.columnWidths as Record<string, number>) ?? {});
    if (serial === lastWidthsSerial) return; // nothing new (or echo of an apply)
    lastWidthsSerial = serial;
    const w = ctx.columnWidths as Record<string, number>;
    for (const member of peers()) member.applyWidths(w);
  }

  return { register, broadcastScroll, broadcastWidths, alignedGridId: id };
}
