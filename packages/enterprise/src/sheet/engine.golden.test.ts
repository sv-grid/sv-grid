import { describe, expect, it, afterEach } from 'vitest'
import type { GridCommandContext } from '@svgrid/grid/shortcuts'
import { parseFormula } from './parse'
import { evaluate, formatValue, type EvalContext } from './evaluate'
import { withCustomFunctions } from './functions'
import { createDependencyGraph, precedentsOf, cellKey } from './deps'
import { translateFormula } from './refs'
import { fillDown, fillRight, setFillTranslator } from './commands'
import type { CellValue } from './ast'

/**
 * A whole-sheet evaluator, the way a consumer wires one up. Recalculates every
 * cell from its raw text, with cycle detection, so these tests exercise the
 * modules together rather than one at a time.
 */
function sheetOf(raw: string[][]) {
  const rows = raw.length
  const cols = raw[0]?.length ?? 0
  const computed = new Map<string, CellValue>()
  const visiting = new Set<string>()

  const ctx: EvalContext = {
    resolve: (_sheet, r, c) => resolveCell(r, c),
    lastRow: () => Math.max(rows - 1, 0),
    functions: withCustomFunctions(undefined),
  }

  function resolveCell(r: number, c: number): CellValue {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return { error: '#REF!' }
    const key = `${r} ${c}`
    const done = computed.get(key)
    if (done !== undefined) return done
    if (visiting.has(key)) return { error: '#CYCLE!' }
    visiting.add(key)
    const text = (raw[r]?.[c] ?? '').trim()
    let value: CellValue
    if (text === '') value = ''
    else if (text.startsWith('=')) {
      try {
        value = evaluate(parseFormula(text), ctx)
      } catch {
        value = { error: '#PARSE!' }
      }
    } else {
      const n = Number(text)
      value = text !== '' && Number.isFinite(n) ? n : text
    }
    visiting.delete(key)
    computed.set(key, value)
    return value
  }

  return {
    value: (r: number, c: number) => resolveCell(r, c),
    display: (r: number, c: number) => formatValue(resolveCell(r, c)),
  }
}

describe('golden: demo 83 budget sheet', () => {
  // The seed data from examples/src/demos/83-spreadsheet-formulas.svelte. The
  // promoted engine has to render exactly what that demo renders today, or the
  // promotion changed behaviour instead of relocating it.
  const sheet = sheetOf([
    ['Item', 'Cost', 'Qty', 'Subtotal', 'Total'],
    ['Domain', '12.99', '3', '=B2*C2', '=ROUND(D2*1.08,2)'],
    ['Hosting', '49', '12', '=B3*C3', '=ROUND(D3*1.08,2)'],
    ['SSL', '85', '1', '=B4*C4', '=ROUND(D4*1.08,2)'],
    ['TOTALS', '', '', '=SUM(D2:D4)', '=SUM(E2:E4)'],
    ['Status', '', '', '', '=IF(E5>500,"REVIEW","OK")'],
  ])

  it('computes each line subtotal', () => {
    expect(sheet.value(1, 3)).toBeCloseTo(38.97, 10)
    expect(sheet.value(2, 3)).toBe(588)
    expect(sheet.value(3, 3)).toBe(85)
  })

  it('rounds each line total to two places', () => {
    expect(sheet.value(1, 4)).toBe(42.09)
    expect(sheet.value(2, 4)).toBe(635.04)
    expect(sheet.value(3, 4)).toBe(91.8)
  })

  it('sums the columns', () => {
    expect(sheet.value(4, 3)).toBeCloseTo(711.97, 10)
    expect(sheet.value(4, 4)).toBeCloseTo(768.93, 10)
  })

  it('resolves the IF status', () => {
    expect(sheet.value(5, 4)).toBe('REVIEW')
  })

  it('keeps text cells as text', () => {
    expect(sheet.value(0, 0)).toBe('Item')
  })
})

describe('golden: the error vocabulary', () => {
  it('produces the same codes the demos document', () => {
    const s = sheetOf([
      ['=A9', '=1/0', '="abc"+1', '=NOPE()', '=SUM(', '=B2'],
      ['', '', '', '', '', '=A2'],
    ])
    expect(s.display(0, 0)).toBe('#REF!')
    expect(s.display(0, 1)).toBe('#DIV/0!')
    expect(s.display(0, 2)).toBe('#VALUE!')
    expect(s.display(0, 3)).toBe('#NAME?')
    expect(s.display(0, 4)).toBe('#PARSE!')
  })

  it('detects a cycle rather than recursing forever', () => {
    const s = sheetOf([['=B1', '=A1']])
    expect(s.display(0, 0)).toBe('#CYCLE!')
  })
})

