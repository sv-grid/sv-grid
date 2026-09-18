import { describe, expect, it } from 'vitest'
import { parseFormula } from './parse'
import { evaluate, evaluateSpill, type EvalContext } from './evaluate'
import type { CellValue } from './ast'

// A1:C3 of numbers, and a column of names beside them.
const grid: CellValue[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]

const ctx: EvalContext = {
  resolve: (_sheet, row, col) => grid[row]?.[col] ?? '',
  lastRow: () => grid.length - 1,
  resolveName: (name) => (name.toUpperCase() === 'TAX' ? 0.2 : undefined),
}

const run = (formula: string) => evaluate(parseFormula(formula), ctx)
const spill = (formula: string) => evaluateSpill(parseFormula(formula), ctx)

describe('LET', () => {
  it('binds a name for the calculation, and a later binding reads an earlier one', () => {
    expect(run('=LET(x, 2, x * 3)')).toBe(6)
    expect(run('=LET(x, 2, y, x + 1, x * y)')).toBe(6)
  })

  it('a bound name wins over the workbook\'s own', () => {
    expect(run('=Tax')).toBe(0.2)
    expect(run('=LET(Tax, 0.5, Tax)')).toBe(0.5)
    // And only inside: the binding does not leak out of the call.
    expect(run('=LET(Tax, 0.5, Tax) + Tax')).toBe(0.7)
  })

  it('binds a range as a range, so the calculation reads all of it', () => {
    expect(run('=LET(r, A1:C1, SUM(r))')).toBe(6)
    expect(run('=LET(r, A1:C3, SUM(r) / COUNT(r))')).toBe(5)
  })

  it('refuses a shape Excel refuses', () => {
    expect(run('=LET(x, 2)')).toEqual({ error: '#VALUE!' })
    expect(run('=LET(x, 2, y, 3)')).toEqual({ error: '#VALUE!' })
    expect(run('=LET(5, 2, 3)')).toEqual({ error: '#VALUE!' })
  })

  it('spills what its calculation spills', () => {
    expect(spill('=LET(r, A1:C1, r)')).toEqual([[1, 2, 3]])
    expect(spill('=LET(r, A1:C1, SUM(r))')).toBeNull()
  })
})

describe('LAMBDA', () => {
  it('is #CALC! on its own, and a call when a name holds it', () => {
    expect(run('=LAMBDA(x, x * 2)')).toEqual({ error: '#CALC!' })
    expect(run('=LET(double, LAMBDA(x, x * 2), double(21))')).toBe(42)
    expect(run('=LET(add, LAMBDA(a, b, a + b), add(2, 3))')).toBe(5)
  })

  it('can be written and called on the spot', () => {
    expect(run('=LAMBDA(x, x * 2)(21)')).toBe(42)
    expect(run('=LAMBDA(a, b, a & b)("x", 2)')).toBe('x2')
    expect(run('=LAMBDA(x, x)(1, 2)')).toEqual({ error: '#VALUE!' })
    expect(run('=LAMBDA(x, LAMBDA(y, x + y))(2)(3)')).toBe(5)
  })

  it('closes over what was in scope where it was written', () => {
    expect(run('=LET(n, 10, addN, LAMBDA(x, x + n), addN(5))')).toBe(15)
    // The parameter shadows the outer binding for the call.
    expect(run('=LET(x, 1, f, LAMBDA(x, x * 100), f(3))')).toBe(300)
  })

  it('takes the count of arguments it declared', () => {
    expect(run('=LET(f, LAMBDA(a, b, a + b), f(1))')).toEqual({ error: '#VALUE!' })
    expect(run('=LET(f, LAMBDA(a, a), f(1, 2))')).toEqual({ error: '#VALUE!' })
  })

  it('a name that holds no lambda is still a name', () => {
    expect(run('=LET(x, 2, x(3))')).toEqual({ error: '#NAME?' })
  })
})

describe('the lambda helpers', () => {
  it('MAP puts every cell through the function, and takes several arrays', () => {
    expect(spill('=MAP(A1:C1, LAMBDA(v, v * 10))')).toEqual([[10, 20, 30]])
    expect(spill('=MAP(A1:C1, A2:C2, LAMBDA(a, b, a + b))')).toEqual([[5, 7, 9]])
    expect(run('=MAP(A1:C1, A1:C3, LAMBDA(a, b, a))')).toEqual({ error: '#VALUE!' })
  })

  it('BYROW answers per row and BYCOL per column', () => {
    expect(spill('=BYROW(A1:C3, LAMBDA(row, SUM(row)))')).toEqual([[6], [15], [24]])
    expect(spill('=BYCOL(A1:C3, LAMBDA(col, SUM(col)))')).toEqual([[12, 15, 18]])
  })

  it('REDUCE folds to one value and SCAN keeps every step', () => {
    expect(run('=REDUCE(0, A1:C1, LAMBDA(acc, v, acc + v))')).toBe(6)
    expect(run('=REDUCE(1, A1:C1, LAMBDA(acc, v, acc * v))')).toBe(6)
    expect(spill('=SCAN(0, A1:C1, LAMBDA(acc, v, acc + v))')).toEqual([[1, 3, 6]])
  })

  it('takes arithmetic over ranges as the grid it is', () => {
    // `A1:C1 * 2` is a grid, not the first cell doubled.
    expect(run('=REDUCE(0, A1:C1 * 2, LAMBDA(acc, v, acc + v))')).toBe(12)
    expect(spill('=BYROW(A1:C3 * 2, LAMBDA(r, SUM(r)))')).toEqual([[12], [30], [48]])
    expect(spill('=MAP(A1:C1 * 10, LAMBDA(v, v + 1))')).toEqual([[11, 21, 31]])
    expect(run('=LET(doubled, A1:C1 * 2, SUM(doubled))')).toBe(12)
  })

  it('MAKEARRAY builds from the row and column numbers', () => {
    expect(spill('=MAKEARRAY(2, 3, LAMBDA(r, c, r * 10 + c))')).toEqual([[11, 12, 13], [21, 22, 23]])
    expect(run('=MAKEARRAY(0, 3, LAMBDA(r, c, r))')).toEqual({ error: '#VALUE!' })
  })

  it('takes a lambda bound by LET as well as one written in place', () => {
    expect(spill('=LET(twice, LAMBDA(v, v * 2), MAP(A1:C1, twice))')).toEqual([[2, 4, 6]])
    expect(run('=MAP(A1:C1, 5)')).toEqual({ error: '#VALUE!' })
  })
})
