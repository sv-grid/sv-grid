/**
 * "Color rows by this field": a choice from the column menu wins over the
 * `rowColor` prop for that grid and is reported to the app. A view's colors
 * test conditions as the filter does, and a view keeps no search text.
 */
import { describe, expect, it } from 'vitest'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import { chooseRowColor, clearRowColorChoice } from './row-color-choice.svelte'
import { rowColorOf, rowMarkColor } from './row-colors'
import { captureView, rowColorFor, type ColorSetting, type FieldView } from './view-model'
import type { FieldCondition } from './filter-model'

enableFields()

describe('row color choice', () => {
  it('wins over the prop, reports to the app, and null stops the colors', () => {
    const reported: unknown[] = []
    const columns = [
      { columnDef: fillFieldColumn({ field: 'status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Done', color: '#16a34a' }] } }) },
      { columnDef: fillFieldColumn({ field: 'stage', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Beta', color: '#2563eb' }] } }) },
    ]
    const ctrl: any = { props: { rowColor: { field: 'status' }, onRowColorChange: (c: unknown) => reported.push(c) }, allColumns: columns }
    const row = { status: 'Done', stage: 'Beta' }
    expect(rowMarkColor(ctrl, row)).toBe('#16a34a')

    chooseRowColor(ctrl, { field: 'stage' })
    expect(rowColorOf(ctrl)).toEqual({ field: 'stage' })
    expect(rowMarkColor(ctrl, row)).toBe('#2563eb')
    expect(reported).toEqual([{ field: 'stage' }])

    chooseRowColor(ctrl, null)
    expect(rowMarkColor(ctrl, row)).toBeNull()
    expect(reported.at(-1)).toBeNull()

    // Cleared, the prop rules again and the app hears the prop's colors.
    clearRowColorChoice(ctrl)
    expect(rowMarkColor(ctrl, row)).toBe('#16a34a')
    expect(reported.at(-1)).toEqual({ field: 'status' })
    clearRowColorChoice(ctrl)
    expect(reported).toHaveLength(3)
  })
})

describe('a view\'s colors (rowColorFor)', () => {
  const declared = [
    { field: 'task', header: 'Task', fieldType: 'text' },
    { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Done', color: '#16a34a' }] } },
    { field: 'qty', header: 'Qty', fieldType: 'number' },
    { field: 'price', header: 'Price', fieldType: 'number' },
    // A computed field: no stored value, only what its fieldFn returns.
    { field: 'total', header: 'Total', fieldType: 'formula', fieldFn: (r: { qty: number; price: number }) => r.qty * r.price },
  ]
  const ctrlWith = (rowColor?: unknown): any => ({ props: { rowColor }, internalColumns: declared, allColumns: [] })
  const rules = (...conditions: FieldCondition[]): ColorSetting => ({ mode: 'conditions', rules: conditions.map((condition) => ({ color: '#f00', condition })) })
  const test = (cfg: ReturnType<typeof rowColorFor>, row: unknown) => !!(cfg && 'rules' in cfg && cfg.rules.some((r) => r.when(row as never)))

  it('keeps the rowColor prop\'s target, by field and by conditions', () => {
    const ctrl = ctrlWith({ field: 'status', target: 'row' })
    expect(rowColorFor(ctrl, { mode: 'field', field: 'status' })).toEqual({ field: 'status', target: 'row' })
    expect(rowColorFor(ctrl, rules({ column: 'task', kind: 'text', op: 'contains', value: 'a' }))).toMatchObject({ target: 'row' })
    expect(rowColorFor(ctrlWith(), { mode: 'field', field: 'status' })).toEqual({ field: 'status' })
  })

  it('leaves out a condition still missing its value, as the filter does', () => {
    const ctrl = ctrlWith()
    expect(rowColorFor(ctrl, rules({ column: 'task', kind: 'text', op: 'contains', value: '' }))).toBeNull()
    expect(rowColorFor(ctrl, rules({ column: 'qty', kind: 'number', op: 'eq', value: '' }))).toBeNull()
    expect(rowColorFor(ctrl, rules({ column: 'qty', kind: 'number', op: 'eq', value: null }))).toBeNull()
    // The complete one still colors; the half-written one beside it is skipped.
    const cfg = rowColorFor(ctrl, rules({ column: 'task', kind: 'text', op: 'contains', value: '' }, { column: 'qty', kind: 'number', op: 'eq', value: 0 }))
    expect(cfg && 'rules' in cfg ? cfg.rules.length : 0).toBe(1)
    expect(test(cfg, { task: 'x', qty: 0 })).toBe(true)
    expect(test(cfg, { task: 'x', qty: 2 })).toBe(false)
  })

  it('tests a computed field\'s value, not the stored one', () => {
    const ctrl = ctrlWith()
    const big = rowColorFor(ctrl, rules({ column: 'total', kind: 'number', op: 'gt', value: 10 }))
    expect(test(big, { qty: 3, price: 5 })).toBe(true)
    expect(test(big, { qty: 1, price: 5 })).toBe(false)
    const empty = rowColorFor(ctrl, rules({ column: 'total', kind: 'number', op: 'isEmpty', value: null }))
    expect(test(empty, { qty: 3, price: 5 })).toBe(false)
  })
})

describe('captureView', () => {
  const api = { getState: () => ({ sorting: [], globalFilter: 'regist', pagination: { pageIndex: 2 } }), getOption: () => undefined }

  it('keeps neither the search text nor a color setting the view never chose', () => {
    const ctrl: any = { props: { rowColor: { field: 'status' } }, internalColumns: [], allColumns: [] }
    const view: FieldView = { id: 'v', name: 'V', type: 'gallery', color: { mode: 'field', field: 'status' } }
    const kept = captureView(ctrl, api, view)
    expect(kept.state).toEqual({ sorting: [] })
    // The prop's colors are in force: the view has no color of its own.
    expect('color' in kept).toBe(false)

    chooseRowColor(ctrl, { field: 'stage' })
    expect(captureView(ctrl, api, view).color).toEqual({ mode: 'field', field: 'stage' })
  })
})
