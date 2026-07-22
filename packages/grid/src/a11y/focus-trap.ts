/**
 * focus-trap - keep Tab / Shift+Tab focus inside a container while it is active,
 * move focus in on activate, and restore it on release. Shared by SvModal,
 * SvDrawer, SvMenu and any dialog-like overlay so the WAI-ARIA dialog focus
 * behaviour lives in ONE place instead of being re-hand-rolled per component.
 *
 * Framework-free (DOM only): call `createFocusTrap(el).activate()` from a
 * component `$effect` and `release()` from its cleanup.
 *
 * ```ts
 * $effect(() => {
 *   if (!open || !panel) return
 *   const trap = createFocusTrap(panel)
 *   trap.activate()
 *   return () => trap.release()
 * })
 * ```
 */

/** Selector for elements that can, in principle, hold keyboard focus. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

/**
 * Whether `el` is visible enough to be Tab-focusable. Detects the common,
 * layout-independent ways of hiding (disabled / hidden attr / aria-hidden /
 * inline display:none|visibility:hidden) so the check is deterministic in both
 * real browsers and jsdom. Class-based `display:none` in a real browser is
 * additionally caught via client rects when layout is available.
 */
function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.hidden || el.closest('[hidden]')) return false
  const style = el.style
  if (style.display === 'none' || style.visibility === 'hidden') return false
  // Only trust layout when the environment actually lays out (real browsers).
  if (typeof el.getClientRects === 'function') {
    const rects = el.getClientRects()
    // jsdom reports 0 rects for everything, so 0 alone is not "hidden" there;
    // treat 0 rects as hidden only when SOME element in the doc has layout.
    if (rects.length === 0 && document.body.getClientRects().length > 0) return false
  }
  return true
}

/** Visible, Tab-focusable descendants of `container`, in DOM order. Elements
 *  with `tabindex="-1"` are excluded (script-focusable, not Tab-reachable). */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return nodes.filter((el) => {
    const ti = el.getAttribute('tabindex')
    if (ti !== null && Number(ti) < 0) return false
    return isVisible(el)
  })
}

export type FocusTrapOptions = {
  /** Where focus goes on activate: the first focusable (default), the container
   *  itself, a specific element, or a getter resolved at activate time. */
  initialFocus?: 'first' | 'container' | HTMLElement | (() => HTMLElement | null)
  /** Restore focus to the previously-focused element on release. Default true. */
  returnFocus?: boolean
  /** Called on Escape while active. Dismissal is usually owned by the layer
   *  manager, so most consumers leave this unset. */
  onEscape?: (e: KeyboardEvent) => void
}

export type FocusTrap = { activate: () => void; release: () => void }

/** Create a focus trap for `container`. Inert until `activate()`. */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {},
): FocusTrap {
  const { initialFocus = 'first', returnFocus = true } = options
  let previouslyFocused: HTMLElement | null = null
  let active = false

  function resolveInitial(): HTMLElement | null {
    const f = initialFocus
    if (f === 'container') return container
    if (f === 'first') return getFocusable(container)[0] ?? container
    if (typeof f === 'function') return f()
    return f
  }

  function onKeydown(e: KeyboardEvent) {
    if (!active) return
    if (e.key === 'Escape' && options.onEscape) { options.onEscape(e); return }
    if (e.key !== 'Tab') return
    const f = getFocusable(container)
    if (!f.length) { e.preventDefault(); container.focus(); return }
    const first = f[0]!
    const last = f[f.length - 1]!
    const activeEl = document.activeElement
    // Focus escaped the container entirely (programmatic blur, etc.): pull back.
    if (!container.contains(activeEl)) { e.preventDefault(); first.focus(); return }
    if (e.shiftKey && activeEl === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus() }
  }

  function activate() {
    if (active) return
    active = true
    previouslyFocused = document.activeElement as HTMLElement | null
    // Guarantee the container is a focus fallback even without focusable children.
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
    document.addEventListener('keydown', onKeydown, true)
    // Focus on the next microtask so a just-opened panel is in the DOM first.
    queueMicrotask(() => { if (active) resolveInitial()?.focus() })
  }

  function release() {
    if (!active) return
    active = false
    document.removeEventListener('keydown', onKeydown, true)
    if (returnFocus) previouslyFocused?.focus?.()
    previouslyFocused = null
  }

  return { activate, release }
}
