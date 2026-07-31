/**
 * Component tests for SvMenu: the trigger opens a portalled menu, items/separators
 * render with menu semantics, choosing a leaf fires onSelect + closes, and a
 * submenu opens on pointer-enter.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mount, unmount, flushSync, createRawSnippet } from 'svelte'
import SvMenu, { type MenuItem } from './SvMenu.svelte'

const anchor = createRawSnippet(() => ({ render: () => `<button class="trigger">Actions</button>` }))

function mountMenu(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvMenu, { target, props: { anchor, ...props } as any })
  flushSync()
  return { target, destroy: () => { unmount(app); target.remove() } }
}
const menu = () => document.querySelector<HTMLElement>('.sv-menu')
afterEach(() => document.querySelectorAll('.sv-menu').forEach((n) => n.remove()))

describe('SvMenu', () => {
  const items: MenuItem[] = [
    { label: 'Cut', shortcut: 'Ctrl+X', onSelect: () => {} },
    { label: 'Copy', shortcut: 'Ctrl+C' },
    { separator: true },
    { label: 'Share', children: [{ label: 'Email' }, { label: 'Link' }] },
    { label: 'Delete', disabled: true },
  ]

  it('opens on trigger click with menu/menuitem roles + a separator', () => {
    const { target, destroy } = mountMenu({ items })
    try {
      expect(menu()).toBeNull()
      target.querySelector<HTMLElement>('.trigger')!.click()
      flushSync()
      const m = menu()!
      expect(m.querySelector('[role="menu"]')).not.toBeNull()
      expect(m.querySelectorAll('[role="menuitem"]').length).toBe(4) // 4 items, separator excluded
      expect(m.querySelector('[role="separator"]')).not.toBeNull()
      expect(m.querySelector('[aria-disabled="true"]')).not.toBeNull()
    } finally { destroy() }
  })

  it('choosing a leaf fires onSelect and closes', () => {
    let chosen: MenuItem | undefined
    const { target, destroy } = mountMenu({ items, onSelect: (i: MenuItem) => (chosen = i) })
    try {
      target.querySelector<HTMLElement>('.trigger')!.click()
      flushSync()
      const copy = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((b) => b.textContent?.includes('Copy'))!
      copy.click()
      flushSync()
      expect(chosen?.label).toBe('Copy')
      expect(menu()).toBeNull()
    } finally { destroy() }
  })

  it('ArrowDown moves the roving tab stop and Enter activates via keyboard', () => {
    let chosen: MenuItem | undefined
    const { target, destroy } = mountMenu({ items, onSelect: (i: MenuItem) => (chosen = i) })
    try {
      target.querySelector<HTMLElement>('.trigger')!.click()
      flushSync()
      const btns = () => [...menu()!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const cut = btns().find((b) => b.textContent?.includes('Cut'))!
      // From nothing focused, ArrowDown lands on the first item, then the next.
      cut.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      cut.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      flushSync()
      const copy = btns().find((b) => b.textContent?.includes('Copy'))!
      expect(copy.tabIndex).toBe(0)
      expect(cut.tabIndex).toBe(-1)
      // Enter on the focused item activates it and closes the menu.
      copy.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      flushSync()
      expect(chosen?.label).toBe('Copy')
      expect(menu()).toBeNull()
    } finally { destroy() }
  })

  it('opens a submenu on pointer-enter of a parent item', () => {
    const { target, destroy } = mountMenu({ items })
    try {
      target.querySelector<HTMLElement>('.trigger')!.click()
      flushSync()
      const share = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((b) => b.textContent?.includes('Share'))!
      expect(share.getAttribute('aria-haspopup')).toBe('menu')
      share.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }))
      flushSync()
      expect(menu()!.querySelector('.sv-menu__flyout')).not.toBeNull()
      const sub = [...menu()!.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent)
      expect(sub.some((t) => t?.includes('Email'))).toBe(true)
    } finally { destroy() }
  })
})
