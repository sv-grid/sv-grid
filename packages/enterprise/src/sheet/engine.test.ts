import { describe, expect, it, vi } from 'vitest'
import { createWorkbook } from './workbook'
import { builtinEngine, type SheetEngine } from './engine'
import { createHyperFormulaEngine, fromHyperFormula, type HyperFormulaLike } from './hyperformula-engine'
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

/** A HyperFormula stand-in: sheets of text, and a hand-worked answer per formula. */
function mockHyperFormula(answers: Record<string, unknown>): HyperFormulaLike & { sheets: Map<number, unknown[][]> } {
  const names = new Map<string, number>()
  const sheets = new Map<number, unknown[][]>()
  return {
    sheets,
    getSheetId: (name) => names.get(name.toLowerCase()),
    addSheet(name) {
      const id = names.size
      names.set((name ?? `Sheet${id + 1}`).toLowerCase(), id)
      sheets.set(id, [])
      return name ?? `Sheet${id + 1}`
    },
    setSheetContent(id, values) { sheets.set(id, values.map((row) => [...row])) },
    setCellContents(cell, contents) {
      const grid = sheets.get(cell.sheet) ?? []
      while (grid.length <= cell.row) grid.push([])
      const row = grid[cell.row] as unknown[]
      while (row.length <= cell.col) row.push('')
      row[cell.col] = contents
      sheets.set(cell.sheet, grid)
    },
    getCellValue(cell) {
      const text = sheets.get(cell.sheet)?.[cell.row]?.[cell.col]
      if (typeof text === 'string' && text.startsWith('=')) return answers[text] ?? null
      if (typeof text === 'string' && text !== '' && Number.isFinite(Number(text))) return Number(text)
      return text ?? null
    },
  }
}

describe('the HyperFormula engine', () => {
  it('mirrors the cells, answers from the instance, and keeps the workbook\'s graph', () => {
    const hf = mockHyperFormula({ '=TEXTJOIN("-",TRUE,A1:A2)': 'a-b', '=SUM(A1:A2)': 3 })
    const engine = createHyperFormulaEngine({ hyperformula: hf })
    expect(engine.name).toBe('hyperformula')
    const wb = createWorkbook([{ name: 'Data', cells: [['1'], ['2'], ['=SUM(A1:A2)']] }], { engine })
    // The mirror squares the ragged rows off, and holds the same text.
    expect(hf.sheets.get(0)).toEqual([['1'], ['2'], ['=SUM(A1:A2)']])
    expect(wb.getValue('Data', 2, 0)).toBe(3)
    // A write goes through to the instance, and the graph still dirties downstream.
    wb.setRaw('Data', 0, 0, '10')
    expect(hf.sheets.get(0)![0]).toEqual(['10'])
    expect(wb.precedents('Data', 2, 0)).toEqual([
      { sheet: 'Data', row: 0, col: 0 },
      { sheet: 'Data', row: 1, col: 0 },
    ])
    // A function the built-in does not have is HyperFormula's to answer.
    wb.setRaw('Data', 3, 0, '=TEXTJOIN("-",TRUE,A1:A2)')
    expect(wb.getValue('Data', 3, 0)).toBe('a-b')
    // Text the grammar cannot read is refused before the instance is asked.
    wb.setRaw('Data', 4, 0, '=1+')
    expect(wb.getValue('Data', 4, 0)).toEqual({ error: '#PARSE!' })
  })

  it('maps HyperFormula values and errors to the sheet\'s own', () => {
    expect(fromHyperFormula(null)).toBe('')
    expect(fromHyperFormula(42)).toBe(42)
    expect(fromHyperFormula(Number.POSITIVE_INFINITY)).toEqual({ error: '#NUM!' })
    expect(fromHyperFormula(true)).toBe(true)
    expect(fromHyperFormula('text')).toBe('text')
    expect(fromHyperFormula({ value: '#DIV/0!' })).toEqual({ error: '#DIV/0!' })
    expect(fromHyperFormula({ value: '#ERROR!' })).toEqual({ error: '#VALUE!' })
    expect(fromHyperFormula({ type: 'NAME' })).toEqual({ error: '#NAME?' })
    expect(fromHyperFormula(new Date(Date.UTC(2026, 2, 4)))).toBe('2026-03-04')
  })

  it('a sheet the instance does not know is #REF!, and a new sheet is added to it', () => {
    const hf = mockHyperFormula({})
    const wb = createWorkbook([{ name: 'A', cells: [['=1']] }], { engine: createHyperFormulaEngine({ hyperformula: hf }) })
    wb.addSheet('B')
    expect(hf.getSheetId('B')).toBe(1)
    wb.setRaw('B', 0, 0, '=2')
    expect(hf.sheets.get(1)![0]![0]).toBe('=2')
  })
})
