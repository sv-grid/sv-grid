// Google tag (gtag.js) helpers for the marketing site.
//
// The GA4 / Google Ads loader is installed in index.html and fires the
// initial pageview when the page boots. The router is history-based, so
// every subsequent route change is a JS navigation that gtag does NOT see
// on its own - we have to push a page_view event for it. Without this,
// only the landing page is counted and Google Ads conversion attribution
// + GA4 behavior flow under-report by a large margin.
//
// SCOPE: marketing site only. Nothing here ships in the @svgrid/* packages.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Send a `page_view` event for the current URL + title to every gtag
 * configuration installed in index.html. No-op if the gtag loader hasn't
 * resolved yet (ad blocker, private mode, dev server before the bootstrap
 * script ran). Never throws - analytics must not break navigation.
 */
export function trackGtagPageview(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return
  try {
    gtag('event', 'page_view', {
      page_path: window.location.pathname + window.location.search,
      page_title: document.title,
      page_location: window.location.href,
    })
  } catch {
    // ignore
  }
}
