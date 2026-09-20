/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createSheetDocument, type SheetDocument } from './document'
import { documentToXlsxParts, documentFromXlsxParts } from './xlsx-document'
import { documentToOdsParts, sheetStateFromOds } from './ods-document'
import { documentToXls, sheetStateFromXls } from './xls-document'
import { filteredRows } from './filter-files'
import type { ColumnFilter } from './auto-filter'

/**
 * A filtered sheet in a file. The region alone went out before, so a
 * sheet saved with 34 of 40 rows showing came back with all 40: the rows
 * a filter folds go out hidden now, and the criteria beside the region.
 */

const ROWS = [
  ['Ticket', 'Owner', 'Hours', 'Opened', 'Status'],
  ['T-1', 'Priya', '12', '2026-09-01', 'Open'],
  ['T-2', 'Marco', '60', '2026-09-03', 'Closed'],
  ['T-3', 'Priya', '3', '2026-08-20', 'Pending'],
  ['T-4', 'Lena', '48', '2026-09-10', 'Open'],
  ['T-5', 'Priya', '', '2026-09-12', 'Closed'],
]
const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

function docWith(filters: Record<number, ColumnFilter>, hidden: number[] = []): SheetDocument {
  const doc = createSheetDocument({ sheets: [{ name: 'Log', cells: ROWS.map((r) => [...r]) }] })
  const state = doc.get('Log')
  state.autoFilter = { range: [0, 0, 5, 4], filters }
  for (const r of hidden) state.hidden.rows.add(r)
  return doc
}

const xlsxTrip = (doc: SheetDocument) => documentFromXlsxParts(documentToXlsxParts(doc))
const sheetXml = (doc: SheetDocument) => documentToXlsxParts(doc)['xl/worksheets/sheet1.xml']!

describe('the rows a filter hides', () => {
  it('are worked out from the criteria, formats and all', () => {
    const doc = docWith({ 4: { kind: 'values', excluded: ['Closed'] } })
    expect([...filteredRows(doc, 'Log')].sort()).toEqual([2, 5])
  })
})

describe('.xlsx', () => {
  it('writes the folded rows hidden and the criteria beside the region', () => {
    const xml = sheetXml(docWith({ 4: { kind: 'values', excluded: ['Closed'] } }, [3]))
    expect(xml).toContain('<row r="3" hidden="1">')
    expect(xml).toContain('<row r="6" hidden="1">')
    // The row hidden by hand is hidden too, and no other.
    expect(xml).toContain('<row r="4" hidden="1">')
    expect((xml.match(/hidden="1"/g) ?? []).length).toBe(3)
    // Excel lists what is IN.
    expect(xml).toContain('<autoFilter ref="A1:E6"><filterColumn colId="4"><filters><filter val="Open"/><filter val="Pending"/></filters></filterColumn></autoFilter>')
  })

  it('comes back filtered, the folded rows the filter\'s and the hand-hidden one the user\'s', () => {
    const state = xlsxTrip(docWith({ 4: { kind: 'values', excluded: ['Closed'] } }, [3]))
    const log = state.sheets.Log!
    expect(log.autoFilter).toEqual({ range: [0, 0, 5, 4], filters: { 4: { kind: 'values', excluded: [], included: ['Open', 'Pending'] } } })
    // The file says three rows are hidden; the document keeps only the one
    // its criteria do not reach as hidden by hand, and folds the other two.
    expect(log.hidden.rows).toEqual([2, 3, 5])
    const again = createSheetDocument({ state })
    expect([...again.get('Log').hidden.rows]).toEqual([3])
    expect([...filteredRows(again, 'Log')].sort()).toEqual([2, 5])
  })

  it('carries a number condition, a text condition, a between and a Top 10', () => {
    const filters: Record<number, ColumnFilter> = {
      1: { kind: 'condition', first: { op: 'contains', value: 'ri' } },
      2: { kind: 'condition', first: { op: 'greaterThan', value: '10' }, join: 'and', second: { op: 'lessThan', value: '50' } },
      0: { kind: 'condition', first: { op: 'between', value: 'T-2', valueTo: 'T-4' } },
    }
    const xml = sheetXml(docWith(filters))
    expect(xml).toContain('<filterColumn colId="1"><customFilters and="1"><customFilter operator="equal" val="*ri*"/></customFilters></filterColumn>')
    expect(xml).toContain('<filterColumn colId="2"><customFilters and="1"><customFilter operator="greaterThan" val="10"/><customFilter operator="lessThan" val="50"/></customFilters></filterColumn>')
    const back = xlsxTrip(docWith(filters)).sheets.Log!.autoFilter!.filters
    expect(back[1]).toEqual({ kind: 'condition', first: { op: 'contains', value: 'ri' } })
    expect(back[2]).toEqual({ kind: 'condition', first: { op: 'greaterThan', value: '10' }, join: 'and', second: { op: 'lessThan', value: '50' } })
    expect(back[0]).toEqual({ kind: 'condition', first: { op: 'between', value: 'T-2', valueTo: 'T-4' } })

    const top = xlsxTrip(docWith({ 2: { kind: 'top', top: true, count: 3 } })).sheets.Log!.autoFilter!.filters
    expect(top[2]).toEqual({ kind: 'top', top: true, count: 3 })
  })

  it('carries a date period as Excel\'s dynamic filter, and a typed date bound as a serial', () => {
    const xml = sheetXml(docWith({ 3: { kind: 'date', period: 'thisMonth' } }))
    expect(xml).toContain('<filterColumn colId="3"><dynamicFilter type="thisMonth"/></filterColumn>')
    expect(xlsxTrip(docWith({ 3: { kind: 'date', period: 'thisMonth' } })).sheets.Log!.autoFilter!.filters[3]).toEqual({ kind: 'date', period: 'thisMonth' })
    const before = docWith({ 3: { kind: 'date', period: 'before', value: '2026-09-05' } })
    expect(sheetXml(before)).toContain('<customFilter operator="lessThan" val="46270"/>')
    expect(xlsxTrip(before).sheets.Log!.autoFilter!.filters[3]).toEqual({ kind: 'date', period: 'before', value: '2026-09-05' })
    const between = docWith({ 3: { kind: 'date', period: 'between', value: '2026-09-01', valueTo: '2026-09-10' } })
    expect(xlsxTrip(between).sheets.Log!.autoFilter!.filters[3]).toEqual({ kind: 'date', period: 'between', value: '2026-09-01', valueTo: '2026-09-10' })
  })

  it('hides the rows of a colour filter and leaves the criterion out, so they stay hidden by hand', () => {
    const doc = docWith({ 4: { kind: 'color', fill: '#ffff00' } })
    doc.get('Log').formats.set([[1, 4, 1, 4], [4, 4, 4, 4]], { fill: '#ffff00' }, at)
    const xml = sheetXml(doc)
    expect(xml).toContain('<autoFilter ref="A1:E6"/>')
    expect((xml.match(/hidden="1"/g) ?? []).length).toBe(3)
    const back = xlsxTrip(doc).sheets.Log!
    expect(back.autoFilter!.filters).toEqual({})
    expect(back.hidden.rows).toEqual([2, 3, 5])
  })

  it('reads what Excel writes: a value list with blanks, and its hidden rows as the filter\'s', () => {
    const parts = documentToXlsxParts(docWith({}))
    parts['xl/worksheets/sheet1.xml'] = parts['xl/worksheets/sheet1.xml']!
      .replace('<autoFilter ref="A1:E6"/>', '<autoFilter ref="A1:E6"><filterColumn colId="2"><filters blank="1"><filter val="12"/></filters></filterColumn></autoFilter>')
      .replace('<row r="3">', '<row r="3" hidden="1">').replace('<row r="4">', '<row r="4" hidden="1">').replace('<row r="5">', '<row r="5" hidden="1">')
    const state = documentFromXlsxParts(parts)
    expect(state.sheets.Log!.autoFilter!.filters[2]).toEqual({ kind: 'values', excluded: [], included: ['12', ''] })
    expect(state.sheets.Log!.hidden.rows).toEqual([2, 3, 4])
    const doc = createSheetDocument({ state })
    expect(doc.get('Log').hidden.rows.size).toBe(0)
    expect([...filteredRows(doc, 'Log')].sort()).toEqual([2, 3, 4])
  })
})

