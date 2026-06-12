// History-based router for clean, individually-indexable URLs.
//
// The site used to be hash-routed (#/docs/...), which collapses every route
// onto one crawlable URL. This module switches to real paths
// (/sv-grid/docs/...) so each page can be prerendered to static HTML and
// indexed on its own. It keeps full backward-compatibility:
//
//   - Old inbound #/... links are rewritten to the clean path on load.
//   - A single global click interceptor turns existing href="#/..." links
//     (and the rendered doc links produced by resolveDocsLink) into pushState
//     navigations, so none of the markup had to change.
//   - In-doc anchors (#section) ride along as real URL fragments and are
//     folded back into the route string so the Docs route keeps working.
//
// `route` is a rune, so consumers just read `router.route` reactively.

const BASE = import.meta.env.BASE_URL || '/'

/** Strip the site base + surrounding slashes from a pathname. */
function pathToRoute(pathname: string): string {
  let p = pathname
  if (p.startsWith(BASE)) p = p.slice(BASE.length)
  return decodeURIComponent(p.replace(/^\/+/, '').replace(/\/+$/, ''))
}

/**
 * Read the active route from the URL. Clean path wins; a legacy `#/...` hash
 * is honoured as a fallback. A plain `#anchor` fragment (in-doc table of
 * contents) is appended so the Docs route can scroll to it.
 */
export function readRoute(): string {
  if (typeof window === 'undefined') return ''
  let route = pathToRoute(window.location.pathname)
  const hash = window.location.hash
  if (!route && hash.startsWith('#/')) {
    // Legacy hash route, e.g. "#/docs/foo#frag".
    return hash.replace(/^#\/?/, '')
  }
  // Real fragment on a clean URL (e.g. "/docs/foo#frag").
  if (hash && !hash.startsWith('#/') && hash !== '#') {
    route = route ? `${route}${hash}` : route
  }
  return route
}

/** Build a clean, base-prefixed URL from a route string like "docs/foo#frag". */
export function routeToUrl(route: string): string {
  const clean = route.replace(/^[#/]+/, '')
  return BASE + clean
}

class Router {
  route = $state(typeof window === 'undefined' ? '' : readRoute())

  /** Navigate to a route string ("demos/01-quick-start", "docs/foo#frag"). */
  navigate(route: string, opts: { replace?: boolean } = {}): void {
    const url = routeToUrl(route)
    if (opts.replace) window.history.replaceState({}, '', url)
    else window.history.pushState({}, '', url)
    this.route = readRoute()
  }

  /** Wire popstate + a global link interceptor. Returns a teardown fn. */
  init(): () => void {
    // Rewrite a legacy hash URL to its clean equivalent so the address bar
    // and canonical agree from the first paint.
    if (window.location.hash.startsWith('#/')) {
      this.navigate(window.location.hash.replace(/^#\/?/, ''), { replace: true })
    }

    const onPop = () => (this.route = readRoute())
    window.addEventListener('popstate', onPop)

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const a = target?.closest?.('a')
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      if (a.target === '_blank' || a.hasAttribute('download')) return
      const rel = a.getAttribute('rel') ?? ''
      if (rel.includes('external')) return
      if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return

      let route: string
      if (href.startsWith('#/')) {
        route = href.slice(1) // "#/docs/x" -> "/docs/x"
      } else if (href === '#' || href.startsWith('#')) {
        return // bare same-page anchor: let the browser handle it
      } else if (href.startsWith(BASE)) {
        route = href.slice(BASE.length)
      } else if (href.startsWith('/')) {
        route = href
      } else {
        return // unknown relative form: leave it to the browser
      }
      e.preventDefault()
      this.navigate(route)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    document.addEventListener('click', onClick)

    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick)
    }
  }
}

export const router = new Router()
