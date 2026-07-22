/**
 * live-region - a single shared pair of visually-hidden ARIA live regions
 * (polite + assertive) appended to <body> on first use, so any component can
 * push a transient message to screen readers via `announce()` without each one
 * shipping its own live region. Used for things like "3 rows selected",
 * "copied", "no results".
 */
let politeEl: HTMLElement | null = null
let assertiveEl: HTMLElement | null = null

function make(mode: 'polite' | 'assertive'): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('aria-live', mode)
  el.setAttribute('aria-atomic', 'true')
  el.setAttribute('role', mode === 'assertive' ? 'alert' : 'status')
  // Visually hidden, but still exposed to assistive technology.
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    border: '0',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  })
  document.body.appendChild(el)
  return el
}

export type AnnounceOptions = {
  /** Interrupt the user immediately (role="alert"). Default polite. */
  assertive?: boolean
}

/** Announce `message` to screen readers. Empty messages are ignored. */
export function announce(message: string, options: AnnounceOptions = {}): void {
  if (typeof document === 'undefined' || !message) return
  const assertive = options.assertive ?? false
  let el = assertive ? assertiveEl : politeEl
  // Recreate when missing OR when a prior DOM reset detached the cached node,
  // so a stale reference can never swallow an announcement silently.
  if (!el || !el.isConnected) {
    el = make(assertive ? 'assertive' : 'polite')
    if (assertive) assertiveEl = el
    else politeEl = el
  }
  // Clear, then set on the next microtask, so an identical consecutive message
  // still triggers a fresh announcement.
  el.textContent = ''
  const target = el
  queueMicrotask(() => {
    target.textContent = message
  })
}

/** Test helper: tear the shared live regions down. */
export function _resetLiveRegions(): void {
  politeEl?.remove()
  assertiveEl?.remove()
  politeEl = null
  assertiveEl = null
}
