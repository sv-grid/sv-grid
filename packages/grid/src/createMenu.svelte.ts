/**
 * createMenu - the HEADLESS core behind <SvMenuList> / <SvMenu>, in the same
 * spirit as `createListbox`: a runes-based state machine for ONE menu level -
 * roving focus over enabled items, submenu open/collapse, and the full WAI-ARIA
 * menu keyboard contract (arrows, Home/End, Enter/Space, Escape, Tab, and
 * rtl-aware ArrowLeft/Right) - with **prop-getters** you spread onto your own
 * markup. No styles, no DOM assumptions.
 *
 * A menu tree is recursive, so you create one core per nesting level (exactly
 * what the recursive <SvMenuList> does). The styled component is just one
 * renderer over this core.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createMenu, type MenuItem } from '@svgrid/grid'
 *   let listEl = $state<HTMLElement | null>(null)
 *   const menu = createMenu({
 *     items: () => items,
 *     onSelect: (it) => run(it),
 *     onClose: () => close(),
 *     focusItem: (i) => queueMicrotask(() => listEl?.querySelector(`[data-mi="${i}"]`)?.focus()),
 *   })
 * </script>
 * <div bind:this={listEl} {...menu.listProps()}>
 *   {#each items as item, i}
 *     <button {...menu.itemProps(i)}>{item.label}</button>
 *   {/each}
 * </div>
 * ```
 */
import type { MenuItem } from './menu-item'
import type { EditorDir } from './editor-contract'
import { enabledIndices, wrapMove } from './list-nav'
import { createTypeaheadBuffer, isTypeaheadKey } from './list-option'

/** Reactive inputs are getters so the core tracks live prop changes (the same
 *  controlled pattern as `createListbox`). */
export type MenuConfig = {
  items: () => ReadonlyArray<MenuItem>
  /** Report the chosen leaf item (a non-parent menuitem). */
  onSelect: (item: MenuItem) => void
  /** Close the WHOLE menu tree - a leaf was chosen, or Escape / Tab / dismissal. */
  onClose: () => void
  /** This level is a submenu: enables ArrowLeft (or ArrowRight under rtl) to
   *  collapse back into the opener. The root level has nowhere to collapse. */
  submenu?: () => boolean
  /** Collapse just THIS submenu level and refocus the item that opened it. */
  onCollapse?: () => void
  /** Text direction; under `rtl` the open/collapse arrow keys swap. */
  dir?: () => EditorDir | undefined
  /** DOM focus hook, invoked ONLY on keyboard navigation (never on hover) so the
   *  core stays DOM-free. Receives the item index that should take focus. */
  focusItem?: (index: number) => void
}

export type MenuItemProps = {
  role: 'menuitem'
  'data-mi': number
  tabindex: 0 | -1
  'aria-haspopup': 'menu' | undefined
  'aria-expanded': boolean | undefined
  'aria-disabled': true | undefined
  disabled: boolean | undefined
  onkeydown: (event: KeyboardEvent) => void
  onpointerenter: () => void
  onclick: () => void
}

let uid = 0

