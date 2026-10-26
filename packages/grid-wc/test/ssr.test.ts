// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

// A server has no customElements and no HTMLElement. Svelte registers the
// element with a bare top-level `customElements.define(...)`, so before the
// ssr-safe-define build step every import below threw during SSR - which is
// the default for a TanStack Start (Lovable), Next or Remix app that renders
// <SvGrid> from '@svgrid/grid-wc/react'.
describe('importing the built bundles on a server', () => {
  it('does not throw for any of the three elements', async () => {
    expect(typeof globalThis.customElements).toBe('undefined')
    await expect(import('../dist/sv-grid-element.js')).resolves.toBeDefined()
    await expect(import('../dist/shadow/sv-grid-shadow-element.js')).resolves.toBeDefined()
    await expect(import('../dist/chart/sv-chart-element.js')).resolves.toBeDefined()
  })

  it('server-renders the React wrapper as a plain <sv-grid> tag', async () => {
    const { SvGrid } = await import('../dist/react/index.js')
    const html = renderToString(
      createElement(SvGrid, { data: [{ name: 'Ada' }], columns: [{ id: 'name', header: 'Name' }], sortable: true }),
    )
    expect(html).toMatch(/^<sv-grid[\s>]/)
    expect(html).toContain('</sv-grid>')
  })
})
