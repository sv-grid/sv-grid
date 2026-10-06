// @vitest-environment node
/**
 * `createWorkerDataSource` + `serveWorkerDataSource`.
 *
 * The worker side runs here without a DOM, as it does in a real worker. The
 * client tests connect the two halves through a real `MessageChannel`, so
 * every request and answer is structured-cloned exactly as `postMessage` to a
 * worker would clone it. The protocol tests drive the worker side through a
 * synchronous fake scope instead, where message order is under the test's
 * control.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ServerRequest } from '@svgrid/grid/server'
import { createInMemoryDataSource } from '../sveltekit/in-memory'
import { createServerRowModel } from '../server/server-row-model'
import { createWorkerDataSource, type WorkerLike } from '../server/worker-data-source'
import { inferSchemaFromRows } from './infer-schema'
import { serveWorkerDataSource, type ServeWorkerDataSourceOptions, type WorkerScopeLike } from './serve'
import { CHANNEL, type FromWorker } from './protocol'

type Sale = { id: number; region: string; country: string; rep: string; amount: number; won: boolean }

const WORLD: Record<string, string[]> = { EMEA: ['DE', 'FR', 'UK'], APAC: ['JP', 'AU'], AMER: ['US'] }

function makeSales(n: number): Sale[] {
  const pairs = Object.entries(WORLD).flatMap(([region, cs]) => cs.map((country) => ({ region, country })))
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    ...pairs[i % pairs.length]!,
    rep: `rep${i % 17}`,
    amount: (i * 7919) % 1000,
    won: i % 3 === 0,
  }))
}

function req(partial: Partial<ServerRequest> = {}): ServerRequest {
  return { startRow: 0, endRow: 50, pageIndex: 0, pageSize: 50, sortModel: [], filterModel: {}, ...partial }
}

const closers: Array<() => void> = []
afterEach(() => {
  while (closers.length) closers.pop()!()
})

/** Both halves joined by a MessageChannel. `posted` is everything the worker sent. */
function connect(serve: ServeWorkerDataSourceOptions<Sale> = {}) {
  const { port1, port2 } = new MessageChannel()
  const posted: FromWorker[] = []
  const scope: WorkerScopeLike = {
    postMessage: (m) => {
      posted.push(m as FromWorker)
      port2.postMessage(m)
    },
    addEventListener: (t, l) => port2.addEventListener(t, l as never),
    removeEventListener: (t, l) => port2.removeEventListener(t, l as never),
  }
  port2.start()
  const server = serveWorkerDataSource({ ...serve, scope })
  const terminate = vi.fn()
  const worker: WorkerLike = {
    postMessage: (m) => port1.postMessage(m),
    addEventListener: (t, l) => port1.addEventListener(t, l as never),
    removeEventListener: (t, l) => port1.removeEventListener(t, l as never),
    terminate,
  }
  port1.start()
  closers.push(() => {
    server.dispose()
    port1.close()
    port2.close()
  })
  return { worker, posted, terminate }
}

/** A worker scope whose messages the test delivers by hand, synchronously. */
function fakeScope() {
  const listeners = new Set<(e: MessageEvent) => void>()
  const posted: FromWorker[] = []
  const scope: WorkerScopeLike = {
    postMessage: (m) => void posted.push(m as FromWorker),
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  }
  const deliver = (data: unknown) => {
    for (const l of listeners) l({ data } as MessageEvent)
  }
  return { scope, posted, deliver }
}

async function until(check: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}

describe('createWorkerDataSource answers as the in-memory reference source does', () => {
  const rows = makeSales(3000)
  const schema = inferSchemaFromRows(rows)
  const matrix: Array<[string, Partial<ServerRequest>]> = [
    ['a later block of a sorted flat list', { sortModel: [{ id: 'amount', desc: true }], startRow: 400, pageSize: 100 }],
    ['two sort keys', { sortModel: [{ id: 'region', desc: false }, { id: 'amount', desc: true }] }],
    ['a numeric column filter', { filterModel: { columns: { amount: { operator: 'greaterThan', value: '900' } } } }],
    ['a global search', { filterModel: { global: 'rep1' } }],
    ['a set filter', { filterModel: { columns: { country: { operator: 'equals', value: '', selectedValues: ['DE', 'JP'] } } } }],
    [
      'the top group level with aggregates and a grand total',
      {
        groupBy: ['region', 'country'],
        groupKeys: [],
        aggregations: [{ col: 'amount', fn: 'sum' }, { col: 'amount', fn: 'max' }],
        needsGrandTotal: true,
      },
    ],
    ['a nested group level', { groupBy: ['region', 'country'], groupKeys: ['EMEA'], aggregations: [{ col: 'amount', fn: 'avg' }] }],
    ['the leaves under a group path', { groupBy: ['region', 'country'], groupKeys: ['EMEA', 'DE'], sortModel: [{ id: 'amount', desc: false }] }],
    [
      'a pivot',
      { groupBy: ['region'], groupKeys: [], pivotBy: ['won'], pivotMode: true, aggregations: [{ col: 'amount', fn: 'sum' }] },
    ],
  ]

  it.each(matrix)('%s', async (_label, partial) => {
    const { worker } = connect()
    const remote = createWorkerDataSource<Sale>(worker, { rows })
    const local = createInMemoryDataSource(rows, schema)
    const expected = await local.getRows(req(partial))
    // Two empty answers would agree too; every case here has rows.
    expect(expected.rows.length).toBeGreaterThan(0)
    expect(await remote.getRows(req(partial))).toEqual(expected)
  })
})

