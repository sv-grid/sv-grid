/**
 * positioning - a small, dependency-free anchor-positioning engine for the
 * overlay layer (popover, tooltip, menu, dropdowns). It replaces the vertical-
 * flip-only `anchoredRect` for components that need the full placement matrix.
 *
 * Two halves:
 *
 * 1. `computePosition(reference, floating, options)` - PURE geometry. Given the
 *    reference rect and the floating size (plus a viewport), it returns the
 *    floating `x`/`y`, the resolved `placement` (after flip), the arrow offset,
 *    and the available `maxWidth`/`maxHeight` on the chosen side. No DOM, so it
 *    is fully unit-tested by feeding rects and asserting placement.
 *
 * 2. `autoUpdate(referenceEl, floatingEl, update)` - the browser half. Re-runs
 *    `update` whenever the reference/floating resize, an ancestor scrolls, or the
 *    window resizes (via `ResizeObserver` + scroll/resize listeners). SSR-safe
 *    (a no-op without `window`).
 *
 * The middleware (flip / shift / size / arrow) is implemented inline - no
 * Floating-UI dependency - matching the kit's zero-runtime-dep posture.
 */

/** A physical side the floating element is placed on, relative to the reference. */
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** Cross-axis alignment. `center` is the bare side (e.g. `'bottom'`). */
export type Align = 'start' | 'center' | 'end'

/** `'bottom'` = bottom-center; `'bottom-start'` / `'bottom-end'` align the edges. */
export type Placement = Side | `${Side}-start` | `${Side}-end`

/** A viewport-relative rectangle (CSS `getBoundingClientRect` shape suffices). */
export type Rect = { x: number; y: number; width: number; height: number }

/** The available viewport (defaults to `window` in the browser). */
export type Viewport = { width: number; height: number }

export type ComputePositionOptions = {
  /** Preferred placement. Default `'bottom-start'`. */
  placement?: Placement
  /** Main-axis gap between reference and floating. Default 6. */
  offset?: number
  /** Viewport edge kept clear on every side. Default 8. */
  padding?: number
  /** Flip to the opposite side when the preferred side overflows. Default true. */
  flip?: boolean
  /** Shift along the cross axis to stay in view (without flipping). Default true. */
  shift?: boolean
  /** Compute `maxWidth`/`maxHeight` for the chosen side. Default true. */
  size?: boolean
  /** When set, compute the arrow offset for an arrow element of this size (px). */
  arrow?: { size: number }
  /** Extra placements to try (after the automatic opposite) before giving up. */
  fallbackPlacements?: Placement[]
  /** Viewport to fit within. Defaults to the window; pure callers pass it. */
  viewport?: Viewport
  /** Floor for the available main-axis size returned by `size`. Default 0. */
  minMainAxis?: number
}

export type ComputePositionResult = {
  /** Floating left, in viewport (fixed-position) coordinates. */
  x: number
  /** Floating top, in viewport (fixed-position) coordinates. */
  y: number
  /** The resolved placement after flip. */
  placement: Placement
  /** The resolved side after flip. */
  side: Side
  /** The resolved cross-axis alignment. */
  align: Align
  /** Space available for the floating on the chosen side's main axis (+cross). */
  maxWidth: number
  maxHeight: number
  /**
   * Arrow offset within the floating box: `x` for top/bottom placements, `y` for
   * left/right. Only present when `options.arrow` is set. Clamped so the arrow
   * stays inside the floating (minus padding).
   */
  arrow?: { x?: number; y?: number }
}

const SIDES: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** Split a placement into its side + alignment (`center` when no suffix). */
export function parsePlacement(p: Placement): { side: Side; align: Align } {
  const [side, align] = p.split('-') as [Side, 'start' | 'end' | undefined]
  return { side, align: align ?? 'center' }
}

function opposite(p: Placement): Placement {
  const { side, align } = parsePlacement(p)
  return (align === 'center' ? SIDES[side] : `${SIDES[side]}-${align}`) as Placement
}

function clamp(v: number, min: number, max: number): number {
  if (max < min) return min
  return v < min ? min : v > max ? max : v
}

/** Floating x/y for a given side+align (before flip/shift). */
function coordsFor(side: Side, align: Align, r: Rect, f: Viewport, offset: number): { x: number; y: number } {
  if (side === 'top' || side === 'bottom') {
    const y = side === 'top' ? r.y - f.height - offset : r.y + r.height + offset
    const x =
      align === 'start' ? r.x : align === 'end' ? r.x + r.width - f.width : r.x + r.width / 2 - f.width / 2
    return { x, y }
  }
  const x = side === 'left' ? r.x - f.width - offset : r.x + r.width + offset
  const y =
    align === 'start' ? r.y : align === 'end' ? r.y + r.height - f.height : r.y + r.height / 2 - f.height / 2
  return { x, y }
}

