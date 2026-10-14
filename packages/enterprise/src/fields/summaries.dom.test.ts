/**
 * Footer summaries: what each kind of field offers, what each summary
 * computes, a choice kept in the field, and the field's declared form found
 * again on a copy of its filled column.
 */
import { describe, expect, it } from 'vitest'
import { enableFields } from './index'
import { fillFieldColumn, originalColumn, registerFieldType } from './registry.svelte'
import { makeSummary, summaryChoices } from './summaries'
import { setFieldSummary } from './field-ops'

enableFields()

const fill = (fieldType: string, fieldProps: Record<string, unknown> = {}) => fillFieldColumn({ field: 'v', fieldType, fieldProps })
const run = (col: Record<string, unknown>, values: unknown[]) =>
  (col.summary as (n: number[], rows: unknown[]) => string)([], values.map((v) => ({ v })))

describe('footer summaries', () => {
  it('offer what fits the field', () => {
    const kinds = (col: Record<string, unknown>) => summaryChoices(col).map((c) => c.value)
    expect(kinds(fill('number'))).toEqual(expect.arrayContaining(['sum', 'avg', 'median', 'empty']))
    expect(kinds(fill('checkbox'))).toEqual(expect.arrayContaining(['checked', 'percentChecked']))
    expect(kinds(fill('date'))).toEqual(expect.arrayContaining(['earliest', 'latest', 'dateRange']))
    expect(kinds(fill('singleSelect'))).not.toContain('sum')
  })

  it('show nothing until one is picked, then compute it in the field\'s own format', () => {
    expect(fill('number').summary).toBe(false)
    const money = fill('number', { format: 'currency', symbol: '$', precision: 0, separators: 'comma-period', summary: 'sum' })
    expect(run(money, [1200, 300, null])).toBe('$1,500')
    const avg = fill('number', { format: 'percent', precision: 0, summary: 'avg' })
    expect(run(avg, [0.5, 1])).toBe('75%')
    expect(run(fill('number', { summary: 'median' }), [3, 1, 2, 10])).toBe('2.5')
    expect(run(fill('text', { summary: 'percentFilled' }), ['a', '', null, 'b'])).toBe('50%')
    expect(run(fill('multiSelect', { options: [], summary: 'unique' }), [['A'], ['A'], ['B'], []])).toBe('2')
    expect(run(fill('checkbox', { summary: 'checked' }), [true, false, true])).toBe('2')
    expect(run(fill('date', { dateFormat: 'iso', summary: 'latest' }), ['2026-10-14', '2026-11-03', ''])).toBe('2026-11-03')
    expect(makeSummary('none', {})).toBe(false)
  })

  it('a registered type with cellDataType boolean gets the checkbox summaries', () => {
    registerFieldType({ id: 'testToggle', label: 'Test toggle', fill: (def) => ({ ...def, cellDataType: 'boolean' }) })
    expect(summaryChoices(fill('testToggle')).map((c) => c.value)).toEqual(summaryChoices(fill('checkbox')).map((c) => c.value))
    expect(run(fill('testToggle', { summary: 'percentChecked' }), [true, false, true, null])).toBe('50%')
    expect(run(fill('testToggle', { summary: 'unchecked' }), [true, false, null])).toBe('2')
  })

  it('a formula sums when it computes a number, and not when it computes text', () => {
    const kinds = (col: Record<string, unknown>) => summaryChoices(col).map((c) => c.value)
    expect(kinds(fill('formula', { formula: '2 * 3', result: 'currency' }))).toContain('sum')
    expect(kinds(fill('formula', { formula: '2 * 3', result: 'date' }))).toContain('latest')
    expect(kinds(fill('formula', { formula: '2 * 3' }))).not.toContain('sum')
    expect(run(fill('formula', { formula: '2 * 3', result: 'number', summary: 'sum' }), [null, null])).toMatch(/^12/)
  })

  it('a single select sorts in the order of its options', () => {
    const col = fill('singleSelect', { options: [{ value: 'Q4 2026' }, { value: 'Q1 2027' }, { value: 'Later' }] }) as { sortValue?: (v: unknown) => number | null }
    expect(['Later', 'Q1 2027', 'Q4 2026'].map((v) => col.sortValue?.(v))).toEqual([2, 1, 0])
    expect(col.sortValue?.('')).toBeNull()
  })

  it('a choice is kept in the field and reported to the app', () => {
    const events: any[] = []
    const ctrl: any = {
      props: { onColumnChange: (e: unknown) => events.push(e) },
      internalColumns: [fillFieldColumn({ id: 'v', field: 'v', fieldType: 'number' })],
      internalData: [],
    }
    setFieldSummary(ctrl, 'v', 'max')
    expect(events[0].columns[0].fieldProps).toEqual({ summary: 'max' })
    expect(typeof ctrl.internalColumns[0].summary).toBe('function')
    setFieldSummary(ctrl, 'v', 'none')
    expect(events[1].columns[0].fieldProps).toEqual({})
  })

  it('the declared column is found on a copy of the filled one (the grid copies columns)', () => {
    const declared = { field: 'v', header: 'V', fieldType: 'number', fieldProps: { precision: 2 } }
    const filled = fillFieldColumn(declared)
    const copy = { ...filled, cellDataType: 'number' }
    expect(originalColumn(copy)).toBe(declared)
    // And no filled-in key leaks into what the app gets back.
    expect(Object.keys(originalColumn(copy))).toEqual(['field', 'header', 'fieldType', 'fieldProps'])
  })
})

describe('tall rows', () => {
  it('a row height of 48px or more names the lines that fit, 2 to 6', async () => {
    const { tallRowClass } = await import('./row-colors')
    const at = (rowHeight: unknown) => tallRowClass({ props: { rowHeight } } as never)
    expect(at(34)).toBeNull()
    expect(at(undefined)).toBeNull()
    expect(at(56)).toBe('sv-fields-tall sv-fields-lines-2')
    expect(at(88)).toBe('sv-fields-tall sv-fields-lines-3')
    expect(at(400)).toBe('sv-fields-tall sv-fields-lines-6')
  })
})
