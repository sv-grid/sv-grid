/**
 * createPopoverSelect - the shared HEADLESS engine behind the kit's dropdown
 * selects (SvMultiSelect, SvTreeSelect, SvGridSelect and any future one). It
 * owns the parts every anchored-panel select repeats: open/close state, the
 * `anchoredRect` positioning (reposition on scroll/resize), outside/Escape
 * dismissal via the shared layer stack, a roving `active` index over the visible
 * items, the WAI-ARIA combobox wiring (`aria-expanded` / `aria-controls` /
 * `aria-activedescendant` + stable option ids), and focus management (focus
 * moves into the panel on open, back to the trigger on close).
 *
 * The component owns its own `bind:this` refs and item rendering; it passes the
 * refs in as getters and spreads the returned prop-getters onto its trigger,
 * panel and items. Runes-based, like `createListbox`.
 */
import { anchoredRect, type AnchoredRect } from './popover'
import { createDismissableLayer } from './a11y/dismissable'
import { enabledIndices as enabledIndicesOf, wrapMove } from './list-nav'

let uidSeq = 0

export type PopoverSelectConfig = {
  /** Number of currently-visible/navigable items (post-filter). */
  itemCount: () => number
  /** Whether item `i` is disabled (skipped by roving, not selectable). */
  disabled?: (index: number) => boolean
  /** Read-only: value shown, trigger focusable, but the panel will not open. */
  readonly?: () => boolean
  /** Commit the item at `index` (Enter or a click the component forwards). */
  onSelect: (index: number) => void
  /** Notified whenever the open state changes. */
  onOpenChange?: (open: boolean) => void
  /** The trigger element (component owns `bind:this`, passes a getter). */
  getTrigger: () => HTMLElement | null
  /** The panel element. */
  getPanel: () => HTMLElement | null
  /** Element focused when the panel opens (e.g. a search input). Defaults to the
   *  panel itself. Its id-holder also carries `aria-activedescendant`. */
  getInitialFocus?: () => HTMLElement | null
  /** Estimated panel height, for the flip-up decision. Default 280. */
  estimatedHeight?: () => number
  /** Minimum panel width. Default 200. */
  minWidth?: () => number
  /** Close after a selection (single-select). Default true. */
  closeOnSelect?: () => boolean
  /** Active index to start on when opening (e.g. the selected row). Default 0. */
  initialActive?: () => number
  /** Handle a key the core doesn't (e.g. tree ArrowLeft/Right). Return true if
   *  handled to stop the core's default handling. */
  onExtraKey?: (event: KeyboardEvent, active: number) => boolean
  idPrefix?: string
}

export function createPopoverSelect(config: PopoverSelectConfig) {
  const id = `${config.idPrefix ?? 'sv-pop'}-${uidSeq++}`
  const panelId = `${id}-panel`
  const optionId = (i: number) => `${id}-opt-${i}`

  let open = $state(false)
  let active = $state(0)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })

  const count = () => config.itemCount()
  const isDisabled = (i: number) => config.disabled?.(i) ?? false
  const readonly = () => config.readonly?.() ?? false

  function enabledIndices(): number[] {
    return enabledIndicesOf(count(), isDisabled)
  }
  function clampActive(i: number): number {
    const n = count()
    return n <= 0 ? 0 : Math.max(0, Math.min(i, n - 1))
  }

  function setOpen(v: boolean) {
    if (v === open) return
    open = v
    config.onOpenChange?.(v)
  }
  function openPanel() {
    if (readonly()) return
    active = clampActive(config.initialActive?.() ?? 0)
    setOpen(true)
  }
  function closePanel() {
    setOpen(false)
    config.getTrigger()?.focus()
  }
  function toggle() {
    if (readonly()) return
    open ? setOpen(false) : openPanel()
  }

  function move(delta: number) {
    const next = wrapMove(enabledIndices(), active, delta)
    if (next >= 0) active = next
  }
  function first() { active = enabledIndices()[0] ?? 0 }
  function last() { active = enabledIndices().at(-1) ?? 0 }
  function selectActive() {
    if (readonly() || count() === 0 || isDisabled(active)) return
    config.onSelect(active)
    if (config.closeOnSelect?.() ?? true) closePanel()
  }

  function updatePos() {
    const t = config.getTrigger()
    if (!t) return
    rect = anchoredRect(t.getBoundingClientRect(), {
      estimatedHeight: config.estimatedHeight?.() ?? 280,
      minWidth: config.minWidth?.() ?? 200,
    })
  }

  // While open: position, focus into the panel, reposition on scroll/resize, and
  // register a dismissable layer (Escape / outside-click, top-of-stack first).
  $effect(() => {
    if (!open) return
    updatePos()
    const initial = config.getInitialFocus?.() ?? config.getPanel()
    queueMicrotask(() => initial?.focus())
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true)
    window.addEventListener('resize', rp)
    const layer = createDismissableLayer({
      element: () => [config.getTrigger(), config.getPanel()],
      onDismiss: () => setOpen(false),
    })
    layer.activate()
    return () => {
      window.removeEventListener('scroll', rp, true)
      window.removeEventListener('resize', rp)
      layer.release()
    }
  })

  function onTriggerKeydown(e: KeyboardEvent) {
    if (readonly()) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPanel()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      openPanel()
      last()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }
  function onPanelKeydown(e: KeyboardEvent) {
    if (config.onExtraKey?.(e, active)) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); first(); break
      case 'End': e.preventDefault(); last(); break
      case 'Enter': e.preventDefault(); selectActive(); break
      case 'Escape': e.preventDefault(); closePanel(); break
      case 'Tab': setOpen(false); break
    }
  }

  /** The current active-descendant id (for the focused element), or undefined. */
  const activeDescendant = () => (open && count() > 0 ? optionId(active) : undefined)

  return {
    get open() { return open },
    set open(v: boolean) { setOpen(v) },
    get active() { return active },
    set active(i: number) { active = clampActive(i) },
    get rect() { return rect },
    /** Stable id of the panel element (for aria-controls / labelling). */
    panelId,
    /** Stable id of the option at `i` (for aria-activedescendant + item id). */
    optionId,
    activeDescendant,
    openPanel,
    closePanel,
    toggle,
    move,
    first,
    last,
    selectActive,
    updatePos,
    onPanelKeydown,
    /** True when item `i` is the roving-active one. */
    isActive: (i: number) => i === active,
    /** Spread onto the trigger button. Pass the ARIA popup type the panel
     *  exposes (mirrors `focusOwnerProps(role)`); defaults to 'listbox' for
     *  the classic select panels. */
    triggerProps: (haspopup: 'listbox' | 'tree' | 'grid' = 'listbox') => ({
      'aria-haspopup': haspopup,
      'aria-expanded': open,
      'aria-controls': open ? panelId : undefined,
      'aria-readonly': readonly() || undefined,
      onkeydown: onTriggerKeydown,
    }),
    /** Attributes for the element that OWNS focus + activedescendant (the panel,
     *  or a search input). Pass the ARIA role the panel should expose. */
    focusOwnerProps: (role: 'listbox' | 'tree' | 'grid' = 'listbox') => ({
      role,
      'aria-activedescendant': activeDescendant(),
      onkeydown: onPanelKeydown,
    }),
    /** Spread onto the item element at `i`. */
    itemProps: (i: number) => ({
      id: optionId(i),
      'data-active': i === active ? '' : undefined,
      onpointermove: () => { if (!isDisabled(i)) active = i },
    }),
  }
}

export type PopoverSelect = ReturnType<typeof createPopoverSelect>
