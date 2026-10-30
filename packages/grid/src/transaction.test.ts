import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Order = { id: string; symbol: string; price: number }

const features = tableFeatures({})
const seed: Order[] = [
  { id: 'a', symbol: 'AAPL', price: 100 },
  { id: 'b', symbol: 'MSFT', price: 200 },
  { id: 'c', symbol: 'NVDA', price: 300 },
]
const columns: ColumnDef<typeof features, Order>[] = [
  { field: 'symbol', header: 'Symbol' },
  { field: 'price', header: 'Price' },
]

function mountGrid(): Promise<{ api: SvGridApi<typeof features, Order>; destroy: () => void }> {
  return new Promise((resolve, reject) => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let captured: SvGridApi<typeof features, Order> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: seed,
        columns,
        features,
        getRowId: (o: Order) => o.id,
        _rowModels: {
          coreRowModel: createCoreRowModel(),
          filteredRowModel: createFilteredRowModel(),
          sortedRowModel: createSortedRowModel(sortFns),
        },
        containerHeight: 400,
        virtualization: false,
        onApiReady(api: SvGridApi<typeof features, Order>) {
          captured = api
          resolve({ api, destroy: () => { unmount(app); target.remove() } })
        },
      } as any,
    })
    queueMicrotask(() => { if (!captured) reject(new Error('onApiReady never fired')) })
  })
}

const tick = () => Promise.resolve()

