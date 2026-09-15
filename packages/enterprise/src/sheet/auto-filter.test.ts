import { describe, expect, it } from 'vitest'
import {
  distinctValues, hiddenRowsFor, passesFilter, withColumnFilter, valuesFilter, shiftAutoFilter, isFiltering, describeFilter,
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
