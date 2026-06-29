import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachAutoSavedView,
  createNamedViews,
  localStorageViews,
  memoryViews,
  type ViewStorage,
} from './named-views'
import type { SvGridViewState } from './svgrid-wrapper.types'

function fakeHost(initial: Partial<SvGridViewState> = {}) {
  let state = { sorting: [], columnFilters: [], ...initial } as SvGridViewState
  return {
    getState: () => state,
    setState: vi.fn((s: Partial<SvGridViewState>) => {
      state = { ...state, ...s }
    }),
    set: (s: SvGridViewState) => {
      state = s
    },
  }
}

describe('createNamedViews - list ordering and edge cases', () => {
  it('lists views sorted by createdAt ascending', () => {
    const store = memoryViews([
      { name: 'late', state: {}, createdAt: 200 },
      { name: 'early', state: {}, createdAt: 100 },
    ])
    const views = createNamedViews(fakeHost(), { storage: store })
    expect(views.list().map((v) => v.name)).toEqual(['early', 'late'])
  })

  it('defaults to memory storage when none is passed', () => {
    const views = createNamedViews(fakeHost({ sorting: [{ id: 'a', desc: true }] }))
    views.save('only')
    expect(views.has('only')).toBe(true)
    expect(views.list()).toHaveLength(1)
  })

  it('rename returns false when the source name is unknown', () => {
    const views = createNamedViews(fakeHost(), { storage: memoryViews() })
    views.save('a')
    expect(views.rename('missing', 'b')).toBe(false)
    expect(views.list().map((v) => v.name)).toEqual(['a'])
  })

  it('load returns false and does not call setState for unknown name', () => {
    const host = fakeHost()
    const views = createNamedViews(host, { storage: memoryViews() })
    host.setState.mockClear()
    expect(views.load('nope')).toBe(false)
    expect(host.setState).not.toHaveBeenCalled()
  })

  it('save captures the current host state snapshot', () => {
    const host = fakeHost({ sorting: [{ id: 'z', desc: false }] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const v = views.save('snap')
    expect(v.state).toMatchObject({ sorting: [{ id: 'z', desc: false }] })
    expect(typeof v.createdAt).toBe('number')
  })
})

describe('localStorageViews', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('reads [] when the key is absent', () => {
    const store = localStorageViews('svgrid:absent')
    expect(store.read()).toEqual([])
  })

  it('round-trips views through localStorage', () => {
    const store = localStorageViews('svgrid:rt')
    const views = [{ name: 'x', state: {}, createdAt: 1 }]
    store.write(views)
    expect(store.read()).toEqual(views)
    // raw JSON is actually present
    expect(JSON.parse(localStorage.getItem('svgrid:rt')!)).toEqual(views)
  })

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem('svgrid:bad', '{not valid json')
    expect(localStorageViews('svgrid:bad').read()).toEqual([])
  })

  it('returns [] when the stored value is not an array', () => {
    localStorage.setItem('svgrid:obj', JSON.stringify({ foo: 'bar' }))
    expect(localStorageViews('svgrid:obj').read()).toEqual([])
  })

  it('swallows write errors (quota / private mode)', () => {
    const store = localStorageViews('svgrid:quota')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => store.write([{ name: 'a', state: {}, createdAt: 1 }])).not.toThrow()
    spy.mockRestore()
  })

  it('works end-to-end as a NamedViews adapter', () => {
    const views = createNamedViews(fakeHost({ sorting: [{ id: 'p', desc: true }] }), {
      storage: localStorageViews('svgrid:adapter'),
    })
    views.save('persisted')
    const reopened = createNamedViews(fakeHost(), {
      storage: localStorageViews('svgrid:adapter'),
    })
    expect(reopened.has('persisted')).toBe(true)
    expect(reopened.load('persisted')).toBe(true)
  })
})

describe('attachAutoSavedView', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('restores an existing autosave slot on attach', () => {
    const host = fakeHost()
    const store: ViewStorage = memoryViews([
      { name: '__autosave', state: { sorting: [{ id: 'restored', desc: true }] }, createdAt: 1 },
    ])
    const views = createNamedViews(host, { storage: store })
    const off = attachAutoSavedView(host, views)
    expect(host.setState).toHaveBeenCalledWith(
      expect.objectContaining({ sorting: [{ id: 'restored', desc: true }] }),
    )
    off()
  })

  it('skips restore when skipRestore is set', () => {
    const host = fakeHost()
    const store = memoryViews([{ name: '__autosave', state: { sorting: [] }, createdAt: 1 }])
    const views = createNamedViews(host, { storage: store })
    const off = attachAutoSavedView(host, views, { skipRestore: true })
    expect(host.setState).not.toHaveBeenCalled()
    off()
  })

  it('saves when the state snapshot changes after an interval', () => {
    const host = fakeHost({ sorting: [] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const off = attachAutoSavedView(host, views, { intervalMs: 500 })
    expect(views.has('__autosave')).toBe(false)
    // mutate the host state, then let the poller tick
    host.set({ sorting: [{ id: 'new', desc: false }], columnFilters: [] } as SvGridViewState)
    vi.advanceTimersByTime(500)
    expect(views.has('__autosave')).toBe(true)
    off()
  })

  it('does not save when the snapshot is unchanged', () => {
    const host = fakeHost({ sorting: [] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const saveSpy = vi.spyOn(views, 'save')
    const off = attachAutoSavedView(host, views, { intervalMs: 300 })
    vi.advanceTimersByTime(900) // several ticks, no state change
    expect(saveSpy).not.toHaveBeenCalled()
    off()
  })

  it('uses a custom slot name', () => {
    const host = fakeHost({ sorting: [] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const off = attachAutoSavedView(host, views, { name: 'mySlot', intervalMs: 200 })
    host.set({ sorting: [{ id: 'q', desc: true }], columnFilters: [] } as SvGridViewState)
    vi.advanceTimersByTime(200)
    expect(views.has('mySlot')).toBe(true)
    off()
  })

  it('clamps the interval to a minimum of 100ms', () => {
    const host = fakeHost({ sorting: [] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const off = attachAutoSavedView(host, views, { intervalMs: 5 })
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 100)
    off()
    setIntervalSpy.mockRestore()
  })

  it('recovers when getState throws inside the poll loop', () => {
    let throwing = false
    const host = {
      getState: () => {
        if (throwing) throw new Error('boom')
        return { sorting: [], columnFilters: [] } as SvGridViewState
      },
      setState: vi.fn(),
    }
    const views = createNamedViews(host, { storage: memoryViews() })
    const saveSpy = vi.spyOn(views, 'save')
    const off = attachAutoSavedView(host, views, { intervalMs: 200 })
    throwing = true
    expect(() => vi.advanceTimersByTime(400)).not.toThrow()
    expect(saveSpy).not.toHaveBeenCalled()
    off()
  })

  it('detach stops the polling interval', () => {
    const host = fakeHost({ sorting: [] })
    const views = createNamedViews(host, { storage: memoryViews() })
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const off = attachAutoSavedView(host, views, { intervalMs: 200 })
    off()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
