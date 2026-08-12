import { afterEach, describe, expect, it } from 'vitest'
import {
  getPivotEngine,
  hasPivotEngine,
  registerPivotEngine,
  type GridPivotRow,
} from './pivot-view.svelte'

// A tiny stand-in engine so the seam can be exercised without @svgrid/enterprise.
const fakeEngine = (data: ReadonlyArray<Record<string, unknown>>) => {
  const rows: GridPivotRow[] = [
    { __pivotId: 'g1', __pivotDepth: 0, __pivotLabel: 'All', __pivotParentId: null, __pivotExpandable: true, total: data.length },
  ]
  return { rows, columns: [{ id: 'total', header: 'Total', field: 'total' }] as never }
}

afterEach(() => {
  // reset the module singleton between tests
  registerPivotEngine(null as never)
})

describe('pivot-view seam', () => {
  it('reports no engine until one is registered', () => {
    expect(hasPivotEngine()).toBe(false)
    expect(getPivotEngine()).toBeNull()
  })

  it('round-trips a registered engine', () => {
    registerPivotEngine(fakeEngine as never)
    expect(hasPivotEngine()).toBe(true)
    const engine = getPivotEngine()
    expect(engine).not.toBeNull()
    const result = engine!([{ a: 1 }, { a: 2 }], { rows: [], cols: [], values: [] })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!.total).toBe(2)
    expect(result.columns[0]!.id).toBe('total')
  })
})
