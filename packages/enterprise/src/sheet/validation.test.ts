import { describe, expect, it } from 'vitest'
import {
  ruleAt, rulesIn, checkEntry, listChoices, shiftValidation, removeValidation, dateValue, describeRule, invalidCells,
  DEFAULT_ALERT_MESSAGE, type ValidationRule, type ValidationContext,
} from './validation'
import { createWorkbook } from './workbook'

/** A context over a real workbook, so bounds written as formulas resolve. */
function ctxOver(cells: string[][]): ValidationContext {
  const wb = createWorkbook([{ name: 'S', cells }])
  return {
    evaluate: (text, entry) => wb.evaluateText('S', text, entry),
    range: (text) => wb.evaluateRange('S', text),
  }
}
const ctx = ctxOver([['5', 'Red'], ['10', 'Green'], ['', 'Blue']])

const rule = (over: Partial<ValidationRule>): ValidationRule => ({
  id: 'r', rects: [[0, 0, 4, 0]], allow: 'whole', operator: 'between', value1: '1', value2: '10',
  ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' }, ...over,
})
const at = { row: 0, col: 0 }
const ok = (r: ValidationRule, text: string) => checkEntry(r, text, at, ctx).ok

describe('ruleAt / rulesIn', () => {
  it('the last rule covering a cell wins', () => {
    const a = rule({ id: 'a', rects: [[0, 0, 9, 9]] })
    const b = rule({ id: 'b', rects: [[2, 2, 3, 3]] })
    expect(ruleAt([a, b], 2, 2)?.id).toBe('b')
    expect(ruleAt([a, b], 0, 0)?.id).toBe('a')
    expect(ruleAt([a, b], 20, 20)).toBeUndefined()
    expect(rulesIn([a, b], [[3, 3, 3, 3]]).map((r) => r.id)).toEqual(['a', 'b'])
    expect(rulesIn([a, b], [[5, 5, 5, 5]]).map((r) => r.id)).toEqual(['a'])
  })
})

describe('whole and decimal', () => {
  it('whole numbers between bounds, and nothing else', () => {
    const r = rule({})
    expect(ok(r, '7')).toBe(true)
    expect(ok(r, '10')).toBe(true)
    expect(ok(r, '11')).toBe(false)
    expect(ok(r, '7.5')).toBe(false)
    expect(ok(r, 'seven')).toBe(false)
    expect(ok(r, 'TRUE')).toBe(false)
  })

  it('every operator', () => {
    const with_ = (operator: ValidationRule['operator'], value1 = '5', value2 = '8') => rule({ allow: 'decimal', operator, value1, value2 })
    expect(ok(with_('notBetween'), '6')).toBe(false)
    expect(ok(with_('notBetween'), '9')).toBe(true)
    expect(ok(with_('equal'), '5')).toBe(true)
    expect(ok(with_('equal'), '5.5')).toBe(false)
    expect(ok(with_('notEqual'), '5')).toBe(false)
    expect(ok(with_('greater'), '5')).toBe(false)
    expect(ok(with_('greater'), '5.01')).toBe(true)
    expect(ok(with_('less'), '4.99')).toBe(true)
    expect(ok(with_('greaterOrEqual'), '5')).toBe(true)
    expect(ok(with_('lessOrEqual'), '5')).toBe(true)
    expect(ok(with_('lessOrEqual'), '5.1')).toBe(false)
  })

  it('takes a typed 12% or $5 the way a cell would, and a formula by its result', () => {
    const r = rule({ allow: 'decimal', operator: 'between', value1: '0', value2: '1' })
    expect(ok(r, '12%')).toBe(true)
    expect(ok(r, '$5')).toBe(false)
    expect(ok(r, '=A1/10')).toBe(true)
    expect(ok(r, '=A2/10')).toBe(true)
    expect(ok(r, '=A2')).toBe(false)
  })

  it('bounds may be formulas that read the sheet', () => {
    const r = rule({ operator: 'lessOrEqual', value1: '=A2' })
    expect(ok(r, '10')).toBe(true)
    expect(ok(r, '11')).toBe(false)
  })

  it('a bound that is not a number fails everything rather than passing everything', () => {
    expect(ok(rule({ operator: 'greater', value1: 'abc' }), '100')).toBe(false)
  })
})

