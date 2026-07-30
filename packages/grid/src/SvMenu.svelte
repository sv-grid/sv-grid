<script lang="ts" module>
  export type { MenuItem } from './SvMenuList.svelte'
</script>

<script lang="ts">
  /**
   * SvMenu - a dropdown / context menu: a trigger opens a portalled, animated
   * menu surface with submenus, separators, icons, shortcuts and full keyboard
   * (arrows, Enter, Escape, ArrowRight/Left for submenus). Portals to <body> so it
   * escapes any clipping. Parity: Smart menu / context-menu.
   *
   * ```svelte
   * <SvMenu items={items} onSelect={(i) => run(i)}>
   *   {#snippet anchor()}<button>Actions</button>{/snippet}
   * </SvMenu>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { createDismissableLayer } from './a11y/dismissable'
  import { getFocusable } from './a11y/focus-trap'
  import { type EditorDir } from './editor-contract'
  import SvMenuList, { type MenuItem } from './SvMenuList.svelte'

  let {
    items,
    open = $bindable(false),
    onOpenChange,
    onSelect,
    ariaLabel,
    anchor,
    dir,
  }: {
    items: ReadonlyArray<MenuItem>
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onSelect?: (item: MenuItem) => void
    ariaLabel?: string
    anchor?: Snippet
    /** Text direction (rtl mirrors the submenu chevron + flips ArrowLeft/Right). */
    dir?: EditorDir
  } = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false, maxHeight: 0, availHeight: 0 })

  function setOpen(v: boolean) { if (v !== open) { open = v; onOpenChange?.(v) } }
  function toggle() { setOpen(!open) }
  function updatePos() {
    if (!anchorEl) return
    rect = anchoredRect(anchorEl.getBoundingClientRect(), { estimatedHeight: Math.min(items.length, 10) * 34 + 8, minWidth: 180 })
  }
  /** Return focus to the trigger. Every dismissal path (Escape, item selection,
   *  outside-click, Tab) funnels through the effect cleanup below, so this
   *  fires uniformly instead of dropping focus to <body> on close. */
  function focusTrigger() {
    if (!anchorEl) return
    ;(getFocusable(anchorEl)[0] ?? anchorEl)?.focus?.()
  }

  $effect(() => {
    if (!open) return
    updatePos()
    queueMicrotask(() => panelEl?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true)
    window.addEventListener('resize', rp)
    // Outside-click dismissal via the shared layer stack (Escape stays owned by
    // SvMenuList's keyboard handling, so closeOnEscape is off here).
    const layer = createDismissableLayer({
      element: () => [anchorEl, panelEl],
      onDismiss: () => setOpen(false),
      closeOnEscape: false,
    })
    layer.activate()
    return () => {
      window.removeEventListener('scroll', rp, true)
      window.removeEventListener('resize', rp)
      layer.release()
      // Only on an actual close (not a mid-open rerun from e.g. `items` changing).
      if (!open) focusTrigger()
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<span
  bind:this={anchorEl}
  class="sv-menu__anchor"
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={toggle}
>
  {@render anchor?.()}
</span>

{#if open}
  <div
    bind:this={panelEl}
    class="sv-menu"
    use:portalToBody
    use:popIn={{ up: rect.openUpward }}
    style:position="fixed"
    style:top={`${rect.top}px`}
    style:left={`${rect.left}px`}
    dir={resolvedDir}
    aria-label={ariaLabel}
  >
    <SvMenuList {items} onclose={() => setOpen(false)} onselect={(i) => onSelect?.(i)} dir={resolvedDir} />
  </div>
{/if}

<style>
  .sv-menu__anchor { display: inline-flex; }
  :global(.sv-menu) {
    z-index: 2147483646; min-width: 180px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
</style>
