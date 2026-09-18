import { describe, expect, it } from 'vitest'
import {
  distinctValues, hiddenRowsFor, passesFilter, withColumnFilter, valuesFilter, shiftAutoFilter, isFiltering, describeFilter,
  datePeriodBounds, distinctFills, isDateColumn,
  type AutoFilterState,
} from './auto-filter'
import { createWorkbook } from './workbook'

// A region with a header row, numbers, text, a formula and a blank.
const wb = createWorkbook([{ name: 'S', cells: [
  ['Item', 'Qty'],
  ['apple', '5'],
  ['Banana', '12'],
  ['cherry', '=B2*2'],
  ['apple', ''],
  ['', '3'],
] }])
const valueAt = (r: number, c: number) => wb.getValue('S', r, c)
const displayAt = (r: number, c: number) => { const v = valueAt(r, c); return typeof v === 'object' && v !== null ? v.error : String(v) }
const state: AutoFilterState = { range: [0, 0, 5, 1], filters: {} }

describe('distinctValues', () => {
  it('lists each value once with its count: numbers first, text A to Z, blanks last', () => {
    expect(distinctValues(state, 1, valueAt, displayAt)).toEqual([
      { text: '3', count: 1, numeric: 3 }, { text: '5', count: 1, numeric: 5 }, { text: '10', count: 1, numeric: 10 }, { text: '12', count: 1, numeric: 12 },
      { text: '', count: 1, numeric: null },
    ])
    expect(distinctValues(state, 0, valueAt, displayAt).map((v) => `${v.text}:${v.count}`)).toEqual(['apple:2', 'Banana:1', 'cherry:1', ':1'])
  })

  it('leaves out the rows other filters hide', () => {
    const visible = (r: number) => r !== 1
    expect(distinctValues(state, 0, valueAt, displayAt, visible).map((v) => `${v.text}:${v.count}`)).toEqual(['apple:1', 'Banana:1', 'cherry:1', ':1'])
  })
})

describe('hiddenRowsFor', () => {
  it('a values filter hides the unticked texts, blanks included, and never the header', () => {
    const s = withColumnFilter(state, 0, { kind: 'values', excluded: ['apple', ''] })
    expect([...hiddenRowsFor(s, valueAt, displayAt)]).toEqual([1, 4, 5])
  })

  it('a number condition compares the computed value; a text one the display', () => {
    const gt = withColumnFilter(state, 1, { kind: 'condition', first: { op: 'greaterThan', value: '6' } })
    expect([...hiddenRowsFor(gt, valueAt, displayAt)]).toEqual([1, 4, 5])
    const contains = withColumnFilter(state, 0, { kind: 'condition', first: { op: 'contains', value: 'an' } })
    expect([...hiddenRowsFor(contains, valueAt, displayAt)]).toEqual([1, 3, 4, 5])
    const blank = withColumnFilter(state, 1, { kind: 'condition', first: { op: 'isBlank' } })
    expect([...hiddenRowsFor(blank, valueAt, displayAt)]).toEqual([1, 2, 3, 5])
  })

  it('two conditions join with and / or', () => {
    const and = withColumnFilter(state, 1, { kind: 'condition', first: { op: 'greaterThan', value: '4' }, join: 'and', second: { op: 'lessThan', value: '11' } })
    expect([...hiddenRowsFor(and, valueAt, displayAt)]).toEqual([2, 4, 5])
    const or = withColumnFilter(state, 1, { kind: 'condition', first: { op: 'equals', value: '3' }, join: 'or', second: { op: 'equals', value: '12' } })
    expect([...hiddenRowsFor(or, valueAt, displayAt)]).toEqual([1, 3, 4])
  })

  it('filters on two columns both apply; no filters hide nothing', () => {
    let s = withColumnFilter(state, 0, { kind: 'values', excluded: [''] })
    s = withColumnFilter(s, 1, { kind: 'condition', first: { op: 'greaterThan', value: '4' } })
    expect([...hiddenRowsFor(s, valueAt, displayAt)]).toEqual([4, 5])
    expect(hiddenRowsFor(state, valueAt, displayAt).size).toBe(0)
    expect(hiddenRowsFor(null, valueAt, displayAt).size).toBe(0)
    expect(isFiltering(state)).toBe(false)
    expect(isFiltering(s)).toBe(true)
  })

  it('passesFilter reads a between as inclusive numbers', () => {
    const f = { kind: 'condition' as const, first: { op: 'between' as const, value: '5', valueTo: '10' } }
    expect(passesFilter(f, 5, '5')).toBe(true)
    expect(passesFilter(f, 10, '10')).toBe(true)
    expect(passesFilter(f, 11, '11')).toBe(false)
    expect(passesFilter(f, 'x', 'x')).toBe(false)
  })
})

