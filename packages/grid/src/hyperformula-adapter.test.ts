import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createHyperFormulaSheet,
  type HyperFormulaInstance,
} from './hyperformula-adapter'

/**
 * A tiny in-memory fake that emulates just the slice of the HyperFormula
 * API the adapter touches: setCellContents / getCellValue / destroy.
 *
 * It stores raw cell contents in a Map keyed by "sheet:row:col" and
 * evaluates `=A1+B1` style formulas with a deliberately small expression
 * engine so we can assert the adapter wires reads/writes correctly without
 * needing the real ~1MB hyperformula package.
 */
function makeFakeEngine(opts: { bulk?: boolean } = {}) {
  const raw = new Map<string, unknown>()
  const key = (s: number, r: number, c: number) => `${s}:${r}:${c}`

  // Resolve an A1 reference (e.g. "A1", "B2") to a cell value.
  const colLetterToIndex = (letters: string) => {
    let n = 0
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }

  function evalCell(sheet: number, row: number, col: number): unknown {
    const stored = raw.get(key(sheet, row, col))
    if (typeof stored !== 'string' || !stored.startsWith('=')) return stored
    const expr = stored.slice(1)
    // Replace A1-style refs with their numeric values.
    const substituted = expr.replace(/([A-Z]+)(\d+)/g, (_m, letters, digits) => {
      const refCol = colLetterToIndex(letters)
      const refRow = Number(digits) - 1
      const v = evalCell(sheet, refRow, refCol)
      return String(typeof v === 'number' ? v : 0)
    })
    try {
      // Only ever digits / operators after substitution: safe to eval here.
      // eslint-disable-next-line no-new-func
      return Function(`"use strict";return (${substituted})`)()
    } catch {
      return '#ERROR!'
    }
  }

  const engine = {
    setCellContents: vi.fn(
      (cell: { sheet: number; row: number; col: number }, contents: unknown) => {
        raw.set(key(cell.sheet, cell.row, cell.col), contents)
        return [
          {
            address: { sheet: cell.sheet, row: cell.row, col: cell.col },
            newValue: evalCell(cell.sheet, cell.row, cell.col),
          },
        ]
      },
    ),
    getCellValue: vi.fn((cell: { sheet: number; row: number; col: number }) =>
      evalCell(cell.sheet, cell.row, cell.col),
    ),
    destroy: vi.fn(() => {}),
    rebuildAndRecalculate: vi.fn(() => {}),
    // Bulk seed path (only when opted in) - fills the same `raw` map so
    // getCellValue/evalCell work identically to the per-cell path.
    ...(opts.bulk
      ? {
          setSheetContent: vi.fn((sheetId: number, values: unknown[][]) => {
            values.forEach((rowVals, r) =>
              rowVals.forEach((v, c) => raw.set(key(sheetId, r, c), v)),
            )
            return []
          }),
        }
      : {}),
    // test-only introspection
    _raw: raw,
  }
  return engine as HyperFormulaInstance & {
    setCellContents: ReturnType<typeof vi.fn>
    getCellValue: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    _raw: Map<string, unknown>
  }
}

