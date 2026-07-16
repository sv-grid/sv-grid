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
  '--sg-accent', '--sg-bg', '--sg-fg', '--sg-border', '--sg-muted',
  '--sg-header-bg', '--sg-row-hover-bg', '--sg-selection-bg',
  '--sg-input-bg', '--sg-input-border', '--sg-selection-fg',
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

export type AnchoredRect = { top: number; left: number; width: number; openUpward: boolean }

export type AnchorOptions = {
  /** Estimated panel height, used to decide whether to flip upward. */
  estimatedHeight: number
  /** Gap between trigger and panel. Default 2px. */
  gap?: number
  /** Force the panel at least this wide (else it matches the trigger). */
  minWidth?: number
  /** Keep the panel within the viewport horizontally. Default true. */
  clampHorizontal?: boolean
}

/**
 * Compute a `position: fixed` rect anchored to `triggerRect`, flipping above the
 * trigger when there isn't room below and there's more room above. Mirrors the
 * behavior SvGridDropdown shipped with, generalized with min-width + horizontal
 * clamping for wider panels (date/time popovers).
 */
export function anchoredRect(triggerRect: DOMRect, opts: AnchorOptions): AnchoredRect {
  const gap = opts.gap ?? 2
  const spaceBelow = window.innerHeight - triggerRect.bottom
  const spaceAbove = triggerRect.top
  const openUpward = spaceBelow < opts.estimatedHeight && spaceAbove > spaceBelow
  const width = Math.max(triggerRect.width, opts.minWidth ?? 0)
  let left = triggerRect.left
  if (opts.clampHorizontal !== false) {
    const maxLeft = window.innerWidth - width - 4
    left = Math.max(4, Math.min(left, maxLeft))
  }
  return {
    top: openUpward ? triggerRect.top - opts.estimatedHeight - gap : triggerRect.bottom + gap,
    left,
    width,
    openUpward,
  }
}