describe('blank and any', () => {
  it('a blank entry passes with Ignore blank and fails without', () => {
    expect(ok(rule({ ignoreBlank: true }), '')).toBe(true)
    expect(ok(rule({ ignoreBlank: true }), '   ')).toBe(true)
    expect(ok(rule({ ignoreBlank: false }), '')).toBe(false)
  })

  it('any value takes anything', () => {
    expect(ok(rule({ allow: 'any', ignoreBlank: false }), '')).toBe(true)
    expect(ok(rule({ allow: 'any' }), 'whatever')).toBe(true)
  })
})

describe('date', () => {
  it('reads ISO dates and serials', () => {
    expect(dateValue('2024-03-01')).toBe(Date.UTC(2024, 2, 1))
    expect(dateValue('2024-03-01 10:30')).not.toBeNull()
    expect(dateValue(45352)).toBe(Date.UTC(2024, 2, 1))
    expect(dateValue('March')).toBeNull()
    expect(dateValue('')).toBeNull()
    expect(dateValue(true)).toBeNull()
  })

  it('between two dates', () => {
    const r = rule({ allow: 'date', operator: 'between', value1: '2024-01-01', value2: '2024-12-31' })
    expect(ok(r, '2024-06-15')).toBe(true)
    expect(ok(r, '2025-01-01')).toBe(false)
    expect(ok(r, 'not a date')).toBe(false)
  })
})

describe('text length', () => {
  it('counts the entry as text', () => {
    const r = rule({ allow: 'textLength', operator: 'lessOrEqual', value1: '3' })
    expect(ok(r, 'abc')).toBe(true)
    expect(ok(r, 'abcd')).toBe(false)
    expect(ok(r, '1234')).toBe(false)
    expect(ok(r, '12')).toBe(true)
  })
})

describe('list', () => {
  it('a comma list, matched without regard to case', () => {
    const r = rule({ allow: 'list', value1: 'Red, Green,Blue' })
    expect(listChoices(r, ctx)).toEqual(['Red', 'Green', 'Blue'])
    expect(ok(r, 'green')).toBe(true)
    expect(ok(r, 'Yellow')).toBe(false)
  })

  it('a range, blanks left out', () => {
    const r = rule({ allow: 'list', value1: '=B1:B3' })
    expect(listChoices(r, ctx)).toEqual(['Red', 'Green', 'Blue'])
    expect(listChoices(rule({ allow: 'list', value1: '=A1:A3' }), ctx)).toEqual(['5', '10'])
    expect(ok(r, 'Blue')).toBe(true)
    expect(ok(r, 'Black')).toBe(false)
  })

  it('a name that refers to a range', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['x'], ['y']] }])
    wb.names.define('Choices', 'S!A1:A2')
    const c: ValidationContext = { evaluate: (t) => wb.evaluateText('S', t), range: (t) => wb.evaluateRange('S', t) }
    expect(listChoices(rule({ allow: 'list', value1: '=Choices' }), c)).toEqual(['x', 'y'])
  })

  it('a formula that is not a range gives its one value', () => {
    expect(listChoices(rule({ allow: 'list', value1: '=A1+1' }), ctx)).toEqual(['6'])
    expect(listChoices(rule({ allow: 'list', value1: '' }), ctx)).toEqual([])
  })
})

