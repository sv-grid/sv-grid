import { describe, expect, it, vi } from 'vitest'
import { createWorkbook } from './workbook'
import { builtinEngine, type SheetEngine } from './engine'
import { err } from './ast'

describe('the engine seam', () => {
  it('the built-in is the default, and names itself', () => {
    expect(builtinEngine().name).toBe('builtin')
    const wb = createWorkbook([{ name: 'S', cells: [['2'], ['=A1*3']] }])
    expect(wb.getValue('S', 1, 0)).toBe(6)
  })

  it('an engine of one\'s own answers every formula, and the workbook still keeps the graph and the spills', () => {
    const asked: string[] = []
    const engine: SheetEngine = {
      name: 'test',
      evaluate(text, at, host) {
        asked.push(`${text}@${at.row},${at.col}`)
        // Everything doubled, whatever it says; SPILLS spills a column.
        if (text === '=SPILLS') return { value: 1, spill: [[1], [2], [3]] }
        const ast = host.parse(text)
        if (!ast) return { value: err('#PARSE!') }
        const read = host.context.resolve(null, at.row - 1, at.col)
        return { value: typeof read === 'number' ? read * 2 : read }
      },
    }
    const wb = createWorkbook([{ name: 'S', cells: [['5'], ['=A1'], ['=A2']] }], { engine })
    expect(wb.getValue('S', 1, 0)).toBe(10)
    expect(wb.getValue('S', 2, 0)).toBe(20)
    expect(asked).toContain('=A1@1,0')
    // The graph is the workbook's, so a write upstream still invalidates.
    wb.setRaw('S', 0, 0, '7')
    expect(wb.getValue('S', 2, 0)).toBe(28)
    expect(wb.precedents('S', 1, 0)).toEqual([{ sheet: 'S', row: 0, col: 0 }])
    // And so are the spills.
    wb.setRaw('S', 4, 1, '=SPILLS')
    expect(wb.getValue('S', 6, 1)).toBe(3)
    expect(wb.spillOf('S', 5, 1)).toEqual({ anchor: { row: 4, col: 1 }, rect: [4, 1, 6, 1] })
  })

  it('load and write carry the cells to an engine that keeps a copy', () => {
    const load = vi.fn()
    const write = vi.fn()
    const engine: SheetEngine = { load, write, evaluate: () => ({ value: 1 }) }
    const wb = createWorkbook([{ name: 'S', cells: [['1']] }], { engine })
    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0]![0]).toEqual([{ name: 'S', cells: [['1']] }])
    wb.setRaw('S', 0, 1, 'x')
    expect(write).toHaveBeenCalledWith('S', 0, 1, 'x')
    // A wholesale change reloads: a new sheet, a rename, a structural edit, a recalculation.
    wb.addSheet('T')
    expect(load).toHaveBeenCalledTimes(2)
    wb.renameSheet('T', 'U')
    expect(load).toHaveBeenCalledTimes(3)
    wb.applyStructuralEdit('S', { kind: 'insertRows', at: 0, count: 1 })
    expect(load).toHaveBeenCalledTimes(4)
    wb.recalculate()
    expect(load).toHaveBeenCalledTimes(5)
    wb.removeSheet('U')
    expect(load).toHaveBeenCalledTimes(6)
  })
})
