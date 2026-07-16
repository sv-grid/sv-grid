import { describe, expect, it } from 'vitest'
import type { ServerFilterModel } from '@svgrid/grid'
import { normalizeFilters } from './filters'

const model = (columns: ServerFilterModel['columns'], global?: string): ServerFilterModel => ({
  columns,
  ...(global !== undefined ? { global } : {}),
})

describe('normalizeFilters', () => {
  it('maps each operator to a neutral predicate', () => {
    const { predicates } = normalizeFilters(
      model({
        a: { operator: 'contains', value: 'x' },
        b: { operator: 'startsWith', value: 'y' },
        c: { operator: 'equals', value: 'z' },
        d: { operator: 'greaterThan', value: '5' },
        e: { operator: 'lessThan', value: '9' },
        f: { operator: 'between', value: '1', valueTo: '4' },
        g: { operator: 'isBlank', value: '' },
      }),
    )
    expect(predicates).toEqual([
      { column: 'a', op: 'contains', value: 'x' },
      { column: 'b', op: 'startsWith', value: 'y' },
      { column: 'c', op: 'eq', value: 'z' },
      { column: 'd', op: 'gt', value: '5' },
      { column: 'e', op: 'lt', value: '9' },
      { column: 'f', op: 'between', value: '1', valueTo: '4' },
      { column: 'g', op: 'isNull' },
    ])
  })

  it('prefers selectedValues (set filter) as an in predicate', () => {
    const { predicates } = normalizeFilters(
      model({ tier: { operator: 'contains', value: 'ignored', selectedValues: ['pro', 'free'] } }),
    )
    expect(predicates).toEqual([{ column: 'tier', op: 'in', values: ['pro', 'free'] }])
  })

  it('drops empty column values but keeps isBlank', () => {
    const { predicates } = normalizeFilters(
      model({ a: { operator: 'contains', value: '   ' }, b: { operator: 'isBlank', value: '' } }),
    )
    expect(predicates).toEqual([{ column: 'b', op: 'isNull' }])
  })

  it('backfills a one-sided between with the given bound', () => {
    const { predicates } = normalizeFilters(model({ a: { operator: 'between', value: '3', valueTo: '' } }))
    expect(predicates).toEqual([{ column: 'a', op: 'between', value: '3', valueTo: '3' }])
  })

  it('trims the global search and omits it when blank', () => {
    expect(normalizeFilters(model({}, '  hi ')).search).toBe('hi')
    expect(normalizeFilters(model({}, '   ')).search).toBeUndefined()
    expect(normalizeFilters(undefined)).toEqual({ predicates: [], search: undefined })
  })
})
