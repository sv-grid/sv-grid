/**
 * The view bar's filter: the operators each field type gets, what each one
 * matches, and that a condition still being written filters nothing.
 */
import { describe, expect, it } from 'vitest'
import { ME, compileCondition, compileFieldFilter, conditionCount, dayOf, describeFieldFilter, filterKindOf, isComplete, newCondition, operatorsFor, resolveMeWith, type FieldFilter } from './filter-model'

const NOW = new Date(2026, 9, 13, 12, 0) // 13 Oct 2026, local
const test = (c: Parameters<typeof compileCondition>[0]) => compileCondition(c, undefined, NOW)

describe('filter kinds and operators', () => {
  it('follow the field type', () => {
    expect(filterKindOf({ fieldType: 'singleSelect' })).toBe('select')
    expect(filterKindOf({ fieldType: 'multiSelect' })).toBe('multi')
    expect(filterKindOf({ fieldType: 'user', fieldProps: { multiple: true } })).toBe('multi')
    expect(filterKindOf({ fieldType: 'currency' })).toBe('number')
    expect(filterKindOf({ fieldType: 'date' })).toBe('date')
    expect(filterKindOf({ fieldType: 'attachment' })).toBe('files')
    expect(filterKindOf({ fieldType: 'button' })).toBeNull()
    expect(filterKindOf({ cellDataType: 'number' })).toBe('number')
    expect(operatorsFor('multi').map((o) => o.op)).toEqual(['hasAnyOf', 'hasAllOf', 'isExactly', 'hasNoneOf', 'isEmpty', 'isNotEmpty'])
    expect(operatorsFor('number').map((o) => o.label).slice(0, 2)).toEqual(['=', '≠'])
  })

  it('a new condition takes the first operator and a value of the right shape', () => {
    expect(newCondition('tags', { fieldType: 'multiSelect' })).toMatchObject({ column: 'tags', kind: 'multi', op: 'hasAnyOf', value: [] })
    expect(newCondition('due', { fieldType: 'date' })).toMatchObject({ op: 'is', value: { mode: 'today' } })
    expect(newCondition('m', { fieldType: 'link', fieldProps: { table: 'milestones' } })).toMatchObject({ kind: 'link', table: 'milestones' })
    expect(newCondition('b', { fieldType: 'button' })).toBeNull()
  })
})

describe('what a condition matches', () => {
  it('text, case and padding aside', () => {
    expect(test({ column: 'x', kind: 'text', op: 'contains', value: 'REG' })('Field type registry')).toBe(true)
    expect(test({ column: 'x', kind: 'text', op: 'is', value: ' docs page ' })('Docs page')).toBe(true)
    expect(test({ column: 'x', kind: 'text', op: 'notContains', value: 'docs' })('Docs page')).toBe(false)
  })

  it('numbers; an empty cell is no number', () => {
    expect(test({ column: 'x', kind: 'number', op: 'gte', value: '1500' })(1500)).toBe(true)
    expect(test({ column: 'x', kind: 'number', op: 'lt', value: 10 })(null)).toBe(false)
    expect(test({ column: 'x', kind: 'number', op: 'neq', value: 10 })(null)).toBe(true)
  })

  it('single and multiple selects', () => {
    expect(test({ column: 'x', kind: 'select', op: 'is', value: 'Done' })('Done')).toBe(true)
    expect(test({ column: 'x', kind: 'select', op: 'isAnyOf', value: ['Done', 'Blocked'] })('Todo')).toBe(false)
    expect(test({ column: 'x', kind: 'multi', op: 'hasAllOf', value: ['Design', 'Frontend'] })(['Frontend', 'Design', 'Docs'])).toBe(true)
    expect(test({ column: 'x', kind: 'multi', op: 'isExactly', value: ['Design'] })(['Design', 'Docs'])).toBe(false)
    expect(test({ column: 'x', kind: 'multi', op: 'hasNoneOf', value: ['Docs'] })(['Design'])).toBe(true)
  })

  it('dates by day, relative to today, a bare date read where the user is', () => {
    expect(dayOf('2026-10-13')).toBe(dayOf(NOW))
    expect(test({ column: 'x', kind: 'date', op: 'is', value: { mode: 'today' } })('2026-10-13')).toBe(true)
    expect(test({ column: 'x', kind: 'date', op: 'isBefore', value: { mode: 'exactDate', date: '2026-10-20' } })('2026-10-19')).toBe(true)
    expect(test({ column: 'x', kind: 'date', op: 'isWithin', value: { span: 'nextWeek' } })('2026-10-19')).toBe(true)
    expect(test({ column: 'x', kind: 'date', op: 'isWithin', value: { span: 'pastDays', days: 3 } })('2026-10-05')).toBe(false)
    expect(test({ column: 'x', kind: 'date', op: 'isAfter', value: { mode: 'today' } })(null)).toBe(false)
  })

  it('empty and not empty, for lists too', () => {
    expect(test({ column: 'x', kind: 'multi', op: 'isEmpty' })([])).toBe(true)
    expect(test({ column: 'x', kind: 'files', op: 'isNotEmpty' })([{ name: 'a.png' }])).toBe(true)
    expect(test({ column: 'x', kind: 'files', op: 'contains', value: 'SPEC' })([{ name: 'cell-spec.txt' }])).toBe(true)
  })

  it('a link by its records\' names', () => {
    const names = (_t: string, v: unknown) => ((v as string[]) ?? []).map((id) => (id === 'm1' ? 'Beta' : 'Release'))
    expect(compileCondition({ column: 'x', kind: 'link', op: 'contains', value: 'beta', table: 'milestones' }, names, NOW)(['m1'])).toBe(true)
  })
})

