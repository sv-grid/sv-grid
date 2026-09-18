import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { createSupabaseDataSource } from './supabase'

type Customer = { id: number; name: string; email: string; tier: string; mrr: number }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'number', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'email', type: 'text' },
    { field: 'tier', type: 'enum', options: [{ value: 'pro', label: 'Pro' }] },
    { field: 'mrr', type: 'number' },
  ],
}

/** A supabase-js-like builder: chainable AND awaitable (thenable). */
function makeClient(result: unknown) {
  const calls: Array<[string, unknown[]]> = []
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') return (res: (v: unknown) => void) => Promise.resolve(result).then(res)
        return (...args: unknown[]) => {
          calls.push([prop, args])
          return builder
        }
      },
    },
  )
  const client = { from: (table: string) => { calls.push(['from', [table]]); return builder } }
  return { client, calls }
}

const req = (p: Partial<ServerRequest>): ServerRequest => ({
  startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {}, ...p,
})

const has = (calls: Array<[string, unknown[]]>, name: string) => calls.filter((c) => c[0] === name)

describe('createSupabaseDataSource reads', () => {
  it('selects with an exact count and returns rows + rowCount', async () => {
    const { client, calls } = makeClient({ data: [{ id: 1, name: 'Ada' }], count: 42, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    const out = await src.getRows(req({}))
    expect(has(calls, 'select')[0]![1]).toEqual(['*', { count: 'exact' }])
    expect(has(calls, 'range')[0]![1]).toEqual([0, 9])
    expect(out).toEqual({ rows: [{ id: 1, name: 'Ada' }], rowCount: 42 })
  })

  it('maps filters, sort, and global search onto the query builder', async () => {
    const { client, calls } = makeClient({ data: [], count: 0, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    await src.getRows(
      req({
        sortModel: [{ id: 'mrr', desc: true }],
        filterModel: {
          global: 'ada',
          columns: {
            name: { operator: 'contains', value: 'a' },
            mrr: { operator: 'greaterThan', value: '100' },
            tier: { operator: 'equals', value: '', selectedValues: ['pro', 'free'] },
          },
        },
      }),
    )
    expect(has(calls, 'ilike')).toContainEqual(['ilike', ['name', '%a%']])
    expect(has(calls, 'gt')).toContainEqual(['gt', ['mrr', '100']])
    expect(has(calls, 'in')).toContainEqual(['in', ['tier', ['pro', 'free']]])
    expect(has(calls, 'order')).toContainEqual(['order', ['mrr', { ascending: false }]])
    // global search: OR of ILIKEs across text + enum columns (name, email, tier)
    expect(has(calls, 'or')[0]![1][0]).toBe('name.ilike.%ada%,email.ilike.%ada%,tier.ilike.%ada%')
  })

  it('throws on a query error', async () => {
    const { client } = makeClient({ data: null, count: null, error: { message: 'boom' } })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    await expect(src.getRows(req({}))).rejects.toThrow('boom')
  })
})

describe('createSupabaseDataSource writes', () => {
  it('strips the primary key on insert', async () => {
    const { client, calls } = makeClient({ data: { id: 9, name: 'New' }, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    const row = await src.createRow({ id: 123, name: 'New' } as Partial<Customer>)
    expect(has(calls, 'insert')[0]![1]).toEqual([{ name: 'New' }])
    expect(row).toEqual({ id: 9, name: 'New' })
  })

  it('updates by the schema id field', async () => {
    const { client, calls } = makeClient({ data: { id: 5, name: 'X' }, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    await src.updateRow('5', { name: 'X' })
    expect(has(calls, 'update')[0]![1]).toEqual([{ name: 'X' }])
    expect(has(calls, 'eq')[0]![1]).toEqual(['id', '5'])
  })

  it('deletes by the schema id field', async () => {
    const { client, calls } = makeClient({ error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    await src.deleteRow('7')
    expect(has(calls, 'delete').length).toBe(1)
    expect(has(calls, 'eq')[0]![1]).toEqual(['id', '7'])
  })
})

describe('createSupabaseDataSource child counts and the grand total', () => {
  it('adds count() as childCount at the innermost group level only', async () => {
    const { client, calls } = makeClient({ data: [], count: 0, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })

    // Two levels, asking for the top one: PostgREST cannot COUNT(DISTINCT), so
    // no badge here.
    await src.getRows(req({ groupBy: ['tier', 'name'], groupKeys: [], aggregations: [{ col: 'mrr', fn: 'sum' }] }))
    expect(has(calls, 'select')[0]![1]![0]).toBe('tier,mrr:mrr.sum()')

    // The innermost level: a plain count of the rows in each group.
    await src.getRows(req({ groupBy: ['tier', 'name'], groupKeys: ['pro'], aggregations: [{ col: 'mrr', fn: 'sum' }] }))
    expect(has(calls, 'select')[1]![1]![0]).toBe('name,mrr:mrr.sum(),childCount:count()')
  })

  it('runs a second aggregate-only select for the grand total, filters kept, path dropped', async () => {
    const { client, calls } = makeClient({ data: [{ mrr: 900 }], count: 1, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    const out = await src.getRows(
      req({
        groupBy: ['tier'],
        groupKeys: ['pro'],
        aggregations: [{ col: 'mrr', fn: 'sum' }],
        needsGrandTotal: true,
        filterModel: { columns: { mrr: { operator: 'greaterThan', value: '10' } } },
      }),
    )
    const selects = has(calls, 'select')
    expect(selects).toHaveLength(2)
    expect(selects[1]![1]).toEqual(['mrr:mrr.sum()'])
    // Both queries filter on mrr; only the first carries the tier path.
    expect(has(calls, 'gt').map((c) => c[1])).toEqual([['mrr', '10'], ['mrr', '10']])
    expect(has(calls, 'eq').map((c) => c[1])).toEqual([['tier', 'pro']])
    expect(out.grandTotal).toEqual({ mrr: 900 })
  })
})

describe('createSupabaseDataSource pivot', () => {
  const pivoted = req({
    groupBy: ['tier'],
    groupKeys: [],
    aggregations: [{ col: 'mrr', fn: 'sum' }],
    pivotBy: ['name'],
    pivotMode: true,
  })

  it('hands a pivoted request to the pivot option, which stands in for an RPC', async () => {
    const { client, calls } = makeClient({ data: [], count: 0, error: null })
    const seen: ServerRequest[] = []
    const src = createSupabaseDataSource({
      client,
      table: 'customers',
      schema,
      pivot: async (request) => {
        seen.push(request)
        return { rows: [{ tier: 'pro', Ada_mrr: 1 } as never], rowCount: 1, pivotResultFields: ['Ada_mrr'] }
      },
    })
    const out = await src.getRows(pivoted)
    expect(seen).toHaveLength(1)
    expect(out.pivotResultFields).toEqual(['Ada_mrr'])
    // Nothing went to the table.
    expect(has(calls, 'from')).toHaveLength(0)
    // The leaves under a path are not pivoted: they go the ordinary way.
    await src.getRows(req({ ...pivoted, groupKeys: ['pro'] }))
    expect(seen).toHaveLength(1)
    expect(has(calls, 'from')).toHaveLength(1)
  })

  it('falls back to plain grouping, warning once, without the option', async () => {
    const { client, calls } = makeClient({ data: [], count: 0, error: null })
    const src = createSupabaseDataSource({ client, table: 'customers', schema })
    const warnings: string[] = []
    const original = console.warn
    console.warn = (m: string) => warnings.push(String(m))
    try {
      await src.getRows(pivoted)
      await src.getRows(pivoted)
    } finally {
      console.warn = original
    }
    expect(has(calls, 'select')[0]![1]![0]).toBe('tier,mrr:mrr.sum(),childCount:count()')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('pivot')
  })
})
