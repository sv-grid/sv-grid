/**
 * Alerts in a base: a rule whose condition is the view bar's filter fires
 * through the alert engine, reads as words, and names fields in its message.
 */
import { describe, expect, it } from 'vitest'
import { createAlertEngine } from '../alerts/alert-engine'
import { collectColumnRefs, stringifyPredicate } from '../expressions/parse'
import type { AlertRule } from '../alerts/alert-types'
import { baseCondition, baseFilterOf, registerBaseCondition } from './base-alerts'
import { describeFieldFilter, type FieldFilter } from './filter-model'

registerBaseCondition()

type Row = { id: string; name: string; status: string; due: string }
const rows: Row[] = [
  { id: 't1', name: 'Write brief', status: 'Done', due: '2000-01-03' },
  { id: 't2', name: 'Ship site', status: 'In progress', due: '2000-01-05' },
  { id: 't3', name: 'Plan launch', status: 'Todo', due: '2999-01-01' },
]

const overdue = baseCondition({
  conjunction: 'and',
  conditions: [
    { column: 'due', kind: 'date', op: 'isBefore', value: { mode: 'today' } },
    { column: 'status', kind: 'select', op: 'isNot', value: 'Done' },
  ],
})

const rule = (over: Partial<AlertRule> = {}): AlertRule => ({
  id: 'overdue',
  name: 'Overdue',
  enabled: true,
  severity: 'warning',
  scope: 'row',
  predicate: overdue,
  trigger: { type: 'dataChange' },
  actions: [{ kind: 'toast', message: '{Task name} is overdue (due {Due date})' }],
  createdAt: 0,
  ...over,
})

const HEADERS: Record<string, keyof Row> = { 'task name': 'name', 'due date': 'due' }

describe('base conditions in alerts', () => {
  it('fire for the records the filter matches, with field names in the message', () => {
    const engine = createAlertEngine<Row>({
      rules: [rule()],
      getRowId: (r) => r.id,
      token: (row, name) => {
        const key = HEADERS[name.toLowerCase()]
        return key ? String(row[key]) : undefined
      },
    })
    const events = engine.evaluate(rows)
    expect(events.map((e) => e.rowId)).toEqual(['t2'])
    expect(events[0]!.message).toBe('Ship site is overdue (due 2000-01-05)')
    // The edge fires once while the record keeps matching.
    expect(engine.evaluate(rows)).toHaveLength(0)
  })

  it('leave an unknown token as written', () => {
    const engine = createAlertEngine<Row>({
      rules: [rule({ actions: [{ kind: 'toast', message: '{Owner} late' }] })],
      getRowId: (r) => r.id,
      token: () => undefined,
    })
    expect(engine.evaluate(rows)[0]!.message).toBe('{Owner} late')
  })

  it('read as words with the field names, and report the fields they read', () => {
    expect(stringifyPredicate(overdue, [{ id: 'due', name: 'Due date' }, { id: 'status', name: 'Status' }])).toBe(
      'Due date is before today and Status is not Done',
    )
    expect(collectColumnRefs(overdue)).toEqual(['due', 'status'])
  })

  it('round-trip the filter, and describe groups and an empty filter', () => {
    const f = baseFilterOf(overdue) as FieldFilter
    expect(f.kind).toBe('fieldFilter')
    expect(f.conditions).toHaveLength(2)
    expect(baseFilterOf({ kind: 'const', value: true })).toBeNull()
    expect(describeFieldFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [] })).toBe('every record')
    expect(
      describeFieldFilter({
        kind: 'fieldFilter',
        conjunction: 'and',
        conditions: [
          { column: 'done', kind: 'checkbox', op: 'is', value: false },
          {
            conjunction: 'or',
            conditions: [
              { column: 'tags', kind: 'multi', op: 'hasAnyOf', value: ['Bug', 'Risk'] },
              { column: 'due', kind: 'date', op: 'isWithin', value: { span: 'nextDays', days: 3 } },
            ],
          },
        ],
      }),
    ).toBe('done is unchecked and (tags has any of Bug, Risk or due is within the next 3 days)')
  })
})