describe('createHyperFormulaSheet', () => {
  let hf: ReturnType<typeof makeFakeEngine>

  beforeEach(() => {
    hf = makeFakeEngine()
  })

  it('seeds the engine with one setCellContents per cell in field order', () => {
    const rows = [
      { a: 1, b: 2 },
      { a: 10, b: 20 },
    ]
    createHyperFormulaSheet({ hyperformula: hf, rows, fields: ['a', 'b'] })

    // 2 rows x 2 fields = 4 seeded cells.
    expect(hf.setCellContents).toHaveBeenCalledTimes(4)
    // Field 'a' is column 0, field 'b' is column 1 (order = column index).
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 0, row: 0, col: 0 },
      1,
    )
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 0, row: 1, col: 1 },
      20,
    )
  })

  it('seeds via a single bulk setSheetContent when the engine exposes it', () => {
    const bulkHf = makeFakeEngine({ bulk: true }) as ReturnType<typeof makeFakeEngine> & {
      setSheetContent: ReturnType<typeof vi.fn>
    }
    const rows = [
      { a: 1, b: '=A1+10' },
      { a: 10, b: '=A2+10' },
    ]
    const sheet = createHyperFormulaSheet({ hyperformula: bulkHf, rows, fields: ['a', 'b'] })

    // Bulk path: ONE setSheetContent, no per-cell setCellContents for the seed.
    expect(bulkHf.setSheetContent).toHaveBeenCalledTimes(1)
    expect(bulkHf.setSheetContent).toHaveBeenCalledWith(0, [
      [1, '=A1+10'],
      [10, '=A2+10'],
    ])
    expect(bulkHf.setCellContents).not.toHaveBeenCalled()
    // Still computes correctly.
    expect(sheet.computed[0]!.b).toBe(11)
    expect(sheet.computed[1]!.b).toBe(20)
  })

  it('computed snapshot pulls evaluated values out of the engine', () => {
    const rows = [{ a: 2, b: 3, total: '=A1+B1' }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b', 'total'],
    })
    expect(sheet.computed[0]).toEqual({ a: 2, b: 3, total: 5 })
    // getCellValue called once per cell in the snapshot (3 fields).
    expect(hf.getCellValue).toHaveBeenCalledTimes(3)
  })

  it('raw snapshot keeps the original formula strings untouched', () => {
    const rows = [{ a: 2, b: 3, total: '=A1+B1' }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b', 'total'],
    })
    expect(sheet.raw[0]!.total).toBe('=A1+B1')
    // raw is a copy, not the same object reference as the input row.
    expect(sheet.raw[0]).not.toBe(rows[0])
  })

  it('preserves non-formula fields not listed in `fields`', () => {
    const rows = [{ a: 1, b: 2, name: 'keep-me' }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b'],
    })
    // `name` was never registered as a column but survives in computed.
    expect(sheet.computed[0]!.name).toBe('keep-me')
    expect(sheet.raw[0]!.name).toBe('keep-me')
  })

  it('update() writes the edited cell back and re-evaluates dependents', () => {
    const rows = [{ a: 2, b: 3, total: '=A1+B1' }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b', 'total'],
    })
    expect(sheet.computed[0]!.total).toBe(5)

    hf.setCellContents.mockClear()
    const next = sheet.update(0, 'a', 100)

    // The edited cell was pushed into the engine at its column index (a => col 0).
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 0, row: 0, col: 0 },
      100,
    )
    // Dependent formula recomputed from the engine.
    expect(next.computed[0]).toEqual({ a: 100, b: 3, total: 103 })
    // raw reflects the new edited literal but keeps the formula string.
    expect(next.raw[0]).toEqual({ a: 100, b: 3, total: '=A1+B1' })
  })

  it('update() with an unregistered field skips the engine write but updates rows', () => {
    const rows = [{ a: 1, b: 2, note: 'x' }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b'],
    })
    hf.setCellContents.mockClear()

    const next = sheet.update(0, 'note' as 'a', 'edited')

    // `note` is not a registered column => no setCellContents call.
    expect(hf.setCellContents).not.toHaveBeenCalled()
    // But the raw/computed row still carries the new value.
    expect(next.raw[0]!.note).toBe('edited')
    expect(next.computed[0]!.note).toBe('edited')
  })

  it('respects a custom sheetId for every read and write', () => {
    const rows = [{ a: 1 }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a'],
      sheetId: 7,
    })
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 7, row: 0, col: 0 },
      1,
    )
    expect(hf.getCellValue).toHaveBeenCalledWith({ sheet: 7, row: 0, col: 0 })

    hf.setCellContents.mockClear()
    sheet.update(0, 'a', 9)
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 7, row: 0, col: 0 },
      9,
    )
  })

  it('defaults sheetId to 0 when omitted', () => {
    createHyperFormulaSheet({ hyperformula: hf, rows: [{ a: 1 }], fields: ['a'] })
    expect(hf.setCellContents).toHaveBeenCalledWith(
      { sheet: 0, row: 0, col: 0 },
      1,
    )
  })

  it('handles an empty rows array without touching the engine', () => {
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows: [],
      fields: ['a', 'b'],
    })
    expect(hf.setCellContents).not.toHaveBeenCalled()
    expect(sheet.computed).toEqual([])
    expect(sheet.raw).toEqual([])
  })

  it('cross-row formula references resolve through the engine', () => {
    const rows = [
      { a: 5 },
      { a: 7 },
      { a: '=A1+A2' },
    ]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a'],
    })
    expect(sheet.computed[2]!.a).toBe(12)
  })

  it('destroy() tears down the underlying engine', () => {
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows: [{ a: 1 }],
      fields: ['a'],
    })
    sheet.destroy()
    expect(hf.destroy).toHaveBeenCalledTimes(1)
  })

  it('update() returns fresh array instances each call (no shared mutation)', () => {
    const rows = [{ a: 1, b: 1 }]
    const sheet = createHyperFormulaSheet({
      hyperformula: hf,
      rows,
      fields: ['a', 'b'],
    })
    const first = sheet.update(0, 'a', 2)
    const second = sheet.update(0, 'b', 3)
    expect(first.computed).not.toBe(second.computed)
    expect(second.computed[0]).toEqual({ a: 2, b: 3 })
  })
})
