/**
 * DOM test: the sheet tab strip renders the workbook, switches on click,
 * renames in place, and refuses to delete the last sheet.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync, type ComponentProps } from 'svelte'
import SvSheetTabs from './SvSheetTabs.svelte'
import { createWorkbook, type Workbook } from './sheet/workbook'
import { reactiveProps } from './SvSheetTabs.test-harness.svelte'

let host: HTMLElement | null = null
let comp: ReturnType<typeof mount> | null = null
afterEach(() => {
  if (comp) { unmount(comp); comp = null }
  if (host) { host.remove(); host = null }
})

type TabProps = ComponentProps<typeof SvSheetTabs>

function render(props: Partial<TabProps> & { workbook: Workbook }): HTMLElement {
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

  /** Right-click a tab: the sheet menu Excel opens, with Delete on it. */
  function openMenu(el: HTMLElement, name: string): HTMLElement {
    const tab = [...el.querySelectorAll<HTMLElement>('.tab')]
      .find((t) => t.textContent?.trim() === name)!
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 20 }))
    flushSync()
    return document.querySelector<HTMLElement>('.sheet-menu')!
  }

  function menuItem(menu: HTMLElement, label: string): HTMLButtonElement {
    return [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((b) => b.textContent?.trim() === label)!
  }

  it('deletes a sheet from the right-click menu, and from nowhere on the tab face', () => {
    // Excel keeps Delete behind a right-click; a button on the tab itself
    // is one stray click from losing a sheet.
    const workbook = threeSheets()
    const el = render({ workbook })
    expect(el.querySelector('[aria-label="Delete Budget"]')).toBeNull()
    menuItem(openMenu(el, 'Budget'), 'Delete').click()
    flushSync()
    expect(workbook.sheets).toEqual(['Orders', 'Summary'])
  })

  it('inserts, renames and moves from the same menu', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    menuItem(openMenu(el, 'Orders'), 'Move Right').click()
    flushSync()
    expect(workbook.sheets).toEqual(['Budget', 'Summary', 'Orders'])
    menuItem(openMenu(el, 'Summary'), 'Insert...').click()
    flushSync()
    expect(workbook.sheets).toEqual(['Budget', 'Sheet1', 'Summary', 'Orders'])
    expect(workbook.active).toBe('Sheet1')
    menuItem(openMenu(el, 'Sheet1'), 'Rename').click()
    flushSync()
    expect(el.querySelector('.rename')).not.toBeNull()
  })

  it('asks before deleting a sheet that holds data, and deletes an empty one at once', () => {
    const workbook = createWorkbook([{ name: 'Data', cells: [['x']] }, { name: 'Empty', cells: [] }, { name: 'Other', cells: [] }])
    const el = render({ workbook })
    menuItem(openMenu(el, 'Empty'), 'Delete').click()
    flushSync()
    expect(workbook.sheets).toEqual(['Data', 'Other'])
    menuItem(openMenu(el, 'Data'), 'Delete').click()
    flushSync()
    expect(workbook.sheets).toEqual(['Data', 'Other'])
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.sv-modal button')].find((b) => b.textContent?.trim() === 'Delete')!
    confirm.click()
    flushSync()
    expect(workbook.sheets).toEqual(['Other'])
  })

  it('hides a tab, lists it under Unhide, and never hides the last one showing', () => {
    const workbook = threeSheets()
    const onHide = vi.fn()
    const onUnhide = vi.fn()
    const box = reactiveProps({ workbook, hidden: [] as string[], onHide, onUnhide })
    const el = render(box.props)
    expect(menuItem(openMenu(el, 'Budget'), 'Hide').disabled).toBe(false)
    menuItem(openMenu(el, 'Orders'), 'Hide').click()
    flushSync()
    expect(onHide).toHaveBeenCalledWith('Orders')
    box.set({ hidden: ['Orders'] })
    flushSync()
    expect(tabNames(el)).toEqual(['Budget', 'Summary'])
    const menu = openMenu(el, 'Budget')
    expect(menu.textContent).toContain('Unhide')
    menuItem(menu, 'Orders').click()
    flushSync()
    expect(onUnhide).toHaveBeenCalledWith('Orders')
    box.set({ hidden: ['Orders', 'Summary'] })
    flushSync()
    expect(menuItem(openMenu(el, 'Budget'), 'Hide').disabled).toBe(true)
  })

  it('offers Duplicate only when the consumer answers it', () => {
    const workbook = threeSheets()
    expect(menuItem(openMenu(render({ workbook }), 'Budget'), 'Duplicate')).toBeUndefined()
    if (comp) { unmount(comp); comp = null }
    if (host) { host.remove(); host = null }
    const onDuplicate = vi.fn()
    menuItem(openMenu(render({ workbook, onDuplicate }), 'Budget'), 'Duplicate').click()
    expect(onDuplicate).toHaveBeenCalledWith('Budget')
  })

  it('greys Delete out when one sheet is left', () => {
    // The workbook refuses to remove it, so an enabled item that does
    // nothing would be worse than a disabled one.
    const el = render({ workbook: createWorkbook() })
    expect(menuItem(openMenu(el, 'Sheet1'), 'Delete').disabled).toBe(true)
  })

  it('greys the scroll arrows until the strip has somewhere to scroll', () => {
    // jsdom lays nothing out, so the strip never overflows: both arrows
    // read disabled, which is also what one sheet in a wide strip shows.
    const el = render({ workbook: createWorkbook() })
    const left = el.querySelector<HTMLButtonElement>('button[aria-label="Scroll tabs left"]')!
    const right = el.querySelector<HTMLButtonElement>('button[aria-label="Scroll tabs right"]')!
    expect(left.disabled).toBe(true)
    expect(right.disabled).toBe(true)
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
    const tab = el.querySelector<HTMLElement>('.tab')!
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    flushSync()
    expect(document.querySelector('.sheet-menu')).toBeNull()
  })
})

