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
