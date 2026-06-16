import { beforeAll, describe, expect, it } from 'vitest'

// jsdom doesn't implement ResizeObserver, which the grid sets up on mount.
// A no-op shim lets the element connect without throwing. (Real layout /
// virtualization is exercised in a browser, not here - this is a smoke test
// of the built bundle: registration, style injection, and clean mount.)
class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(async () => {
  // @ts-expect-error - assigning a test shim
  globalThis.ResizeObserver ??= ResizeObserverShim
  // Importing the bundle registers <sv-grid> and injects its <style>.
  await import('../dist/sv-grid-element.js')
})

describe('sv-grid built bundle', () => {
  it('registers the <sv-grid> custom element on import', () => {
    expect(customElements.get('sv-grid')).toBeTruthy()
  })

  it('injects its styles once, into the document', () => {
    const styles = document.querySelectorAll('style[data-svgrid-grid-wc]')
    expect(styles.length).toBe(1)
    expect(styles[0].textContent).toContain('sv-grid')
  })

  it('upgrades and mounts when data + columns are set as properties', async () => {
    const el = document.createElement('sv-grid') as HTMLElement & {
      data?: unknown
      columns?: unknown
    }
    el.columns = [{ field: 'name', header: 'Name' }]
    el.data = [{ name: 'Ada' }, { name: 'Linus' }]
    document.body.appendChild(el)

    // It's an upgraded custom element, not a plain unknown element.
    expect(el).toBeInstanceOf(customElements.get('sv-grid')!)

    // Let Svelte flush its mount effects, then assert the wrapper rendered
    // light-DOM content (shadow: 'none').
    await new Promise((r) => setTimeout(r, 50))
    expect(el.children.length).toBeGreaterThan(0)
  })
})
