import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { menuFocus } from './menu-focus'

function press(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  ;(document.activeElement as HTMLElement).dispatchEvent(event)
  return event
}

describe('menuFocus', () => {
  let opener: HTMLButtonElement
  let menu: HTMLDivElement

  beforeEach(() => {
    opener = document.createElement('button')
    menu = document.createElement('div')
    menu.tabIndex = -1
    menu.innerHTML = `
      <button role="menuitem">Rename</button>
      <button role="menuitem" disabled>Locked</button>
      <div role="separator"></div>
      <button role="menuitem">Duplicate</button>
      <button role="menuitem">Delete</button>`
    document.body.append(opener, menu)
    opener.focus()
  })
  afterEach(() => {
    opener.remove()
    menu.remove()
  })

  const items = () => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')]

  it('moves focus to the first enabled item', () => {
    menuFocus(menu)
    expect(document.activeElement).toBe(items()[0])
  })

  it('walks the items with the arrows, wrapping, past a disabled one and a separator', () => {
    menuFocus(menu)
    expect(press('ArrowDown').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(items()[1])
    press('ArrowDown')
    press('ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    press('ArrowUp')
    expect(document.activeElement).toBe(items()[2])
  })

  it('an item marked aria-disabled stays in the arrow and letter order, so it is heard with why', () => {
    menu.querySelectorAll('[role="menuitem"]')[2]!.setAttribute('aria-disabled', 'true')
    menuFocus(menu)
    const off = menu.querySelectorAll<HTMLElement>('[role="menuitem"]')[2]!
    press('ArrowDown')
    expect(document.activeElement).toBe(off)
    press('End')
    press('ArrowUp')
    expect(document.activeElement).toBe(off)
    press('Home')
    press('d')
    expect(document.activeElement).toBe(off)
  })

  it('jumps with Home, End and a first letter', () => {
    menuFocus(menu)
    press('End')
    expect(document.activeElement).toBe(items()[2])
    press('Home')
    expect(document.activeElement).toBe(items()[0])
    press('d')
    expect(document.activeElement).toBe(items()[1])
    press('d')
    expect(document.activeElement).toBe(items()[2])
  })

  it('closes on Escape and on Tab', () => {
    const close = vi.fn()
    menuFocus(menu, { close })
    press('Escape')
    press('Tab')
    expect(close).toHaveBeenCalledTimes(2)
  })

  it('gives focus back to what opened it once the menu has gone', async () => {
    const action = menuFocus(menu)
    menu.remove()
    action.destroy()
    await Promise.resolve()
    expect(document.activeElement).toBe(opener)
  })

  it('leaves focus alone when an item opened something that took it', async () => {
    const dialog = document.createElement('input')
    document.body.append(dialog)
    const action = menuFocus(menu)
    dialog.focus()
    menu.remove()
    action.destroy()
    await Promise.resolve()
    expect(document.activeElement).toBe(dialog)
    dialog.remove()
  })

  it('goes back to `returnTo` when it is given', async () => {
    const root = document.createElement('div')
    root.tabIndex = 0
    document.body.append(root)
    const action = menuFocus(menu, { returnTo: () => root })
    menu.remove()
    action.destroy()
    await Promise.resolve()
    expect(document.activeElement).toBe(root)
    root.remove()
  })

  it('leaves the keys of a box inside the menu alone', () => {
    const close = vi.fn()
    const box = document.createElement('input')
    menu.prepend(box)
    menuFocus(menu, { close })
    box.focus()
    expect(press('ArrowDown').defaultPrevented).toBe(false)
    press('Tab')
    expect(close).not.toHaveBeenCalled()
  })

  it('scrolls the item it moves to into view', () => {
    menuFocus(menu)
    const last = menu.querySelectorAll<HTMLElement>('[role="menuitem"]')[3]!
    const seen = vi.fn()
    last.scrollIntoView = seen
    press('End')
    expect(document.activeElement).toBe(last)
    expect(seen).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('a control removed from the menu hands focus on', async () => {
    menuFocus(menu)
    const first = menu.querySelector<HTMLElement>('[role="menuitem"]')!
    first.focus()
    first.remove()
    await new Promise((r) => setTimeout(r, 5))
    expect(menu.contains(document.activeElement)).toBe(true)
  })

  it('an item that took its opener away (Hide field): what held the opener takes focus', async () => {
    const grid = document.createElement('div')
    grid.tabIndex = 0
    const head = document.createElement('button')
    grid.append(head)
    document.body.append(grid)
    head.focus()
    const action = menuFocus(menu)
    head.remove()
    menu.remove()
    action.destroy()
    await Promise.resolve()
    expect(document.activeElement).toBe(grid)
    grid.remove()
  })

  it('focuses the first control of a menu with no items', () => {
    menu.innerHTML = '<input type="text" />'
    menuFocus(menu)
    expect(document.activeElement).toBe(menu.querySelector('input'))
  })
})
