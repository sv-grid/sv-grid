/**
 * scroll-lock - stop the document scrolling behind an overlay, with REF-COUNTING
 * so nested overlays (a dialog that opens a menu) never fight over
 * `body.style.overflow`. The first lock records the original values; the last
 * unlock restores them. Also pads for the vanishing scrollbar so the page
 * doesn't shift when the lock engages.
 */
let locks = 0
let previousOverflow = ''
let previousPaddingRight = ''

/** Lock document scroll. Returns an idempotent unlock function. */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  const body = document.body
  if (locks === 0) {
    previousOverflow = body.style.overflow
    previousPaddingRight = body.style.paddingRight
    // Compensate for the scrollbar width so fixed/full-width layout stays put.
    const sbw = window.innerWidth - document.documentElement.clientWidth
    if (sbw > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${current + sbw}px`
    }
    body.style.overflow = 'hidden'
  }
  locks++
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }
}

/** Test helper: current lock depth. */
export function scrollLockDepth(): number { return locks }
