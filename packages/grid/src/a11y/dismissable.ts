/**
 * dismissable-layer - a global stack of dismissable overlays (dropdowns,
 * popovers, dialogs). Escape and outside-pointer dismiss only the TOP layer, so
 * a menu opened inside a dialog closes the menu first and the dialog second -
 * the ordering users expect from nested overlays. One set of document listeners
 * is shared by every layer instead of each component wiring its own.
 */
type Reason = 'escape' | 'outside'

/** One element, several elements, or a getter of either. A pointerdown counts
 *  as "inside" when it lands in ANY of them (e.g. a popover's panel AND its
 *  trigger, so clicking the trigger doesn't immediately re-dismiss). */
export type DismissTarget = HTMLElement | null | ReadonlyArray<HTMLElement | null>

type Layer = {
  element: () => DismissTarget
  onDismiss: (reason: Reason) => void
  closeOnEscape: boolean
  closeOnOutside: boolean
}

function containsTarget(target: DismissTarget, node: Node | null): boolean {
  if (!node) return false
  const els = Array.isArray(target) ? target : [target as HTMLElement | null]
  return els.some((el) => el != null && el.contains(node))
}

const stack: Layer[] = []
let wired = false

function ensureWired() {
  if (wired || typeof document === 'undefined') return
  wired = true
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return
      const top = stack[stack.length - 1]
      if (top?.closeOnEscape) {
        e.stopPropagation()
        top.onDismiss('escape')
      }
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    (e) => {
      const top = stack[stack.length - 1]
      if (!top?.closeOnOutside) return
      if (!containsTarget(top.element(), e.target as Node)) top.onDismiss('outside')
    },
    true,
  )
}

export type DismissableOptions = {
  /** The panel element(s); a pointerdown outside ALL of them dismisses the layer.
   *  Pass multiple (e.g. panel + trigger) so clicking the trigger doesn't
   *  immediately re-dismiss what it just opened. */
  element: () => DismissTarget
  onDismiss: (reason: Reason) => void
  /** Dismiss on Escape when topmost. Default true. */
  closeOnEscape?: boolean
  /** Dismiss on outside pointerdown when topmost. Default true. */
  closeOnOutside?: boolean
}

export type DismissableLayer = { activate: () => void; release: () => void }

/** Register a dismissable layer. Inert until `activate()`. */
export function createDismissableLayer(options: DismissableOptions): DismissableLayer {
  const layer: Layer = {
    element: options.element,
    onDismiss: options.onDismiss,
    closeOnEscape: options.closeOnEscape ?? true,
    closeOnOutside: options.closeOnOutside ?? true,
  }
  return {
    activate() {
      ensureWired()
      if (!stack.includes(layer)) stack.push(layer)
    },
    release() {
      const i = stack.indexOf(layer)
      if (i >= 0) stack.splice(i, 1)
    },
  }
}

/** Test/introspection helper: current number of active layers. */
export function dismissableDepth(): number {
  return stack.length
}
