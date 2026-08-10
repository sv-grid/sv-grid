import { describe, expect, it } from 'vitest'
import { rulesToConditionalFormats, toConditionalFormats } from './alert-formats'
import type { AlertEvent, AlertRule } from './alert-types'

type Row = { id: string; price: number }
const getRowId = (r: Row) => r.id

const event = (over: Partial<AlertEvent> = {}): AlertEvent => ({
  ruleId: 'r1',
  ruleName: 'High',
  severity: 'warning',
  scope: 'row',
  triggerType: 'dataChange',
  rowId: 'a',
  message: 'hi',
  actions: [{ kind: 'highlight', style: { background: '#fee2e2', color: '#991b1b' } }],
  firedAt: 0,
  ...over,
})

describe('toConditionalFormats', () => {
  it('turns a highlight action into a row-matching RuleFormat', () => {
    const formats = toConditionalFormats([event()], getRowId)
    expect(formats).toHaveLength(1)
    const f = formats[0]!
    expect(f.type).toBe('rule')
    if (f.type === 'rule') {
      expect(f.background).toBe('#fee2e2')
      expect(f.color).toBe('#991b1b')
      expect(f.when({ value: 120, row: { id: 'a', price: 120 } })).toBe(true)
      expect(f.when({ value: 80, row: { id: 'b', price: 80 } })).toBe(false)
    }
  })

  it('scopes to the event column when no explicit columns', () => {
    const formats = toConditionalFormats([event({ columnId: 'price' })], getRowId)
    const f = formats[0]!
    if (f.type === 'rule') expect(f.columns).toEqual(['price'])
  })

  it('honours explicit action columns', () => {
    const formats = toConditionalFormats(
      [event({ actions: [{ kind: 'badge', columns: ['price', 'id'], style: { background: '#fff' } }] })],
      getRowId,
    )
    const f = formats[0]!
    if (f.type === 'rule') expect(f.columns).toEqual(['price', 'id'])
  })

  it('ignores toast/log/flash-only events (no styling)', () => {
    expect(toConditionalFormats([event({ actions: [{ kind: 'toast' }, { kind: 'log' }] })], getRowId)).toHaveLength(0)
  })

  it('skips events without a row id', () => {
    expect(toConditionalFormats([event({ rowId: undefined })], getRowId)).toHaveLength(0)
  })
})

describe('rulesToConditionalFormats', () => {
  const rule = (over: Partial<AlertRule> = {}): AlertRule => ({
    id: 'r1',
    name: 'High',
    enabled: true,
    severity: 'warning',
    scope: 'row',
    predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 100 },
    trigger: { type: 'dataChange' },
    actions: [{ kind: 'highlight', style: { background: '#fee2e2' } }],
    createdAt: 0,
    ...over,
  })

  it('emits one live predicate-driven format per styling rule', () => {
    const formats = rulesToConditionalFormats<Row>([rule()])
    expect(formats).toHaveLength(1)
    const f = formats[0]!
    if (f.type === 'rule') {
      expect(f.when({ value: 0, row: { id: 'a', price: 120 } })).toBe(true)
      expect(f.when({ value: 0, row: { id: 'b', price: 80 } })).toBe(false)
    }
  })

  it('ignores disabled rules and non-styling rules', () => {
    expect(rulesToConditionalFormats<Row>([rule({ enabled: false })])).toHaveLength(0)
    expect(rulesToConditionalFormats<Row>([rule({ actions: [{ kind: 'toast' }] })])).toHaveLength(0)
  })
})
