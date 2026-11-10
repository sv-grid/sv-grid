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

/** Below this a reading is junk (0 from jsdom, a sub-cap layout quirk, etc). */
const MAX_DOM_HEIGHT_SANITY_FLOOR = 100_000
/** At/above this the browser didn't clamp (returned ~the 1e9 we asked for). */
const MAX_DOM_HEIGHT_SANITY_CEIL = 900_000_000
/**
 * Shave a hair off the detected cap so the spacer never sits at the exact
 * physical edge, where sub-pixel rounding could leave the final row a touch
 * out of reach. 0.5% is invisible at desktop caps (~33.5M -> ~33.3M) yet
 * keeps a safety gap proportional to the cap.
 */
const MAX_DOM_HEIGHT_SAFETY = 0.995

/**
 * Resolve the usable max element height from the two raw DOM signals.
 *
 * `layoutCap` is a tall probe's clamped `offsetHeight` - the height layout
 * assigns the element. `scrollCap` is the `scrollHeight` a real `overflow:auto`
 * container exposes for that same probe - the height the user can actually
 * scroll through. They differ on mobile / high-DPR engines, which report a
 * generous `offsetHeight` but then expose a SMALLER scrollable range (the
 * physical limit is in device px, so a 3x-DPR phone has ~1/3 the CSS-px scroll
 * cap). Trusting `offsetHeight` alone is exactly what strands the last rows of
 * a huge grid on a phone, so we take the smaller of the two.
 *
 * A junk reading (<= the sanity floor, or so large the browser clearly didn't
 * clamp) is dropped; if neither signal survives, the caller's conservative
 * `fallback` is returned unchanged.
 */
export function resolveMaxDomHeight(
  layoutCap: number,
  scrollCap: number,
  fallback: number,
): number {
  const usable = [layoutCap, scrollCap].filter(
    (v) =>
      Number.isFinite(v) &&
      v > MAX_DOM_HEIGHT_SANITY_FLOOR &&
      v < MAX_DOM_HEIGHT_SANITY_CEIL,
  )
  if (usable.length === 0) return fallback
  return Math.floor(Math.min(...usable) * MAX_DOM_HEIGHT_SAFETY)
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
 *  - Near both ends a pixel is a pixel: scaled up to the very ends, the rows
 *    drawn around the view would run past the top or the end of the spacer,
 *    and the list and its scrollbar would stop agreeing.
 */
export function createRowScrollScaling(
  trueTotal: number,
  maxDomHeight: number,
  viewport: number,
): RowScrollScaling {
  const active = trueTotal > maxDomHeight
  const domTotal = active ? maxDomHeight : trueTotal
  // Scrollable ranges (content minus one viewport). The maps read them only
  // when scaling, so never for a tiny or empty grid.
  const domRange = domTotal - viewport
  const logicalRange = trueTotal - viewport
  // More than the overscan and a view of the tallest rows; a third of the range at most.
  const edge = Math.min(8192, domRange / 3)
  // Straight across the middle; the ends keep their distance to the end.
  const map = (value: number, from: number, to: number): number => {
    const v = Math.min(Math.max(value, 0), from)
    if (v <= edge) return v
    if (v >= from - edge) return to - from + v
    return edge + ((v - edge) * (to - 2 * edge)) / (from - 2 * edge)
  }

  return {
    active,
    domTotal,
    domToLogical: (domTop) => (active ? map(domTop, domRange, logicalRange) : domTop),
    logicalToDom: (logical) => (active ? map(logical, logicalRange, domRange) : logical),
  }
}
