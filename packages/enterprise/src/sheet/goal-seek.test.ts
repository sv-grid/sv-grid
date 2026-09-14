import { describe, expect, it, vi } from 'vitest'
import { goalSeek, goalSeekCell } from './goal-seek'
import { createWorkbook } from './workbook'

const near = (a: number, b: number, eps = 1e-5) => Math.abs(a - b) < eps

describe('goalSeek', () => {
  it('solves a linear function', () => {
    // 2x + 3 = 11  ->  x = 4
    const out = goalSeek((x) => 2 * x + 3, 11, 0)
    expect(out.converged).toBe(true)
    expect(near(out.value, 4)).toBe(true)
  })

  it('solves a nonlinear one', () => {
    // x^2 = 9, starting positive, finds 3
    const out = goalSeek((x) => x * x, 9, 1)
    expect(out.converged).toBe(true)
    expect(near(out.value, 3)).toBe(true)
  })

  it('returns immediately when the start is already the answer', () => {
    const out = goalSeek((x) => x, 5, 5)
    expect(out.converged).toBe(true)
    expect(out.value).toBe(5)
    expect(out.iterations).toBe(1)
  })

  it('works on a tiny scale, where a fixed probe step would swamp it', () => {
    // An interest rate. A second point one whole unit away from 0.05 would
    // be nonsense, which is why the probe scales with the guess.
    const out = goalSeek((r) => 100000 * r, 4250, 0.05)
    expect(out.converged).toBe(true)
    expect(near(out.value, 0.0425)).toBe(true)
  })

  it('works on a large scale too', () => {
    const out = goalSeek((p) => p * 1.08, 540000, 300000)
    expect(out.converged).toBe(true)
    expect(near(out.value, 500000, 1e-3)).toBe(true)
  })

  it('handles a start of zero, where a proportional probe cannot move', () => {
    const out = goalSeek((x) => 2 * x, 10, 0)
    expect(out.converged).toBe(true)
    expect(near(out.value, 5)).toBe(true)
  })

  it('reports the closest attempt when it cannot converge', () => {
    // No x makes a constant equal 5, but the caller still gets a number and
    // a reason rather than nothing.
    const out = goalSeek(() => 1, 5, 0, { maxIterations: 20 })
    expect(out.converged).toBe(false)
    expect(out.reason).toBe('flat')
    expect(Number.isFinite(out.value)).toBe(true)
  })

  it('gives up after maxIterations', () => {
    // A function with no root that is not flat either.
    const out = goalSeek((x) => Math.exp(x), -1, 0, { maxIterations: 12 })
    expect(out.converged).toBe(false)
    expect(out.iterations).toBeLessThanOrEqual(13)
  })

  it('reports a non-numeric result rather than looping on NaN', () => {
    const out = goalSeek(() => 'not a number', 5, 0)
    expect(out.converged).toBe(false)
    expect(out.reason).toBe('notNumeric')
  })

  it('respects bounds', () => {
    // The answer is 10, but the search is capped at 3.
    const out = goalSeek((x) => x, 10, 0, { max: 3 })
    expect(out.converged).toBe(false)
    expect(out.value).toBeLessThanOrEqual(3)
  })

  it('finds an answer that is inside the bounds', () => {
    const out = goalSeek((x) => x * x, 4, 0.5, { min: 0, max: 10 })
    expect(out.converged).toBe(true)
    expect(near(out.value, 2)).toBe(true)
  })

  it('honours a looser tolerance with fewer iterations', () => {
    const loose = goalSeek((x) => x * x * x, 2, 1, { tolerance: 0.1 })
    const tight = goalSeek((x) => x * x * x, 2, 1, { tolerance: 1e-12 })
    expect(loose.converged).toBe(true)
    expect(tight.converged).toBe(true)
    expect(loose.iterations).toBeLessThanOrEqual(tight.iterations)
  })

  it('takes an explicit starting guess', () => {
    // x^2 = 9 has two roots; starting negative finds the negative one.
    const out = goalSeek((x) => x * x, 9, 0, { initialGuess: -1 })
    expect(out.converged).toBe(true)
    expect(near(out.value, -3)).toBe(true)
  })

  it('converges on a kinked function by bisecting', () => {
    // abs() has a corner at zero that pure secant handles badly.
    const out = goalSeek((x) => Math.abs(x - 3) + 1, 2, 0, { maxIterations: 200 })
    expect(out.converged).toBe(true)
  })

  it('counts every evaluation', () => {
    const fn = vi.fn((x: number) => 2 * x)
    const out = goalSeek(fn, 10, 0)
    expect(out.iterations).toBe(fn.mock.calls.length)
  })
})

describe('goalSeekCell', () => {
  const model = () => createWorkbook([{
    name: 'M',
    cells: [
      ['100'],            // A1  principal
      ['0.05'],           // A2  rate
      ['=A1*A2'],         // A3  interest
    ],
  }])

  it('solves for the input that hits the target', () => {
    const wb = model()
    const out = goalSeekCell(
      wb,
      { sheet: 'M', row: 2, col: 0 },
      { sheet: 'M', row: 1, col: 0 },
      8,
    )
    expect(out.converged).toBe(true)
    expect(near(out.value, 0.08)).toBe(true)
  })

  it('RESTORES the input cell, whatever the outcome', () => {
    // The solver writes to it dozens of times while searching. Leaving the
    // last probe behind would be worse than not running, and it is what
    // makes an "OK or Cancel" dialog possible.
    const wb = model()
    goalSeekCell(wb, { sheet: 'M', row: 2, col: 0 }, { sheet: 'M', row: 1, col: 0 }, 8)
    expect(wb.getRaw('M', 1, 0)).toBe('0.05')
    expect(wb.getValue('M', 2, 0)).toBe(5)
  })

  it('restores even when it fails to converge', () => {
    const wb = model()
    const out = goalSeekCell(
      wb,
      { sheet: 'M', row: 0, col: 0 },   // A1 does not depend on A2
      { sheet: 'M', row: 1, col: 0 },
      999,
      { maxIterations: 10 },
    )
    expect(out.converged).toBe(false)
    expect(wb.getRaw('M', 1, 0)).toBe('0.05')
  })

  it('solves through a chain of formulas', () => {
    const wb = createWorkbook([{
      name: 'M',
      cells: [['2'], ['=A1*3'], ['=A2+4']],
    }])
    const out = goalSeekCell(
      wb,
      { sheet: 'M', row: 2, col: 0 },
      { sheet: 'M', row: 0, col: 0 },
      22,
    )
    expect(out.converged).toBe(true)
    expect(near(out.value, 6)).toBe(true)
  })

  it('solves across sheets', () => {
    const wb = createWorkbook([
      { name: 'In', cells: [['1']] },
      { name: 'Out', cells: [['=In!A1*7']] },
    ])
    const out = goalSeekCell(
      wb,
      { sheet: 'Out', row: 0, col: 0 },
      { sheet: 'In', row: 0, col: 0 },
      42,
    )
    expect(out.converged).toBe(true)
    expect(near(out.value, 6)).toBe(true)
  })

  it('starts from a non-numeric input without crashing', () => {
    const wb = createWorkbook([{ name: 'M', cells: [['hello'], ['=A1*2']] }])
    expect(() => goalSeekCell(
      wb,
      { sheet: 'M', row: 1, col: 0 },
      { sheet: 'M', row: 0, col: 0 },
      10,
    )).not.toThrow()
  })
})
