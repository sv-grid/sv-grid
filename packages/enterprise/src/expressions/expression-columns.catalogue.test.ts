import { describe, it, expect } from 'vitest'
import {
  ALL_FILTER_OPERATORS,
  isRangeOperator as gridIsRangeOperator,
  isSetOperator as gridIsSetOperator,
  isValuelessOperator as gridIsValuelessOperator,
} from '@svgrid/grid/filtering'
import { OPERATORS, isValueless, isSetOperator, isRangeOperator } from './expression-columns'
import { RELATIVE_DATE_OPERATOR_IDS } from '../relative-date-core'

/**
 * The expression editor and the grid's filter row present the same operators.
 * Labels and ordering differ on purpose, but identity and input shape must not:
 * if they drift, the editor renders a text box where a chip input belongs, or
 * omits an operator the grid offers. These tests are the guard.
 */
describe('expression operator catalogue vs the grid catalogue', () => {
  it('covers exactly the grid operators plus the relative date ones this package adds', () => {
    const mine = OPERATORS.map((o) => o.value).sort()
    const expected = [...ALL_FILTER_OPERATORS, ...RELATIVE_DATE_OPERATOR_IDS].sort()
    expect(mine).toEqual(expected)
  })

  it('marks the relative date operators valueless, for dates only', () => {
    for (const op of RELATIVE_DATE_OPERATOR_IDS) {
      const meta = OPERATORS.find((o) => o.value === op)!
      expect(meta.valueless).toBe(true)
      expect(isValueless(op)).toBe(true)
      expect([...meta.types].sort()).toEqual(['date', 'datetime'])
    }
  })

  it('lists each operator once', () => {
    const values = OPERATORS.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('agrees with the grid on which operators take no value', () => {
    for (const op of ALL_FILTER_OPERATORS) {
      expect(isValueless(op)).toBe(gridIsValuelessOperator(op))
    }
  })

  it('agrees with the grid on which operators take a token list', () => {
    for (const op of ALL_FILTER_OPERATORS) {
      expect(isSetOperator(op)).toBe(gridIsSetOperator(op))
    }
  })

  it('agrees with the grid on which operators need a second value', () => {
    for (const op of ALL_FILTER_OPERATORS) {
      expect(isRangeOperator(op)).toBe(gridIsRangeOperator(op))
    }
  })

  it('stamps the flags onto the metadata the editor reads', () => {
    // SvExpressionEditor branches on `.set` / `.valueless` / `.range` directly,
    // so the derived flags have to land on the objects, not just the helpers.
    const byValue = new Map(OPERATORS.map((o) => [o.value, o]))
    expect(byValue.get('in')?.set).toBe(true)
    expect(byValue.get('notIn')?.set).toBe(true)
    expect(byValue.get('between')?.range).toBe(true)
    expect(byValue.get('isBlank')?.valueless).toBe(true)
    expect(byValue.get('isNotBlank')?.valueless).toBe(true)
    expect(byValue.get('equals')?.set).toBeUndefined()
    expect(byValue.get('equals')?.range).toBeUndefined()
    expect(byValue.get('equals')?.valueless).toBeUndefined()
  })
})
