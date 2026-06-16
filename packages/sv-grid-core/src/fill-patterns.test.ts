import { describe, expect, it } from 'vitest'
import { buildFillPattern } from './fill-patterns'

describe('buildFillPattern - numeric', () => {
  it('extrapolates an arithmetic progression', () => {
    expect(buildFillPattern([1, 2, 3], 3)).toEqual([4, 5, 6])
    expect(buildFillPattern([10, 20, 30], 2)).toEqual([40, 50])
    expect(buildFillPattern([100, 90, 80], 3)).toEqual([70, 60, 50])
  })

  it('repeats a single numeric value (Excel default)', () => {
    expect(buildFillPattern([42], 4)).toEqual([42, 42, 42, 42])
  })
})

describe('buildFillPattern - known sequences', () => {
  it('extends days of the week with wrap', () => {
    expect(buildFillPattern(['Monday', 'Tuesday'], 3)).toEqual([
      'Wednesday',
      'Thursday',
      'Friday',
    ])
  })

  it('preserves source casing', () => {
    expect(buildFillPattern(['JAN', 'FEB'], 2)).toEqual(['MAR', 'APR'])
    expect(buildFillPattern(['jan', 'feb'], 2)).toEqual(['mar', 'apr'])
  })

  it('extends quarters with wrap', () => {
    expect(buildFillPattern(['Q3', 'Q4'], 3)).toEqual(['Q1', 'Q2', 'Q3'])
  })
})

describe('buildFillPattern - chips / array values', () => {
  it('cycles array values across target cells', () => {
    const source = [['feature', 'editors']]
    const result = buildFillPattern(source, 3)
    expect(result).toEqual([
      ['feature', 'editors'],
      ['feature', 'editors'],
      ['feature', 'editors'],
    ])
  })

  it('returns INDEPENDENT copies of arrays so a later mutation to one filled cell does not bleed into siblings', () => {
    const source = [['feature', 'editors']]
    const result = buildFillPattern(source, 3) as string[][]
    // Mutate one - siblings must not change.
    result[0]!.push('bug')
    expect(result[1]).toEqual(['feature', 'editors'])
    expect(result[2]).toEqual(['feature', 'editors'])
  })

  it('cycles multi-cell array source', () => {
    const source = [['a'], ['b'], ['c']]
    const result = buildFillPattern(source, 4)
    expect(result).toEqual([['a'], ['b'], ['c'], ['a']])
  })
})

describe('buildFillPattern - prefix/number/suffix', () => {
  it('extrapolates "Item N" series', () => {
    expect(buildFillPattern(['Item 1', 'Item 2'], 3)).toEqual([
      'Item 3',
      'Item 4',
      'Item 5',
    ])
  })

  it('preserves zero-padding width', () => {
    expect(buildFillPattern(['Run-001', 'Run-002'], 2)).toEqual([
      'Run-003',
      'Run-004',
    ])
  })
})

describe('buildFillPattern - fallback cycle', () => {
  it('cycles plain string list when no sequence/progression detected', () => {
    expect(buildFillPattern(['red', 'green', 'blue'], 5)).toEqual([
      'red',
      'green',
      'blue',
      'red',
      'green',
    ])
  })

  it('repeats a single non-numeric string', () => {
    expect(buildFillPattern(['hello'], 3)).toEqual(['hello', 'hello', 'hello'])
  })
})
