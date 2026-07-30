/**
 * panel-resize - the drag math behind a dropdown panel's bottom resize grip
 * (the "····" handle). Rune-free and DOM-only so every popover select can reuse
 * it: on the grip's `pointerdown` it tracks the pointer and reports a clamped
 * height as it moves, releasing its listeners on `pointerup`.
 *
 * The grip is only meaningful when the panel opens DOWNWARD (it grows toward the
 * bottom of the screen); components hide it on an upward flip, where there is no
 * room below to grow into.
 */

export type PanelResizeOptions = {
  /** Panel height (px) at the moment the drag starts. */
  startHeight: number
  /** Smallest height the panel may shrink to. Default 80. */
  min?: number
  /** Largest height the panel may grow to - the live viewport ceiling. */
  max: () => number
  /** Called with the new clamped height on each pointer move. */
  onHeight: (height: number) => void
}

/**
 * Begin a vertical resize from a grip `pointerdown`. Returns nothing; the drag
 * ends itself on `pointerup`. Safe to call from an `onpointerdown` handler.
 */
export function startPanelResize(event: PointerEvent, opts: PanelResizeOptions): void {
  // Ignore secondary buttons; only a primary drag resizes.
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const startY = event.clientY
  const min = opts.min ?? 80

  const clamp = (h: number) => Math.max(min, Math.min(opts.max(), Math.round(h)))
  const onMove = (e: PointerEvent) => {
    opts.onHeight(clamp(opts.startHeight + (e.clientY - startY)))
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  // Suppress text selection + keep the resize cursor for the whole drag.
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
