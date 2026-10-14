/**
 * Formula fields in the grid: a date result that keeps a text branch, a
 * formula that names its own field, the warning before deleting a field
 * formulas read, and automation tokens matched like formula names.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { getGridExtension } from '@svgrid/grid'
import { enableFields } from './index'
import { fillFieldColumn } from './registry.svelte'
import { askDeleteField, getDeleteFieldRequest } from './editor-request.svelte'
import { fillTokens } from './automations.svelte'
import type { BaseTable } from './base-tables'
import DeleteFieldConfirm from './DeleteFieldConfirm.svelte'

enableFields()

type Def = Record<string, any>
const fill = (d: Def, cols: Def[]) => {
  const c = fillFieldColumn(d, cols) as Def
  const value = (row: Def) => c.fieldFn(row)
  return { value, show: (row: Def) => String(c.formatter({ value: value(row) })) }
}

const declared: Def[] = [
  { field: 'item', header: 'Item', fieldType: 'text' },
  { field: 'qty', header: 'Qty', fieldType: 'number' },
  { field: 'counted', header: 'Last counted', fieldType: 'date' },
  { field: 'value', header: 'Stock value', fieldType: 'formula', fieldProps: { formula: '{Qty} * 2', result: 'number' } },
  { field: 'status', header: 'Status', fieldType: 'formula', fieldProps: { formula: 'IF({qty} = 0, "Out", "OK")' } },
]

describe('a formula with result date', () => {
  const p = { result: 'date', dateFormat: 'iso' }

  it('shows a text branch as text and a date branch as a date', () => {
    const f = fill({ field: 'next', fieldType: 'formula', fieldProps: { ...p, formula: 'IF({Qty} = 0, "Count now", DATEADD({Last counted}, 90, "days"))' } }, declared)
    expect(f.show({ qty: 0, counted: '2026-09-05' })).toBe('Count now')
    expect(f.show({ qty: 3, counted: '2026-09-05' })).toBe('2026-12-04')
  })

  it('reads only stored-date text as a date: "1" stays "1"', () => {
    expect(fill({ field: 'x', fieldType: 'formula', fieldProps: { ...p, formula: '"1"' } }, declared).show({})).toBe('1')
    expect(fill({ field: 'x', fieldType: 'formula', fieldProps: { ...p, formula: '{Last counted}' } }, declared).show({ counted: '2026-09-05' })).toBe('2026-09-05')
    expect(fill({ field: 'x', fieldType: 'formula', fieldProps: { ...p, formula: '{Nope}' } }, declared).show({})).toBe('#ERROR')
  })
})

describe('a formula that names its own field', () => {
  it('shows #ERROR, by header or by key, with or without itself in the columns', () => {
    const own = { field: 'total', header: 'Total', fieldType: 'formula', fieldProps: { formula: '{Total} + 1' } }
    expect(fill(own, [...declared, own]).value({ total: 5 })).toBe('#ERROR')
    expect(fill(own, declared).value({ total: 5 })).toBe('#ERROR')
    const byKey = { ...own, fieldProps: { formula: '{ TOTAL } + {Qty}' } }
    expect(fill(byKey, [...declared, byKey]).value({ total: 5, qty: 1 })).toBe('#ERROR')
    const fine = { ...own, fieldProps: { formula: '{Qty} + 1' } }
    expect(fill(fine, [...declared, fine]).value({ qty: 1 })).toBe(2)
  })
})

describe('deleting a field that formulas read', () => {
  const mounted: Array<() => void> = []
  afterEach(() => {
    while (mounted.length) mounted.pop()!()
    askDeleteField(null)
  })
  const fakeGrid = () => ({ props: { fieldMenu: true }, internalColumns: declared.map((d) => fillFieldColumn(d, declared)) })
  const deleteItem = (ctrl: unknown, id: string) => getGridExtension()!.columnMenuItems!(ctrl as never, id).find((i) => i.key === 'field-delete')!

  it('the field menu asks first, and deletes a field no formula reads at once', () => {
    const ctrl = fakeGrid()
    ;(deleteItem(ctrl, 'qty').run as () => void)()
    expect(getDeleteFieldRequest()).toEqual({ ctrl, columnId: 'qty' })
    expect(ctrl.internalColumns).toHaveLength(5)
    askDeleteField(null)
    ;(deleteItem(ctrl, 'item').run as () => void)()
    expect(getDeleteFieldRequest()).toBeNull()
    expect(ctrl.internalColumns.map((d: Def) => d.field)).toEqual(['qty', 'counted', 'value', 'status'])
  })

  it('names the formulas that will show #ERROR, and deletes on Delete field', () => {
    const ctrl = fakeGrid()
    const target = document.createElement('div')
    document.body.appendChild(target)
    let closed = false
    const dialog = mount(DeleteFieldConfirm as any, { target, props: { ctrl, columnId: 'qty', onClose: () => (closed = true) } })
    mounted.push(() => {
      unmount(dialog)
      target.remove()
    })
    flushSync()
    expect(document.querySelector('.sv-fdel-formulas')?.textContent).toBe('These formulas read it and will show #ERROR: Stock value, Status.')
    expect(document.body.textContent).not.toContain('links to')
    ;([...document.querySelectorAll('.sv-fdel-btn')].find((x) => x.textContent === 'Delete field') as HTMLElement).click()
    flushSync()
    expect(closed).toBe(true)
    expect(ctrl.internalColumns.map((d: Def) => d.field)).toEqual(['item', 'counted', 'value', 'status'])
  })
})

describe('automation tokens', () => {
  it('match a header or a field key in any case, as formula names do', () => {
    const t: BaseTable = {
      id: 'tok-items',
      name: 'Items',
      primaryField: 'item',
      columns: [
        { field: 'item', header: 'Item', fieldType: 'text' },
        { field: 'unitNote', header: 'Unit note', fieldType: 'text' },
        { field: 'status', header: 'Status', fieldType: 'formula', fieldProps: { formula: 'IF({Item} = "", "None", "Some")' } },
      ],
      data: [],
    }
    const rec = { id: 1, item: 'Lamp', unitNote: 'boxed' }
    expect(fillTokens(t, rec, '{ITEM}, {item}, { unit NOTE }, {UNITNOTE}, {unitnote}, {status}')).toBe('Lamp, Lamp, boxed, boxed, boxed, Some')
    expect(fillTokens(t, rec, '{Nope}')).toBe('{Nope}')
  })
})
