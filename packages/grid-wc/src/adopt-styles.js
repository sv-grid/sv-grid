/**
 * Put the bundle's CSS inside a shadow root.
 *
 * The build's `inlineCss` plugin splits the stylesheet per chunk: the entry's
 * CSS goes on `globalThis.__SVGRID_WC_CSS__` and into `document.head`; each
 * lazy chunk (the chart, the date pickers, the menus) carries its own CSS and
 * announces it through `globalThis.__SVGRID_WC_ADD_CSS__` when it loads, so a
 * page that never charts never downloads the chart's styles. The light-DOM
 * element needs only the head copies. The shadow element needs BOTH:
 *
 *  - in the shadow root, because a `<style>` in the document does not cross the
 *    boundary, so the grid would render unstyled;
 *  - in the document, because about twenty overlay surfaces (the cell dropdown,
 *    date picker, tooltips, toasts, modals) portal to `document.body` on
 *    purpose, to escape every ancestor `overflow` and clip. Those land OUTSIDE
 *    the shadow root and are styled by the head copy.
 *
 * So the isolation a shadow root buys here is one-directional and worth stating
 * plainly: page CSS cannot reach into the grid, but the grid's own stylesheet
 * is still present in the page for the popups' sake.
 */

/** Every open root that adopted the styles, so a chunk loaded later reaches it. */
const roots = new Set()
/** The lazy chunks' CSS, in load order, for roots that adopt after they loaded. */
const extra = []

function makeSheet(css) {
  if (typeof CSSStyleSheet === 'undefined') return null
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    return sheet
  } catch {
    // `replaceSync` throws on an @import, and older engines reject assigning
    // a frozen adoptedStyleSheets array. The caller falls back to a <style>.
    return null
  }
}

function applyTo(root, sheet, css, key) {
  if (sheet && 'adoptedStyleSheets' in root) {
    try {
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
      }
      return
    } catch {
      /* fall through to a <style> */
    }
  }
  if (root.querySelector(`style[data-svgrid-wc-shadow="${key}"]`)) return
  const el = document.createElement('style')
  el.setAttribute('data-svgrid-wc-shadow', key)
  el.textContent = css
  root.appendChild(el)
}

/**
 * Adopt the grid's styles into a shadow root: the entry's sheet plus every
 * lazy chunk's already loaded. Returns a function that forgets the root, for
 * the element's disconnect.
 */
export function adoptGridStyles(root) {
  const css = globalThis.__SVGRID_WC_CSS__
  if (!root || typeof css !== 'string' || css === '') return () => {}

  // Constructable stylesheets are shared, so N elements cost one sheet.
  let sheet = globalThis.__SVGRID_WC_SHEET__
  if (!sheet) {
    sheet = makeSheet(css)
    if (sheet) globalThis.__SVGRID_WC_SHEET__ = sheet
  }
  applyTo(root, sheet, css, 'base')
  for (const x of extra) applyTo(root, x.sheet, x.css, x.key)
  roots.add(root)
  return () => roots.delete(root)
}

/** A lazy chunk's CSS arrived: give it to every adopted root, now and later. */
function addChunkCss(css) {
  if (typeof css !== 'string' || !css) return
  const entry = { css, sheet: makeSheet(css), key: `chunk-${extra.length}` }
  extra.push(entry)
  for (const root of roots) applyTo(root, entry.sheet, entry.css, entry.key)
}

if (typeof globalThis !== 'undefined') {
  // Chunks that loaded before this module queued their CSS; drain it.
  const pending = globalThis.__SVGRID_WC_CSS_CHUNKS__
  globalThis.__SVGRID_WC_ADD_CSS__ = addChunkCss
  if (Array.isArray(pending)) {
    for (const css of pending) addChunkCss(css)
    pending.length = 0
  }
}