/**
 * A Workbook is a plain object, not `$state`, so nothing about reading
 * `workbook.sheets` makes the strip re-render. Every test above asserts the
 * WORKBOOK after an interaction, which passes whether or not the DOM ever
 * caught up - and it did not: the strip rendered once at mount and then showed
 * a stale sheet list and a stale selected tab for the rest of its life.
 */
describe('SvSheetTabs re-renders when the workbook changes', () => {
  it('shows a sheet added through its own button', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelector<HTMLButtonElement>('.add')!.click()
    flushSync()
    expect(tabNames(el)).toEqual(['Budget', 'Orders', 'Summary', 'Sheet1'])
  })

  it('moves the selected marker when its own tab is clicked', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2]!.click()
    flushSync()
    expect(el.querySelector('[role="tab"][aria-selected="true"]')!.textContent)
      .toBe('Summary')
  })

  it('drops a sheet deleted through its own menu', () => {
    const workbook = threeSheets()
    const el = render({ workbook })
    const tab = el.querySelector<HTMLElement>('.tab')!
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    flushSync()
    const item = [...document.querySelectorAll<HTMLButtonElement>('.sheet-menu [role="menuitem"]')]
      .find((b) => b.textContent?.trim() === 'Delete')!
    item.click()
    flushSync()
    expect(tabNames(el)).toEqual(['Orders', 'Summary'])
  })

  it('follows an OUTSIDE mutation once `version` is bumped', () => {
    // What Ctrl+PageUp / Ctrl+PageDown do: the shortcut layer moves the
    // workbook and the consumer bumps the counter it already keeps.
    const workbook = threeSheets()
    const box = reactiveProps({ workbook, version: 0 })
    const el = render(box.props)

    workbook.setActive('Summary')
    workbook.addSheet('Notes')
    flushSync()
    // Nothing has told the strip yet, so it is still showing the old list.
    expect(tabNames(el)).toEqual(['Budget', 'Orders', 'Summary'])

    box.set({ version: 1 })
    flushSync()
    expect(tabNames(el)).toEqual(['Budget', 'Orders', 'Summary', 'Notes'])
    expect(el.querySelector('[role="tab"][aria-selected="true"]')!.textContent)
      .toBe('Notes')
  })

  it('keeps the tabs owned by the tablist', () => {
    const el = render({ workbook: threeSheets() })
    const list = el.querySelector('[role="tablist"]')!
    for (const tab of el.querySelectorAll('[role="tab"]')) {
      // Every element between a tab and its tablist must be presentational,
      // or the tablist does not own the tab as far as ARIA is concerned.
      let node = tab.parentElement
      while (node && node !== list) {
        expect(node.getAttribute('role')).toBe('presentation')
        node = node.parentElement
      }
      expect(node).toBe(list)
    }
  })
})