describe('api.applyTransaction', () => {
  it('adds, updates (by id), and removes (by id) in one batch', async () => {
    const { api, destroy } = await mountGrid()
    try {
      const result = api.applyTransaction({
        add: [{ id: 'd', symbol: 'AMZN', price: 400 }],
        update: [{ id: 'b', symbol: 'MSFT', price: 222 }],
        remove: ['a'],
      })
      await tick()
      expect(result).toEqual({ added: 1, updated: 1, removed: 1 })
      const data = api.getData()
      expect(data.map((o) => o.id)).toEqual(['b', 'c', 'd'])
      expect(data.find((o) => o.id === 'b')?.price).toBe(222)
    } finally {
      destroy()
    }
  })

  it('removes by row reference too', async () => {
    const { api, destroy } = await mountGrid()
    try {
      const ref = api.getData()[2]! // 'c'
      const result = api.applyTransaction({ remove: [ref] })
      await tick()
      expect(result.removed).toBe(1)
      expect(api.getData().map((o) => o.id)).toEqual(['a', 'b'])
    } finally {
      destroy()
    }
  })

  it('ignores unknown ids without throwing', async () => {
    const { api, destroy } = await mountGrid()
    try {
      const result = api.applyTransaction({ update: [{ id: 'zzz', symbol: 'X', price: 1 }], remove: ['nope'] })
      await tick()
      expect(result).toEqual({ added: 0, updated: 0, removed: 0 })
      expect(api.getData()).toHaveLength(3)
    } finally {
      destroy()
    }
  })
  it('removes a row that the same transaction also updates, by id or by reference', async () => {
    const { api, destroy } = await mountGrid()
    try {
      const byId = api.applyTransaction({ update: [{ id: 'a', symbol: 'AAPL', price: 1 }], remove: ['a'] })
      await tick()
      expect(byId).toEqual({ added: 0, updated: 1, removed: 1 })
      expect(api.getData().map((o) => o.id)).toEqual(['b', 'c'])
      const ref = api.getData()[0]! // 'b'
      const byRef = api.applyTransaction({ update: [{ id: 'b', symbol: 'MSFT', price: 2 }], remove: [ref] })
      await tick()
      expect(byRef).toEqual({ added: 0, updated: 1, removed: 1 })
      expect(api.getData().map((o) => o.id)).toEqual(['c'])
    } finally {
      destroy()
    }
  })

  it('a large reference removal scans the data once, not once per row', async () => {
    // One `indexOf` per removed object was rows x removed: 10k objects out of
    // a 1M-row grid scanned the array 10k times. The transaction crosses
    // them off in its filter pass instead; these are out of data order and
    // one repeats, so they take the second pass, through a Set.
    const big: Order[] = Array.from({ length: 2_000 }, (_, i) => ({ id: `r${i}`, symbol: 'X', price: i }))
    const target = document.createElement('div')
    document.body.appendChild(target)
    let captured: SvGridApi<typeof features, Order> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: big,
        columns,
        features,
        getRowId: (o: Order) => o.id,
        _rowModels: { coreRowModel: createCoreRowModel() },
        containerHeight: 400,
        onApiReady(api: SvGridApi<typeof features, Order>) { captured = api },
      } as any,
    })
    const indexOf = vi.spyOn(Array.prototype, 'indexOf')
    try {
      await tick()
      const api = captured!
      const data = api.getData()
      // Every other row from the back half, plus one id, in shuffled order.
      const refs = data.filter((_, i) => i >= 1_000 && i % 2 === 0).reverse()
      indexOf.mockClear()
      const result = api.applyTransaction({ remove: [...refs, 'r1', refs[0]!] })
      const scans = indexOf.mock.calls.length
      await tick()
      expect(scans).toBe(0)
      expect(result.removed).toBe(refs.length + 1)
      const ids = api.getData().map((o) => o.id)
      expect(ids).toHaveLength(2_000 - refs.length - 1)
      expect(ids.slice(0, 3)).toEqual(['r0', 'r2', 'r3'])
      expect(ids).toContain('r1001')
      expect(ids).not.toContain('r1000')
    } finally {
      indexOf.mockRestore()
      unmount(app)
      target.remove()
    }
  })

  it('a removal of row objects alone asks getRowId about no row', async () => {
    // The id -> index map answers id removals; building it for a batch of
    // objects was a getRowId call per row, a million on a million-row grid.
    const big: Order[] = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, symbol: 'X', price: i }))
    const target = document.createElement('div')
    document.body.appendChild(target)
    let calls = 0
    let captured: SvGridApi<typeof features, Order> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: big,
        columns,
        features,
        getRowId: (o: Order) => { calls++; return o.id },
        _rowModels: { coreRowModel: createCoreRowModel() },
        containerHeight: 400,
        onApiReady(api: SvGridApi<typeof features, Order>) { captured = api },
      } as any,
    })
    try {
      await tick()
      const api = captured!
      const refs = api.getData().slice(10, 30)
      calls = 0
      const result = api.applyTransaction({ remove: refs })
      expect(calls).toBe(0)
      expect(result.removed).toBe(20)
      await tick()
      expect(api.getData().map((o) => o.id)).toEqual([...big.slice(0, 10), ...big.slice(30)].map((o) => o.id))
    } finally {
      unmount(app)
      target.remove()
    }
  })

  it('an update batch looks its rows up by id instead of walking the array', async () => {
    // The id -> index map is built once per data array and carried across
    // update-only transactions, so the second tick calls getRowId only for
    // the rows in the batch. Before, every transaction called it for every
    // row - 100k calls per tick on a 100k-row feed.
    const target = document.createElement('div')
    document.body.appendChild(target)
    let calls = 0
    let captured: SvGridApi<typeof features, Order> | null = null
    const app = mount(SvGrid, {
      target,
      props: {
        data: seed,
        columns,
        features,
        getRowId: (o: Order) => { calls++; return o.id },
        _rowModels: { coreRowModel: createCoreRowModel(), filteredRowModel: createFilteredRowModel(), sortedRowModel: createSortedRowModel(sortFns) },
        containerHeight: 400,
        virtualization: false,
        onApiReady(api: SvGridApi<typeof features, Order>) { captured = api },
      } as any,
    })
    try {
      await tick()
      const api = captured!
      api.applyTransaction({ update: [{ id: 'b', symbol: 'MSFT', price: 201 }] })
      await tick()
      const afterFirst = calls
      api.applyTransaction({ update: [{ id: 'b', symbol: 'MSFT', price: 202 }] })
      await tick()
      // One call: the id of the update itself. The row model's own getRowId
      // calls for the replaced row are not part of this count because the
      // map answered the lookup.
      expect(calls - afterFirst).toBeLessThanOrEqual(2)
      expect(api.getData()[1]!.price).toBe(202)
    } finally {
      unmount(app)
      target.remove()
    }
  })
})

