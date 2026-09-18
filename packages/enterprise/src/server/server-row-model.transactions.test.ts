/**
 * Transactions on `createServerRowModel`: add / update / remove rows in a
 * level without a request, async batching, the source-backed CRUD that ends
 * in a transaction, and single-row patches.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ServerDataSource } from '@svgrid/grid/server'
import { createServerRowModel, GRAND_TOTAL_ROW_ID } from './server-row-model'

type Order = { id: string; region: string; item: string; qty: number }

function orders(): Order[] {
  const out: Order[] = []
  for (const region of ['EMEA', 'APAC']) {
    for (let i = 0; i < 6; i += 1) out.push({ id: `${region}-${i}`, region, item: `item${i}`, qty: i })
  }
  return out
}

/** A grouping backend over a mutable table, so CRUD can be observed. */
function backend(rows: Order[] = orders()) {
  const table = rows
  const source: ServerDataSource<Order> = {
    async getRows(req) {
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      const scoped = table.filter((r) =>
        keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k),
      )
      if (keys.length < groupBy.length) {
        const field = groupBy[keys.length]!
        const buckets = new Map<string, number>()
        for (const r of scoped) {
          const k = String((r as Record<string, unknown>)[field])
          buckets.set(k, (buckets.get(k) ?? 0) + r.qty)
        }
        const groups = [...buckets].map(([k, qty]) => ({ [field]: k, qty }) as unknown as Order)
        return { rows: groups.slice(req.startRow, req.endRow), rowCount: groups.length }
      }
      return { rows: scoped.slice(req.startRow, req.endRow), rowCount: scoped.length }
    },
    async createRow(input) {
      const row = { id: `new-${table.length}`, ...input } as Order
      table.push(row)
      return row
    },
    async updateRow(id, patch) {
      const i = table.findIndex((r) => r.id === id)
      table[i] = { ...table[i]!, ...patch }
      return table[i]!
    },
    async deleteRow(id) {
      const i = table.findIndex((r) => r.id === id)
      table.splice(i, 1)
    },
  }
  return { source, table }
}

const settle = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

function leavesOf(ctl: ReturnType<typeof createServerRowModel<Order>>, route: string[]) {
  return ctl
    .getState()
    .displayRows.filter((r) => r.kind === 'leaf' && (r as { id: string }).id.startsWith(JSON.stringify(route)))
    .map((r) => (r as { data: Order }).data.id)
}

async function opened() {
  const be = backend()
  const ctl = createServerRowModel<Order>(be.source, {
    groupBy: ['region'],
    aggregations: [{ col: 'qty', fn: 'sum' }],
    getRowId: (r) => r.id,
    onChange: () => {},
  })
  ctl.refresh()
  await settle()
  ctl.expandGroup(['EMEA'])
  await settle()
  return { be, ctl }
}

