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

/**
 * A region whose controls come and go: a dialog, a menu, a panel, a page of
 * tiles. When the control holding focus is removed or disabled, focus falls to
 * the body, the next Tab starts over at the top of the page and a typed key
 * goes nowhere. Here it moves instead to the control that now stands in that
 * place (the one after it, or the last), then to `fallback`, then the region
 * itself. A control that is only moved, as a reordered tile is, keeps it.
 *
 * Decided after the current task, so an editor or a dialog placing focus itself
 * goes first, and focus someone took elsewhere stays there. On touch it never
 * lands in a text box: that would bring up the on-screen keyboard unasked.
 * Works as a Svelte action, `use:keepFocus`.
 */
export function keepFocus(container: HTMLElement, fallback?: () => HTMLElement | null | undefined) {
  let held: HTMLElement | null = null
  let place = 0
  let changed = false
  let touch = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(settle, 0)
  }
  function settle() {
    const now = document.activeElement
    const gone = !held?.isConnected || held.matches(':disabled')
    const fell = !now || now === document.body || (now === held && gone)
    const moved = changed
    changed = false
    if (!held || !fell) {
      if (!container.contains(now)) held = null
      return
    }
    // Nothing here changed: it was a click on the page, and focus goes with it.
    if (!moved) {
      held = null
      return
    }
    if (!gone) return held.focus()
    const list = getFocusable(container)
    const next = list[Math.min(place, list.length - 1)]
    const target = next && !(touch && next.matches('input, textarea, [contenteditable]')) ? next : (fallback?.() ?? container)
    if (target === container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
    // A list that draws only what is in sight drops the focused card as it scrolls: no pulling it back.
    target.focus({ preventScroll: true })
  }
  const onIn = (e: FocusEvent) => {
    held = e.target as HTMLElement
    place = Math.max(0, getFocusable(container).indexOf(held))
  }
  const onDown = (e: PointerEvent) => {
    touch = e.pointerType === 'touch'
  }
  const watch = new MutationObserver((records) => {
    if (!held) return
    if (records.some((r) => r.type === 'childList' || r.target === held)) changed = true
    later()
  })
  container.addEventListener('focusin', onIn)
  container.addEventListener('focusout', later)
  container.addEventListener('pointerdown', onDown, true)
  watch.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] })
  return {
    destroy() {
      clearTimeout(timer)
      watch.disconnect()
      container.removeEventListener('focusin', onIn)
      container.removeEventListener('focusout', later)
      container.removeEventListener('pointerdown', onDown, true)
    },
  }
}

/** Where focus can go when an element cannot take it back: the element and what holds it, nearest first, each with what stood after it. */
export type FocusPath = Array<{ el: HTMLElement; next?: HTMLElement | null }>

export function focusPath(el: Element | null): FocusPath {
  const path: FocusPath = []
  for (let at = el as HTMLElement | null; at && at !== document.body; at = at.parentElement ?? ((at.getRootNode() as ShadowRoot).host as HTMLElement | undefined) ?? null) {
    path.push({ el: at, next: at.nextElementSibling as HTMLElement | null })
  }
  return path
}

/**
 * Focus `path`'s element, or the nearest thing that takes focus: a control that
 * left the page, or turned disabled or hidden, does not, and focus would fall
 * to the body. What held it does (the grid, for a button in a row or a header);
 * with nothing there that can (a wall of cards), what stood after it (the next
 * card), or the first control of what is left.
 */
export function focusNearest(path: FocusPath): void {
  const take = (el?: HTMLElement) => {
    if (!el?.isConnected) return false
    el.focus({ preventScroll: true })
    return (el.getRootNode() as Document).activeElement === el
  }
  const inside = (el?: HTMLElement | null) => !!el && take(el.matches(FOCUSABLE_SELECTOR) ? el : getFocusable(el)[0])
  void (path.some(({ el }) => el.matches(FOCUSABLE_SELECTOR) && take(el)) || path.some(({ el, next }) => inside(el.isConnected ? el : next)))
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
  let path: FocusPath = []
  let active = false
  let kept: ReturnType<typeof keepFocus> | null = null

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
    kept = keepFocus(container)
    // Focus on the next microtask so a just-opened panel is in the DOM first.
    queueMicrotask(() => {
      if (!active) return
      // Opened from a menu: the item left the page, and the menu has just given
      // focus back to what opened it. That is where this one goes back to.
      if (!previouslyFocused?.isConnected || previouslyFocused === document.body) previouslyFocused = document.activeElement as HTMLElement | null
      path = focusPath(previouslyFocused)
      resolveInitial()?.focus()
    })
  }

  function release() {
    if (!active) return
    active = false
    kept?.destroy()
    document.removeEventListener('keydown', onKeydown, true)
    if (returnFocus) {
      previouslyFocused?.focus?.()
      focusNearest(path)
    }
    previouslyFocused = null
  }

  return { activate, release }
}
