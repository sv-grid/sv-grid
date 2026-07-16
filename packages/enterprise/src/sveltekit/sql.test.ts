import { describe, expect, it } from 'vitest'
import type { QueryPlan } from './query-plan'
import { planToSql } from './sql'

const base: QueryPlan = { where: [], search: null, orderBy: [], limit: 50, offset: 0 }

describe('planToSql', () => {
  it('emits parameterized predicates with ANSI defaults', () => {
    const plan: QueryPlan = {
      ...base,
      where: [
        { field: 'age', op: 'gt', value: 30 },
        { field: 'name', op: 'contains', value: 'ann' },
      ],
    }
    const sql = planToSql(plan)
    expect(sql.whereText).toBe('WHERE "age" > ? AND LOWER("name") LIKE LOWER(?)')
    expect(sql.params).toEqual([30, '%ann%'])
  })

  it('supports the Postgres dialect: $ placeholders and ILIKE', () => {
    const plan: QueryPlan = { ...base, where: [{ field: 'name', op: 'startsWith', value: 'A' }] }
    const sql = planToSql(plan, { placeholders: '$', ilike: true })
    expect(sql.whereText).toBe('WHERE "name" ILIKE $1')
    expect(sql.params).toEqual(['A%'])
  })

  it('supports SQL Server @p placeholders', () => {
    const plan: QueryPlan = { ...base, where: [{ field: 'age', op: 'gt', value: 30 }] }
    const sql = planToSql(plan, { placeholders: '@' })
    expect(sql.whereText).toBe('WHERE "age" > @p1')
    expect(sql.params).toEqual([30])
  })

  it('renders between, isBlank, and in', () => {
    const plan: QueryPlan = {
      ...base,
      where: [
        { field: 'age', op: 'between', value: 20, valueTo: 40 },
        { field: 'note', op: 'isBlank' },
        { field: 'tier', op: 'in', values: ['free', 'pro'] },
      ],
    }
    const sql = planToSql(plan)
    expect(sql.where).toBe(
      '"age" BETWEEN ? AND ? AND ("note" IS NULL OR "note" = \'\') AND "tier" IN (?, ?)',
    )
    expect(sql.params).toEqual([20, 40, 'free', 'pro'])
  })

  it('an empty `in` matches nothing', () => {
    const sql = planToSql({ ...base, where: [{ field: 'tier', op: 'in', values: [] }] })
    expect(sql.where).toBe('1 = 0')
    expect(sql.params).toEqual([])
  })

  it('appends a global search as an OR group after the column predicates', () => {
    const plan: QueryPlan = {
      ...base,
      where: [{ field: 'age', op: 'gt', value: 1 }],
      search: { term: 'acme', fields: ['name', 'tier'] },
    }
    const sql = planToSql(plan)
    expect(sql.where).toBe(
      '"age" > ? AND (LOWER("name") LIKE LOWER(?) OR LOWER("tier") LIKE LOWER(?))',
    )
    expect(sql.params).toEqual([1, '%acme%', '%acme%'])
  })

  it('builds order by and leaves where empty when there are no predicates', () => {
    const sql = planToSql({ ...base, orderBy: [{ field: 'name', desc: false }, { field: 'age', desc: true }] })
    expect(sql.whereText).toBe('')
    expect(sql.orderByText).toBe('ORDER BY "name" ASC, "age" DESC')
  })

  it('escapes identifier quote chars', () => {
    const sql = planToSql({ ...base, where: [{ field: 'we"ird', op: 'eq', value: 1 }] })
    expect(sql.where).toBe('"we""ird" = ?')
  })
})
