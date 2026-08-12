<script lang="ts">
  /**
   * SvPopover - a floating panel anchored to a trigger, portalled to <body> so it
   * escapes any `overflow:hidden` ancestor. Open on click (default), hover, or
   * manually via `open`. Positioned by the shared engine (`computePosition`): full
   * placement matrix + flip + shift + an optional arrow, kept in sync with
   * `autoUpdate`. Closes on outside-click / Escape via the dismissable layer
   * stack, and animates in. The panel is hoverable (interactive) under the hover
   * trigger. Parity: Smart popover.
   *
   * ```svelte
   * <SvPopover placement="bottom" arrow>
   *   {#snippet anchor()}<button>Open</button>{/snippet}
   *   <p>Panel content</p>
   * </SvPopover>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { portalToBody, popIn } from './popover'
  import { computePosition, autoUpdate, type Placement, type ComputePositionResult } from './positioning'
  import { createDismissableLayer } from './a11y/dismissable'

  type Props = {
    /** Controlled open state (bindable). */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** How the anchor opens the panel. `manual` = only `open` drives it. */
    trigger?: 'click' | 'hover' | 'manual'
    /** Preferred placement (flips when there is no room). Default `bottom-start`. */
    placement?: Placement
    /** Main-axis gap between trigger and panel. Default 8 (room for the arrow). */
    offset?: number
    /** Render a pointer arrow toward the trigger. Default true. */
    arrow?: boolean
    /** Hover trigger: delay (ms) before opening. Default 0. */
    openDelay?: number
    /** Hover trigger: delay (ms) before closing after leave. Default 120. */
    closeDelay?: number
    /** Estimated panel height, used before the panel has been measured. */
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
    placement = 'bottom-start',
    offset = 8,
    arrow = true,
    openDelay = 0,
    closeDelay = 120,
    estimatedHeight = 220,
    minWidth,
    closeOnOutsideClick = true,
    ariaLabel,
    anchor,
    children,
  }: Props = $props()

  const ARROW = 10

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let pos = $state<ComputePositionResult>({
    x: 0, y: 0, placement, side: 'bottom', align: 'start', maxWidth: 0, maxHeight: 0,
  })

  function setOpen(v: boolean) { if (v !== open) { open = v; onOpenChange?.(v) } }
  function toggle() { setOpen(!open) }

  function updatePos() {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const f = panelEl?.getBoundingClientRect()
    const floating = {
      width: f?.width || minWidth || r.width,
      height: f?.height || estimatedHeight,
    }
    pos = computePosition(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      floating,
      { placement, offset, padding: 8, minMainAxis: 96, arrow: arrow ? { size: ARROW } : undefined },
    )
  }

  // Reposition whenever the trigger/panel resize or an ancestor scrolls, and wire
  // Escape + outside-click dismissal via the shared layer stack (so a popover
  // nested in a dialog closes top-first). Re-runs once `panelEl` mounts.
  $effect(() => {
    if (!open || !anchorEl || !panelEl) return
    const stop = autoUpdate(anchorEl, panelEl, updatePos)
    const layer = createDismissableLayer({
      element: () => [anchorEl, panelEl],
      onDismiss: () => setOpen(false),
      closeOnOutside: closeOnOutsideClick,
    })
    layer.activate()
    return () => { stop(); layer.release() }
  })

  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  function onEnter() {
    if (trigger !== 'hover') return
    clearTimeout(closeTimer)
    if (open) return
    openTimer = setTimeout(() => setOpen(true), openDelay)
  }
  function onLeave() {
    if (trigger !== 'hover') return
    clearTimeout(openTimer)
    closeTimer = setTimeout(() => setOpen(false), closeDelay)
  }

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
    use:popIn={{ up: pos.side === 'top' }}
    style:position="fixed"
    style:top={`${pos.y}px`}
    style:left={`${pos.x}px`}
    style:min-width={minWidth ? `${minWidth}px` : undefined}
    role="dialog"
    aria-label={ariaLabel ?? anchorFallbackLabel()}
    onpointerenter={onEnter}
    onpointerleave={onLeave}
    onfocusin={onEnter}
    onfocusout={onLeave}
  >
    {#if arrow}
      <span
        class="sv-pop__arrow sv-pop__arrow--{pos.side}"
        style:left={pos.arrow?.x != null ? `${pos.arrow.x}px` : undefined}
        style:top={pos.arrow?.y != null ? `${pos.arrow.y}px` : undefined}
      ></span>
    {/if}
    <div class="sv-pop__content" style:max-height={pos.maxHeight ? `${pos.maxHeight}px` : undefined}>
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .sv-pop__anchor { display: inline-flex; }
  :global(.sv-pop__panel) {
    z-index: 2147483646; max-width: min(92vw, 360px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px; line-height: 1.55;
  }
  :global(.sv-pop__content) { padding: 12px 14px; overflow: auto; }
  /* Arrow: a rotated square straddling the panel edge, two borders showing so it
     reads as a continuation of the panel outline. Not clipped (sibling of the
     scrollable content, panel itself has no overflow). */
  :global(.sv-pop__arrow) {
    position: absolute; width: 10px; height: 10px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    transform: rotate(45deg);
  }
  :global(.sv-pop__arrow--bottom) { top: -6px; border-right: 0; border-bottom: 0; }
  :global(.sv-pop__arrow--top) { bottom: -6px; border-left: 0; border-top: 0; }
  :global(.sv-pop__arrow--right) { left: -6px; border-top: 0; border-right: 0; }
  :global(.sv-pop__arrow--left) { right: -6px; border-bottom: 0; border-left: 0; }
</style>
