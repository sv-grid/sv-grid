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
  import { createDismissableLayer } from './a11y/dismissable'
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

  $effect(() => {
    if (!open) return
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
    const layer = createDismissableLayer({
      element: () => panelEl,
      onDismiss: () => (open = false),
    })
    layer.activate()
    // Reposition-close on scroll (a moved anchor would leave the menu stranded).
    const onScroll = () => (open = false)
    window.addEventListener('scroll', onScroll, true)
    return () => { layer.release(); window.removeEventListener('scroll', onScroll, true) }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="sv-ctx__zone" oncontextmenu={onContextMenu}>
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
  .sv-ctx__zone { display: contents; }
  :global(.sv-ctx) {
    z-index: 2147483646; min-width: 200px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
</style>
