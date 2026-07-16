import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import type { EntitySchema } from '../schema'
import { planQuery } from './query-plan'

type Customer = { id: string; name: string; age: number; tier: string; active: boolean }

const schema: EntitySchema<Customer> = {
  name: 'customers',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'age', type: 'number' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'active', type: 'boolean' },
  ],
}

function req(partial: Partial<ServerRequest>): ServerRequest {
  return {
    startRow: 0,
    endRow: 50,
    pageIndex: 0,
    pageSize: 50,
    sortModel: [],
    filterModel: {},
    ...partial,
  }
}

describe('planQuery', () => {
  it('maps grid operators to plan predicates', () => {
    const plan = planQuery(
      schema,
      req({ filterModel: { columns: { name: { operator: 'contains', value: 'ann' } } } }),
    )
    expect(plan.where).toEqual([{ field: 'name', op: 'contains', value: 'ann' }])
  })

  it('coerces numeric operands to numbers', () => {
    const plan = planQuery(
      schema,
      req({ filterModel: { columns: { age: { operator: 'greaterThan', value: '30' } } } }),
    )
    expect(plan.where[0]).toEqual({ field: 'age', op: 'gt', value: 30 })
  })

  it('turns selectedValues into an `in` predicate', () => {
    const plan = planQuery(
      schema,
      req({ filterModel: { columns: { tier: { operator: 'equals', value: '', selectedValues: ['free', 'pro'] } } } }),
    )
    expect(plan.where[0]).toEqual({ field: 'tier', op: 'in', values: ['free', 'pro'] })
  })

  it('coerces both bounds of a between', () => {
    const plan = planQuery(
      schema,
      req({ filterModel: { columns: { age: { operator: 'between', value: '20', valueTo: '40' } } } }),
    )
    expect(plan.where[0]).toEqual({ field: 'age', op: 'between', value: 20, valueTo: 40 })
  })

  it('whitelists fields: unknown columns are dropped', () => {
    const plan = planQuery(
      schema,
      req({ filterModel: { columns: { evil: { operator: 'contains', value: 'x' } } } }),
    )
    expect(plan.where).toHaveLength(0)
  })

  it('drops empty operator values but keeps isBlank', () => {
    const plan = planQuery(
      schema,
      req({
        filterModel: {
          columns: {
            name: { operator: 'contains', value: '' },
            id: { operator: 'isBlank', value: '' },
          },
        },
      }),
    )
    expect(plan.where).toEqual([{ field: 'id', op: 'isBlank' }])
  })

  it('builds a search over textual fields only', () => {
    const plan = planQuery(schema, req({ filterModel: { global: '  acme ' } }))
    expect(plan.search).toEqual({ term: 'acme', fields: ['name', 'tier'] })
  })

  it('is null-search when no global term', () => {
    expect(planQuery(schema, req({})).search).toBeNull()
  })

  it('maps sort, dropping unknown sort fields', () => {
    const plan = planQuery(
      schema,
      req({ sortModel: [{ id: 'age', desc: true }, { id: 'ghost', desc: false }] }),
    )
    expect(plan.orderBy).toEqual([{ field: 'age', desc: true }])
  })

  it('carries paging through as limit/offset', () => {
    const plan = planQuery(schema, req({ startRow: 100, pageSize: 25 }))
    expect(plan.limit).toBe(25)
    expect(plan.offset).toBe(100)
  })
})
