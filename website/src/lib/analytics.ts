// Privacy-friendly, cookieless analytics for the svgrid.com marketing site,
// powered by Umami (umami.is) - hosted free tier or self-hosted.
//
// SCOPE: this instruments the WEBSITE only. The sv-grid library itself stays
// zero-telemetry - nothing in this file ships in the npm packages (see
// docs/help/security.md). Keep that line clean.
//
// Principles:
//   - Cookieless. No localStorage, no fingerprinting, no cross-site tracking,
//     no PII. We send anonymous event names + a few coarse props (e.g. tier).
//   - Consent-light by design, and we still honor signals: if Do Not Track or
//     Global Privacy Control is set, analytics is fully disabled.
//   - Production only. Active in `vite build` output (GitHub Pages) with the
//     baked-in Umami website id; a no-op in dev / preview so localhost traffic
//     never reaches the dashboard. Override the id via VITE_ANALYTICS_WEBSITE_ID.
//   - Manual pageviews (data-auto-track="false") so SPA route changes are
//     counted exactly once, from the same place we update SEO.

type Props = Record<string, string | number | boolean>

declare global {
  interface Window {
    umami?: {
      track: (event?: string | Props, data?: Props) => void
    }
  }
}

// Umami "website id" (a UUID from your Umami dashboard). Public value (it's in
// the client script tag), so it's baked in as the default; override with
// VITE_ANALYTICS_WEBSITE_ID at build time to point at a different site.
const WEBSITE_ID =
  (import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined) ||
  'ab599902-f07b-4347-8de3-241502e7ab14'
// Tracker script. Defaults to Umami Cloud; point at your own host to self-host.
const SRC =
  (import.meta.env.VITE_ANALYTICS_SRC as string | undefined) ||
  'https://cloud.umami.is/script.js'
// Optional: override where events are sent (self-hosted/proxied instances).
const HOST_URL = import.meta.env.VITE_ANALYTICS_HOST_URL as string | undefined

let started = false
let enabled = false
let ready = false
const pending: Array<() => void> = []

/** Honor Do Not Track / Global Privacy Control across browsers. */
function privacySignalsOptOut(): boolean {
  if (typeof navigator === 'undefined') return true
  const dnt =
    navigator.doNotTrack ??
    (window as unknown as { doNotTrack?: string }).doNotTrack ??
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack
  if (dnt === '1' || dnt === 'yes') return true
  if ((navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl) {
    return true
  }
  return false
}

function run(fn: () => void): void {
  if (!enabled) return
  if (ready && typeof window !== 'undefined' && window.umami) {
    try {
      fn()
    } catch {
      // analytics must never break the app
    }
  } else {
    // Buffer until the deferred script has loaded, then flush in order.
    pending.push(fn)
  }
}

/**
 * Initialize analytics once, from the app root. Safe to call repeatedly. Does
 * nothing (and loads no script) when unconfigured or when the visitor opts out
 * via DNT/GPC, so the default build ships zero tracking.
 */
export function initAnalytics(): void {
  if (started) return
  started = true
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!WEBSITE_ID) return // unconfigured -> stay dark
  // Production only: never send dev / localhost / preview traffic to the
  // dashboard. import.meta.env.PROD is true only in `vite build` output.
  if (!import.meta.env.PROD) return
  if (privacySignalsOptOut()) return

  enabled = true
  const s = document.createElement('script')
  s.defer = true
  s.src = SRC
  s.setAttribute('data-website-id', WEBSITE_ID)
  // We send pageviews manually (one per SPA route change), so turn off the
  // tracker's own auto pageview to avoid double counting.
  s.setAttribute('data-auto-track', 'false')
  if (HOST_URL) s.setAttribute('data-host-url', HOST_URL)
  s.addEventListener('load', () => {
    ready = true
    while (pending.length) pending.shift()!()
  })
  document.head.appendChild(s)
}

/** Fire a custom event. No-op when analytics is disabled. */
export function track(event: string, props?: Props): void {
  run(() => window.umami!.track(event, props))
}

/** Manual pageview - call on every SPA route change. */
export function trackPageview(): void {
  // umami.track() with no arguments records a pageview for the current URL.
  run(() => window.umami!.track())
}

// ---------------------------------------------------------------------------
// Funnel events. One named place so call sites stay consistent and the
// dashboard funnel matches the code. Stages:
//   awareness/activation -> consideration -> intent/purchase -> sales
// ---------------------------------------------------------------------------

export const funnel = {
  /** Install command copied on the home page. */
  installCopied: (pkg: string) => track('Install Copied', { package: pkg }),
  /** A specific demo was opened. */
  demoViewed: (id: string) => track('Demo Viewed', { demo: id }),
  /** A comparison ("vs X") page was opened. */
  compareViewed: (slug: string) => track('Compare Viewed', { competitor: slug }),
  /** The pricing page was viewed. */
  pricingViewed: () => track('Pricing Viewed'),
  /** Buy modal opened for a tier (intent). */
  buyDialogOpened: (tier: string) => track('Buy Dialog Opened', { tier }),
  /** Reached the pay step with a valid form (checkout started). */
  checkoutStarted: (tier: string) => track('Checkout Started', { tier }),
  /** PayPal approved the subscription (purchase). */
  checkoutCompleted: (tier: string) => track('Checkout Completed', { tier }),
  /** Clicked a "talk to sales" / volume / enterprise contact. */
  contactSales: (where: string) => track('Contact Sales', { where }),
}
