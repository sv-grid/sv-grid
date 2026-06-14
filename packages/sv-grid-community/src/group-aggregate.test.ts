import { describe, expect, it } from 'vitest'
import { applyGroupAggregate } from './core'
import type { Row } from './core'

type R = { v: number; cat: string }

// Minimal Row stubs - applyGroupAggregate only touches getCellValueByColumnId
// and original.
function rows(values: number[]): Row<R>[] {
  return values.map(
    (v) =>
      ({
        original: { v, cat: 'x' } as R,
        getCellValueByColumnId: (id: string) => (id === 'v' ? v : 'x'),
      }) as unknown as Row<R>,
  )
}

describe('applyGroupAggregate', () => {
  const r = rows([10, 20, 30])

  it('sum / avg / min / max', () => {
    expect(applyGroupAggregate('sum', 'v', r)).toBe(60)
    expect(applyGroupAggregate('avg', 'v', r)).toBe(20)
    expect(applyGroupAggregate('min', 'v', r)).toBe(10)
    expect(applyGroupAggregate('max', 'v', r)).toBe(30)
  })

  it('count / countDistinct / first / extent', () => {
    expect(applyGroupAggregate('count', 'v', r)).toBe(3)
    expect(applyGroupAggregate('countDistinct', 'cat', r)).toBe(1)
    expect(applyGroupAggregate('first', 'v', r)).toBe(10)
    expect(applyGroupAggregate('extent', 'v', r)).toBe('10 – 30')
  })

  it('custom function receives numeric values + rows', () => {
    const median = applyGroupAggregate(
      (vals) => vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)],
      'v',
      r,
    )
    expect(median).toBe(20)
  })

  it('numeric reducers ignore non-numeric and empty groups', () => {
    expect(applyGroupAggregate('sum', 'v', rows([]))).toBeUndefined()
  })
})
