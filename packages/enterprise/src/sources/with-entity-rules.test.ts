import { describe, expect, it, vi } from 'vitest'
import type { ServerDataSource, ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { withEntityRules } from './with-entity-rules'

type Order = { id: string; qty: number; price: number; total: number; createdAt?: string }

const schema: EntitySchema<Order> = {
  name: 'orders',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'qty', type: 'number', required: true },
    { field: 'price', type: 'number', required: true },
    { field: 'total', type: 'number', computed: (r) => Number(r.qty) * Number(r.price) },
  ],
}

const req: ServerRequest = { startRow: 0, endRow: 10, pageIndex: 0, pageSize: 10, sortModel: [], filterModel: {} }

/** A tiny in-memory source we can wrap. */
function makeSource(seed: Order[] = []): ServerDataSource<Order> {
  let rows = [...seed]
  return {
    async getRows() {
      return { rows: [...rows], rowCount: rows.length }
    },
    async createRow(input) {
      const row = { id: 'x', qty: 0, price: 0, total: 0, ...input } as Order
      rows = [...rows, row]
      return row
    },
    async updateRow(id, patch) {
      const row = { ...rows.find((r) => r.id === id)!, ...patch }
      rows = rows.map((r) => (r.id === id ? row : r))
      return row
    },
    async deleteRow(id) {
      rows = rows.filter((r) => r.id !== id)
    },
  }
}

describe('withEntityRules - computed materialization', () => {
  it('materializes computed fields on getRows', async () => {
    const source = withEntityRules(makeSource([{ id: '1', qty: 3, price: 10, total: 0 }]), schema)
    const { rows } = await source.getRows(req)
    expect(rows[0]!.total).toBe(30)
  })

  it('materializes computed fields on the created/updated row', async () => {
    const source = withEntityRules(makeSource(), schema)
    const created = await source.createRow!({ id: '1', qty: 2, price: 5 })
    expect(created.total).toBe(10)
    const updated = await source.updateRow!('1', { qty: 4, price: 5 })
    expect(updated.total).toBe(20)
  })
})

describe('withEntityRules - hooks', () => {
  it('runs beforeCreate to transform the payload and afterCreate as a side effect', async () => {
    const afterCreate = vi.fn()
    const withHooks: EntitySchema<Order> = {
      ...schema,
      hooks: { beforeCreate: (v) => ({ ...v, createdAt: '2026-01-01' }), afterCreate },
    }
    const source = withEntityRules(makeSource(), withHooks)
    const row = await source.createRow!({ id: '1', qty: 1, price: 1 })
    expect(row.createdAt).toBe('2026-01-01')
    expect(afterCreate).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('rejects a write when cross-field validate fails', async () => {
    const withHooks: EntitySchema<Order> = {
      ...schema,
      hooks: { validate: (v) => (Number(v.qty) <= 0 ? { qty: 'Quantity must be positive' } : null) },
    }
    const source = withEntityRules(makeSource(), withHooks)
    await expect(source.createRow!({ id: '1', qty: 0, price: 5 })).rejects.toThrow(/Quantity must be positive/)
  })

  it('vetoes a delete when beforeDelete throws', async () => {
    const withHooks: EntitySchema<Order> = {
      ...schema,
      hooks: { beforeDelete: () => { throw new Error('locked') } },
    }
    const source = withEntityRules(makeSource([{ id: '1', qty: 1, price: 1, total: 1 }]), withHooks)
    await expect(source.deleteRow!('1')).rejects.toThrow(/locked/)
  })

  it('leaves optional write methods absent when the source lacks them', () => {
    const readOnly: ServerDataSource<Order> = { getRows: async () => ({ rows: [], rowCount: 0 }) }
    const wrapped = withEntityRules(readOnly, schema)
    expect(wrapped.createRow).toBeUndefined()
    expect(wrapped.deleteRow).toBeUndefined()
  })

  it('passes through extra source capabilities (getAggregate)', () => {
    const getAggregate = vi.fn()
    const source = Object.assign(makeSource(), { getAggregate })
    const wrapped = withEntityRules(source, schema)
    expect((wrapped as typeof source).getAggregate).toBe(getAggregate)
  })
})