/** How far the floating exceeds the viewport on the placement's MAIN axis. >0 = overflow. */
function mainAxisOverflow(side: Side, x: number, y: number, f: Viewport, v: Viewport, pad: number): number {
  switch (side) {
    case 'top':
      return pad - y
    case 'bottom':
      return y + f.height - (v.height - pad)
    case 'left':
      return pad - x
    default:
      return x + f.width - (v.width - pad)
  }
}

function resolveViewport(v?: Viewport): Viewport {
  if (v) return v
  if (typeof window !== 'undefined') return { width: window.innerWidth, height: window.innerHeight }
  return { width: 0, height: 0 }
}

/**
 * Compute the floating position anchored to `reference`, applying flip (opposite
 * side when the preferred side overflows), shift (cross-axis clamp to stay in
 * view), size (available max width/height on the chosen side) and an optional
 * arrow offset. Pure - pass an explicit `viewport` in tests.
 */
export function computePosition(
  reference: Rect,
  floating: Viewport,
  options: ComputePositionOptions = {},
): ComputePositionResult {
  const offset = options.offset ?? 6
  const pad = options.padding ?? 8
  const doFlip = options.flip !== false
  const doShift = options.shift !== false
  const v = resolveViewport(options.viewport)
  const preferred = options.placement ?? 'bottom-start'

  // ---- flip: pick the placement whose main-axis overflow is smallest ----
  const candidates: Placement[] = [preferred]
  if (doFlip) {
    candidates.push(opposite(preferred))
    for (const fb of options.fallbackPlacements ?? []) candidates.push(fb)
  }
  let chosen = preferred
  let best = Infinity
  for (const cand of candidates) {
    const { side, align } = parsePlacement(cand)
    const { x, y } = coordsFor(side, align, reference, floating, offset)
    const overflow = mainAxisOverflow(side, x, y, floating, v, pad)
    if (overflow <= 0) {
      chosen = cand
      best = overflow
      break
    }
    if (overflow < best) {
      best = overflow
      chosen = cand
    }
  }

  const { side, align } = parsePlacement(chosen)
  let { x, y } = coordsFor(side, align, reference, floating, offset)

  // ---- shift: clamp along the CROSS axis so the floating stays in view ----
  if (doShift) {
    if (side === 'top' || side === 'bottom') {
      x = clamp(x, pad, v.width - pad - floating.width)
    } else {
      y = clamp(y, pad, v.height - pad - floating.height)
    }
  }

  // ---- size: available room on the chosen side ----
  const minMain = options.minMainAxis ?? 0
  let maxWidth: number
  let maxHeight: number
  if (side === 'top' || side === 'bottom') {
    const avail = side === 'top' ? reference.y - offset - pad : v.height - pad - (reference.y + reference.height + offset)
    maxHeight = Math.max(minMain, Math.floor(avail))
    maxWidth = Math.max(0, v.width - 2 * pad)
  } else {
    const avail = side === 'left' ? reference.x - offset - pad : v.width - pad - (reference.x + reference.width + offset)
    maxWidth = Math.max(minMain, Math.floor(avail))
    maxHeight = Math.max(0, v.height - 2 * pad)
  }

  const result: ComputePositionResult = { x, y, placement: chosen, side, align, maxWidth, maxHeight }

  // ---- arrow: point at the reference center, clamped inside the floating ----
  if (options.arrow) {
    const a = options.arrow.size
    if (side === 'top' || side === 'bottom') {
      const center = reference.x + reference.width / 2
      const ax = clamp(center - x - a / 2, pad, floating.width - a - pad)
      result.arrow = { x: ax }
    } else {
      const center = reference.y + reference.height / 2
      const ay = clamp(center - y - a / 2, pad, floating.height - a - pad)
      result.arrow = { y: ay }
    }
  }

  return result
}

/** Collect scrollable ancestors so `autoUpdate` can listen to their scroll. */
function scrollParents(node: Element): Element[] {
  const out: Element[] = []
  let el: Element | null = node.parentElement
  while (el) {
    const style = getComputedStyle(el)
    if (/(auto|scroll|overlay|hidden)/.test(style.overflow + style.overflowY + style.overflowX)) out.push(el)
    el = el.parentElement
  }
  return out
}

/**
 * Re-run `update` whenever the anchored position could change: the reference or
 * floating element resizes, an ancestor scrolls, or the window scrolls/resizes.
 * Returns a cleanup function. SSR-safe (a no-op without `window`).
 *
 * ```ts
 * const stop = autoUpdate(triggerEl, panelEl, () => reposition())
 * // ...later
 * stop()
 * ```
 */
export function autoUpdate(reference: Element, floating: HTMLElement, update: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const ancestors = scrollParents(reference)
  for (const a of ancestors) a.addEventListener('scroll', update, { passive: true })
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)

  let ro: ResizeObserver | undefined
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(update)
    ro.observe(reference)
    ro.observe(floating)
  }

  update()

  return () => {
    for (const a of ancestors) a.removeEventListener('scroll', update)
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    ro?.disconnect()
  }
}
