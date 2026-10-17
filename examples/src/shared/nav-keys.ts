/**
 * Keyboard navigation for the demo gallery sidebar (website /demos and the
 * examples gallery). The sidebar is a tree of buttons: category heads and
 * block sub-group heads carry aria-expanded, demo leaves run the demo on
 * click. This adds the tree keys on top of Tab:
 *
 *   ArrowDown / ArrowUp   next / previous visible item
 *   Home / End            first / last item
 *   ArrowRight            open a closed group, or step into an open one
 *   ArrowLeft             close an open group, or go to the item's group head
 *   Enter / Space         the button's own action: open a group, run a demo
 *
 * The handler goes on the <nav>; it only acts when focus is on one of its items.
 */

/** Focusable, visible items of the sidebar in document order. */
export function navItems(nav: HTMLElement): HTMLElement[] {
  return [...nav.querySelectorAll<HTMLElement>('button, a[href]')].filter(
    (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
  )
}

const isHead = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el.matches('button[aria-expanded]')

/**
 * The group head an item belongs to: a demo leaf's sub-group or category
 * head, a sub-group head's category head. Null for top-level items.
 */
export function parentHead(item: HTMLElement): HTMLElement | null {
  const list = item.closest('ul')
  if (list) {
    if (isHead(list.previousElementSibling)) return list.previousElementSibling
    const outer = list.parentElement?.previousElementSibling
    return isHead(outer) ? outer : null
  }
  const outer = item.parentElement?.previousElementSibling
  return isHead(outer) ? outer : null
}

/** keydown handler for the sidebar <nav>. Returns true when it handled the key. */
export function handleNavKeydown(e: KeyboardEvent, nav: HTMLElement): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
  const items = navItems(nav)
  const i = items.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return false
  const item = items[i]!
  const focusAt = (j: number) => {
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, j))]?.focus()
    return true
  }
  switch (e.key) {
    case 'ArrowDown': return focusAt(i + 1)
    case 'ArrowUp': return focusAt(i - 1)
    case 'Home': return focusAt(0)
    case 'End': return focusAt(items.length - 1)
    case 'ArrowRight': {
      const expanded = item.getAttribute('aria-expanded')
      if (expanded === 'false') { e.preventDefault(); item.click(); return true }
      if (expanded === 'true') return focusAt(i + 1)
      return false
    }
    case 'ArrowLeft': {
      if (item.getAttribute('aria-expanded') === 'true') { e.preventDefault(); item.click(); return true }
      const head = parentHead(item)
      if (head) { e.preventDefault(); head.focus(); return true }
      return false
    }
  }
  return false
}
