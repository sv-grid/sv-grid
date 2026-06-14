import { describe, expect, it, vi } from 'vitest'
import { createNamedViews, memoryViews } from './named-views'
import type { SvGridViewState } from './svgrid-wrapper.types'

function fakeHost(initial: Partial<SvGridViewState> = {}) {
  let state = { sorting: [], columnFilters: [], ...initial } as SvGridViewState
  return {
    getState: () => state,
    setState: vi.fn((s: Partial<SvGridViewState>) => {
      state = { ...state, ...s }
    }),
    _peek: () => state,
  }
}

describe('createNamedViews', () => {
  it('saves the current state and lists it', () => {
    const host = fakeHost({ sorting: [{ id: 'name', desc: true }] })
    const views = createNamedViews(host, { storage: memoryViews() })
    views.save('By name')
    expect(views.list().map((v) => v.name)).toEqual(['By name'])
    expect(views.has('By name')).toBe(true)
  })

  it('load applies the saved state via setState', () => {
    const host = fakeHost({ sorting: [{ id: 'age', desc: false }] })
    const views = createNamedViews(host, { storage: memoryViews() })
    views.save('snap')
    host.setState({ sorting: [] }) // mutate away
    host.setState.mockClear()
    expect(views.load('snap')).toBe(true)
    expect(host.setState).toHaveBeenCalledWith(
      expect.objectContaining({ sorting: [{ id: 'age', desc: false }] }),
    )
    expect(views.load('missing')).toBe(false)
  })

  it('save overwrites a duplicate name but keeps its createdAt', () => {
    const host = fakeHost()
    const views = createNamedViews(host, { storage: memoryViews() })
    const a = views.save('v')
    const b = views.save('v')
    expect(views.list()).toHaveLength(1)
    expect(b.createdAt).toBe(a.createdAt)
  })

  it('remove and rename', () => {
    const host = fakeHost()
    const views = createNamedViews(host, { storage: memoryViews() })
    views.save('a')
    views.save('b')
    expect(views.rename('a', 'c')).toBe(true)
    expect(views.rename('c', 'b')).toBe(false) // target exists
    expect(views.remove('c')).toBe(true)
    expect(views.remove('c')).toBe(false)
    expect(views.list().map((v) => v.name)).toEqual(['b'])
  })

  it('persists through a storage adapter', () => {
    const store = memoryViews()
    createNamedViews(fakeHost({ sorting: [{ id: 'x', desc: true }] }), { storage: store }).save('keep')
    // A fresh manager over the same storage sees it.
    const reopened = createNamedViews(fakeHost(), { storage: store })
    expect(reopened.has('keep')).toBe(true)
  })
})
