/**
 * popover - shared helpers for panels that must escape the grid's
 * `overflow:hidden` scroll container by portalling to <body>: the theme-var
 * snapshot + portal action, and the fixed-position anchor/flip math. Rune-free
 * and DOM-only so it is reused verbatim by SvGridDropdown, SvDateTimePicker and
 * any future popover. The per-component `$effect` wiring (scroll/resize
 * reposition, outside-click close) stays in the component since it needs the
 * component's own open state.
 */

/**
 * Theme tokens a portalled panel must carry with it. `--sg-*` custom properties
 * are scoped to whatever wrapper the grid sits inside (e.g. a per-preset theme
 * class); moving the panel to <body> leaves that scope, so we snapshot the
 * resolved values and pin them inline. Keep this list in sync with the tokens
 * any popover panel actually consumes.
 */
export const PANEL_THEME_VARS = [
  '--sg-accent', '--sg-on-accent', '--sg-bg', '--sg-fg', '--sg-muted', '--sg-border',
  '--sg-header-bg', '--sg-header-fg', '--sg-row-hover-bg', '--sg-row-alt-bg',
  '--sg-selection-bg', '--sg-selection-fg', '--sg-input-bg', '--sg-input-border',
  '--sg-danger', '--sg-focus-ring', '--sg-radius', '--sg-font',
  '--sg-invalid-bg', '--sg-invalid-border', '--sg-invalid-fg',
  '--sg-rating-on', '--sg-rating-empty', '--sg-rating-hover',
] as const

/**
 * Svelte action: snapshot the resolved theme tokens from the node's current
 * (in-scope) position, then detach it and append to <body> so it can never be
 * clipped by an ancestor's overflow. Removes itself on destroy.
 */
export function portalToBody(node: HTMLElement, vars: ReadonlyArray<string> = PANEL_THEME_VARS) {
  const cs = getComputedStyle(node)
  for (const v of vars) {
    const val = cs.getPropertyValue(v).trim()
    if (val) node.style.setProperty(v, val)
  }
  document.body.appendChild(node)
  return {
    destroy() {
      if (node.parentNode === document.body) document.body.removeChild(node)
    },
  }
}

/**
 * Svelte action: play a short enter animation when a portalled panel mounts
 * (dropdowns, popovers, dialogs). Slides from the trigger side + fades/scales in.
 * A no-op under `prefers-reduced-motion` and in environments without the Web
 * Animations API (jsdom), so tests and reduced-motion users are unaffected.
 *
 * `use:popIn={{ up: rect.openUpward }}` - pass `up` for panels that flipped above
 * their trigger so the slide direction matches.
 */
export function popIn(node: HTMLElement, param: { up?: boolean; duration?: number; scale?: number } = {}) {
  if (typeof node.animate !== 'function') return
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return
  const dy = param.up ? 6 : -6
  const s = param.scale ?? 0.97
  node.animate(
    [
      { opacity: 0, transform: `translateY(${dy}px) scale(${s})` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: param.duration ?? 140, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  )
  return {}
}

export type AnchoredRect = {
  top: number
  left: number
  width: number
  openUpward: boolean
  /**
   * Comfortable panel height: the estimate, capped to the room on the chosen
   * side so the panel never leaves the viewport. Apply as the panel's
   * `max-height` and long content scrolls inside instead of overflowing.
   */
  maxHeight: number
  /**
   * Absolute height the panel may occupy on the chosen side (room minus the
   * viewport margin). The hard ceiling a user resize must clamp to.
   */
  availHeight: number
}

export type AnchorOptions = {
  /** Estimated panel height, used to decide whether to flip upward. */
  estimatedHeight: number
  /** Gap between trigger and panel. Default 2px. */
  gap?: number
  /** Force the panel at least this wide (else it matches the trigger). */
  minWidth?: number
  /** Keep the panel within the viewport horizontally. Default true. */
  clampHorizontal?: boolean
  /** Viewport edge kept clear top/bottom so a panel never touches it. Default 8. */
  viewportMargin?: number
  /** Floor for `maxHeight`/`availHeight` so a cramped panel stays usable. Default 96. */
  minHeight?: number
}

/**
 * Compute a `position: fixed` rect anchored to `triggerRect`, flipping above the
 * trigger when there isn't room below and there's more room above. Generalized
 * with min-width + horizontal clamping for wider panels (date/time popovers),
 * and with vertical bounds detection: `maxHeight` caps the panel to the room on
 * the chosen side (minus a viewport margin) so a long list near a screen edge
 * scrolls internally rather than overflowing, and an upward flip is clamped so
 * its top never leaves the viewport.
 */
export function anchoredRect(triggerRect: DOMRect, opts: AnchorOptions): AnchoredRect {
  const gap = opts.gap ?? 2
  const margin = opts.viewportMargin ?? 8
  const minH = opts.minHeight ?? 96
  const spaceBelow = window.innerHeight - triggerRect.bottom - gap - margin
  const spaceAbove = triggerRect.top - gap - margin
  const openUpward = spaceBelow < opts.estimatedHeight && spaceAbove > spaceBelow
  const availHeight = Math.max(minH, Math.floor(openUpward ? spaceAbove : spaceBelow))
  const maxHeight = Math.min(opts.estimatedHeight, availHeight)
  const width = Math.max(triggerRect.width, opts.minWidth ?? 0)
  let left = triggerRect.left
  if (opts.clampHorizontal !== false) {
    const maxLeft = window.innerWidth - width - 4
    left = Math.max(4, Math.min(left, maxLeft))
  }
  return {
    // Upward: pin by the comfortable height and clamp to the top margin so the
    // panel can never start off-screen. Downward: sit just below the trigger.
    top: openUpward
      ? Math.max(margin, triggerRect.top - gap - maxHeight)
      : triggerRect.bottom + gap,
    left,
    width,
    openUpward,
    maxHeight,
    availHeight,
  }
}