describe('the state', () => {
  it('valuesFilter is null when everything is ticked', () => {
    expect(valuesFilter(['a', 'b'], new Set(['a', 'b']))).toBeNull()
    expect(valuesFilter(['a', 'b', ''], new Set(['a']))).toEqual({ kind: 'values', excluded: ['b', ''] })
  })

  it('clearing a column removes its filter', () => {
    const s = withColumnFilter(state, 0, { kind: 'values', excluded: ['x'] })
    expect(Object.keys(withColumnFilter(s, 0, null).filters)).toEqual([])
  })

  it('moves with an insert or delete, the filters following their columns', () => {
    const s = withColumnFilter(state, 1, { kind: 'values', excluded: ['x'] })
    expect(shiftAutoFilter(s, { kind: 'insertRows', at: 0, count: 2 })).toEqual({ range: [2, 0, 7, 1], filters: { 1: { kind: 'values', excluded: ['x'] } } })
    expect(shiftAutoFilter(s, { kind: 'insertCols', at: 0, count: 1 })).toEqual({ range: [0, 1, 5, 2], filters: { 2: { kind: 'values', excluded: ['x'] } } })
    expect(shiftAutoFilter(s, { kind: 'insertCols', at: 1, count: 1 })).toEqual({ range: [0, 0, 5, 2], filters: { 2: { kind: 'values', excluded: ['x'] } } })
    expect(shiftAutoFilter(s, { kind: 'deleteCols', at: 1, count: 1 })).toEqual({ range: [0, 0, 5, 0], filters: {} })
    expect(shiftAutoFilter(s, { kind: 'deleteRows', at: 0, count: 6 })).toBeNull()
    expect(shiftAutoFilter(null, { kind: 'insertRows', at: 0, count: 1 })).toBeNull()
  })

  it('describes a filter', () => {
    expect(describeFilter({ kind: 'values', excluded: ['a', 'b'] })).toBe('2 values hidden')
    expect(describeFilter({ kind: 'condition', first: { op: 'greaterThan', value: '5' } })).toBe('is greater than 5')
    expect(describeFilter({ kind: 'condition', first: { op: 'between', value: '1', valueTo: '9' }, join: 'or', second: { op: 'isBlank' } })).toBe('is between 1 and 9 or is blank')
  })
})