describe('a whole filter', () => {
  const rows = [
    { status: 'Done', budget: 1800 },
    { status: 'Todo', budget: 600 },
    { status: 'Blocked', budget: 2900 },
  ]
  const get = (r: Record<string, unknown>, c: string) => r[c]
  it('joins with and / or, one group deep', () => {
    const f: FieldFilter = {
      kind: 'fieldFilter',
      conjunction: 'or',
      conditions: [
        { column: 'status', kind: 'select', op: 'is', value: 'Done' },
        {
          conjunction: 'and',
          conditions: [
            { column: 'status', kind: 'select', op: 'is', value: 'Blocked' },
            { column: 'budget', kind: 'number', op: 'gt', value: 2000 },
          ],
        },
      ],
    }
    const pred = compileFieldFilter(f, get)!
    expect(rows.filter(pred).map((r) => r.status)).toEqual(['Done', 'Blocked'])
    expect(conditionCount(f)).toBe(3)
  })

  it('leaves out a condition with no value yet; with none left it filters nothing', () => {
    const half = { column: 'status', kind: 'select', op: 'is', value: '' } as const
    expect(isComplete(half)).toBe(false)
    expect(compileFieldFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [half] }, get)).toBeNull()
  })
})

describe('a custom or computed type follows its cellDataType', () => {
  it('a type the filter does not know filters as its cellDataType says', () => {
    expect(filterKindOf({ fieldType: 'appScore', cellDataType: 'number' })).toBe('number')
    expect(filterKindOf({ fieldType: 'appDue', cellDataType: 'dateString' })).toBe('date')
    expect(filterKindOf({ fieldType: 'appFlag', cellDataType: 'boolean' })).toBe('checkbox')
    expect(filterKindOf({ fieldType: 'appNote' })).toBe('text')
  })

  it('formula, lookup and rollup take the cellDataType they compute; without one, their own default', () => {
    expect(filterKindOf({ fieldType: 'formula', cellDataType: 'date' })).toBe('date')
    expect(filterKindOf({ fieldType: 'lookup', cellDataType: 'boolean' })).toBe('checkbox')
    expect(filterKindOf({ fieldType: 'rollup', cellDataType: 'date' })).toBe('date')
    expect(filterKindOf({ fieldType: 'formula' })).toBe('text')
    expect(filterKindOf({ fieldType: 'rollup', cellDataType: 'number' })).toBe('number')
  })

  it('a formula formatted as a number or a date filters as one', () => {
    for (const result of ['number', 'currency', 'percent']) {
      expect(filterKindOf({ fieldType: 'formula', fieldProps: { result } })).toBe('number')
    }
    expect(filterKindOf({ fieldType: 'formula', fieldProps: { result: 'date' } })).toBe('date')
    expect(filterKindOf({ fieldType: 'formula', fieldProps: { result: 'auto' } })).toBe('text')
    expect(filterKindOf({ fieldType: 'formula', fieldProps: { result: 'auto' }, cellDataType: 'number' })).toBe('number')
  })

  it('a rollup that is not a number filters as text, and AND / OR as a checkbox', () => {
    for (const aggregation of ['ARRAYJOIN', 'ARRAYUNIQUE', 'CONCATENATE']) {
      expect(filterKindOf({ fieldType: 'rollup', fieldProps: { aggregation } })).toBe('text')
    }
    expect(filterKindOf({ fieldType: 'rollup' })).toBe('text')
    expect(filterKindOf({ fieldType: 'rollup', fieldProps: { aggregation: 'AND' } })).toBe('checkbox')
    expect(filterKindOf({ fieldType: 'rollup', fieldProps: { aggregation: 'OR' } })).toBe('checkbox')
  })
})

describe('the signed-in user', () => {
  it('@me matches whoever is signed in when the filter is compiled, and no one when nobody is', () => {
    const is = { column: 'owner', kind: 'select', op: 'is', value: ME } as const
    const any = { column: 'owner', kind: 'multi', op: 'hasAnyOf', value: [ME, 'u3'] } as const
    let signedIn: string | undefined = 'u1'
    resolveMeWith(() => signedIn)
    try {
      expect(test(is)('u1')).toBe(true)
      expect(test(is)('u2')).toBe(false)
      expect(test(any)(['u2', 'u1'])).toBe(true)
      signedIn = 'u2'
      expect(test(is)('u2')).toBe(true)
      signedIn = undefined
      expect(test(is)('u1')).toBe(false)
      expect(test(any)(['u3'])).toBe(true)
      expect(describeFieldFilter({ kind: 'fieldFilter', conjunction: 'and', conditions: [is] }, () => 'Owner')).toBe('Owner is me')
    } finally {
      resolveMeWith(() => undefined)
    }
  })
})
