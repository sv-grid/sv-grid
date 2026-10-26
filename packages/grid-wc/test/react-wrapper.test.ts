import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let SvGrid: typeof import('../dist/react/index.js').SvGrid
beforeAll(async () => {
  // @ts-expect-error - assigning a test shim
  globalThis.ResizeObserver ??= ResizeObserverShim
  ;({ SvGrid } = await import('../dist/react/index.js'))
})

let root: Root | null = null
afterEach(async () => {
  root?.unmount()
  root = null
  document.body.innerHTML = ''
  await new Promise((r) => setTimeout(r, 20))
})

describe('React wrapper', () => {
  // A Svelte custom element mounts one microtask after it is inserted and
  // reads its props then. The wrapper used to assign them in a passive
  // useEffect, which runs after paint, so the grid mounted with defaults and
  // props it reads once were lost: pageSize={25} rendered 10 rows a page.
  it('has the props on the element by the time it mounts', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const seen = new Promise<unknown>((resolve) => {
      const mo = new MutationObserver(() => {
        const el = host.querySelector('sv-grid') as (HTMLElement & { pageSize?: unknown }) | null
        if (!el) return
        mo.disconnect()
        resolve(el.pageSize)
      })
      mo.observe(host, { childList: true, subtree: true })
    })
    root = createRoot(host)
    root.render(createElement(SvGrid, { data: [{ name: 'Ada' }], columns: [{ field: 'name' }], pageable: true, pageSize: 25 }))
    expect(await seen).toBe(25)
  })
})
