/**
 * createTabs - the HEADLESS core behind <SvTabs>, in the same spirit as
 * `createSvGrid` for the grid: a runes-based state machine (roving arrow-key
 * focus, automatic/manual activation, full WAI-ARIA wiring) exposed as
 * **prop-getters** you spread onto YOUR OWN markup. No styles, no DOM
 * assumptions - render it however you like.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createTabs } from '@svgrid/grid'
 *   let value = $state('a')
 *   const t = createTabs({ tabs: () => tabs, value: () => value, onChange: (id) => (value = id) })
 * </script>
 * <div {...t.tablistProps()}>
 *   {#each tabs as tab}
 *     <button {...t.tabProps(tab.id)}>{tab.label}</button>
 *   {/each}
 * </div>
 * <div {...t.panelProps(t.activeId)}>...</div>
 * ```
 *
 * The styled <SvTabs> is just one renderer over this core. DOM focus movement is
 * a render concern, so the component watches `focusTick`/`focusId` and calls
 * `.focus()` itself; the core only decides *which* tab should take focus.
 */
export type TabItem = { id: string; label: string; disabled?: boolean }

export type TabsOrientation = 'horizontal' | 'vertical'
export type TabsActivation = 'automatic' | 'manual'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type TabsConfig = {
  tabs: () => ReadonlyArray<TabItem>
  value: () => string | undefined
  onChange?: (id: string) => void
  orientation?: () => TabsOrientation
  activation?: () => TabsActivation
  ariaLabel?: () => string | undefined
}

let uid = 0

export function createTabs(config: TabsConfig) {
  const id = `sv-tabs-${uid++}`
  const tabs = () => config.tabs()
  const orientation = () => config.orientation?.() ?? 'horizontal'
  const activation = () => config.activation?.() ?? 'automatic'

  const enabled = $derived(tabs().filter((t) => !t.disabled))
  const active = $derived(config.value() ?? tabs().find((t) => !t.disabled)?.id ?? tabs()[0]?.id ?? '')

  // Roving focus target. `focusTick` bumps on every keyboard move so the styled
  // renderer can move real DOM focus without stealing it on mount.
  let focusId = $state('')
  let focusTick = $state(0)
  const requestFocus = (tid: string) => { focusId = tid; focusTick++ }

  const tabId = (tid: string) => `${id}-tab-${tid}`
  const panelId = (tid: string) => `${id}-panel-${tid}`

  function select(tid: string) {
    const t = tabs().find((x) => x.id === tid)
    if (!t || t.disabled) return
    config.onChange?.(tid)
  }

  function onKeydown(e: KeyboardEvent) {
    const list = enabled
    if (!list.length) return
    const idx = list.findIndex((t) => t.id === active)
    const fwd = orientation() === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const back = orientation() === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    let next: string | null = null
    if (e.key === fwd) next = list[(idx + 1) % list.length]?.id ?? null
    else if (e.key === back) next = list[(idx - 1 + list.length) % list.length]?.id ?? null
    else if (e.key === 'Home') next = list[0]?.id ?? null
    else if (e.key === 'End') next = list.at(-1)?.id ?? null
    else if ((e.key === 'Enter' || e.key === ' ') && activation() === 'manual') { e.preventDefault(); select(active); return }
    else return
    if (next) {
      e.preventDefault()
      requestFocus(next)
      if (activation() === 'automatic') select(next)
    }
  }

  return {
    /** Currently selected tab id (falls back to the first enabled tab). */
    get activeId() { return active },
    /** Tab id that should hold DOM focus after the latest keyboard move. */
    get focusId() { return focusId },
    /** Monotonic counter; changes only on keyboard navigation. */
    get focusTick() { return focusTick },
    isActive: (tid: string) => tid === active,
    select,
    onKeydown,
    /** Spread onto the tablist container element. */
    tablistProps: () => ({
      role: 'tablist' as const,
      'aria-orientation': orientation(),
      'aria-label': config.ariaLabel?.(),
    }),
    /** Spread onto the tab button for `tid`. */
    tabProps: (tid: string) => {
      const t = tabs().find((x) => x.id === tid)
      const isActive = tid === active
      return {
        role: 'tab' as const,
        id: tabId(tid),
        'data-tab': tid,
        'aria-selected': isActive,
        'aria-controls': panelId(tid),
        tabindex: isActive ? 0 : -1,
        disabled: t?.disabled,
        onclick: () => select(tid),
        onkeydown: onKeydown,
      }
    },
    /** Spread onto the tabpanel element for `tid` (usually the active id). */
    panelProps: (tid: string) => ({
      role: 'tabpanel' as const,
      id: panelId(tid),
      'aria-labelledby': tabId(tid),
      tabindex: 0,
    }),
  }
}

export type Tabs = ReturnType<typeof createTabs>
