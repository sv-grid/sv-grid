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

  it('moves the parent group\'s childCount by the net add and remove', async () => {
    const be = backend()
    const withCount: ServerDataSource<Order> = {
      ...be.source,
      async getRows(req) {
        const res = await be.source.getRows(req)
        // The count beside each region: how many orders it holds.
        if ((req.groupKeys ?? []).length < (req.groupBy ?? []).length) {
          return {
            ...res,
            rows: res.rows.map((g) => ({ ...g, n: be.table.filter((r) => r.region === (g as Order).region).length })),
          }
        }
        return res
      },
    }
    const ctl = createServerRowModel<Order>(withCount, {
      groupBy: ['region'],
      aggregations: [{ col: 'qty', fn: 'sum' }],
      getRowId: (r) => r.id,
      childCount: (r) => (r as { n?: number }).n,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const emea = () => ctl.getState().displayRows.find((r) => r.kind === 'group' && r.key === 'EMEA') as { childCount?: number }
    expect(emea().childCount).toBe(6)
    ctl.applyTransaction({
      route: ['EMEA'],
      add: [{ id: 'EMEA-a', region: 'EMEA', item: 'x', qty: 1 }, { id: 'EMEA-b', region: 'EMEA', item: 'y', qty: 1 }],
      remove: ['EMEA-0'],
    })
    expect(emea().childCount).toBe(7)
    // A remove that finds nothing does not move it.
    ctl.applyTransaction({ route: ['EMEA'], remove: ['nope'] })
    expect(emea().childCount).toBe(7)
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
    expect(leavesOf(ctl, ['EMEA']).at(-1)).toBe(created.id) // at the end by default
    const onTop = await ctl.createRow({ region: 'EMEA', item: 'first', qty: 1 }, ['EMEA'], 0)
    expect(leavesOf(ctl, ['EMEA'])[0]).toBe(onTop.id)
    const third = await ctl.createRow({ region: 'EMEA', item: 'third', qty: 1 }, ['EMEA'], 2)
    expect(leavesOf(ctl, ['EMEA'])[2]).toBe(third.id)

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

  it('raises saving while a write is in flight and drops it after, success or not', async () => {
    const { be, ctl } = await opened()
    let release!: (v: Order) => void
    let refuse!: (e: Error) => void
    be.source.updateRow = () => new Promise<Order>((res, rej) => { release = res; refuse = rej })
    const states: boolean[] = []
    const off = ctl.subscribe(() => states.push(ctl.getState().saving))

    const p1 = ctl.updateRow('EMEA-1', { item: 'a' })
    await settle()
    expect(ctl.getState().saving).toBe(true)
    release({ id: 'EMEA-1', region: 'EMEA', item: 'a', qty: 1 })
    await p1
    await settle()
    expect(ctl.getState().saving).toBe(false)

    const p2 = ctl.updateRow('EMEA-2', { item: 'b' })
    await settle()
    expect(ctl.getState().saving).toBe(true)
    refuse(new Error('no'))
    await expect(p2).rejects.toThrow(/no/)
    await settle()
    expect(ctl.getState().saving).toBe(false)
    expect(states).toContain(true)
    off()
    ctl.dispose()
  })

  it('optimistic: shows an update at once, keeps the server answer, and restores the row when it rejects', async () => {
    const be = backend()
    const ctl = createServerRowModel<Order>(be.source, {
      groupBy: ['region'],
      aggregations: [{ col: 'qty', fn: 'sum' }],
      getRowId: (r) => r.id,
      optimistic: true,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const itemOf = (id: string) =>
      (ctl.getState().displayRows.find((r) => r.kind === 'leaf' && (r as { data: Order }).data.id === id) as { data: Order }).data.item

    // Slow server: the patch is visible before it answers.
    let release!: (v: Order) => void
    be.source.updateRow = (id, patch) => new Promise<Order>((res) => { release = (v) => res({ ...v, ...patch, id }) })
    const p1 = ctl.updateRow('EMEA-1', { item: 'typed' })
    await settle()
    expect(itemOf('EMEA-1')).toBe('typed')
    release({ id: 'EMEA-1', region: 'EMEA', item: 'ignored', qty: 99 })
    await p1
    await settle()
    // The server answer wins over the local patch.
    expect(itemOf('EMEA-1')).toBe('typed')
    expect(
      (ctl.getState().displayRows.find((r) => r.kind === 'leaf' && (r as { data: Order }).data.id === 'EMEA-1') as { data: Order }).data.qty,
    ).toBe(99)

    // A rejection restores the row as it was.
    be.source.updateRow = async () => { throw new Error('amount must be positive') }
    await expect(ctl.updateRow('EMEA-2', { item: 'bad' })).rejects.toThrow(/positive/)
    await settle()
    expect(itemOf('EMEA-2')).toBe('item2')
    ctl.dispose()
  })

  it('optimistic: removes a row at once and puts it back in place when the delete rejects', async () => {
    const be = backend()
    const ctl = createServerRowModel<Order>(be.source, {
      groupBy: ['region'],
      getRowId: (r) => r.id,
      optimistic: true,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const before = leavesOf(ctl, ['EMEA'])

    let release!: () => void
    be.source.deleteRow = () => new Promise<void>((res) => { release = res })
    const p1 = ctl.deleteRow('EMEA-2')
    await settle()
    expect(leavesOf(ctl, ['EMEA'])).not.toContain('EMEA-2')
    release()
    await p1
    await settle()
    expect(leavesOf(ctl, ['EMEA'])).toEqual(before.filter((id) => id !== 'EMEA-2'))

    be.source.deleteRow = async () => { throw new Error('locked') }
    await expect(ctl.deleteRow('EMEA-4')).rejects.toThrow(/locked/)
    await settle()
    // Back where it was, not at the end.
    expect(leavesOf(ctl, ['EMEA'])).toEqual(before.filter((id) => id !== 'EMEA-2'))
    ctl.dispose()
  })
})

describe('moveRow', () => {
  it('writes the move through the source, then takes the row out of one level and into another', async () => {
    const { be, ctl } = await opened()
    ctl.expandGroup(['APAC'])
    await settle()
    const res = await ctl.moveRow('EMEA-1', ['APAC'], { patch: { region: 'APAC' }, addIndex: 0 })
    expect(res.status).toBe('applied')
    expect(res.row.region).toBe('APAC')
    expect(be.table.find((r) => r.id === 'EMEA-1')!.region).toBe('APAC')
    expect(leavesOf(ctl, ['EMEA'])).not.toContain('EMEA-1')
    expect(leavesOf(ctl, ['APAC'])[0]).toBe('EMEA-1')
    ctl.dispose()
  })

  it('into a level nothing has opened: gone from its level now, there once the target opens, both badges moved', async () => {
    // A source that counts the orders per region, for the badge.
    const be = backend()
    const withCount: ServerDataSource<Order> = {
      ...be.source,
      async getRows(req) {
        const res = await be.source.getRows(req)
        if ((req.groupKeys ?? []).length < (req.groupBy ?? []).length) {
          return { ...res, rows: res.rows.map((g) => ({ ...g, n: be.table.filter((r) => r.region === (g as Order).region).length })) }
        }
        return res
      },
    }
    const ctl = createServerRowModel<Order>(withCount, {
      groupBy: ['region'],
      getRowId: (r) => r.id,
      childCount: (r) => (r as { n?: number }).n,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const countOf = (key: string) => (ctl.getState().displayRows.find((r) => r.kind === 'group' && (r as { key: string }).key === key) as { childCount?: number }).childCount
    expect(countOf('EMEA')).toBe(6)
    expect(countOf('APAC')).toBe(6)
    const res = await ctl.moveRow('EMEA-2', ['APAC'], { patch: { region: 'APAC' } })
    expect(res.status).toBe('storeNotFound')
    expect(leavesOf(ctl, ['EMEA'])).not.toContain('EMEA-2')
    // The closed target's badge still moves: the row is there on the server.
    expect(countOf('EMEA')).toBe(5)
    expect(countOf('APAC')).toBe(7)
    ctl.expandGroup(['APAC'])
    await settle()
    expect(leavesOf(ctl, ['APAC'])).toContain('EMEA-2')
    ctl.dispose()
  })

  it('without a patch moves the cache alone, and refuses a row that is not loaded', async () => {
    const { be, ctl } = await opened()
    ctl.expandGroup(['APAC'])
    await settle()
    await ctl.moveRow('EMEA-3', ['APAC'])
    expect(be.table.find((r) => r.id === 'EMEA-3')!.region).toBe('EMEA') // the server was not told
    expect(leavesOf(ctl, ['APAC']).at(-1)).toBe('EMEA-3')
    await expect(ctl.moveRow('nope', ['APAC'])).rejects.toThrow(/not loaded/)
    ctl.dispose()
  })
})

describe('master-detail', () => {
  const kinds = (ctl: ReturnType<typeof createServerRowModel<Order>>) =>
    ctl.getState().displayRows.map((r) => (r.kind === 'leaf' ? `leaf:${(r as { data: Order }).data.id}` : r.kind === 'detail' ? `detail:${(r as { masterId: string }).masterId}` : r.kind))

  it('opens a detail row under its leaf, carrying the leaf as master, and closes it again', async () => {
    const { ctl } = await opened()
    expect(ctl.isDetailOpen('EMEA-1')).toBe(false)
    ctl.toggleDetail('EMEA-1')
    await settle()
    expect(ctl.isDetailOpen('EMEA-1')).toBe(true)
    expect(ctl.getState().openDetails).toEqual(['EMEA-1'])
    const shown = kinds(ctl)
    const at = shown.indexOf('leaf:EMEA-1')
    expect(shown[at + 1]).toBe('detail:EMEA-1')
    const detail = ctl.getState().displayRows[at + 1] as { kind: 'detail'; master: Order; route: string[]; id: string }
    expect(detail.master.id).toBe('EMEA-1')
    expect(detail.route).toEqual(['EMEA'])
    // The grid row spreads the master and marks itself.
    const grid = ctl.getState().gridRows[at + 1] as unknown as { item: string; __group: { kind: string } }
    expect(grid.item).toBe('item1')
    expect(grid.__group.kind).toBe('detail')
    // The grid ids it apart from its leaf.
    expect(ctl.getRowId!(ctl.getState().gridRows[at + 1]!, at + 1)).not.toBe(ctl.getRowId!(ctl.getState().gridRows[at]!, at))

    ctl.toggleDetail('EMEA-1')
    await settle()
    expect(kinds(ctl)).not.toContain('detail:EMEA-1')
    ctl.dispose()
  })

  it('goes with the leaf: a removed leaf takes its panel, a collapsed group hides it, closeAllDetails clears', async () => {
    const { ctl } = await opened()
    ctl.toggleDetail('EMEA-1', true)
    ctl.toggleDetail('EMEA-2', true)
    await settle()
    expect(kinds(ctl).filter((k) => k.startsWith('detail:'))).toEqual(['detail:EMEA-1', 'detail:EMEA-2'])
    ctl.applyTransaction({ route: ['EMEA'], remove: ['EMEA-1'] })
    await settle()
    expect(kinds(ctl).filter((k) => k.startsWith('detail:'))).toEqual(['detail:EMEA-2'])
    ctl.collapseGroup(['EMEA'])
    await settle()
    expect(kinds(ctl)).not.toContain('detail:EMEA-2')
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(kinds(ctl)).toContain('detail:EMEA-2')
    ctl.closeAllDetails()
    await settle()
    expect(kinds(ctl)).not.toContain('detail:EMEA-2')
    expect(ctl.getState().openDetails).toEqual([])
    ctl.dispose()
  })
})
