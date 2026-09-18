import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSheetFilterMenu from './SvSheetFilterMenu.svelte'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => { if (comp) { unmount(comp); comp = null } if (host) { host.remove(); host = null } })
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host) })
const q = <T extends Element>(sel: string) => host!.querySelector<T>(sel)
const qa = (sel: string) => [...host!.querySelectorAll(sel)]
const button = (text: string) => qa('button').find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement
const click = (el: Element | undefined | null) => { el?.dispatchEvent(new MouseEvent('click', { bubbles: true })); flushSync() }
const box = (label: string) => qa('label').find((l) => l.textContent?.includes(label))?.querySelector('input') as HTMLInputElement

const values = [
  { text: '3', count: 1, numeric: 3 }, { text: 'apple', count: 2, numeric: null }, { text: 'pear', count: 1, numeric: null }, { text: '', count: 1, numeric: null },
]

describe('SvSheetFilterMenu (DOM)', () => {
  it('lists the values with counts and (Blanks), unticking one hands back a values filter', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Fruit', values, filter: null, numeric: false, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(qa('.values .check:not(.all) .text').map((e) => e.textContent)).toEqual(['3', 'apple', 'pear', '(Blanks)'])
    expect(qa('.values .check:not(.all) .count').map((e) => e.textContent)).toEqual(['1', '2', '1', '1'])
    expect(button('Clear Filter From').disabled).toBe(true)
    box('pear').click(); flushSync()
    expect(box('(Select All)').indeterminate).toBe(true)
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'values', excluded: ['pear'] })
  })

  it('search narrows the list, Select All acts on what is shown, and OK applies the search results', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Fruit', values, filter: { kind: 'values', excluded: ['pear'] }, numeric: false, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(box('pear').checked).toBe(false)
    expect(button('Clear Filter From').disabled).toBe(false)
    const search = q<HTMLInputElement>('input[type="search"]')!
    search.value = 'pe'; search.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
    expect(qa('.values .check:not(.all) .text').map((e) => e.textContent)).toEqual(['pear'])
    box('(Select All Search Results)').click(); flushSync()
    expect(box('pear').checked).toBe(true)
    click(button('OK'))
    // As in Excel, the search's results are the filter: the values it hid
    // are out even though they were ticked before the search.
    expect(onApply).toHaveBeenCalledWith({ kind: 'values', excluded: ['3', 'apple', ''] })
  })

  it('with the search cleared, everything ticked is no filter', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Fruit', values, filter: { kind: 'values', excluded: ['pear'] }, numeric: false, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    box('pear').click(); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith(null)
  })

  it('a condition with a second clause, and the sort buttons', () => {
    const onApply = vi.fn(); const onSort = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Qty', values: values.slice(0, 1), filter: null, numeric: true, onSort, onApply, onCancel: vi.fn() } })
    flushSync()
    expect(q('summary')?.textContent).toBe('Number Filters')
    click(button('Sort Largest to Smallest'))
    expect(onSort).toHaveBeenCalledWith('desc')
    const first = q<HTMLSelectElement>('select[aria-label="First condition"]')!
    first.value = 'greaterThan'; first.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    const v1 = q<HTMLInputElement>('input[aria-label="First value"]')!
    v1.value = '5'; v1.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
    ;(q<HTMLInputElement>('input[value="or"]'))!.click(); flushSync()
    const second = q<HTMLSelectElement>('select[aria-label="Second condition"]')!
    second.value = 'isBlank'; second.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'condition', first: { op: 'greaterThan', value: '5' }, join: 'or', second: { op: 'isBlank' } })
  })

  it('Clear Filter hands back null', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Fruit', values, filter: { kind: 'condition', first: { op: 'equals', value: 'apple' } }, numeric: false, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(q<HTMLSelectElement>('select[aria-label="First condition"]')!.value).toBe('equals')
    click(button('Clear Filter From'))
    expect(onApply).toHaveBeenCalledWith(null)
  })
})

describe('SvSheetFilterMenu: dates, colours and top 10 (DOM)', () => {
  const dateValues = [{ text: '2026-09-18', count: 1, numeric: null }, { text: '2026-08-01', count: 1, numeric: null }]
  const numbers = [{ text: '3', count: 1, numeric: 3 }, { text: '9', count: 1, numeric: 9 }]

  it('Date Filters on a date column: a period, or a typed bound', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'When', values: dateValues, filter: null, numeric: false, dates: true, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(qa('summary').map((s) => s.textContent)).toEqual(['Date Filters', 'Text Filters'])
    const period = q<HTMLSelectElement>('select[aria-label="Date period"]')!
    period.value = 'lastMonth'; period.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'date', period: 'lastMonth' })
    period.value = 'between'; period.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    expect(button('OK').disabled).toBe(true)
    const d1 = q<HTMLInputElement>('input[aria-label="Date"]')!
    d1.value = '2026-09-01'; d1.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
    const d2 = q<HTMLInputElement>('input[aria-label="Second date"]')!
    d2.value = '2026-09-30'; d2.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenLastCalledWith({ kind: 'date', period: 'between', value: '2026-09-01', valueTo: '2026-09-30' })
  })

  it('Top 10 on a number column, and it opens on the filter it has', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Amount', values: numbers, filter: { kind: 'top', top: false, count: 3, percent: true }, numeric: true, onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(qa('summary').map((s) => s.textContent)).toEqual(['Number Filters', 'Top 10'])
    expect(q<HTMLSelectElement>('select[aria-label="Top or bottom"]')!.value).toBe('bottom')
    expect(q<HTMLInputElement>('input[aria-label="How many"]')!.value).toBe('3')
    expect(q<HTMLSelectElement>('select[aria-label="Items or percent"]')!.value).toBe('percent')
    const count = q<HTMLInputElement>('input[aria-label="How many"]')!
    count.value = '5'; count.dispatchEvent(new Event('input', { bubbles: true })); flushSync()
    click(button('OK'))
    expect(onApply).toHaveBeenCalledWith({ kind: 'top', top: false, count: 5, percent: true })
  })

  it('Filter by Color lists the fills once there are two, and a swatch applies at once', () => {
    const onApply = vi.fn()
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Status', values, filter: null, numeric: false, fills: ['#ffff00', null], onSort: vi.fn(), onApply, onCancel: vi.fn() } })
    flushSync()
    expect(qa('.swatch').map((b) => b.getAttribute('aria-label'))).toEqual(['Filter by #ffff00', 'Filter by no fill'])
    click(qa('.swatch')[1])
    expect(onApply).toHaveBeenCalledWith({ kind: 'color', fill: null })
  })

  it('offers no colour entry with one fill, and no date entry on text', () => {
    comp = mount(SvSheetFilterMenu, { target: host!, props: { header: 'Fruit', values, filter: null, numeric: false, fills: [null], onSort: vi.fn(), onApply: vi.fn(), onCancel: vi.fn() } })
    flushSync()
    expect(qa('summary').map((s) => s.textContent)).toEqual(['Text Filters'])
  })
})