describe('.ods', () => {
  it('marks the folded rows as filtered and keeps the values and conditions', () => {
    const doc = docWith({ 4: { kind: 'values', excluded: ['Closed'] }, 2: { kind: 'condition', first: { op: 'greaterThan', value: '10' } } }, [3])
    const parts = documentToOdsParts(doc)
    const content = parts['content.xml']!
    expect((content.match(/table:visibility="filter"/g) ?? []).length).toBe(2)
    expect((content.match(/table:visibility="collapse"/g) ?? []).length).toBe(1)
    expect(content).toContain('<table:filter-set-item table:value="Open"/><table:filter-set-item table:value="Pending"/>')
    expect(content).toContain('table:field-number="2" table:operator="&gt;" table:value="10"')
    const state = sheetStateFromOds(parts)
    const log = state.sheets.Log!
    expect(log.autoFilter!.filters[4]).toEqual({ kind: 'values', excluded: [], included: ['Open', 'Pending'] })
    expect(log.autoFilter!.filters[2]).toEqual({ kind: 'condition', first: { op: 'greaterThan', value: '10' } })
    expect(log.hidden.rows.sort()).toEqual([2, 3, 5])
    // Row 4 was hidden by hand, but Hours > 10 folds it too, so it is the
    // filter's now and Clear Filter will show it.
    const again = createSheetDocument({ state })
    expect(again.get('Log').hidden.rows.size).toBe(0)
    expect([...filteredRows(again, 'Log')].sort()).toEqual([2, 3, 5])
  })

  it('keeps the folded rows hidden when the criterion has no ODF spelling', () => {
    const state = sheetStateFromOds(documentToOdsParts(docWith({ 3: { kind: 'date', period: 'thisMonth' } })))
    // Whatever this month holds, the rows the file folded do not come back.
    const folded = filteredRows(docWith({ 3: { kind: 'date', period: 'thisMonth' } }), 'Log')
    expect(state.sheets.Log!.autoFilter!.filters).toEqual({})
    expect(new Set(state.sheets.Log!.hidden.rows)).toEqual(folded)
  })
})

describe('.xls', () => {
  it('writes the folded rows hidden, which is what the format can say', () => {
    const state = sheetStateFromXls(documentToXls(docWith({ 4: { kind: 'values', excluded: ['Closed'] } }, [3])))
    expect(state.sheets.Log!.hidden.rows.sort()).toEqual([2, 3, 5])
  })
})