export function createMenu(config: MenuConfig) {
  const items = () => config.items()
  const submenu = () => config.submenu?.() ?? false
  const rtl = () => (config.dir?.() ?? 'ltr') === 'rtl'

  // -1 = nothing focused yet (the first enabled item is the tab stop).
  let active = $state(-1)
  let openSub = $state(-1)

  // Type-ahead: printable keys jump to the next item whose label starts with the
  // accumulated buffer (WAI-ARIA menu behavior), wrapping past the active item.
  const typeahead = createTypeaheadBuffer()
  function typeaheadMatch(buffer: string): number {
    const b = buffer.trim().toLowerCase()
    if (!b) return -1
    const its = items()
    const n = its.length
    for (let k = 1; k <= n; k++) {
      const i = (active + k + n) % n
      const it = its[i]
      if (it && !it.disabled && !it.separator && (it.label ?? '').toLowerCase().startsWith(b)) return i
    }
    return -1
  }

  // Real (non-separator, non-disabled) item indices, for roving focus.
  const focusables = $derived(
    enabledIndices(items().length, (i) => {
      const it = items()[i]
      return !it || it.separator === true || it.disabled === true
    }),
  )

  /** Move focus to item `i` (keyboard): highlight it, close any open submenu at
   *  this level, and drive real DOM focus through the host's hook. */
  function focus(i: number) {
    active = i
    openSub = -1
    config.focusItem?.(i)
  }
  function move(delta: number) {
    const next = wrapMove(focusables, active, delta)
    if (next >= 0) focus(next)
  }
  function first() {
    const f = focusables[0]
    if (f != null) focus(f)
  }
  function last() {
    const l = focusables.at(-1)
    if (l != null) focus(l)
  }

  /** Hover highlight: sets active WITHOUT stealing DOM focus, and opens a parent
   *  item's submenu (mirrors the pointerenter behaviour). */
  function hover(i: number) {
    const it = items()[i]
    if (!it || it.disabled || it.separator) return
    active = i
    openSub = it.children?.length ? i : -1
  }

  function choose(item: MenuItem) {
    if (item.disabled || item.separator) return
    if (item.children?.length) {
      openSub = items().indexOf(item)
      return
    }
    item.onSelect?.()
    config.onSelect(item)
    config.onClose()
  }

  function onItemKeydown(e: KeyboardEvent, i: number) {
    const item = items()[i]
    // Open this item's submenu (ArrowRight, or ArrowLeft under rtl).
    const openThis = () => {
      if (item?.children?.length) {
        e.preventDefault()
        openSub = i
      }
    }
    // Collapse just THIS list back into its parent (opposite key under rtl).
    const collapseThis = () => {
      if (submenu()) {
        e.preventDefault()
        config.onCollapse?.()
      }
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); first(); break
      case 'End': e.preventDefault(); last(); break
      case 'ArrowRight': (rtl() ? collapseThis : openThis)(); break
      case 'ArrowLeft': (rtl() ? openThis : collapseThis)(); break
      case 'Enter':
      case ' ': e.preventDefault(); if (item) choose(item); break
      case 'Escape': e.preventDefault(); config.onClose(); break
      // Tab leaves the menu entirely (WAI-ARIA menu-button pattern): close the
      // whole tree rather than trapping focus inside a portalled panel.
      case 'Tab': config.onClose(); break
      default:
        // Type-ahead: a bare printable key jumps to the matching item.
        if (isTypeaheadKey(e)) {
          const idx = typeaheadMatch(typeahead.push(e.key))
          if (idx >= 0) { e.preventDefault(); focus(idx) }
        }
    }
  }

  function itemTabIndex(i: number): 0 | -1 {
    return active === i || (active === -1 && i === focusables[0]) ? 0 : -1
  }

  return {
    get active() { return active },
    get openSub() { return openSub },
    /** Enabled (focusable) item indices. */
    get focusables() { return focusables },
    isActive: (i: number) => i === active,
    isSubOpen: (i: number) => i === openSub,
    itemTabIndex,
    move,
    first,
    last,
    /** Highlight + DOM-focus item `i` (e.g. to refocus a submenu's opener). */
    focus,
    hover,
    choose,
    onItemKeydown,
    /** Spread onto the menu container element. */
    listProps: () => ({ role: 'menu' as const }),
    /** Spread onto the menuitem element at `i`. */
    itemProps: (i: number): MenuItemProps => {
      const it = items()[i]
      const hasKids = !!it?.children?.length
      return {
        role: 'menuitem',
        'data-mi': i,
        tabindex: itemTabIndex(i),
        'aria-haspopup': hasKids ? 'menu' : undefined,
        'aria-expanded': hasKids ? openSub === i : undefined,
        'aria-disabled': it?.disabled ? true : undefined,
        disabled: it?.disabled,
        onkeydown: (e: KeyboardEvent) => onItemKeydown(e, i),
        onpointerenter: () => hover(i),
        onclick: () => { if (it) choose(it) },
      }
    },
  }
}

export type Menu = ReturnType<typeof createMenu>
export type { MenuItem }
