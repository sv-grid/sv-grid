<script lang="ts">
  /**
   * SvPopover - a floating panel anchored to a trigger, portalled to <body> so it
   * escapes any `overflow:hidden` ancestor. Open on click (default), hover, or
   * manually via `open`. Flips above the trigger when there's no room below,
   * closes on outside-click / Escape, and animates in. Parity: Smart popover.
   *
   * ```svelte
   * <SvPopover>
   *   {#snippet anchor()}<button>Open</button>{/snippet}
   *   <p>Panel content</p>
   * </SvPopover>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { anchoredRect, portalToBody, popIn, type AnchoredRect } from './popover'
  import { createDismissableLayer } from './a11y/dismissable'

  type Props = {
    /** Controlled open state (bindable). */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** How the anchor opens the panel. `manual` = only `open` drives it. */
    trigger?: 'click' | 'hover' | 'manual'
    /** Estimated panel height for flip decisions. */
    estimatedHeight?: number
    /** Force a minimum panel width (else it hugs its content). */
    minWidth?: number
    /** Close when clicking outside. Default true. */
    closeOnOutsideClick?: boolean
    ariaLabel?: string
    /** The anchor element(s) that open the panel. */
    anchor?: Snippet
    /** Panel content. */
    children?: Snippet
  }

  let {
    open = $bindable(false),
    onOpenChange,
    trigger = 'click',
    estimatedHeight = 220,
    minWidth,
    closeOnOutsideClick = true,
    ariaLabel,
    anchor,
    children,
  }: Props = $props()

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let rect = $state<AnchoredRect>({ top: 0, left: 0, width: 0, openUpward: false })

  function setOpen(v: boolean) { if (v !== open) { open = v; onOpenChange?.(v) } }
  function toggle() { setOpen(!open) }

  function updatePos() {
    if (!anchorEl) return
    rect = anchoredRect(anchorEl.getBoundingClientRect(), { estimatedHeight, minWidth })
  }

  $effect(() => {
    if (!open) return
    updatePos()
    const rp = () => updatePos()
    window.addEventListener('scroll', rp, true)
    window.addEventListener('resize', rp)
    // Escape + outside-click dismissal via the shared layer stack (so a popover
    // nested in a dialog closes top-first). The trigger is passed alongside the
    // panel so clicking it toggles rather than dismiss-then-reopen.
    const layer = createDismissableLayer({
      element: () => [anchorEl, panelEl],
      onDismiss: () => setOpen(false),
      closeOnOutside: closeOnOutsideClick,
    })
    layer.activate()
    return () => {
      window.removeEventListener('scroll', rp, true)
      window.removeEventListener('resize', rp)
      layer.release()
    }
  })

  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  function onEnter() { if (trigger === 'hover') { clearTimeout(hoverTimer); setOpen(true) } }
  function onLeave() { if (trigger === 'hover') { hoverTimer = setTimeout(() => setOpen(false), 120) } }

  /** Fallback accessible name for the panel when `ariaLabel` isn't given: the
   * anchor's own aria-label, else its trimmed text content. */
  function anchorFallbackLabel(): string | undefined {
    const label = anchorEl?.getAttribute('aria-label')
    if (label) return label
    return anchorEl?.textContent?.trim() || undefined
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={anchorEl}
  class="sv-pop__anchor"
  onclick={() => trigger === 'click' && toggle()}
  onpointerenter={onEnter}
  onpointerleave={onLeave}
  onfocusin={onEnter}
  onfocusout={onLeave}
>
  {@render anchor?.()}
</span>

{#if open}
  <div
    bind:this={panelEl}
    class="sv-pop__panel"
    use:portalToBody
    use:popIn={{ up: rect.openUpward }}
    style:position="fixed"
    style:top={`${rect.top}px`}
    style:left={`${rect.left}px`}
    style:min-width={minWidth ? `${rect.width}px` : undefined}
    role="dialog"
    aria-label={ariaLabel ?? anchorFallbackLabel()}
    onpointerenter={onEnter}
    onpointerleave={onLeave}
    onfocusin={onEnter}
    onfocusout={onLeave}
  >
    {@render children?.()}
  </div>
{/if}

<style>
  .sv-pop__anchor { display: inline-flex; }
  :global(.sv-pop__panel) {
    z-index: 2147483646; max-width: min(92vw, 360px); padding: 12px 14px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px; line-height: 1.55;
  }
</style>