describe('custom', () => {
  it('a formula written for the rule\'s top-left cell moves with the cell it checks', () => {
    // =B1<>"" at A1 means "the cell to the right is filled".
    const r = rule({ allow: 'custom', rects: [[0, 0, 2, 0]], value1: '=B1<>""' })
    expect(checkEntry(r, 'x', { row: 0, col: 0 }, ctx).ok).toBe(true)
    expect(checkEntry(r, 'x', { row: 2, col: 0 }, ctx).ok).toBe(true)
    const empty = ctxOver([['', ''], ['', '']])
    expect(checkEntry(r, 'x', { row: 1, col: 0 }, empty).ok).toBe(false)
  })

  it('a bound written as a relative formula moves with the cell, an absolute one stays', () => {
    // Column A holds 5 and 10; a rule on column B "at most =A1" reads A1 on
    // B1 and A2 on B2, as Excel moves the reference.
    const r = rule({ allow: 'whole', operator: 'lessOrEqual', value1: '=A1', value2: undefined, rects: [[0, 1, 4, 1]] })
    expect(checkEntry(r, '5', { row: 0, col: 1 }, ctx).ok).toBe(true)
    expect(checkEntry(r, '6', { row: 0, col: 1 }, ctx).ok).toBe(false)
    expect(checkEntry(r, '9', { row: 1, col: 1 }, ctx).ok).toBe(true)
    const fixed = rule({ allow: 'whole', operator: 'lessOrEqual', value1: '=$A$1', value2: undefined, rects: [[0, 1, 4, 1]] })
    expect(checkEntry(fixed, '9', { row: 1, col: 1 }, ctx).ok).toBe(false)
    // A date bound moves the same way: on or after the date in column A.
    const dates = ctxOver([['2026-09-01', ''], ['2026-09-10', '']])
    const ship = rule({ allow: 'date', operator: 'greaterOrEqual', value1: '=A1', value2: undefined, rects: [[0, 1, 4, 1]] })
    expect(checkEntry(ship, '2026-09-05', { row: 0, col: 1 }, dates).ok).toBe(true)
    expect(checkEntry(ship, '2026-09-05', { row: 1, col: 1 }, dates).ok).toBe(false)
  })

  it('reads the cell it guards as the entry, which is not in the sheet yet', () => {
    // A1 holds 5 and B1 "Red". The rule "A1 must be bigger than 3" has to
    // judge what is being typed, not the 5 that is there.
    const r = rule({ allow: 'custom', rects: [[0, 0, 4, 0]], value1: '=A1>3' })
    expect(ok(r, '2')).toBe(false)
    expect(ok(r, '9')).toBe(true)
    // The entry is a literal: text stays text, TRUE reads as a boolean.
    const text = rule({ allow: 'custom', rects: [[0, 1, 4, 1]], value1: '=ISTEXT(B1)' })
    expect(checkEntry(text, 'Blue', { row: 0, col: 1 }, ctx).ok).toBe(true)
    expect(checkEntry(text, '12', { row: 0, col: 1 }, ctx).ok).toBe(false)
    // Other cells still read the sheet: A2 is 10.
    const other = rule({ allow: 'custom', rects: [[0, 0, 4, 0]], value1: '=A1<A2' })
    expect(ok(other, '7')).toBe(true)
    expect(ok(other, '11')).toBe(false)
  })

  it('takes a formula without its =, and fails on an error or a non-boolean', () => {
    // A1 reads as the entry, so 'x' (text) is not greater than 1; 7 is.
    expect(ok(rule({ allow: 'custom', value1: 'A1>1' }), 'x')).toBe(false)
    expect(ok(rule({ allow: 'custom', value1: 'A1>1' }), '7')).toBe(true)
    expect(ok(rule({ allow: 'custom', value1: '=1/0' }), 'x')).toBe(false)
    expect(ok(rule({ allow: 'custom', value1: '="text"' }), 'x')).toBe(false)
    expect(ok(rule({ allow: 'custom', value1: '=2' }), 'x')).toBe(true)
    expect(ok(rule({ allow: 'custom', value1: '' }), 'x')).toBe(false)
  })
})

