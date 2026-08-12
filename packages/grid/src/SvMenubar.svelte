<script lang="ts" module>
  export type MenubarMenu = {
    /** Trigger label on the bar. */
    label: string
    /** The dropdown's items (submenus, separators, icons, shortcuts all work). */
    items: import('./menu-item').MenuItem[]
    disabled?: boolean
  }
</script>

<script lang="ts">
  /**
   * SvMenubar - an application menu bar: a horizontal row of menu buttons
   * (File / Edit / View ...) that each open a dropdown built on SvMenuList.
   * Roving focus across the bar, ArrowLeft/Right move between menus, ArrowDown /
   * Enter open the active one, hovering another trigger switches while a menu is
   * open, and Escape closes and returns focus to the trigger. The dropdown is
   * portalled and positioned by the shared engine.
   *
   * ```svelte
   * <SvMenubar menus={[{ label: 'File', items: fileItems }, ...]}
   *            onSelect={(i) => run(i)} />
   * ```
   */
  import { portalToBody, popIn } from './popover'
  import { computePosition, autoUpdate, type ComputePositionResult } from './positioning'
  import { createDismissableLayer } from './a11y/dismissable'
  import { type EditorDir } from './editor-contract'
  import SvMenuList from './SvMenuList.svelte'
  import type { MenuItem } from './menu-item'

  type Props = {
    menus: ReadonlyArray<MenubarMenu>
    onSelect?: (item: MenuItem) => void
    ariaLabel?: string
    dir?: EditorDir
  }

  let { menus, onSelect, ariaLabel = 'Menu bar', dir }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  const rtl = $derived(resolvedDir === 'rtl')

  let triggerEls = $state<(HTMLButtonElement | null)[]>([])
  let panelEl = $state<HTMLDivElement | null>(null)
  let openIndex = $state(-1)
  let activeIndex = $state(0)
  let pos = $state<ComputePositionResult>({ x: 0, y: 0, placement: 'bottom-start', side: 'bottom', align: 'start', maxWidth: 0, maxHeight: 0 })

  const enabled = (i: number) => !menus[i]?.disabled

  function focusTrigger(i: number) { queueMicrotask(() => triggerEls[i]?.focus()) }
  function focusFirstItem() {
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
  }

  function open(i: number) {
    if (!enabled(i)) return
    openIndex = i
    activeIndex = i
    focusFirstItem()
  }
  function close(refocus = true) {
    const i = openIndex
    openIndex = -1
    if (refocus && i >= 0) focusTrigger(i)
  }
  function toggle(i: number) { if (openIndex === i) close(); else open(i) }
  function onTriggerEnter(i: number) {
    // While a menu is open, hovering another trigger switches to it (menubar UX).
    if (openIndex >= 0 && openIndex !== i && enabled(i)) open(i)
  }

  function step(from: number, delta: number): number {
    const n = menus.length
    for (let k = 1; k <= n; k++) {
      const i = (from + delta * k + n * k) % n
      if (enabled(i)) return i
    }
    return from
  }
  function moveActive(delta: number) {
    activeIndex = step(activeIndex, delta)
    focusTrigger(activeIndex)
    if (openIndex >= 0) open(activeIndex)
  }

  function onBarKeydown(e: KeyboardEvent) {
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    switch (e.key) {
      case fwd: e.preventDefault(); moveActive(1); break
      case back: e.preventDefault(); moveActive(-1); break
      case 'Home': e.preventDefault(); activeIndex = step(-1, 1); focusTrigger(activeIndex); if (openIndex >= 0) open(activeIndex); break
      case 'End': e.preventDefault(); activeIndex = step(menus.length, -1); focusTrigger(activeIndex); if (openIndex >= 0) open(activeIndex); break
      case 'ArrowDown':
      case 'Enter':
      case ' ': e.preventDefault(); open(activeIndex); break
      case 'Escape': if (openIndex >= 0) { e.preventDefault(); close() } break
    }
  }

  function updatePos() {
    const trigger = triggerEls[openIndex]
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const f = { width: panelEl?.offsetWidth || 180, height: panelEl?.offsetHeight || 200 }
    pos = computePosition(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      f,
      { placement: rtl ? 'bottom-end' : 'bottom-start', offset: 4, padding: 8, minMainAxis: 96 },
    )
  }

  // Position + dismiss the open dropdown, and let ArrowLeft/Right at the root menu
  // level switch to the adjacent menubar menu (WAI-ARIA menubar behavior). An
  // ArrowRight on a submenu parent still opens its submenu; ArrowLeft inside a
  // submenu still collapses - those are left to SvMenuList.
  $effect(() => {
    const trigger = triggerEls[openIndex]
    if (openIndex < 0 || !panelEl || !trigger) return
    const stop = autoUpdate(trigger, panelEl, updatePos)
    const layer = createDismissableLayer({
      element: () => [trigger, panelEl],
      onDismiss: () => close(false),
      closeOnEscape: false, // Escape is owned by SvMenuList -> onclose -> close()
    })
    layer.activate()

    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const list = el?.closest('.sv-menu__list')
      const inSubmenu = !!list?.classList.contains('is-submenu')
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'
      const back = rtl ? 'ArrowRight' : 'ArrowLeft'
      if (e.key === fwd) {
        if (el?.getAttribute('aria-haspopup') === 'menu') return // opens a submenu
        e.preventDefault(); open(step(openIndex, 1))
      } else if (e.key === back) {
        if (inSubmenu) return // collapse the submenu instead
        e.preventDefault(); open(step(openIndex, -1))
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { stop(); layer.release(); document.removeEventListener('keydown', onKey, true) }
  })
</script>

<div class="sv-menubar" role="menubar" aria-label={ariaLabel} dir={resolvedDir} onkeydown={onBarKeydown}>
  {#each menus as m, i (i)}
    <button
      type="button"
      bind:this={triggerEls[i]}
      class="sv-menubar__item"
      class:is-open={openIndex === i}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={openIndex === i}
      tabindex={activeIndex === i ? 0 : -1}
      disabled={m.disabled}
      onclick={() => toggle(i)}
      onpointerenter={() => onTriggerEnter(i)}
    >{m.label}</button>
  {/each}
</div>

{#if openIndex >= 0}
  <div
    bind:this={panelEl}
    class="sv-menu"
    use:portalToBody
    use:popIn={{ up: pos.side === 'top' }}
    style:position="fixed"
    style:top={`${pos.y}px`}
    style:left={`${pos.x}px`}
    dir={resolvedDir}
  >
    <SvMenuList
      items={menus[openIndex]?.items ?? []}
      onclose={() => close()}
      onselect={(item) => { onSelect?.(item); close() }}
      dir={resolvedDir}
    />
  </div>
{/if}

<style>
  .sv-menubar {
    display: inline-flex; align-items: center; gap: 2px; padding: 3px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 9px;
  }
  .sv-menubar__item {
    font: inherit; font-size: 13px; font-weight: 500; color: var(--sg-fg, #0f172a);
    padding: 5px 11px; background: none; border: 0; border-radius: 6px; cursor: pointer;
    transition: background 0.1s;
  }
  .sv-menubar__item:hover:not([disabled]), .sv-menubar__item.is-open { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-menubar__item:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px; }
  .sv-menubar__item[disabled] { opacity: 0.45; cursor: default; }
</style>
