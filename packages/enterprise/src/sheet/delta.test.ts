import { describe, expect, it, vi } from 'vitest'
import { createSheetDocument } from './document'
import { applySheetDelta, createDeltaStream, partsOfReasons, type SheetDelta } from './delta'
import type { SheetPresence } from './presence'

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

describe('what the workbook keeps, rather than a sheet', () => {
  // Tables, defined names and the calculation settings belong to the
  // workbook, so no `state` delta (which is keyed by sheet and carries a
  // sheet's own entry) can describe them. Without this the two sides drift
  // silently: the same structured reference answers a number on one and
  // #REF! on the other.
  it('a table defined on one side reaches the other, and its references resolve there', async () => {
    const { left, right, sentLeft } = pair()
    left.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false })
    left.changed({ kind: 'tables' })
    await tick()
    expect(sentLeft.map((d) => d.kind)).toEqual(['document'])
    expect(right.workbook.tables.list().map((t) => t.name)).toEqual(['Orders'])
    right.workbook.setRaw('S', 5, 0, '=SUM(Orders[Amount])')
    right.workbook.recalculate()
    expect(right.workbook.getValue('S', 5, 0)).toBe(30)
  })

  it('a table that grows under the last row grows on the other side too', async () => {
    const { left, right } = pair()
    left.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false })
    left.changed({ kind: 'tables' })
    await tick()
    left.workbook.setRaw('S', 3, 0, 'EMEA')
    left.workbook.setRaw('S', 3, 1, '5')
    left.workbook.tables.growToInclude('S', 3, 1)
    left.changed({ kind: 'tables' })
    left.changed({ kind: 'cells' })
    await tick()
    expect(right.workbook.tables.list()[0]!.lastRow, 'the table there').toBe(3)
    right.workbook.setRaw('S', 5, 0, '=SUM(Orders[Amount])')
    right.workbook.recalculate()
    expect(right.workbook.getValue('S', 5, 0), 'the total there').toBe(35)
  })

  it('a defined name and the calculation settings reach the other', async () => {
    const { left, right } = pair()
    left.workbook.names.define('Tax', 'S!B2')
    left.workbook.setIteration({ enabled: true, maxIterations: 30, maxChange: 0.5 })
    left.changed({ kind: 'workbook' })
    await tick()
    expect(right.workbook.names.list().map((n) => n.name)).toEqual(['Tax'])
    expect(right.workbook.iteration).toEqual({ enabled: true, maxIterations: 30, maxChange: 0.5 })
  })

  it('and what arrives is not sent straight back', async () => {
    const { left, sentLeft, sentRight } = pair()
    left.workbook.tables.define({ name: 'Orders', sheet: 'S', headerRow: 0, firstCol: 0, lastCol: 1, lastRow: 2, hasTotals: false })
    left.changed({ kind: 'tables' })
    await tick()
    expect(sentLeft).toHaveLength(1)
    expect(sentRight, 'the other side echoed nothing back').toHaveLength(0)
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

describe('presence on the delta stream', () => {
  it('goes out as a delta, arrives through onPresence, and changes no document', async () => {
    const cells = [['1', '2']]
    const left = createSheetDocument({ sheets: [{ name: 'S', cells: cells.map((r) => [...r]) }] })
    const right = createSheetDocument({ sheets: [{ name: 'S', cells: cells.map((r) => [...r]) }] })
    const sent: SheetDelta[] = []
    const seen: SheetPresence[] = []
    const a = createDeltaStream(left, { onDelta: (d) => sent.push(d) })
    const b = createDeltaStream(right, { onDelta: () => {}, onPresence: (who) => seen.push(who) })

    const me: SheetPresence = { id: 'ada', name: 'Ada', sheet: 'S', rect: [0, 0, 2, 1] }
    a.sendPresence(me)
    expect(sent).toEqual([{ kind: 'presence', who: me }])
    for (const delta of sent) b.apply(delta)
    expect(seen).toEqual([me])

    // Nothing about the document moved, and nothing was echoed back.
    const before = JSON.stringify(right.getState())
    b.apply({ kind: 'presence', who: me })
    await Promise.resolve()
    expect(JSON.stringify(right.getState())).toBe(before)
    a.stop()
    b.stop()
  })

  it('applySheetDelta ignores a presence delta', () => {
    const doc = createSheetDocument({ sheets: [{ name: 'S', cells: [['1']] }] })
    const before = JSON.stringify(doc.getState())
    applySheetDelta(doc, { kind: 'presence', who: { id: 'x', name: 'X', sheet: 'S', rect: [0, 0, 0, 0] } })
    expect(JSON.stringify(doc.getState())).toBe(before)
  })
})
