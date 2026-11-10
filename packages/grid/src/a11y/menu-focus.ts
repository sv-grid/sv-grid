/**
 * Keyboard and focus for a menu whose items are plain markup: the column menu,
 * the cell context menu, a base's table menu. `createMenu` is the same contract
 * for a menu built from a data array; this one reads the items off the DOM, so
 * a menu with conditional items and separators needs no item model.
 *
 * Focus moves to the first item when the menu opens. ArrowUp / ArrowDown wrap,
 * Home / End and first letters jump, Tab and Escape close, and when the menu
 * goes focus returns to what opened it, or to what held that if an item took it
 * away (Hide field), unless something else has taken it (a dialog an item
 * opened). An item's own Enter and Space are the button's click.
 *
 * ```svelte
 * <div role="menu" tabindex="-1" use:menuFocus={{ close }}>
 *   <button role="menuitem">Rename</button>
 * </div>
 * ```
 */
import { wrapMove } from '../list-nav'
import { createTypeaheadBuffer, isTypeaheadKey } from '../list-option'
import { focusNearest, focusPath, keepFocus } from './focus-trap'

export type MenuFocusOptions = {
  /** Close the menu: called for Tab and Escape on an item. */
  close?: () => void
  /** Give focus back here instead of to the element focused when the menu opened. */
  returnTo?: () => HTMLElement | null | undefined
  /** False for a list with keys of its own (`SvMenuList`): only focus moves in and back. */
  keys?: boolean
}

// An item marked aria-disabled stays in the arrow-key order, as the ARIA menu
// pattern has it: a screen reader moving through the menu hears it and why it is
// off. One with the `disabled` attribute cannot take focus at all.
const ITEMS = '[role^="menuitem"]:not(:disabled)'
const FIRST_CONTROL = 'input, select, textarea, button:not(:disabled), [tabindex="0"]'

export function menuFocus(node: HTMLElement, options: MenuFocusOptions = {}) {
  const opener = document.activeElement as HTMLElement | null
  const path = focusPath(opener)
  const typed = createTypeaheadBuffer()
  const items = () => Array.from(node.querySelectorAll<HTMLElement>(ITEMS))
  const go = (el?: HTMLElement) => el?.focus({ preventScroll: true })

  function step(event: KeyboardEvent, list: HTMLElement[]): HTMLElement | undefined {
    const at = list.indexOf(document.activeElement as HTMLElement)
    const all = list.map((_, i) => i)
    if (event.key === 'ArrowDown') return list[wrapMove(all, at, 1)]
    if (event.key === 'ArrowUp') return list[at < 0 ? list.length - 1 : wrapMove(all, at, -1)]
    if (event.key === 'Home') return list[0]
    if (event.key === 'End') return list[list.length - 1]
    if (!isTypeaheadKey(event)) return undefined
    const text = typed.push(event.key.toLowerCase())
    const label = (el: HTMLElement) => (el.textContent ?? '').trim().toLowerCase()
    // A second press of one letter moves on to the next item with it.
    const repeat = text.length > 1 && [...text].every((c) => c === text[0])
    const from = repeat || text.length === 1 ? at + 1 : Math.max(at, 0)
    const order = [...list.slice(from), ...list.slice(0, from)]
    return order.find((el) => label(el).startsWith(repeat ? text[0]! : text))
  }

  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement
    // A box inside the menu (a filter value) keeps its own keys.
    if (target.closest('input, select, textarea, [contenteditable="true"]')) return
    if (event.key === 'Tab' || event.key === 'Escape') {
      if (!options.close) return
      event.preventDefault()
      event.stopPropagation()
      options.close()
      return
    }
    const next = step(event, items())
    if (!next) return
    event.preventDefault()
    go(next)
    // The menu scrolls when it is taller than the room it has: the item stays in sight.
    next.scrollIntoView?.({ block: 'nearest' })
  }

  if (options.keys !== false) node.addEventListener('keydown', onKey)
  const kept = keepFocus(node)
  const first = () => go(items()[0] ?? node.querySelector<HTMLElement>(FIRST_CONTROL) ?? node)
  first()
  // A popover moves its panel to <body> just after this runs, and a moved element loses focus.
  queueMicrotask(() => {
    if (node.isConnected && !node.contains(document.activeElement)) first()
  })

  return {
    update(next: MenuFocusOptions) {
      options = next
    },
    destroy() {
      node.removeEventListener('keydown', onKey)
      kept.destroy()
      typed.clear()
      // After the menu has left the page. Focus left in it falls to the body.
      queueMicrotask(() => {
        const now = document.activeElement
        if (now && now !== document.body && now.isConnected) return
        const back = options.returnTo?.()
        focusNearest(back ? [{ el: back }, ...path] : path)
      })
    },
  }
}
