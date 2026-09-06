/**
 * Put the bundle's CSS inside a shadow root.
 *
 * The build's `inlineCss` plugin hoists every stylesheet in the bundle into one
 * string, stashes it on `globalThis.__SVGRID_WC_CSS__`, and appends it to
 * `document.head`. The light-DOM element needs only the head copy. The shadow
 * element needs BOTH:
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
export function adoptGridStyles(root) {
  const css = globalThis.__SVGRID_WC_CSS__
  if (!root || typeof css !== 'string' || css === '') return

  // Constructable stylesheets are shared, so N elements cost one sheet.
  if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in root) {
    try {
      let sheet = globalThis.__SVGRID_WC_SHEET__
      if (!sheet) {
        sheet = new CSSStyleSheet()
        sheet.replaceSync(css)
        globalThis.__SVGRID_WC_SHEET__ = sheet
      }
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
      }
      return
    } catch {
      // `replaceSync` throws on an @import, and older engines reject assigning
      // a frozen adoptedStyleSheets array. Fall through to a <style>.
    }
  }

  if (root.querySelector('style[data-svgrid-wc-shadow]')) return
  const el = document.createElement('style')
  el.setAttribute('data-svgrid-wc-shadow', '')
  el.textContent = css
  root.appendChild(el)
}
