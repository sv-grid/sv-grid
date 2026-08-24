import { describe, it, expect } from 'vitest'
import { createInMemoryDataSource } from './in-memory'
import { planQuery } from './query-plan'
import { planToSql } from './sql'
import type { EntitySchema } from '../schema'
import type { ServerRequest } from '@svgrid/grid'

/**
 * Server-side grouping, end to end through the plan seam.
 *
 * The grid asks for ONE level at a time: while `groupKeys` is shorter than
 * `groupBy` it wants the distinct keys at that level plus their aggregates,
 * and expanding a group is another request with the key appended. The path
 * already chosen must arrive at the backend as ordinary equality predicates,
 * so a backend only ever handles "filter, then group by one column".
 *
 * `createInMemoryDataSource` is the reference implementation of that contract;
 * `planToSql` has to emit SQL that means the same thing.
 */

type Sale = { id: string; region: string; rep: string; amount: number }

const schema: EntitySchema<Sale> = {
  name: 'sale',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'region', type: 'text' },
    { field: 'rep', type: 'text' },
    { field: 'amount', type: 'number' },
  ],
} as EntitySchema<Sale>

const rows: Sale[] = [
  { id: '1', region: 'EMEA', rep: 'ada', amount: 100 },
  { id: '2', region: 'EMEA', rep: 'ada', amount: 200 },
  { id: '3', region: 'EMEA', rep: 'brian', amount: 300 },
  { id: '4', region: 'APAC', rep: 'chen', amount: 400 },
  { id: '5', region: 'APAC', rep: 'chen', amount: 500 },
]

const req = (over: Partial<ServerRequest> = {}): ServerRequest => ({
  startRow: 0,
  endRow: 100,
  pageIndex: 0,
  pageSize: 100,
  sortModel: [],
  filterModel: {},
  ...over,
})

describe('planQuery grouping', () => {
  it('groups by the first column when no path is chosen', () => {
    const plan = planQuery(schema, req({ groupBy: ['region', 'rep'], groupKeys: [] }))
    expect(plan.groupBy).toBe('region')
  })

  it('turns the chosen path into equality predicates and descends a level', () => {
    const plan = planQuery(schema, req({ groupBy: ['region', 'rep'], groupKeys: ['EMEA'] }))
    expect(plan.groupBy).toBe('rep')
    expect(plan.where).toContainEqual({ field: 'region', op: 'eq', value: 'EMEA' })
  })

  it('stops grouping at the innermost level so leaves come back', () => {
    const plan = planQuery(schema, req({ groupBy: ['region'], groupKeys: ['EMEA'] }))
    expect(plan.groupBy).toBeNull()
    expect(plan.aggregations).toEqual([])
  })

  it('whitelists group and aggregate columns against the schema', () => {
    const plan = planQuery(
      schema,
      req({
        groupBy: ['region', 'DROP TABLE sales'],
        groupKeys: [],
        aggregations: [
          { col: 'amount', fn: 'sum' },
          { col: 'not_a_column', fn: 'sum' },
        ],
      }),
    )
    expect(plan.groupBy).toBe('region')
    expect(plan.aggregations).toEqual([{ field: 'amount', fn: 'sum' }])
  })
})

describe('planToSql grouping', () => {
  it('emits an aliased aggregate select and a GROUP BY', () => {
    const plan = planQuery(
      schema,
      req({ groupBy: ['region'], groupKeys: [], aggregations: [{ col: 'amount', fn: 'sum' }] }),
    )
    const sql = planToSql(plan)
    // Aliased back to the SOURCE column - that is where the grid reads it.
    expect(sql.select).toBe('"region", SUM("amount") AS "amount"')
    expect(sql.groupByText).toBe('GROUP BY "region"')
  })

  it('counts DISTINCT groups, not rows, when grouping', () => {
    const grouped = planToSql(planQuery(schema, req({ groupBy: ['region'], groupKeys: [] })))
    expect(grouped.countText).toBe('COUNT(DISTINCT "region")')
    const flat = planToSql(planQuery(schema, req()))
    expect(flat.countText).toBe('COUNT(*)')
  })

  it('uses COUNT(*) so a count tallies rows rather than non-null values', () => {
    const plan = planQuery(
      schema,
      req({ groupBy: ['region'], groupKeys: [], aggregations: [{ col: 'amount', fn: 'count' }] }),
    )
    expect(planToSql(plan).select).toBe('"region", COUNT(*) AS "amount"')
  })

  it('binds the group path as a parameter rather than inlining it', () => {
    const plan = planQuery(schema, req({ groupBy: ['region', 'rep'], groupKeys: ["EMEA' OR 1=1--"] }))
    const sql = planToSql(plan)
    expect(sql.params).toContain("EMEA' OR 1=1--")
    expect(sql.where).not.toContain('1=1')
  })

  it('emits no select or group by for a flat query', () => {
    const sql = planToSql(planQuery(schema, req()))
    expect(sql.select).toBe('')
    expect(sql.groupByText).toBe('')
  })
})

