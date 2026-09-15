import { describe, expect, it } from 'vitest'
import { buildFillPattern } from './fill-patterns'

describe('buildFillPattern - numeric', () => {
  it('extrapolates an arithmetic progression', () => {
    expect(buildFillPattern([1, 2, 3], 3)).toEqual([4, 5, 6])
    expect(buildFillPattern([10, 20, 30], 2)).toEqual([40, 50])
    expect(buildFillPattern([100, 90, 80], 3)).toEqual([70, 60, 50])
  })

  it('continues an uneven run of numbers along its linear trend, as Excel does', () => {
    // 1, 2, 4: slope 1.5, intercept -2/3, so the next three are 5.33, 6.83, 8.33.
    const next = buildFillPattern([1, 2, 4], 3) as number[]
    expect(next.map((v) => Number(v.toFixed(4)))).toEqual([5.3333, 6.8333, 8.3333])
    expect((buildFillPattern([10, 20, 40], 2) as number[]).map((v) => Number(v.toFixed(4)))).toEqual([53.3333, 68.3333])
    expect(buildFillPattern([18200, 4200, 1200], 2)).toEqual([-9133.33333333333, -17633.3333333333])
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

  it('repeats a single number held as text, the way a numeric one repeats', () => {
    // A sheet stores what was typed, so 5 arrives as '5'. It is a number,
    // not 'Item 5' with an empty prefix: one copy, no 6, 7, 8.
    expect(buildFillPattern(['5'], 3)).toEqual(['5', '5', '5'])
    expect(buildFillPattern(['Item 5'], 2)).toEqual(['Item 6', 'Item 7'])
  })

  it('repeats a single non-numeric string', () => {
    expect(buildFillPattern(['hello'], 3)).toEqual(['hello', 'hello', 'hello'])
  })

  it('steps an ISO date by a day, and by the gap two dates set', () => {
    // Used to read 2024-01-15 as the number 2024 with a suffix and fill
    // 2025-01-15, 2026-01-15.
    expect(buildFillPattern(['2024-01-15'], 3)).toEqual(['2024-01-16', '2024-01-17', '2024-01-18'])
    expect(buildFillPattern(['2024-01-01', '2024-01-08'], 2)).toEqual(['2024-01-15', '2024-01-22'])
    expect(buildFillPattern(['2024-02-28'], 2)).toEqual(['2024-02-29', '2024-03-01'])
    expect(buildFillPattern(['2024-03-03', '2024-03-02'], 2)).toEqual(['2024-03-01', '2024-02-29'])
  })

  it('steps Date objects by the day and keeps them Dates', () => {
    const out = buildFillPattern([new Date(Date.UTC(2024, 0, 31))], 2)
    expect(out.every((d) => d instanceof Date)).toBe(true)
    expect((out as Date[]).map((d) => d.toISOString().slice(0, 10))).toEqual(['2024-02-01', '2024-02-02'])
  })

  it('still counts a prefixed number that happens to hold digits and dashes', () => {
    expect(buildFillPattern(['Run-001'], 2)).toEqual(['Run-002', 'Run-003'])
    expect(buildFillPattern(['2024-1-5'], 1)).not.toEqual(['2024-01-06'])
  })
})
