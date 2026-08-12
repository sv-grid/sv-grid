/**
 * createJsScroller - a JS-driven vertical scroller for the virtualized selection
 * controls (SvListBox / SvDropDownList / SvTree).
 *
 * Native overflow scroll is composited off the main thread, so on a fast
 * scrollbar-thumb drag the browser paints the new (empty) scroll position a
 * frame before JS can re-window the virtualizer - the "blank flash while
 * scrolling". This helper removes that async gap the way Smart's list does: the
 * content does NOT use native scroll. A single `scrollOffset` state positions
 * the rows (`translateY`) AND drives the virtualizer window in the same reactive
 * flush, and a custom scrollbar + wheel/touch handlers set that offset directly.
 *
 * The component owns the markup (translated rows + the `sb`/`thumb` elements);
 * this owns the offset, the geometry, and the input handlers.
 */
import { untrack } from 'svelte'

type ScrollerVirtualizer = {
  setScrollOffset: (offset: number) => void
  getOffsetForIndex: (index: number) => number
  getSizeForIndex: (index: number) => number
}

export type JsScrollerConfig = {
  /** The shared virtualizer to drive. */
  virtualizer: ScrollerVirtualizer
  /** Full scrollable content height (px). */
  totalSize: () => number
  /** Visible viewport height (px). */
  viewport: () => number
  /** Row height used to convert line-mode wheel deltas to px. */
  lineStep: () => number
}

export function createJsScroller(cfg: JsScrollerConfig) {
  // The single source of truth for the scroll position.
  let scrollOffset = $state(0)
  const maxOffset = $derived(Math.max(0, cfg.totalSize() - cfg.viewport()))

  // Push the offset into the virtualizer whenever it changes. `untrack` keeps
  // the virtualizer's `version` write out of this effect's dependencies.
  $effect(() => {
    const o = scrollOffset
    untrack(() => cfg.virtualizer.setScrollOffset(o))
  })
  // Re-clamp if the content shrinks under the current offset.
  $effect(() => {
    const m = maxOffset
    if (untrack(() => scrollOffset) > m) scrollOffset = m
  })

  function scrollTo(offset: number) {
    scrollOffset = Math.max(0, Math.min(maxOffset, offset))
  }
  function scrollByPx(delta: number) {
    scrollTo(scrollOffset + delta)
  }

  function onWheel(e: WheelEvent) {
    if (maxOffset <= 0) return
    // deltaMode: 0 = pixels, 1 = lines, 2 = pages.
    const step =
      e.deltaMode === 1 ? e.deltaY * cfg.lineStep() : e.deltaMode === 2 ? e.deltaY * cfg.viewport() : e.deltaY
    const before = scrollOffset
    scrollByPx(step)
    // Only swallow the wheel when it moved us, so the page can scroll once the
    // list is pinned at its top/bottom edge.
    if (scrollOffset !== before) e.preventDefault()
  }

  // --- Custom scrollbar geometry --------------------------------------------
  const thumbH = $derived(
    maxOffset > 0 && cfg.totalSize() > 0
      ? Math.max(24, Math.min(cfg.viewport(), (cfg.viewport() / cfg.totalSize()) * cfg.viewport()))
      : 0,
  )
  const trackRange = $derived(Math.max(0, cfg.viewport() - thumbH))
  const thumbTop = $derived(maxOffset > 0 ? (scrollOffset / maxOffset) * trackRange : 0)

  let dragging = $state(false)
  let dragStartY = 0
  let dragStartOffset = 0
  function onThumbDown(e: PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    dragging = true
    dragStartY = e.clientY
    dragStartOffset = scrollOffset
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onThumbMove(e: PointerEvent) {
    if (!dragging) return
    const dy = e.clientY - dragStartY
    scrollTo(dragStartOffset + (trackRange > 0 ? (dy / trackRange) * maxOffset : 0))
  }
  function onThumbUp(e: PointerEvent) {
    dragging = false
    releaseCapture(e)
  }
  function onTrackDown(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    scrollByPx(e.clientY - rect.top < thumbTop ? -cfg.viewport() : cfg.viewport())
  }

  // --- Touch: drag the content to pan ---------------------------------------
  let touchActive = false
  let touchStartY = 0
  let touchStartOffset = 0
  function onContentDown(e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    touchActive = true
    touchStartY = e.clientY
    touchStartOffset = scrollOffset
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onContentMove(e: PointerEvent) {
    if (!touchActive) return
    scrollTo(touchStartOffset - (e.clientY - touchStartY))
  }
  function onContentUp(e: PointerEvent) {
    if (!touchActive) return
    touchActive = false
    releaseCapture(e)
  }

  function releaseCapture(e: PointerEvent) {
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* capture may already be gone */
    }
  }

  /** Scroll the minimal amount to bring `[top, top+h]` fully into view. */
  function ensureVisible(top: number, h: number) {
    if (top < scrollOffset) scrollTo(top)
    else if (top + h > scrollOffset + cfg.viewport()) scrollTo(top + h - cfg.viewport())
  }
  /** Bring a virtualizer row index into view (variable-height aware). */
  function ensureIndexVisible(index: number) {
    ensureVisible(cfg.virtualizer.getOffsetForIndex(index), cfg.virtualizer.getSizeForIndex(index))
  }

  return {
    get scrollOffset() {
      return scrollOffset
    },
    get maxOffset() {
      return maxOffset
    },
    get thumbH() {
      return thumbH
    },
    get thumbTop() {
      return thumbTop
    },
    get dragging() {
      return dragging
    },
    scrollTo,
    scrollByPx,
    ensureVisible,
    ensureIndexVisible,
    onWheel,
    onThumbDown,
    onThumbMove,
    onThumbUp,
    onTrackDown,
    onContentDown,
    onContentMove,
    onContentUp,
  }
}