describe('in-memory source executes the grouped plan', () => {
  const source = createInMemoryDataSource(rows, schema)

  it('returns one row per distinct key with its aggregates', async () => {
    const res = await source.getRows(
      req({
        groupBy: ['region'],
        groupKeys: [],
        aggregations: [
          { col: 'amount', fn: 'sum' },
          { col: 'id', fn: 'count' },
        ],
      }),
    )
    expect(res.rows).toEqual([
      { region: 'APAC', amount: 900, id: 2 },
      { region: 'EMEA', amount: 600, id: 3 },
    ])
    // Distinct groups, not the 5 underlying rows.
    expect(res.rowCount).toBe(2)
  })

  it('descends into a group when the path is supplied', async () => {
    const res = await source.getRows(
      req({
        groupBy: ['region', 'rep'],
        groupKeys: ['EMEA'],
        aggregations: [{ col: 'amount', fn: 'sum' }],
      }),
    )
    expect(res.rows).toEqual([
      { rep: 'ada', amount: 300 },
      { rep: 'brian', amount: 300 },
    ])
    expect(res.rowCount).toBe(2)
  })

  it('returns leaf rows at the innermost level', async () => {
    const res = await source.getRows(req({ groupBy: ['region'], groupKeys: ['APAC'] }))
    expect(res.rows.map((r) => r.id)).toEqual(['4', '5'])
    expect(res.rowCount).toBe(2)
  })

  it('composes grouping with a column filter', async () => {
    const res = await source.getRows(
      req({
        groupBy: ['region'],
        groupKeys: [],
        aggregations: [{ col: 'amount', fn: 'sum' }],
        filterModel: { columns: { amount: { operator: 'greaterThan', value: '250' } } },
      }),
    )
    // Only amounts over 250 count: EMEA keeps 300, APAC keeps 400+500.
    expect(res.rows).toEqual([
      { region: 'APAC', amount: 900 },
      { region: 'EMEA', amount: 300 },
    ])
  })

  it('yields null for an aggregate over no numeric values, like SQL', async () => {
    const res = await source.getRows(
      req({ groupBy: ['region'], groupKeys: [], aggregations: [{ col: 'rep', fn: 'sum' }] }),
    )
    expect(res.rows.every((r) => (r as Record<string, unknown>).rep === null)).toBe(true)
  })

  it('pages over groups, not over rows', async () => {
    const res = await source.getRows(
      req({ groupBy: ['region'], groupKeys: [], startRow: 1, pageSize: 1 }),
    )
    expect(res.rows).toEqual([{ region: 'EMEA' }])
    expect(res.rowCount).toBe(2)
  })
})

describe('advanced filter over the server contract', () => {
  const source = createInMemoryDataSource(rows, schema)

  const expr = (col: string): ServerRequest['filterModel'] => ({
    expression: { kind: 'cmp', column: col, op: 'greaterThan', value: '250' } as never,
  })

  it('admits an expression whose columns are all on the schema', () => {
    const plan = planQuery(schema, req({ filterModel: expr('amount') }))
    expect(plan.expression).toBeDefined()
  })

  it('drops the WHOLE expression when any column is off-schema', () => {
    const plan = planQuery(
      schema,
      req({
        filterModel: {
          expression: {
            kind: 'and',
            parts: [
              { kind: 'cmp', column: 'amount', op: 'greaterThan', value: '250' },
              { kind: 'cmp', column: 'secret_salary', op: 'greaterThan', value: '0' },
            ],
          } as never,
        },
      }),
    )
    // Keeping just the understood half would BROADEN the result - showing rows
    // the user's filter excluded - so it is all or nothing.
    expect(plan.expression).toBeUndefined()
  })

  it('rejects an off-schema column referenced from cross-column maths', () => {
    const plan = planQuery(
      schema,
      req({
        filterModel: {
          expression: {
            kind: 'scalarCmp',
            left: { kind: 'col', id: 'amount' },
            op: '>',
            right: { kind: 'agg', fn: 'avg', column: 'secret_salary' },
          } as never,
        },
      }),
    )
    expect(plan.expression).toBeUndefined()
  })

  it('applies the expression and acknowledges it', async () => {
    const res = await source.getRows(req({ filterModel: expr('amount') }))
    expect(res.rows.map((r) => r.id)).toEqual(['3', '4', '5'])
    expect(res.rowCount).toBe(3)
    expect(res.appliedExpression).toBe(true)
  })

  it('does NOT acknowledge when the expression was rejected', async () => {
    const res = await source.getRows(
      req({
        filterModel: {
          expression: { kind: 'cmp', column: 'secret_salary', op: 'greaterThan', value: '0' } as never,
        },
      }),
    )
    // Rows come back unfiltered, and the missing ack is what lets the grid say
    // so rather than presenting a superset as if it were filtered.
    expect(res.rows).toHaveLength(5)
    expect(res.appliedExpression).toBeFalsy()
  })

  it('reports no acknowledgement at all when no expression was sent', async () => {
    const res = await source.getRows(req())
    expect(res.appliedExpression).toBe(false)
  })

  it('composes the expression with column filters and grouping', async () => {
    const res = await source.getRows(
      req({
        groupBy: ['region'],
        groupKeys: [],
        aggregations: [{ col: 'amount', fn: 'sum' }],
        filterModel: expr('amount'),
      }),
    )
    // Only amounts over 250 survive: EMEA keeps 300, APAC keeps 400+500.
    expect(res.rows).toEqual([
      { region: 'APAC', amount: 900 },
      { region: 'EMEA', amount: 300 },
    ])
    expect(res.appliedExpression).toBe(true)
  })
})
