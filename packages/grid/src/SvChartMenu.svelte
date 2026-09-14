<script lang="ts">
  /**
   * The chart's right-click menu: the same portalled, focus-trapped,
   * dismissable panel `SvContextMenu` opens, without the zone `<div>` that
   * component wraps its children in. The chart owns its own `contextmenu`
   * handler (the SVG is the zone) and hands this the items and a position.
   *
   * Lazy-loaded by `SvGridChart` on the first right-click, so a chart that is
   * never right-clicked never pays for the menu machinery.
   */
  import { portalToBody, popIn } from './popover'
  import { createDismissableLayer, onScrollOutside } from './a11y/dismissable'
  import { createFocusTrap } from './a11y/focus-trap'
  import SvMenuList, { type MenuItem } from './SvMenuList.svelte'

  type Props = {
    items: ReadonlyArray<MenuItem>
    x: number
    y: number
    onClose: () => void
    ariaLabel?: string
  }
  let { items, x, y, onClose, ariaLabel = 'Chart menu' }: Props = $props()

  let panelEl = $state<HTMLDivElement | null>(null)
  const MENU_W = 220
  const pos = $derived.by(() => {
    if (typeof window === 'undefined') return { x, y }
    const estH = Math.min(items.length, 12) * 34 + 8
    return {
      x: Math.max(6, Math.min(x, window.innerWidth - MENU_W - 6)),
      y: Math.max(6, Math.min(y, window.innerHeight - estH - 6)),
    }
  })

  $effect(() => {
    if (!panelEl) return
    const trap = createFocusTrap(panelEl, {
      initialFocus: () => panelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])') ?? null,
    })
    trap.activate()
    const layer = createDismissableLayer({ element: () => panelEl, onDismiss: onClose })
    layer.activate()
    const offScroll = onScrollOutside(() => panelEl, onClose)
    return () => { layer.release(); trap.release(); offScroll() }
  })
</script>

<div
  bind:this={panelEl}
  class="sv-ctx sv-grid-chart-menu"
  use:portalToBody
  use:popIn={{}}
  style:position="fixed"
  style:top={`${pos.y}px`}
  style:left={`${pos.x}px`}
  aria-label={ariaLabel}
>
  <SvMenuList {items} onclose={onClose} onselect={() => onClose()} />
</div>

<style>
  :global(.sv-grid-chart-menu) {
    z-index: 2147483646; min-width: 220px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
</style>