describe('applyTransaction', () => {
  it('adds, updates and removes leaves in a level, reporting what it touched', async () => {
    const { ctl } = await opened()
    expect(leavesOf(ctl, ['EMEA'])).toEqual(['EMEA-0', 'EMEA-1', 'EMEA-2', 'EMEA-3', 'EMEA-4', 'EMEA-5'])

    const result = ctl.applyTransaction({
      route: ['EMEA'],
      add: [{ id: 'EMEA-new', region: 'EMEA', item: 'x', qty: 9 }],
      addIndex: 0,
      update: [{ id: 'EMEA-2', region: 'EMEA', item: 'changed', qty: 99 }],
      remove: ['EMEA-5'],
    })

    expect(result).toEqual({ status: 'applied', add: ['EMEA-new'], update: ['EMEA-2'], remove: ['EMEA-5'] })
    expect(leavesOf(ctl, ['EMEA'])).toEqual(['EMEA-new', 'EMEA-0', 'EMEA-1', 'EMEA-2', 'EMEA-3', 'EMEA-4'])
    const changed = ctl
      .getState()
      .displayRows.find((r) => r.kind === 'leaf' && (r as { data: Order }).data.id === 'EMEA-2') as { data: Order }
    expect(changed.data.item).toBe('changed')
    expect(ctl.getLevelState(['EMEA'])!.rowCount).toBe(6)
    ctl.dispose()
  })

  it('appends at the end when no addIndex is given', async () => {
    const { ctl } = await opened()
    ctl.applyTransaction({ route: ['EMEA'], add: [{ id: 'last', region: 'EMEA', item: 'z', qty: 1 }] })
    expect(leavesOf(ctl, ['EMEA']).at(-1)).toBe('last')
    ctl.dispose()
  })

  it('matches group rows by their key and updates the aggregates shown', async () => {
    const { ctl } = await opened()
    const result = ctl.applyTransaction({
      update: [{ region: 'APAC', qty: 12345 } as unknown as Order],
    })
    expect(result.update).toEqual(['APAC'])
    const apac = ctl.getState().displayRows.find((r) => r.kind === 'group' && r.key === 'APAC') as {
      aggregates: Record<string, unknown>
    }
    expect(apac.aggregates.qty).toBe(12345)
    ctl.dispose()
  })

  it('removing a group drops its expansion and its children', async () => {
    const { ctl } = await opened()
    expect(ctl.isExpanded(['EMEA'])).toBe(true)
    const result = ctl.applyTransaction({ remove: [{ region: 'EMEA' } as unknown as Order] })
    expect(result.remove).toEqual(['EMEA'])
    expect(ctl.isExpanded(['EMEA'])).toBe(false)
    expect(ctl.getLevelState(['EMEA'])).toBeNull()
    expect(ctl.getState().displayRows.map((r) => (r as { key?: string }).key)).toEqual(['APAC'])
    ctl.dispose()
  })

  it('ignores an update or remove for a row that is not in the cache', async () => {
    const { ctl } = await opened()
    const result = ctl.applyTransaction({
      route: ['EMEA'],
      update: [{ id: 'nope', region: 'EMEA', item: '', qty: 0 }],
      remove: ['also-nope'],
    })
    expect(result).toEqual({ status: 'applied', add: [], update: [], remove: [] })
    expect(ctl.getLevelState(['EMEA'])!.rowCount).toBe(6)
    ctl.dispose()
  })

  it('takes an explicit rowCount over the arithmetic', async () => {
    const { ctl } = await opened()
    ctl.applyTransaction({ route: ['EMEA'], remove: ['EMEA-0'], rowCount: 100 })
    expect(ctl.getLevelState(['EMEA'])!.rowCount).toBe(100)
    ctl.dispose()
  })

  it('reports storeNotFound for a level nothing has opened', async () => {
    const { ctl } = await opened()
    const result = ctl.applyTransaction({ route: ['APAC'], add: [{ id: 'x', region: 'APAC', item: '', qty: 0 }] })
    expect(result.status).toBe('storeNotFound')
    ctl.dispose()
  })

  it('reports storeLoading while a level\'s first block is in flight', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const be = backend()
    const slow: ServerDataSource<Order> = {
      async getRows(req) {
        if ((req.groupKeys ?? []).length) await gate
        return be.source.getRows(req)
      },
    }
    const ctl = createServerRowModel<Order>(slow, { groupBy: ['region'], getRowId: (r) => r.id, onChange: () => {} })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(ctl.applyTransaction({ route: ['EMEA'], remove: ['EMEA-0'] }).status).toBe('storeLoading')
    release()
    await settle()
    expect(ctl.applyTransaction({ route: ['EMEA'], remove: ['EMEA-0'] }).status).toBe('applied')
    ctl.dispose()
  })

  it('honours the veto', async () => {
    const be = backend()
    const ctl = createServerRowModel<Order>(be.source, {
      groupBy: ['region'],
      getRowId: (r) => r.id,
      isApplyTransaction: (tx) => !tx.remove,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    expect(ctl.applyTransaction({ remove: [{ region: 'EMEA' } as unknown as Order] }).status).toBe('cancelled')
    expect(ctl.getState().displayRows).toHaveLength(2)
    ctl.dispose()
  })

  it('requires getRowId for leaf-level transactions', async () => {
    const be = backend()
    const ctl = createServerRowModel<Order>(be.source, { groupBy: ['region'], onChange: () => {} })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(() => ctl.applyTransaction({ route: ['EMEA'], remove: [{ id: 'EMEA-0' } as Order] })).toThrow(/getRowId/)
    ctl.dispose()
  })

  it('sets, updates and removes the grand total by its fixed id', async () => {
    const be = backend()
    const ctl = createServerRowModel<Order>(be.source, {
      groupBy: ['region'],
      aggregations: [{ col: 'qty', fn: 'sum' }],
      grandTotalRow: 'bottom',
      getRowId: (r) => r.id,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    expect(ctl.getState().grandTotal).toBeNull() // the backend never answered one

    const total = { id: GRAND_TOTAL_ROW_ID, qty: 30 } as unknown as Order
    expect(ctl.applyTransaction({ add: [total] }).status).toBe('applied')
    expect((ctl.getState().grandTotal as unknown as { qty: number }).qty).toBe(30)
    expect(ctl.getState().displayRows.at(-1)!.kind).toBe('grandTotal')

    ctl.applyTransaction({ update: [{ ...total, qty: 31 } as unknown as Order] })
    expect((ctl.getState().grandTotal as unknown as { qty: number }).qty).toBe(31)

    ctl.applyTransaction({ remove: [total] })
    expect(ctl.getState().grandTotal).toBeNull()
    expect(ctl.getState().displayRows.some((r) => r.kind === 'grandTotal')).toBe(false)
    ctl.dispose()
  })
})

describe('applyTransactionAsync', () => {
  it('batches within the wait window and reports the batch once', async () => {
    vi.useFakeTimers()
    const { ctl } = await opened()
    const flushed: unknown[][] = []
    const results: string[] = []
    const model = createServerRowModel<Order>(backend().source, {
      groupBy: ['region'],
      getRowId: (r) => r.id,
      asyncTransactionWaitMs: 40,
      onChange: () => {},
      onAsyncTransactionsFlushed: (r) => flushed.push(r),
    })
    ctl.dispose()
    model.refresh()
    await vi.runAllTimersAsync()
    model.expandGroup(['EMEA'])
    await vi.runAllTimersAsync()

    model.applyTransactionAsync({ route: ['EMEA'], remove: ['EMEA-0'] }, (r) => results.push(r.status))
    model.applyTransactionAsync({ route: ['EMEA'], remove: ['EMEA-1'] }, (r) => results.push(r.status))
    expect(results).toEqual([]) // nothing yet
    expect(leavesOf(model, ['EMEA'])).toHaveLength(6)

    vi.advanceTimersByTime(40)
    expect(results).toEqual(['applied', 'applied'])
    expect(flushed).toHaveLength(1)
    expect(leavesOf(model, ['EMEA'])).toHaveLength(4)
    model.dispose()
    vi.useRealTimers()
  })

  it('flushes on demand, and waits for a level that is still loading', async () => {
    vi.useFakeTimers()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const be = backend()
    const slow: ServerDataSource<Order> = {
      async getRows(req) {
        if ((req.groupKeys ?? []).length) await gate
        return be.source.getRows(req)
      },
    }
    const model = createServerRowModel<Order>(slow, { groupBy: ['region'], getRowId: (r) => r.id, onChange: () => {} })
    model.refresh()
    await vi.runAllTimersAsync()
    model.expandGroup(['EMEA'])
    await vi.runAllTimersAsync()

    const seen: string[] = []
    model.applyTransactionAsync({ route: ['EMEA'], remove: ['EMEA-0'] }, (r) => seen.push(r.status))
    model.flushAsyncTransactions()
    // The level is loading, so the transaction stays queued rather than failing.
    expect(seen).toEqual([])

    release()
    await vi.runAllTimersAsync()
    expect(seen).toEqual(['applied'])
    expect(leavesOf(model, ['EMEA'])).toHaveLength(5)
    model.dispose()
    vi.useRealTimers()
  })
})

describe('updateRowData and source-backed CRUD', () => {
  it('patches one loaded row on whatever level holds it', async () => {
    const { ctl } = await opened()
    expect(ctl.updateRowData('EMEA-3', { item: 'patched' })).toBe(true)
    const row = ctl.getState().displayRows.find((r) => r.kind === 'leaf' && (r as { data: Order }).data.id === 'EMEA-3') as {
      data: Order
    }
    expect(row.data).toEqual({ id: 'EMEA-3', region: 'EMEA', item: 'patched', qty: 3 })
    expect(ctl.updateRowData('APAC-0', { item: 'x' })).toBe(false) // APAC is not open
    ctl.dispose()
  })

  it('replaces the whole row when asked', async () => {
    const { ctl } = await opened()
    ctl.updateRowData('EMEA-3', { id: 'EMEA-3', region: 'EMEA', item: 'only', qty: 0 }, { replace: true })
    const row = ctl.getState().displayRows.find((r) => r.kind === 'leaf' && (r as { data: Order }).data.id === 'EMEA-3') as {
      data: Order
    }
    expect(row.data).toEqual({ id: 'EMEA-3', region: 'EMEA', item: 'only', qty: 0 })
    ctl.dispose()
  })

  it('writes through the source and applies the result as a transaction, with no refetch', async () => {
    const { be, ctl } = await opened()
    const requestsBefore = be.table.length

    const saved = await ctl.updateRow('EMEA-1', { item: 'server-said' })
    expect(saved.item).toBe('server-said')
    expect(be.table.find((r) => r.id === 'EMEA-1')!.item).toBe('server-said')

    const created = await ctl.createRow({ region: 'EMEA', item: 'brand new', qty: 7 }, ['EMEA'])
    expect(leavesOf(ctl, ['EMEA'])).toContain(created.id)

    await ctl.deleteRow('EMEA-4')
    expect(leavesOf(ctl, ['EMEA'])).not.toContain('EMEA-4')
    expect(be.table.some((r) => r.id === 'EMEA-4')).toBe(false)
    void requestsBefore
    ctl.dispose()
  })

  it('throws a clear error when the source lacks the write', async () => {
    const readOnly: ServerDataSource<Order> = { async getRows() { return { rows: [], rowCount: 0 } } }
    const ctl = createServerRowModel<Order>(readOnly, { onChange: () => {} })
    await expect(ctl.deleteRow('x')).rejects.toThrow(/deleteRow/)
    ctl.dispose()
  })
})
