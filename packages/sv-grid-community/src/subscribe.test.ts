/**
 * Unit tests for the grid-store subscribe helper.
 *
 * The function attaches a selector to grid.store and shallow-compares each
 * emitted state, updating the returned `current` getter only when the
 * selection actually changed.
 */
import { describe, expect, it } from 'vitest'
import { subscribeGrid, subscribeSvGrid } from './subscribe'

type Listener = () => void

/**
 * Minimal hand-rolled stand-in for `grid.store` that mimics the TanStack
 * Store shape `subscribeGrid` reads: `state` getter + `subscribe(listener)`
 * + `setState(updater)` that fires the listeners.
 */
function makeFakeStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<Listener>()
  const store = {
    get state() {
      return state
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setState(updater: (prev: T) => T) {
      state = updater(state)
      for (const l of listeners) l()
    },
  }
  return store
}

describe('subscribeGrid', () => {
  it('starts with the current selected value', () => {
    const store = makeFakeStore({ sorting: ['name'], rowSelection: { '0': true } })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sorting)
    expect(sub.current).toEqual(['name'])
  })

  it('updates the selected value when the store fires a change', () => {
    const store = makeFakeStore({ sorting: ['name'] })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sorting)
    store.setState((prev) => ({ ...prev, sorting: ['age'] }))
    expect(sub.current).toEqual(['age'])
  })

  it('keeps the previous reference when shallow-compare reports equal', () => {
    const store = makeFakeStore<{ sel: Record<string, boolean> }>({ sel: { a: true } })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sel)
    const initial = sub.current
    // A new object with the same key/value content - shallow-equal to the prev.
    store.setState(() => ({ sel: { a: true } }))
    expect(sub.current).toBe(initial)
  })

  it('replaces the reference when a key value changes', () => {
    const store = makeFakeStore<{ sel: Record<string, boolean> }>({ sel: { a: true } })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sel)
    const initial = sub.current
    store.setState(() => ({ sel: { a: false } }))
    expect(sub.current).not.toBe(initial)
    expect(sub.current).toEqual({ a: false })
  })

  it('treats a different key set as a change', () => {
    const store = makeFakeStore<{ sel: Record<string, boolean> }>({ sel: { a: true } })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sel)
    store.setState(() => ({ sel: { a: true, b: true } }))
    expect(sub.current).toEqual({ a: true, b: true })
  })

  it('treats primitive selections (numbers, strings) correctly', () => {
    const store = makeFakeStore({ count: 1 })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.count)
    expect(sub.current).toBe(1)
    store.setState(() => ({ count: 1 }))
    expect(sub.current).toBe(1)
    store.setState(() => ({ count: 2 }))
    expect(sub.current).toBe(2)
  })

  it('treats null and undefined as inequal to objects (early-return shallowCompare branch)', () => {
    const store = makeFakeStore<{ sel: Record<string, boolean> | null }>({ sel: { a: true } })
    const grid = { store } as any
    const sub = subscribeGrid(grid, (s) => s.sel)
    store.setState(() => ({ sel: null }))
    expect(sub.current).toBeNull()
  })

  it('exports the subscribeSvGrid alias as the same function', () => {
    expect(subscribeSvGrid).toBe(subscribeGrid)
  })
})
