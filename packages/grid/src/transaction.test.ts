import { describe, expect, it } from 'vitest'
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
})
