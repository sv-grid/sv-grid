import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Smoke test of the BUILT <sv-grid-shadow> bundle: registration, the open
 * root, and the two-place stylesheet.
 *
 * Deliberately shallow. jsdom has no layout, no `adoptedStyleSheets` on a
 * shadow root in every version, and no `elementFromPoint`, so anything about
 * how the grid actually behaves inside the boundary belongs in the Playwright
 * spec (`tests/e2e/wc-shadow-dom.spec.ts`), which drives a real browser. What
 * this file protects is the part a browser test would take 30 seconds to
 * discover: the element is registered, and it is not accidentally shipped
 * closed or light.
 */
class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(async () => {
  // @ts-expect-error - assigning a test shim
  globalThis.ResizeObserver ??= ResizeObserverShim
  await import('../dist/shadow/sv-grid-shadow-element.js')
})

describe('sv-grid-shadow built bundle', () => {
  it('registers the <sv-grid-shadow> custom element on import', () => {
    expect(customElements.get('sv-grid-shadow')).toBeTruthy()
  })

  it('leaves <sv-grid> alone - this element is additive', () => {
    // The shadow bundle must not register the light element too. A consumer
    // loading both files would otherwise hit "already defined".
    expect(customElements.get('sv-grid')).toBeFalsy()
  })

  it('still injects styles into the DOCUMENT, for the portalled popups', () => {
    // Roughly twenty overlay surfaces (cell dropdown, date picker, tooltip,
    // toast, modal) portal to document.body on purpose, to escape ancestor
    // clipping. They land OUTSIDE the shadow root, so dropping the head copy
    // would leave every one of them unstyled.
    const styles = document.querySelectorAll('style[data-svgrid-grid-wc]')
    expect(styles.length).toBe(1)
    expect(styles[0]!.textContent).toContain('sv-grid')
  })

  it('exposes the CSS on a global so the root can adopt the same text', () => {
    const css = (globalThis as { __SVGRID_WC_CSS__?: string }).__SVGRID_WC_CSS__
    expect(typeof css).toBe('string')
    expect(css!.length).toBeGreaterThan(1000)
  })

  it('attaches an OPEN shadow root, so a consumer can reach their own grid', async () => {
    const el = document.createElement('sv-grid-shadow') as HTMLElement & {
      data?: unknown
      columns?: unknown
    }
    el.columns = [{ field: 'name', header: 'Name' }]
    el.data = [{ name: 'Ada' }, { name: 'Linus' }]
    document.body.appendChild(el)

    expect(el).toBeInstanceOf(customElements.get('sv-grid-shadow')!)
    await new Promise((r) => setTimeout(r, 50))

    // `open` is the contract: closed would make shadowRoot null, and then a
    // consumer could not style, query, or test their own grid.
    expect(el.shadowRoot).toBeTruthy()

    // And the content went INSIDE the root, not into the light DOM.
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0)
    expect(el.children.length).toBe(0)
  })
})
