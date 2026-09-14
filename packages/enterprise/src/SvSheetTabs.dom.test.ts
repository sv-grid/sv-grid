/**
 * DOM test: the sheet tab strip renders the workbook, switches on click,
 * renames in place, and refuses to delete the last sheet.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvSheetTabs from './SvSheetTabs.svelte'
import { createWorkbook } from './sheet/workbook'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

function render(props: Record<string, unknown>): HTMLElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  comp = mount(SvSheetTabs, { target: host, props })
  flushSync()
  return host
}

const threeSheets = () => createWorkbook([
  { name: 'Budget', cells: [] },
  { name: 'Orders', cells: [] },
  { name: 'Summary', cells: [] },
])

const tabNames = (el: HTMLElement) =>
  [...el.querySelectorAll('[role="tab"]')].map((b) => b.textContent)

describe('SvSheetTabs (DOM)', () => {
  it('renders a tab per sheet', () => {
    expect(tabNames(render({ workbook: threeSheets() })))
      .toEqual(['Budget', 'Orders', 'Summary'])
  })

  it('marks the active sheet selected', () => {
    const workbook = threeSheets()
    workbook.setActive('Orders')
    const el = render({ workbook })
    const selected = el.querySelector('[role="tab"][aria-selected="true"]')
    expect(selected!.textContent).toBe('Orders')
  })

  it('switches on click and reports the change', () => {
    const workbook = threeSheets()
    const onChange = vi.fn()
    const el = render({ workbook, onChange })
    const tabs = el.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[2]!.click()
    flushSync()
    expect(workbook.active).toBe('Summary')
    expect(onChange).toHaveBeenCalled()
  })

  it('adds a sheet', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('.add')!.click()
    flushSync()
    expect(workbook.sheets).toHaveLength(4)
    expect(workbook.active).toBe('Sheet1')
  })

  it('deletes a sheet', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('[aria-label="Delete Budget"]')!.click()
    flushSync()
    expect(workbook.sheets).toEqual(['Orders', 'Summary'])
  })

  it('offers no delete button when one sheet is left', () => {
    // The workbook refuses to remove it, so showing a button that does
    // nothing would be worse than not showing one.
    const el = render({ workbook: createWorkbook() })
    expect(el.querySelector('.close')).toBeNull()
  })

  it('renames on double click', () => {
    const workbook = threeSheets()
    const onChange = vi.fn()
    const el = render({ workbook, onChange })
    const tab = el.querySelector<HTMLButtonElement>('[role="tab"]')!
    tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()

    const input = el.querySelector<HTMLInputElement>('.rename')!
    input.value = 'Plan'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()

    expect(workbook.sheets[0]).toBe('Plan')
    expect(onChange).toHaveBeenCalled()
  })

  it('abandons a rename on Escape', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('[role="tab"]')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    const input = el.querySelector<HTMLInputElement>('.rename')!
    input.value = 'Nope'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    flushSync()
    expect(workbook.sheets[0]).toBe('Budget')
  })

  it('reports a duplicate name rather than silently doing nothing', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('[role="tab"]')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    const input = el.querySelector<HTMLInputElement>('.rename')!
    input.value = 'Orders'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('already exists')
    expect(workbook.sheets[0]).toBe('Budget')
  })

  it('reports an invalid name', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('[role="tab"]')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    const input = el.querySelector<HTMLInputElement>('.rename')!
    input.value = 'a/b'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    flushSync()
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('not a valid sheet name')
  })

  it('moves between tabs with the arrow keys', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    const first = el.querySelector<HTMLButtonElement>('[role="tab"]')!
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    flushSync()
    expect(workbook.active).toBe('Orders')
  })

  it('does not run off the end with the arrow keys', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    const first = el.querySelector<HTMLButtonElement>('[role="tab"]')!
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    flushSync()
    expect(workbook.active).toBe('Budget')
  })

  it('hides the editing affordances when not editable', () => {
    const el = render({ workbook: threeSheets(), editable: false })
    expect(el.querySelector('.add')).toBeNull()
    expect(el.querySelector('.close')).toBeNull()
  })
})
