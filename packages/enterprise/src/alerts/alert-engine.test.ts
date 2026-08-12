import { describe, expect, it } from 'vitest'
import { createAlertEngine, renderTemplate } from './alert-engine'
import type { AlertRule } from './alert-types'

type Row = { id: string; price: number; region: string; status: string }

const rows = (over: Partial<Row>[] = []): Row[] =>
  [
    { id: 'a', price: 120, region: 'EU', status: 'open' },
    { id: 'b', price: 80, region: 'US', status: 'open' },
  ].map((r, i) => ({ ...r, ...(over[i] ?? {}) }))

const getRowId = (r: Row) => r.id

const rule = (over: Partial<AlertRule> = {}): AlertRule => ({
  id: 'r1',
  name: 'High price',
  enabled: true,
  severity: 'warning',
  scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast', message: '{region} price is {value}' }],
  createdAt: 0,
  ...over,
})

const engine = (r: AlertRule[]) => createAlertEngine<Row>({ rules: r, getRowId, now: () => 1000 })

describe('dataChange edge firing', () => {
  it('fires once when a row starts matching, not on every pass', () => {
    const e = engine([rule()])
    const first = e.evaluate(rows())
    expect(first).toHaveLength(1)
    expect(first[0]!.rowId).toBe('a')
    // Re-evaluating the same data must not re-fire.
    expect(e.evaluate(rows())).toHaveLength(0)
  })

  it('re-arms after a row stops matching', () => {
    const e = engine([rule()])
    e.evaluate(rows())
    // 'a' drops below threshold -> no fire, edge memory cleared.
    expect(e.evaluate(rows([{ price: 90 }]))).toHaveLength(0)
    // 'a' climbs back over -> fires again.
    expect(e.evaluate(rows([{ price: 130 }]))).toHaveLength(1)
  })

  it('fires on transition when a row newly matches after an edit', () => {
    const e = engine([rule()])
    const prev = rows([{ price: 90 }]) // 'a' below threshold
    e.evaluate(prev)
    const events = e.evaluateTransition(prev, rows([{ price: 130 }]))
    expect(events).toHaveLength(1)
    expect(events[0]!.rowId).toBe('a')
  })

  it('respects disabled rules', () => {
    const e = engine([rule({ enabled: false })])
    expect(e.evaluate(rows())).toHaveLength(0)
  })
})

describe('relativeChange firing', () => {
  it('fires when a value jumps by more than the threshold', () => {
    const r = rule({
      id: 'r2',
      trigger: { type: 'relativeChange', expr: { kind: 'percentChange', column: 'price', op: '>', value: 5, abs: true } },
      predicate: { kind: 'const', value: true },
    })
    const e = engine([r])
    const prev = rows()
    e.evaluate(prev)
    const events = e.evaluateTransition(prev, rows([{ price: 140 }])) // +16%
    expect(events).toHaveLength(1)
    expect(events[0]!.columnId).toBe('price')
  })

  it('gates relativeChange on the predicate', () => {
    const r = rule({
      id: 'r3',
      trigger: { type: 'relativeChange', expr: { kind: 'changed', column: 'status' } },
      predicate: { kind: 'cmp', column: 'status', op: 'equals', value: 'closed' },
    })
    const e = engine([r])
    const prev = rows()
    // status changes open -> pending: predicate (== closed) fails -> no fire.
    expect(e.evaluateTransition(prev, rows([{ status: 'pending' }]))).toHaveLength(0)
    // status changes open -> closed: fires.
    expect(e.evaluateTransition(prev, rows([{ status: 'closed' }]))).toHaveLength(1)
  })
})

describe('aggregate scope', () => {
  it('fires one edge event when the whole-set predicate flips true', () => {
    const r = rule({
      id: 'agg',
      scope: 'aggregate',
      predicate: { kind: 'scalarCmp', left: { kind: 'agg', fn: 'sum', column: 'price' }, op: '>', right: { kind: 'lit', value: 250 } },
    })
    const e = engine([r])
    expect(e.evaluate(rows())).toHaveLength(0) // 120+80 = 200
    const fired = e.evaluate(rows([{ price: 200 }])) // 200+80 = 280
    expect(fired).toHaveLength(1)
    expect(fired[0]!.rowId).toBeUndefined()
  })
})

describe('validateEdit', () => {
  it('vetoes an edit that trips a preventEdit validation rule', () => {
    const r = rule({
      id: 'v',
      trigger: { type: 'validation' },
      predicate: { kind: 'cmp', column: 'price', op: 'lessThan', value: 0 },
      actions: [{ kind: 'preventEdit', message: 'Price cannot be negative' }],
    })
    const e = engine([r])
    const target = rows()[0]!
    expect(e.validateEdit(target, 'price', -5).vetoed).toBe(true)
    expect(e.validateEdit(target, 'price', 50).vetoed).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('fills tokens from the firing context', () => {
    expect(
      renderTemplate('{rule}: {region} = {value}', {
        rule: rule(),
        row: { region: 'EU' },
        columnId: 'price',
        value: 120,
      }),
    ).toBe('High price: EU = 120')
  })
})
