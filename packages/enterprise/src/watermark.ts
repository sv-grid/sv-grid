// Soft-gate UX for unlicensed @svgrid/enterprise use. Shows a small clickable
// "www.svgrid.com" watermark in the bottom-right corner of every SvGrid on
// the page, which fades out after 5 seconds, and emits a one-time console
// nudge. Hard errors (revoked / bad-prefix keys) still throw via license.ts -
// this file is only for the "no key set" case where the feature continues to
// work but the user gets nudged.

const WATERMARK_ATTR = 'data-svgrid-enterprise-watermark'
// Marks a grid that has already shown (and faded) its watermark, so the
// MutationObserver doesn't re-add it once it fades out and is removed.
const NUDGED_ATTR = 'data-svgrid-enterprise-nudged'
const HOMEPAGE_URL = 'https://www.svgrid.com'
const LICENSE_URL = 'https://www.svgrid.com/pricing'
const WATERMARK_LABEL = 'www.svgrid.com'

// How long the watermark stays fully visible before it starts fading, and how
// long the fade itself takes.
const VISIBLE_MS = 5000
const FADE_MS = 700

let consoleNudgeShown = false
let observer: MutationObserver | null = null

export function emitUnlicensedNudge(): void {
  showConsoleOnce()
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  // Defer one tick: installEnterprise may run inside onApiReady before the grid's
  // root element is in the DOM. The microtask gives Svelte time to flush.
  queueMicrotask(() => attachToAllGrids())
  // Watch for grids that mount later (route changes, dynamic loads).
  if (!observer) {
    observer = new MutationObserver(() => attachToAllGrids())
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

export function dismissUnlicensedNudge(): void {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (typeof document === 'undefined') return
  document.querySelectorAll(`[${WATERMARK_ATTR}]`).forEach((el) => el.remove())
  document
    .querySelectorAll(`[${NUDGED_ATTR}]`)
    .forEach((el) => el.removeAttribute(NUDGED_ATTR))
  consoleNudgeShown = false
}

function showConsoleOnce(): void {
  if (consoleNudgeShown) return
  consoleNudgeShown = true
  if (typeof console === 'undefined') return
  // Per spec we use console.log (not warn/error) - this is a nudge, not an
  // error condition. Styled with %c so it stands out in the devtools.
  console.log(
    '%c @svgrid/enterprise %c User is using a Commercial version which requires a license.\n' +
      'Contact sales@jqwidgets.com for details or visit the license page: ' +
      LICENSE_URL,
    'background:#4f46e5;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:inherit',
  )
}

function attachToAllGrids(): void {
  if (typeof document === 'undefined') return
  // Primary selector targets SvGrid's root container class. Fall back to
  // ARIA grid role for headless renderers that re-style the wrapper.
  const grids = document.querySelectorAll<HTMLElement>(
    '.sv-grid-root, [role="grid"]',
  )
  if (grids.length === 0) {
    ensureFixedFallback()
    return
  }
  // A grid root was found - remove any fixed fallback we may have installed
  // earlier before the grid mounted.
  document
    .querySelectorAll(`[${WATERMARK_ATTR}="fixed"]`)
    .forEach((el) => el.remove())
  grids.forEach(attachWatermarkTo)
}

function attachWatermarkTo(grid: HTMLElement): void {
  // Show the watermark once per grid. The marker survives the fade-out so the
  // MutationObserver doesn't keep re-adding it on every DOM change.
  if (grid.hasAttribute(NUDGED_ATTR)) return
  grid.setAttribute(NUDGED_ATTR, '1')
  const cs = getComputedStyle(grid)
  if (cs.position === 'static') {
    // Need a positioning context for absolute positioning. Only override when
    // 'static' (the browser default) - don't clobber an explicit
    // relative/absolute the consumer chose.
    grid.style.position = 'relative'
  }
  const a = buildWatermark('grid')
  applyWatermarkStyles(a, /* fixed */ false)
  grid.appendChild(a)
  scheduleFadeOut(a)
}

function ensureFixedFallback(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`[${WATERMARK_ATTR}="fixed"]`)) return
  const a = buildWatermark('fixed')
  applyWatermarkStyles(a, /* fixed */ true)
  document.body.appendChild(a)
  scheduleFadeOut(a)
}

function buildWatermark(kind: 'grid' | 'fixed'): HTMLAnchorElement {
  const a = document.createElement('a')
  a.setAttribute(WATERMARK_ATTR, kind)
  a.href = HOMEPAGE_URL
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.textContent = WATERMARK_LABEL
  a.title =
    'Unlicensed @svgrid/enterprise. Contact sales@jqwidgets.com or visit www.svgrid.com.'
  return a
}

/** Keep the watermark visible for VISIBLE_MS, then fade it out and remove it. */
function scheduleFadeOut(el: HTMLElement): void {
  if (typeof window === 'undefined') {
    el.remove()
    return
  }
  window.setTimeout(() => {
    el.style.opacity = '0'
    window.setTimeout(() => el.remove(), FADE_MS)
  }, VISIBLE_MS)
}

function applyWatermarkStyles(el: HTMLAnchorElement, fixed: boolean): void {
  Object.assign(el.style, {
    position: fixed ? 'fixed' : 'absolute',
    bottom: fixed ? '12px' : '6px',
    right: fixed ? '12px' : '8px',
    zIndex: '2147483647',
    background: 'rgba(15,23,42,0.85)',
    color: '#fff',
    padding: fixed ? '6px 10px' : '4px 8px',
    borderRadius: fixed ? '4px' : '3px',
    fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: fixed ? '11px' : '10px',
    lineHeight: '1.2',
    textDecoration: 'none',
    boxShadow: fixed ? '0 2px 12px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.18)',
    pointerEvents: 'auto',
    letterSpacing: '0.02em',
    opacity: '1',
    transition: `opacity ${FADE_MS}ms ease`,
  } as Partial<CSSStyleDeclaration> as CSSStyleDeclaration)
}