describe('date, colour and top filters', () => {
  const dates = createWorkbook([{ name: 'D', cells: [
    ['When', 'Amount'],
    ['2026-09-18', '10'],
    ['2026-09-17', '40'],
    ['2026-09-14', '30'],
    ['2026-08-31', '20'],
    ['2026-07-01', '50'],
    ['2025-12-31', '5'],
    ['soon', ''],
  ] }])
  const dv = (r: number, c: number) => dates.getValue('D', r, c)
  const dd = (r: number, c: number) => { const v = dv(r, c); return typeof v === 'object' && v !== null ? v.error : String(v) }
  const region: AutoFilterState = { range: [0, 0, 7, 1], filters: {} }
  // A Friday, so this week runs Sunday the 13th to Saturday the 19th.
  const today = new Date('2026-09-18T15:00:00Z')

  it('the periods count from today, weeks from Sunday, quarters from the calendar', () => {
    const at = (period: Parameters<typeof datePeriodBounds>[0]['period']) => datePeriodBounds({ kind: 'date', period }, today)!.map((ms) => new Date(ms).toISOString().slice(0, 10))
    expect(at('today')).toEqual(['2026-09-18', '2026-09-18'])
    expect(at('yesterday')).toEqual(['2026-09-17', '2026-09-17'])
    expect(at('thisWeek')).toEqual(['2026-09-13', '2026-09-19'])
    expect(at('lastWeek')).toEqual(['2026-09-06', '2026-09-12'])
    expect(at('nextWeek')).toEqual(['2026-09-20', '2026-09-26'])
    expect(at('thisMonth')).toEqual(['2026-09-01', '2026-09-30'])
    expect(at('lastMonth')).toEqual(['2026-08-01', '2026-08-31'])
    expect(at('nextMonth')).toEqual(['2026-10-01', '2026-10-31'])
    expect(at('thisQuarter')).toEqual(['2026-07-01', '2026-09-30'])
    expect(at('lastQuarter')).toEqual(['2026-04-01', '2026-06-30'])
    expect(at('nextQuarter')).toEqual(['2026-10-01', '2026-12-31'])
    expect(at('lastYear')).toEqual(['2025-01-01', '2025-12-31'])
    expect(at('yearToDate')).toEqual(['2026-01-01', '2026-09-18'])
    expect(datePeriodBounds({ kind: 'date', period: 'lastQuarter' }, new Date('2026-02-10T00:00:00Z'))![0]).toBe(Date.UTC(2025, 9, 1))
    expect(datePeriodBounds({ kind: 'date', period: 'between', value: '2026-09-01' }, today)).toBeNull()
  })

  it('a date filter keeps the rows in the period and folds text and blanks', () => {
    const hidden = (filter: Parameters<typeof withColumnFilter>[2]) => [...hiddenRowsFor(withColumnFilter(region, 0, filter), dv, dd, { today })]
    expect(hidden({ kind: 'date', period: 'thisWeek' })).toEqual([4, 5, 6, 7])
    expect(hidden({ kind: 'date', period: 'thisMonth' })).toEqual([4, 5, 6, 7])
    expect(hidden({ kind: 'date', period: 'thisQuarter' })).toEqual([6, 7])
    expect(hidden({ kind: 'date', period: 'before', value: '2026-09-01' })).toEqual([1, 2, 3, 7])
    expect(hidden({ kind: 'date', period: 'after', value: '2026-09-14' })).toEqual([3, 4, 5, 6, 7])
    expect(hidden({ kind: 'date', period: 'between', value: '2026-09-14', valueTo: '2026-09-17' })).toEqual([1, 4, 5, 6, 7])
    expect(hidden({ kind: 'date', period: 'equals', value: '2026-07-01' })).toEqual([1, 2, 3, 4, 6, 7])
    // A typed period with nothing typed hides nothing.
    expect(hidden({ kind: 'date', period: 'before' })).toEqual([])
  })

  it('top 10 counts over the whole column, by items or by percent, either end', () => {
    const hidden = (filter: Parameters<typeof withColumnFilter>[2]) => [...hiddenRowsFor(withColumnFilter(region, 1, filter), dv, dd)]
    expect(hidden({ kind: 'top', top: true, count: 2 })).toEqual([1, 3, 4, 6, 7])
    expect(hidden({ kind: 'top', top: false, count: 2 })).toEqual([2, 3, 4, 5, 7])
    // Six numbers: 50 percent keeps three.
    expect(hidden({ kind: 'top', top: true, count: 50, percent: true })).toEqual([1, 4, 6, 7])
    expect(hidden({ kind: 'top', top: true, count: 100 })).toEqual([7])
    expect(passesFilter({ kind: 'top', top: true, count: 1 }, 5, '5')).toBe(true)
  })

  it('filter by colour reads the fills, and lists them each once', () => {
    const fillAt = (r: number, c: number): string | null => (c === 1 && r % 2 === 0 ? (r === 2 ? '#FFFF00' : '#ffff00') : r === 3 ? '#ff0000' : null)
    expect(distinctFills(region, 1, fillAt)).toEqual([null, '#ffff00', '#ff0000'])
    const yellow = withColumnFilter(region, 1, { kind: 'color', fill: '#FFFF00' })
    expect([...hiddenRowsFor(yellow, dv, dd, { fillAt })]).toEqual([1, 3, 5, 7])
    const none = withColumnFilter(region, 1, { kind: 'color', fill: null })
    expect([...hiddenRowsFor(none, dv, dd, { fillAt })]).toEqual([2, 3, 4, 6])
    // Without a fill reader every cell counts as unfilled.
    expect([...hiddenRowsFor(yellow, dv, dd)]).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('a column of dates reads as one; a mixed column does not', () => {
    expect(isDateColumn(distinctValues({ range: [0, 0, 6, 1], filters: {} }, 0, dv, dd))).toBe(true)
    expect(isDateColumn(distinctValues(region, 0, dv, dd))).toBe(false)
    expect(isDateColumn(distinctValues(region, 1, dv, dd))).toBe(false)
  })

  it('describes the new kinds', () => {
    expect(describeFilter({ kind: 'date', period: 'thisWeek' })).toBe('this week')
    expect(describeFilter({ kind: 'date', period: 'between', value: '2026-01-01', valueTo: '2026-01-31' })).toBe('is between 2026-01-01 and 2026-01-31')
    expect(describeFilter({ kind: 'color', fill: null })).toBe('no fill')
    expect(describeFilter({ kind: 'top', top: false, count: 5, percent: true })).toBe('bottom 5 percent')
  })
})
