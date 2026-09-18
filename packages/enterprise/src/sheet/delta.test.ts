import { describe, expect, it, vi } from 'vitest'
import { createSheetDocument } from './document'
import { applySheetDelta, createDeltaStream, partsOfReasons, type SheetDelta } from './delta'

const tick = () => new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(resolve)))

/** Two documents over the same starting data, wired to each other. */
function pair() {
  const cells = [['Region', 'Amount'], ['North', '10'], ['South', '20'], ['Total', '=SUM(B2:B3)']]
  const left = createSheetDocument({ sheets: [{ name: 'S', cells: cells.map((r) => [...r]) }] })
  const right = createSheetDocument({ sheets: [{ name: 'S', cells: cells.map((r) => [...r]) }] })
  const sentLeft: SheetDelta[] = []
  const sentRight: SheetDelta[] = []
  const a = createDeltaStream(left, { onDelta: (d) => { sentLeft.push(d); b.apply(d) } })
  const b = createDeltaStream(right, { onDelta: (d) => { sentRight.push(d); a.apply(d) } })
  return { left, right, a, b, sentLeft, sentRight }
}

describe('the delta stream', () => {
  it('sends the raw text of a written cell, not its value, and the other side computes its own', async () => {
    const { left, right, sentLeft } = pair()
    left.workbook.setRaw('S', 1, 1, '=10*5')
    left.changed({ kind: 'cells' })
    await tick()
    expect(sentLeft).toEqual([{ kind: 'cells', sheet: 'S', cells: [{ row: 1, col: 1, text: '=10*5' }] }])
    expect(right.workbook.getRaw('S', 1, 1)).toBe('=10*5')
    expect(right.workbook.getValue('S', 1, 1)).toBe(50)
    // And the receiving workbook recalculated what read it.
    expect(right.workbook.getValue('S', 3, 1)).toBe(70)
  })

  it('a cell typed twice in one tick goes out once', async () => {
    const { left, sentLeft } = pair()
    left.workbook.setRaw('S', 1, 1, '11')
    left.workbook.setRaw('S', 1, 1, '12')
    left.workbook.setRaw('S', 2, 1, '99')
    left.changed({ kind: 'cells' })
    await tick()
    expect(sentLeft).toEqual([{
      kind: 'cells',
      sheet: 'S',
      cells: [{ row: 1, col: 1, text: '12' }, { row: 2, col: 1, text: '99' }],
    }])
  })

  it('does not echo what it applied', async () => {
    const { left, right, sentLeft, sentRight } = pair()
    left.workbook.setRaw('S', 1, 1, '42')
    left.changed({ kind: 'cells' })
    await tick()
    expect(sentLeft).toHaveLength(1)
    expect(sentRight).toEqual([])
    expect(right.workbook.getValue('S', 1, 1)).toBe(42)
  })

  it('sends the one part of the one sheet that changed', async () => {
    const { left, right, sentLeft } = pair()
    const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
    left.get('S').formats.set([[0, 0, 0, 1]], { bold: true }, at)
    left.changed({ kind: 'formats' })
    await tick()
    expect(sentLeft).toHaveLength(1)
    const delta = sentLeft[0]!
    expect(delta.kind).toBe('state')
    expect(Object.keys((delta as { entry: Record<string, unknown> }).entry)).toEqual(['formats'])
    expect(right.get('S').formats.get('r0', 'A')).toEqual({ bold: true })

    // A change that touches nothing sends nothing.
    left.changed({ kind: 'formats' })
    await tick()
    expect(sentLeft).toHaveLength(1)
  })

  it('carries an insert as the edit itself, so both sides rewrite their own formulas', async () => {
    const { left, right, sentLeft } = pair()
    left.workbook.applyStructuralEdit('S', { kind: 'insertRows', at: 1, count: 1 })
    left.shift('S', { kind: 'insertRows', at: 1, count: 1 })
    left.changed({ kind: 'structure', sheet: 'S', edit: { kind: 'insertRows', at: 1, count: 1 } })
    await tick()
    expect(sentLeft).toEqual([{ kind: 'structure', sheet: 'S', edit: { kind: 'insertRows', at: 1, count: 1 } }])
    expect(right.workbook.getRaw('S', 4, 1)).toBe('=SUM(B3:B4)')
    expect(right.workbook.getValue('S', 4, 1)).toBe(30)
  })

  it('sends the whole document when a sheet is added, and resync sends it on demand', async () => {
    const { left, right, sentLeft } = pair()
    left.workbook.addSheet('Second')
    left.changed({ kind: 'sheets' })
    await tick()
    expect(sentLeft.map((d) => d.kind)).toEqual(['document'])
    expect(right.workbook.sheets).toEqual(['S', 'Second'])

    const seen: SheetDelta[] = []
    const stream = createDeltaStream(left, { onDelta: (d) => seen.push(d) })
    stream.resync()
    expect(seen).toHaveLength(1)
    expect(seen[0]!.kind).toBe('document')
    stream.stop()
  })

  it('stops when it is told to', async () => {
    const { left, a, sentLeft } = pair()
    a.stop()
    left.workbook.setRaw('S', 1, 1, '7')
    left.changed({ kind: 'cells' })
    await tick()
    expect(sentLeft).toEqual([])
  })

  it('last writer wins on the same cell', async () => {
    const { left, right } = pair()
    // Both type into B2 before either message lands.
    left.workbook.setRaw('S', 1, 1, 'left')
    right.workbook.setRaw('S', 1, 1, 'right')
    left.changed({ kind: 'cells' })
    right.changed({ kind: 'cells' })
    await tick()
    // Whatever arrived last is what both hold, which is the documented rule.
    expect(left.workbook.getValue('S', 1, 1)).toBe(right.workbook.getValue('S', 1, 1))
  })
})

describe('applySheetDelta', () => {
  it('applies each kind to a plain document', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1'], ['=A1*2']] }] })
    const listener = vi.fn()
    doc.subscribe(listener)
    applySheetDelta(doc, { kind: 'cells', sheet: 'S', cells: [{ row: 0, col: 0, text: '5' }] })
    expect(doc.workbook.getValue('S', 1, 0)).toBe(10)
    applySheetDelta(doc, { kind: 'state', sheet: 'S', entry: { freeze: { rows: 1, cols: 0 } } })
    expect(doc.get('S').freeze).toEqual({ rows: 1, cols: 0 })
    applySheetDelta(doc, { kind: 'structure', sheet: 'S', edit: { kind: 'insertRows', at: 0, count: 1 } })
    expect(doc.workbook.getRaw('S', 2, 0)).toBe('=A2*2')
  })
})

describe('partsOfReasons', () => {
  it('maps reasons to the parts of a saved sheet they touch', () => {
    expect(partsOfReasons([{ kind: 'formats' }, { kind: 'sizes' }])).toEqual(['formats', 'columnWidths', 'rowHeights'])
    expect(partsOfReasons([{ kind: 'protection' }, { kind: 'protection' }])).toEqual(['protected', 'protection'])
    expect(partsOfReasons([{ kind: 'cells' }, { kind: 'restore' }])).toEqual([])
  })
})