describe('the verdict', () => {
  it('carries the rule\'s alert, or Excel\'s words', () => {
    const plain = checkEntry(rule({}), '99', at, ctx)
    expect(plain).toEqual({ ok: false, style: 'stop', title: 'Data validation', message: DEFAULT_ALERT_MESSAGE })
    const own = checkEntry(rule({ alert: { style: 'warning', title: 'Score', message: '1 to 10 only' } }), '99', at, ctx)
    expect(own).toEqual({ ok: false, style: 'warning', title: 'Score', message: '1 to 10 only' })
  })
})

describe('shift and remove', () => {
  it('rules move with an insert and drop when their rows go', () => {
    const rules = [rule({ rects: [[2, 0, 4, 0]] })]
    expect(shiftValidation(rules, { kind: 'insertRows', at: 0, count: 2 })[0]!.rects).toEqual([[4, 0, 6, 0]])
    expect(shiftValidation(rules, { kind: 'deleteRows', at: 2, count: 3 })).toEqual([])
  })

  it('Clear All cuts the selection out of every rule it touches', () => {
    const rules = [rule({ id: 'a', rects: [[0, 0, 4, 0]] }), rule({ id: 'b', rects: [[9, 9, 9, 9]] })]
    const left = removeValidation(rules, [[1, 0, 2, 0]])
    expect(left.map((r) => [r.id, r.rects])).toEqual([['a', [[0, 0, 0, 0], [3, 0, 4, 0]]], ['b', [[9, 9, 9, 9]]]])
    expect(removeValidation(rules, [[0, 0, 4, 0]]).map((r) => r.id)).toEqual(['b'])
  })
})

describe('describeRule', () => {
  it('reads like Excel\'s dialog', () => {
    expect(describeRule(rule({}))).toBe('Whole number between 1 and 10')
    expect(describeRule(rule({ allow: 'decimal', operator: 'greater', value1: '0' }))).toBe('Decimal greater than 0')
    expect(describeRule(rule({ allow: 'list', value1: 'a,b' }))).toBe('List: a,b')
    expect(describeRule(rule({ allow: 'any' }))).toBe('Any value')
  })
})

describe('invalidCells', () => {
  const cells = [
    ['5', 'x', ''],
    ['50', '=1+1', 'ok'],
    ['abc', '3', ''],
  ]
  const ctx: ValidationContext = {
    evaluate: (text) => (text === '=1+1' ? 2 : Number(text)),
    range: () => null,
  }
  const rawAt = (r: number, c: number) => cells[r]?.[c] ?? ''
  const rule = (over: ValidationRule['rects'], extra: Partial<ValidationRule> = {}): ValidationRule => ({
    id: 'v', rects: over, allow: 'whole', operator: 'between', value1: '1', value2: '10',
    ignoreBlank: true, inCellDropdown: false, alert: { style: 'stop' }, ...extra,
  })

  it('lists the cells under a rule that break it, blanks left alone', () => {
    expect(invalidCells([rule([[0, 0, 2, 2]])], ctx, rawAt, 3, 3)).toEqual([
      { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 2 }, { row: 2, col: 0 },
    ])
  })

  it('counts a blank when the rule does not ignore it', () => {
    expect(invalidCells([rule([[0, 2, 0, 2]], { ignoreBlank: false })], ctx, rawAt, 3, 3)).toEqual([{ row: 0, col: 2 }])
  })

  it('clips to the sheet extent and lets the last rule over a cell decide', () => {
    const any: ValidationRule = { ...rule([[0, 0, 0, 0]]), id: 'w', allow: 'any' }
    expect(invalidCells([rule([[0, 0, 1000, 0]]), any], ctx, rawAt, 3, 3)).toEqual([{ row: 1, col: 0 }, { row: 2, col: 0 }])
    expect(invalidCells([any, rule([[0, 0, 0, 0]])], ctx, rawAt, 3, 3)).toEqual([])
  })
})