describe('golden: demo 119 cross-sheet workbook', () => {
  // Demo 119 is the superset the promotion took as its baseline: quoted sheet
  // names, whole-column refs and VLOOKUP.
  const priceList: CellValue[][] = [
    ['SKU-100', 10],
    ['SKU-110', 25],
    ['SKU-120', 40],
  ]
  const orders: CellValue[][] = [[2], [3]]

  const ctx: EvalContext = {
    resolve: (sheet, r, c) => {
      const grid = sheet === 'Price list' ? priceList : sheet === 'Orders' ? orders : []
      if (r < 0 || r >= grid.length) return { error: '#REF!' }
      const row = grid[r]!
      if (c < 0 || c >= row.length) return { error: '#REF!' }
      return row[c] ?? ''
    },
    lastRow: (sheet) => (sheet === 'Price list' ? priceList.length - 1 : orders.length - 1),
    functions: withCustomFunctions(undefined),
  }
  const run = (src: string) => evaluate(parseFormula(src), ctx)

  it('reads across sheets with a quoted name', () => {
    expect(run("='Price list'!B2")).toBe(25)
  })

  it('does a cross-sheet VLOOKUP', () => {
    expect(run("=VLOOKUP(\"SKU-120\", 'Price list'!A1:B3, 2)")).toBe(40)
  })

  it('sums a whole column of another sheet', () => {
    expect(run('=SUM(Orders!A)')).toBe(5)
  })

  it('nests a lookup inside arithmetic', () => {
    expect(run("=VLOOKUP(\"SKU-100\", 'Price list'!A1:B3, 2) * Orders!A1")).toBe(20)
  })
})

describe('incremental recalc matches a full recompute', () => {
  it('dirties exactly the dependents of an edit', () => {
    const raw = [
      ['1', '=A1*2', '=B1+10'],
      ['5', '=A2*2', '=B2+10'],
    ]
    const graph = createDependencyGraph()
    const lastRow = () => raw.length - 1
    for (let r = 0; r < raw.length; r += 1) {
      for (let c = 0; c < (raw[r]?.length ?? 0); c += 1) {
        const text = raw[r]![c]!
        if (!text.startsWith('=')) continue
        graph.setPrecedents(
          cellKey(null, r, c),
          precedentsOf(parseFormula(text), { sheet: null }, lastRow),
        )
      }
    }
    // Editing A1 touches B1 then C1, and nothing in row 2.
    expect(graph.dirtyFrom([cellKey(null, 0, 0)]))
      .toEqual([cellKey(null, 0, 1), cellKey(null, 0, 2)])
    expect(graph.dirtyFrom([cellKey(null, 1, 0)]))
      .toEqual([cellKey(null, 1, 1), cellKey(null, 1, 2)])
  })
})

describe('fill translates references end to end', () => {
  function fakeCmd(cells: unknown[][], ranges: ReadonlyArray<readonly [number, number, number, number]>) {
    const first = ranges[0]!
    return {
      cmd: {
        api: {} as never,
        editing: false,
        activeCell: { rowIndex: first[0], colIndex: first[1], columnId: 'c' },
        rowCount: cells.length,
        colCount: cells[0]?.length ?? 0,
        ranges,
        columnIdAt: (c: number) => `c${c}`,
        getCellValue: (r: number, c: number) => cells[r]?.[c],
        setCellValue: (r: number, c: number, v: unknown) => { cells[r]![c] = v },
        setActiveCell: () => {}, setSelection: () => {},
        extendSelection: () => {}, scrollIntoView: () => {},
        startEditing: () => true,
        batch: <T,>(fn: () => T) => fn(),
      } as unknown as GridCommandContext,
      cells,
    }
  }

  // The wiring enableSheet() does.
  setFillTranslator((value, delta) => translateFormula(value, delta.rows, delta.cols))
  afterEach(() => setFillTranslator((value, delta) => translateFormula(value, delta.rows, delta.cols)))

  it('shifts relative references filling down', () => {
    const { cmd, cells } = fakeCmd([['=A1*2'], [''], ['']], [[0, 0, 2, 0]])
    fillDown(cmd)
    expect(cells[1]![0]).toBe('=A2*2')
    expect(cells[2]![0]).toBe('=A3*2')
  })

  it('leaves an absolute reference pinned while filling down', () => {
    // The bug the whole phase exists for. Before this, =$A$1*B1 filled down
    // silently started reading $A$2 and returned a plausible wrong number.
    const { cmd, cells } = fakeCmd([['=$A$1*B1'], [''], ['']], [[0, 0, 2, 0]])
    fillDown(cmd)
    expect(cells[1]![0]).toBe('=$A$1*B2')
    expect(cells[2]![0]).toBe('=$A$1*B3')
  })

  it('shifts columns filling right, honouring a column anchor', () => {
    const { cmd, cells } = fakeCmd([['=$A1+B$1', '', '']], [[0, 0, 0, 2]])
    fillRight(cmd)
    expect(cells[0]![1]).toBe('=$A1+C$1')
    expect(cells[0]![2]).toBe('=$A1+D$1')
  })

  it('leaves literals alone while filling', () => {
    const { cmd, cells } = fakeCmd([['hello'], [''], ['']], [[0, 0, 2, 0]])
    fillDown(cmd)
    expect(cells[1]![0]).toBe('hello')
  })

  it('shifts a range inside a filled formula', () => {
    const { cmd, cells } = fakeCmd([['=SUM(B1:D1)'], ['']], [[0, 0, 1, 0]])
    fillDown(cmd)
    expect(cells[1]![0]).toBe('=SUM(B2:D2)')
  })
})
