/**
 * Where a pointer-anchored panel (a context menu, the "+N more" list) should
 * sit so all of it is on screen.
 *
 * The scheduler and Gantt menus open at the pointer. A right-click near the
 * bottom or right edge put their lower items outside the viewport, where they
 * could not be clicked. The panel goes above the pointer when it does not fit
 * below it, and is pulled back from the right edge when it does not fit there.
 * The result for a position it returns is that same position, so an effect
 * that writes it back settles after one pass.
 *
 * Internal: not exported from the package index.
 */
export function keepOnScreen(
  pos: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  pad = 8,
): { x: number; y: number } {
  let { x, y } = pos
  // Above the pointer, but never lower than "bottom edge minus padding": a
  // plain flip of a point within `pad` of the bottom would still overflow by
  // a few pixels and flip again on the next pass.
  if (y + size.height > viewport.height - pad) y = Math.max(pad, Math.min(y - size.height, viewport.height - size.height - pad))
  if (x + size.width > viewport.width - pad) x = Math.max(pad, viewport.width - size.width - pad)
  return { x, y }
}
