/**
 * Deep QA, round 2: the round trips. A document that survives save and
 * restore, and a file that survives write and read, are the two promises
 * everything else on the sheet rests on.
 */
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createSheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts } from './xlsx-document'
import type { Rect } from './format-store'

const rect = (a: number, b: number, c: number, d: number) => [a, b, c, d] as unknown as Rect
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** One document carrying every part this branch added. */
function everything() {
  const doc = createSheetDocument({
    sheets: [{ name: 'Sales', cells: [
      ['Region', 'Quarter', 'Amount', 'Thumb'],
      ['North', 'Q1', '100', `=IMAGE("${PNG}")`],
      ['North', 'Q2', '150', ''],
      ['South', 'Q1', '80', ''],
      ['South', 'Q2', '120', ''],
      ['Total', '', '=SUM(C2:C5)', ''],
    ] }],
  })
  const wb = doc.workbook
  wb.tables.define({ name: 'Orders', sheet: 'Sales', headerRow: 0, firstCol: 0, lastCol: 3, lastRow: 4, hasTotals: false, style: 'TableStyleDark5' })
  wb.setIteration({ enabled: true, maxIterations: 42, maxChange: 0.5 })
  wb.names.define('Tax', 'Sales!C6')
  const state = doc.get('Sales')
  state.sparklines = [{ id: 's1', location: rect(1, 5, 4, 5), data: rect(1, 2, 4, 2), type: 'column', color: '#2563eb', sameScale: true }]
  state.objects = [
    { id: 'o1', kind: 'chart', anchor: { row: 8, col: 0, dx: 4, dy: 6, width: 420, height: 260 }, range: rect(0, 0, 4, 2), type: 'bar', headers: true, series: 'columns', title: 'By region', trend: 'linear' },
    { id: 'o2', kind: 'image', anchor: { row: 8, col: 6, dx: 0, dy: 0, width: 64, height: 32 }, src: PNG, alt: 'A mark' },
  ]
  state.pivots = [{
    id: 'p1', source: rect(0, 0, 4, 2), target: { row: 16, col: 0 },
    rows: ['Region'], cols: ['Quarter'], values: [{ field: 'Amount', agg: 'sum' }],
    filters: [{ field: 'Quarter', value: 'Q1' }],
  }]
  state.links = { r1: { A: { target: 'https://example.com', tip: 'The spec' } } }
  state.merges = [rect(5, 0, 5, 1)]
  state.freeze = { rows: 1, cols: 1 }
  return doc
}

describe('a document keeps every part through save and restore', () => {
  it('getState then setState leaves the same document', () => {
    const doc = everything()
    const saved = JSON.parse(JSON.stringify(doc.getState()))
    const again = createSheetDocument({ state: saved })
    const back = JSON.parse(JSON.stringify(again.getState()))
    expect(back).toEqual(saved)
  })

  it('restoring into the SAME document is stable too', () => {
    const doc = everything()
    const saved = JSON.parse(JSON.stringify(doc.getState()))
    doc.setState(saved)
    expect(JSON.parse(JSON.stringify(doc.getState()))).toEqual(saved)
  })

  it('carries the parts a reader would look for by name', () => {
    const state = everything().getState()
    expect(state.workbook.tables?.[0]).toMatchObject({ name: 'Orders', style: 'TableStyleDark5' })
    expect(state.workbook.iteration).toEqual({ enabled: true, maxIterations: 42, maxChange: 0.5 })
    expect(state.sheets.Sales!.pivots?.[0]!.filters).toEqual([{ field: 'Quarter', value: 'Q1' }])
    expect(state.sheets.Sales!.objects?.[0]).toMatchObject({ trend: 'linear' })
    expect(state.sheets.Sales!.sparklines?.[0]).toMatchObject({ type: 'column', sameScale: true })
    expect(state.sheets.Sales!.links).toMatchObject({ r1: { A: { target: 'https://example.com' } } })
  })
})

describe('a file keeps what it can, and says what it cannot', () => {
  it('writing twice from the same document gives the same package', () => {
    const doc = everything()
    const once = documentToXlsxParts(doc)
    const twice = documentToXlsxParts(doc)
    expect(Object.keys(twice).sort()).toEqual(Object.keys(once).sort())
    for (const path of Object.keys(once)) {
      // The one part that carries a fresh guid per write is the person list.
      if (path.includes('persons')) continue
      expect([path, twice[path]]).toEqual([path, once[path]])
    }
  })

  it('write, read, write again gives the same cells, tables and settings', () => {
    const doc = everything()
    const first = documentToXlsxParts(doc)
    const back = documentFromXlsxParts(first)
    const rebuilt = createSheetDocument({ state: back })
    const second = documentToXlsxParts(rebuilt)

    // The setting survives into the SECOND file, which is what makes a
    // save-open-save cycle safe.
    expect(second['xl/workbook.xml']).toContain('iterate="1" iterateCount="42" iterateDelta="0.5"')
    expect(second['xl/tables/table1.xml']).toContain('TableStyleDark5')
    expect(back.workbook.iteration).toEqual({ enabled: true, maxIterations: 42, maxChange: 0.5 })
    expect(back.workbook.tables?.[0]).toMatchObject({ name: 'Orders', style: 'TableStyleDark5' })
    expect(back.sheets.Sales!.sparklines?.[0]).toMatchObject({ type: 'column' })
    expect(back.sheets.Sales!.objects?.map((o) => o.kind)).toEqual(['chart', 'image'])
    expect(back.sheets.Sales!.links?.r1?.A?.target).toBe('https://example.com')
    // The cells come back as they were typed, IMAGE included.
    expect(back.workbook.sheets[0]!.cells[1]![3]).toBe(`=IMAGE("${PNG}")`)
    expect(back.workbook.sheets[0]!.cells[5]![2]).toBe('=SUM(C2:C5)')
  })

  it('a package with none of the new parts still reads', () => {
    const plain = createSheetDocument({ sheets: [{ name: 'S', cells: [['1', '2']] }] })
    const parts = documentToXlsxParts(plain)
    expect(Object.keys(parts).some((p) => p.startsWith('xl/drawings/'))).toBe(false)
    const back = documentFromXlsxParts(parts)
    expect(back.workbook.tables).toBeUndefined()
    expect(back.workbook.iteration).toBeUndefined()
    expect(back.sheets.S!.objects).toBeUndefined()
    expect(back.sheets.S!.sparklines).toBeUndefined()
  })

  it('says in the file that the pivot block is cells, since a PivotTable part is not written', () => {
    // The pivot is a definition plus written cells; the file carries the
    // cells. This is the promise the docs make, and it is worth pinning.
    const parts = documentToXlsxParts(everything())
    expect(Object.keys(parts).some((p) => p.includes('pivotTable'))).toBe(false)
  })
})
