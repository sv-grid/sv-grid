// Pure math for "huge list" vertical scroll scaling.
//
// Browsers cap how tall a single element may be (Chrome/Safari ~33.5M px,
// Firefox ~17.9M, mobile/high-DPR lower). Once a virtualized grid's true
// content height (count * rowHeight) exceeds that cap the scroll container
// silently clamps its scrollHeight and the tail rows become unreachable - a
// 1,000,000-row grid that only scrolls to ~994,000 on a phone.
//
// The fix (the technique react-virtualized calls "scaling"): size the DOM
// scroll spacer to a capped height the browser CAN render, and map between the
// limited DOM scroll range and the full logical range the virtualizer works
// in. This module is the pure, side-effect-free core of that mapping so the
// invariants can be unit-tested independently of the Svelte controller.
//
// When the true height fits under the cap, scaling is INERT: every mapping is
// the identity and callers behave exactly as before.

export type RowScrollScaling = {
  /** True when the true content height exceeds the cap and mapping applies. */
  readonly active: boolean
  /** Height (px) the DOM scroll spacer should occupy - capped at maxDomHeight. */
  readonly domTotal: number
  /** Map a DOM scrollTop into the virtualizer's logical scroll offset. */
  domToLogical(domTop: number): number
  /** Map a virtualizer logical offset back into a DOM scrollTop. */
  logicalToDom(logical: number): number
}

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

/**
 * Build the scaling mapping for one axis.
 *
 * @param trueTotal     The real content height in logical px (count * rowH, or
 *                      the cumulative offset total for variable rows).
 * @param maxDomHeight  The browser's max element height (detected at runtime).
 * @param viewport      The scroll viewport height in px.
 *
 * Invariants (verified in scroll-scaling.test.ts):
 *  - Inert when `trueTotal <= maxDomHeight`: both maps are the identity.
 *  - `domTotal <= maxDomHeight` always, so the spacer never exceeds the cap.
 *  - Endpoints line up: domTop 0 -> logical 0, and the DOM max
 *    (`domTotal - viewport`) -> the logical max (`trueTotal - viewport`), so
 *    the very last row is always reachable.
 *  - `logicalToDom` is the inverse of `domToLogical` across the range.
 *  - Both maps are monotonic non-decreasing and clamp out-of-range inputs.
 */
export function createRowScrollScaling(
  trueTotal: number,
  maxDomHeight: number,
  viewport: number,
): RowScrollScaling {
  const safeMax = Math.max(maxDomHeight, 1)
  const domTotal = Math.min(Math.max(trueTotal, 0), safeMax)
  const active = trueTotal > safeMax
  // Scrollable ranges (content minus one viewport). Guard against zero so the
  // ratios below never divide by zero on tiny / empty grids.
  const domRange = Math.max(domTotal - viewport, 1)
  const logicalRange = Math.max(trueTotal - viewport, 0)

  return {
    active,
    domTotal,
    domToLogical(domTop: number): number {
      if (!active) return domTop
      return clamp01(domTop / domRange) * logicalRange
    },
    logicalToDom(logical: number): number {
      if (!active) return logical
      const lr = Math.max(logicalRange, 1)
      return clamp01(logical / lr) * Math.max(domTotal - viewport, 0)
    },
  }
}
