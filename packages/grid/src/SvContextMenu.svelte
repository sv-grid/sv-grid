<script lang="ts" module>
  export type { MenuItem } from './SvMenuList.svelte'
</script>

<script lang="ts">
  /**
   * SvContextMenu - wraps a region and opens a menu at the pointer on right-click
   * (or long-press). Reuses SvMenuList (submenus, keyboard, icons, shortcuts),
   * portals to <body>, and closes via the shared dismissable layer stack.
   * Parity: Smart context-menu.
   *
   * ```svelte
   * <SvContextMenu items={items} onSelect={(i) => run(i)}>
   *   <div class="drop-zone">Right-click me</div>
   * </SvContextMenu>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { portalToBody, popIn } from './popover'
  import { createDismissableLayer, onScrollOutside } from './a11y/dismissable'
  import { createFocusTrap } from './a11y/focus-trap'
  import SvMenuList, { type MenuItem } from './SvMenuList.svelte'

  type Props = {
    items: ReadonlyArray<MenuItem>
    onSelect?: (item: MenuItem) => void
    disabled?: boolean
    ariaLabel?: string
    children?: Snippet
  }

  let { items, onSelect, disabled = false, ariaLabel, children }: Props = $props()

  let open = $state(false)
  let pos = $state({ x: 0, y: 0 })
  let panelEl = $state<HTMLDivElement | null>(null)
  let zoneEl = $state<HTMLDivElement | null>(null)

  const MENU_W = 200
  function openAt(clientX: number, clientY: number) {
    // Clamp so the menu stays on-screen (estimate height from item count).
    const estH = Math.min(items.length, 12) * 34 + 8
    const x = Math.min(clientX, window.innerWidth - MENU_W - 6)
    const y = Math.min(clientY, window.innerHeight - estH - 6)
    pos = { x: Math.max(6, x), y: Math.max(6, y) }
    open = true
  }

  function onContextMenu(e: MouseEvent) {
    if (disabled) return
    e.preventDefault()
    openAt(e.clientX, e.clientY)
  }

  // Keyboard equivalent of a right-click: the ContextMenu key, or Shift+F10.
  // Anchors at the focused zone's own position instead of the (nonexistent)
  // pointer coordinates.
  function onZoneKeydown(e: KeyboardEvent) {
    if (disabled) return
    const isMenuKey = e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)
    if (!isMenuKey) return
    e.preventDefault()
    const rect = zoneEl?.getBoundingClientRect()
    openAt(rect ? rect.left : 0, rect ? rect.bottom : 0)
  }

  $effect(() => {
    if (!open || !panelEl) return
    const trap = createFocusTrap(panelEl, {
      initialFocus: () => panelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])') ?? null,
    })
    trap.activate()
    const layer = createDismissableLayer({
      element: () => panelEl,
      onDismiss: () => (open = false),
    })
    layer.activate()
    // Reposition-close on scroll (a moved anchor would leave the menu stranded).
    // Scrolling the menu's own item list doesn't count as the anchor moving.
    const offScroll = onScrollOutside(() => panelEl, () => (open = false))
    return () => { layer.release(); trap.release(); offScroll() }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
<div class="sv-ctx__zone" bind:this={zoneEl} tabindex={disabled ? -1 : 0} oncontextmenu={onContextMenu} onkeydown={onZoneKeydown}>
  {@render children?.()}
</div>

{#if open}
  <div
    bind:this={panelEl}
    class="sv-ctx"
    use:portalToBody
    use:popIn={{}}
    style:position="fixed"
    style:top={`${pos.y}px`}
    style:left={`${pos.x}px`}
    aria-label={ariaLabel}
  >
    <SvMenuList {items} onclose={() => (open = false)} onselect={(i) => onSelect?.(i)} />
  </div>
{/if}

<style>
  /* display:contents generates no box and per spec cannot receive focus - it
     must be a real box for the keyboard-open path (tabindex) to work at all. */
  .sv-ctx__zone { display: block; }
  .sv-ctx__zone:focus-visible { outline: 2px solid var(--sg-accent, #6366f1); outline-offset: 1px; }
  :global(.sv-ctx) {
    z-index: 2147483646; min-width: 200px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
</style>