describe('createWorkerDataSource', () => {
  it('reads rows the worker loaded itself, without the main thread sending any', async () => {
    const { worker } = connect({ rows: async () => makeSales(500) })
    const source = createWorkerDataSource<Sale>(worker)
    expect(await source.ready).toBe(500)
    const { rowCount, rows } = await source.getRows(req({ sortModel: [{ id: 'id', desc: true }], pageSize: 3 }))
    expect(rowCount).toBe(500)
    expect(rows.map((r) => r.id)).toEqual([500, 499, 498])
  })

  it('writes through to the worker, and the next read sees them', async () => {
    const { worker } = connect({ rows: makeSales(100) })
    const source = createWorkerDataSource<Sale>(worker)
    const sorted = req({ sortModel: [{ id: 'amount', desc: true }], pageSize: 1 })
    // Fill the worker's result cache first, so a stale cache would show.
    const before = await source.getRows(sorted)
    await source.updateRow('42', { amount: 5000 })
    expect((await source.getRows(sorted)).rows[0]).toMatchObject({ id: 42, amount: 5000 })
    expect(before.rows[0]!.id).not.toBe(42)

    await source.deleteRow('42')
    expect((await source.getRows(req())).rowCount).toBe(99)
    const changed = await source.updateWhere({}, { rep: 'all' }, { selectAll: true, toggled: [] })
    expect(changed).toBe(99)
  })

  it('replaces the dataset with setRows', async () => {
    const { worker } = connect({ rows: makeSales(10) })
    const source = createWorkerDataSource<Sale>(worker)
    await source.ready
    expect(await source.setRows(makeSales(25))).toBe(25)
    expect((await source.getRows(req())).rowCount).toBe(25)
  })

  it('rejects an aborted request with the abort reason and keeps serving the rest', async () => {
    const { worker } = connect({ rows: makeSales(100) })
    const source = createWorkerDataSource<Sale>(worker)
    const controller = new AbortController()
    const doomed = source.getRows(req({ signal: controller.signal }))
    controller.abort()
    await expect(doomed).rejects.toMatchObject({ name: 'AbortError' })
    await expect(source.getRows(req({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' })
    expect((await source.getRows(req())).rowCount).toBe(100)
  })

  it('does not send the signal, the parent row or the context to the worker', async () => {
    const { worker } = connect({ rows: makeSales(10) })
    const source = createWorkerDataSource<Sale>(worker)
    // A function is not cloneable: if any of these crossed, postMessage would throw.
    const result = await source.getRows(
      req({ signal: new AbortController().signal, parentRow: { fn: () => 1 }, context: { fn: () => 2 } }),
    )
    expect(result.rowCount).toBe(10)
  })

  it('rejects ready and every call when the worker loader throws', async () => {
    const { worker } = connect({
      rows: () => {
        throw new Error('no data')
      },
    })
    const source = createWorkerDataSource<Sale>(worker)
    await expect(source.ready).rejects.toThrow('no data')
    await expect(source.getRows(req())).rejects.toThrow('no data')
  })

  it('fails pending calls when the worker reports an error event', async () => {
    const listeners = new Map<string, (e: Event) => void>()
    const worker: WorkerLike = {
      postMessage: () => {},
      addEventListener: (t, l) => void listeners.set(t, l as never),
      removeEventListener: (t) => void listeners.delete(t),
    }
    const source = createWorkerDataSource<Sale>(worker)
    const pending = source.getRows(req())
    listeners.get('error')!({ message: 'worker.js 404' } as unknown as Event)
    await expect(pending).rejects.toThrow('worker.js 404')
    await expect(source.ready).rejects.toThrow('worker.js 404')
  })

  it('destroy rejects what is pending and terminates the worker', async () => {
    const { worker, terminate } = connect()
    const source = createWorkerDataSource<Sale>(worker)
    const pending = source.getRows(req()) // no rows yet: waits for a load
    source.destroy()
    await expect(pending).rejects.toThrow(/destroyed/)
    await expect(source.getRows(req())).rejects.toThrow(/destroyed/)
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('drives createServerRowModel: grouped levels load and dispose terminates the worker', async () => {
    const { worker, terminate } = connect({ rows: makeSales(600) })
    const ctl = createServerRowModel(createWorkerDataSource<Sale>(worker), {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
    })
    ctl.refresh()
    await until(() => ctl.getState().displayRows.some((r) => 'kind' in r && r.kind === 'group'))
    const keys = () => ctl.getState().displayRows.map((r) => ('key' in r ? r.key : r.kind))
    expect(keys()).toEqual(['AMER', 'APAC', 'EMEA'])

    ctl.expandGroup(['EMEA'])
    await until(() => keys().includes('DE'))
    expect(keys()).toEqual(['AMER', 'APAC', 'EMEA', 'DE', 'FR', 'UK'])

    ctl.dispose()
    expect(terminate).toHaveBeenCalledOnce()
  })
})

describe('serveWorkerDataSource', () => {
  const call = (id: number, startRow = 0) => ({
    channel: CHANNEL,
    kind: 'call',
    id,
    method: 'getRows',
    args: [req({ startRow })],
  })
  const resultIds = (posted: FromWorker[]) =>
    posted.flatMap((m) => (m.kind === 'result' ? [m.id] : []))

  it('skips a call cancelled while it was still queued', async () => {
    const { scope, posted, deliver } = fakeScope()
    serveWorkerDataSource({ scope, rows: makeSales(50) })
    await until(() => posted.some((m) => m.kind === 'ready'))
    deliver(call(1))
    deliver(call(2, 10))
    deliver({ channel: CHANNEL, kind: 'cancel', id: 2 })
    deliver(call(3, 20))
    await until(() => resultIds(posted).length === 2)
    await new Promise((r) => setTimeout(r, 20))
    expect(resultIds(posted)).toEqual([1, 3])
  })

  it('holds calls that arrive before the rows, and answers them once loaded', async () => {
    const { scope, posted, deliver } = fakeScope()
    serveWorkerDataSource({ scope })
    deliver(call(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(resultIds(posted)).toEqual([])
    deliver({ channel: CHANNEL, kind: 'load', id: 2, rows: makeSales(5) })
    await until(() => resultIds(posted).length === 2)
    const answer = posted.find((m) => m.kind === 'result' && m.id === 1)
    expect(answer).toMatchObject({ ok: true, value: { rowCount: 5 } })
  })

  it('ignores messages that are not on its channel', async () => {
    const { scope, posted, deliver } = fakeScope()
    serveWorkerDataSource({ scope, rows: [] })
    deliver({ kind: 'call', id: 1, method: 'getRows', args: [req()] })
    deliver('hello')
    await new Promise((r) => setTimeout(r, 20))
    expect(resultIds(posted)).toEqual([])
  })

  it('answers a failing call with an error result instead of going quiet', async () => {
    const { scope, posted, deliver } = fakeScope()
    serveWorkerDataSource({ scope, rows: makeSales(5) })
    deliver({ channel: CHANNEL, kind: 'call', id: 1, method: 'updateRow', args: ['999', { amount: 1 }] })
    await until(() => resultIds(posted).length === 1)
    expect(posted.find((m) => m.kind === 'result')).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('no row with id="999"') },
    })
  })
})

describe('inferSchemaFromRows', () => {
  it('types each field from the sampled values and picks the id', () => {
    const schema = inferSchemaFromRows([
      { id: 1, name: 'a', qty: 3, ok: true, note: null },
      { id: 2, name: 'b', qty: 4, ok: false, note: 'x' },
    ])
    expect(schema.idField).toBe('id')
    expect(Object.fromEntries(schema.fields.map((f) => [f.field, f.type]))).toEqual({
      id: 'number',
      name: 'text',
      qty: 'number',
      ok: 'boolean',
      note: 'text',
    })
  })

  it('falls back to text for mixed values and to the first field for the id', () => {
    const schema = inferSchemaFromRows([{ sku: 'A1', v: 1 }, { sku: 'B2', v: 'n/a' }])
    expect(schema.idField).toBe('sku')
    expect(schema.fields.find((f) => f.field === 'v')!.type).toBe('text')
  })
})
