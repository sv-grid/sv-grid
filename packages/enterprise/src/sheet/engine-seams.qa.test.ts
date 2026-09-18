/**
 * Deep QA, round 3: the engine under awkward combinations. Iteration with
 * volatiles and spills, tables holding array formulas, the delta stream
 * carrying the new parts, and the paths a protected or hidden sheet takes.
 */
import { describe, expect, it, vi } from 'vitest'
import { createWorkbook } from './workbook'
import { createSheetDocument } from './document'
import { createDeltaStream, type SheetDelta } from './delta'
import type { Rect } from './format-store'

const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect
const settle = () => new Promise<void>((r) => queueMicrotask(() => queueMicrotask(r)))

describe('iterative calculation under pressure', () => {
  it('a cycle that reads a spilled cell still settles', () => {
    const wb = createWorkbook([{ name: 'S', cells: [
      ['=SEQUENCE(3)', '', '=A1+0.1*(10-B1)'],
    ] }], { iteration: { enabled: true } })
    const value = wb.getValue('S', 0, 2)
    expect(typeof value).toBe('number')
  })

  it('a cycle with a volatile in it does not hang', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['=INDIRECT("A1")+0']] }], { iteration: { enabled: true, maxIterations: 5 } })
    const value = wb.getValue('S', 0, 0)
    expect(typeof value === 'number' || typeof value === 'object').toBe(true)
  })

  it('turning iteration on does not disturb a sheet with no cycle', () => {
    const cells = [['2'], ['=A1*3'], ['=SUM(A1:A2)']]
    const plain = createWorkbook([{ name: 'S', cells: cells.map((r) => [...r]) }])
    const iterating = createWorkbook([{ name: 'S', cells: cells.map((r) => [...r]) }], { iteration: { enabled: true } })
    for (let r = 0; r < 3; r += 1) expect(iterating.getValue('S', r, 0)).toEqual(plain.getValue('S', r, 0))
  })

  it('an edit inside a settled cycle settles again', () => {
    const wb = createWorkbook([{ name: 'S', cells: [['100000'], ['=0.1*(A1-A2)']] }], { iteration: { enabled: true } })
    expect(wb.getValue('S', 1, 0)).toBeCloseTo(100000 / 11, 2)
    wb.setRaw('S', 0, 0, '220000')
    expect(wb.getValue('S', 1, 0)).toBeCloseTo(220000 / 11, 2)
    wb.setRaw('S', 0, 0, '100000')
    expect(wb.getValue('S', 1, 0)).toBeCloseTo(100000 / 11, 2)
  })
})

describe('a table holding an array formula', () => {
  it('spills inside the table and the total reads the spill', () => {
    const wb = createWorkbook([{ name: 'S', cells: [
      ['Qty', 'Double'], ['2', '=A2:A4*2'], ['3', ''], ['4', ''], ['', '=SUM(T[Double])'],
    ] }])
    wb.tables.define({ name: 'T', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 3, hasTotals: false })
    expect(wb.getValue('S', 1, 1)).toBe(4)
    expect(wb.getValue('S', 3, 1)).toBe(8)
    expect(wb.getValue('S', 4, 1)).toBe(18)
  })
})

describe('the delta stream carries the new parts', () => {
  it('sends a state delta for pivots, links, sparklines and objects', async () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const sent: SheetDelta[] = []
    const stream = createDeltaStream(doc, { onDelta: (d) => sent.push(d) })
    doc.get('S').links = { r0: { A: { target: 'https://example.com' } } }
    doc.changed({ kind: 'links' })
    doc.get('S').sparklines = [{ id: 's', location: rect(0, 1, 0, 1), data: rect(0, 0, 0, 0), type: 'line' }]
    doc.changed({ kind: 'sparklines' })
    doc.get('S').pivots = [{ id: 'p', source: rect(0, 0, 0, 0), target: { row: 3, col: 0 }, rows: [], cols: [], values: [{ field: 'A', agg: 'sum' }], filters: [{ field: 'A', value: 'x' }] }]
    doc.changed({ kind: 'pivots' })
    await settle()
    const parts = sent.filter((d) => d.kind === 'state').flatMap((d) => Object.keys((d as { entry: object }).entry))
    expect(parts).toContain('links')
    expect(parts).toContain('sparklines')
    expect(parts).toContain('pivots')
    stream.stop()
  })

  it('applies one of those to another document', async () => {
    const left = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const right = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const b = createDeltaStream(right, { onDelta: () => {} })
    const a = createDeltaStream(left, { onDelta: (d) => b.apply(d) })
    left.get('S').pivots = [{ id: 'p', source: rect(0, 0, 0, 0), target: { row: 3, col: 0 }, rows: [], cols: [], values: [{ field: 'A', agg: 'sum' }], filters: [{ field: 'A', value: 'x' }] }]
    left.changed({ kind: 'pivots' })
    await settle()
    expect(right.get('S').pivots[0]?.filters).toEqual([{ field: 'A', value: 'x' }])
    a.stop(); b.stop()
  })
})

describe('a workbook with a table on a renamed sheet', () => {
  it('follows the rename rather than pointing at a sheet that is gone', () => {
    const wb = createWorkbook([{ name: 'Old', cells: [['Qty'], ['2'], ['3']] }])
    wb.tables.define({ name: 'T', sheet: 'Old', headerRow: 0, firstCol: 0, lastCol: 0, lastRow: 2, hasTotals: false })
    wb.addSheet('Report')
    wb.setRaw('Report', 0, 0, '=SUM(T[Qty])')
    expect(wb.getValue('Report', 0, 0)).toBe(5)
    wb.renameSheet('Old', 'New')
    expect(wb.getValue('Report', 0, 0)).toBe(5)
  })
})

describe('onRecalc still reports once per write', () => {
  it('does not fire for a read', () => {
    const onRecalc = vi.fn()
    const wb = createWorkbook([{ name: 'S', cells: [['1'], ['=A1+1']] }], { onRecalc })
    onRecalc.mockClear()
    wb.getValue('S', 1, 0)
    expect(onRecalc).not.toHaveBeenCalled()
    wb.setRaw('S', 0, 0, '5')
    expect(onRecalc).toHaveBeenCalledTimes(1)
  })
})
