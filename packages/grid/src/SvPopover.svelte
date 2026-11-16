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
   * On a phone it can open as a bottom sheet instead (`sheet`, or for the
   * whole page `setPopoverSheets('phone')`): the screen's width from the
   * bottom up, the page dimmed behind it, a handle to drag it down and
   * close it, and rows a finger can hit.
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
  import { popoverSheets, SHEET_MAX_WIDTH } from './popover-sheets.svelte'

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
    /**
     * Open as a bottom sheet: `true` always, `'phone'` when the window is 600px
     * wide or less, `false` never. Default: the page's `setPopoverSheets` mode.
     * A hover popover never does.
     */
    sheet?: boolean | 'phone'
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
    sheet,
    ariaLabel,
    anchor,
    children,
  }: Props = $props()

  const ARROW = 10

  let windowW = $state(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const asSheet = $derived.by(() => {
    if (trigger === 'hover') return false
    const want = sheet ?? (popoverSheets() === 'phone' ? 'phone' : false)
    return want === true || (want === 'phone' && windowW > 0 && windowW <= SHEET_MAX_WIDTH)
  })
  let backdropEl = $state<HTMLDivElement | null>(null)
  // Dragged down by its handle: it follows the finger, and closes past a fifth of its height (40px to 90px).
  let dragFrom: number | null = null
  let dragBy = $state(0)
  function gripDown(e: PointerEvent) {
    dragFrom = e.clientY
    dragBy = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function gripMove(e: PointerEvent) {
    if (dragFrom == null) return
    dragBy = Math.max(0, e.clientY - dragFrom)
  }
  function gripUp() {
    if (dragFrom == null) return
    const h = panelEl?.getBoundingClientRect().height ?? 300
    // A nudge (under 40px) never closes it, however small the sheet.
    const far = dragBy > Math.min(90, Math.max(40, h / 5))
    dragFrom = null
    dragBy = 0
    if (far) setOpen(false)
  }

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let pos = $state<ComputePositionResult>({
    x: 0, y: 0, placement, side: 'bottom', align: 'start', maxWidth: 0, maxHeight: 0,
  })

  function setOpen(v: boolean) { if (v !== open) { open = v; onOpenChange?.(v) } }
  function toggle() { setOpen(!open) }

  function updatePos() {
    if (!anchorEl || asSheet) return
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
      // The sheet's dimmed page is part of it: a tap there closes it (below), and goes no further.
      element: () => [anchorEl, panelEl, backdropEl],
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

<svelte:window bind:innerWidth={windowW} />

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

{#if open && asSheet}
  <!-- The dimmed page: a tap closes the sheet (Escape does from a keyboard). -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div bind:this={backdropEl} class="sv-pop__backdrop" use:portalToBody onclick={() => setOpen(false)}></div>
{/if}
{#if open}
  <div
    bind:this={panelEl}
    class="sv-pop__panel"
    class:sv-pop__panel--sheet={asSheet}
    use:portalToBody
    use:popIn={{ up: asSheet || pos.side === 'top' }}
    style:position="fixed"
    style:top={asSheet ? undefined : `${pos.y}px`}
    style:left={asSheet ? undefined : `${pos.x}px`}
    style:transform={asSheet && dragBy ? `translateY(${dragBy}px)` : undefined}
    style:min-width={minWidth && !asSheet ? `${minWidth}px` : undefined}
    role="dialog"
    aria-label={ariaLabel ?? anchorFallbackLabel()}
    onpointerenter={onEnter}
    onpointerleave={onLeave}
    onfocusin={onEnter}
    onfocusout={onLeave}
  >
    {#if asSheet}
      <!-- The handle: drag it down to close (Escape does from a keyboard). -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-pop__grip" aria-hidden="true" onpointerdown={gripDown} onpointermove={gripMove} onpointerup={gripUp} onpointercancel={gripUp}><span></span></div>
    {/if}
    {#if arrow && !asSheet}
      <span
        class="sv-pop__arrow sv-pop__arrow--{pos.side}"
        style:left={pos.arrow?.x != null ? `${pos.arrow.x}px` : undefined}
        style:top={pos.arrow?.y != null ? `${pos.arrow.y}px` : undefined}
      ></span>
    {/if}
    <div class="sv-pop__content" style:max-height={!asSheet && pos.maxHeight ? `${pos.maxHeight}px` : undefined}>
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
  /* A bottom sheet (`sheet`): the screen's width, from the bottom, at most three quarters of it high. */
  :global(.sv-pop__backdrop) { position: fixed; inset: 0; z-index: 2147483645; background: rgba(15, 23, 42, 0.32); }
  :global(.sv-pop__panel.sv-pop__panel--sheet) {
    /* Its place wins over anything a panel's own style gives a popover (a margin, a width). */
    inset: auto 0 0 0 !important; margin: 0 !important; max-width: none !important; width: auto !important; box-sizing: border-box;
    max-height: 75vh; display: flex; flex-direction: column;
    border-radius: 16px 16px 0 0; border-bottom: 0; font-size: 15px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -12px 40px -12px rgba(15, 23, 42, 0.35);
  }
  :global(.sv-pop__panel--sheet .sv-pop__content) { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px 16px; }
  :global(.sv-pop__grip) { flex: none; display: flex; justify-content: center; padding: 8px 0 6px; cursor: grab; touch-action: none; }
  :global(.sv-pop__grip span) { width: 40px; height: 5px; border-radius: 3px; background: var(--sg-border, #cbd5e1); }
  /* Rows a finger can hit (44px, WCAG 2.5.5): menu items, options, and the panels' buttons. */
  :global(.sv-pop__panel--sheet :is([role='menuitem'], [role='menuitemradio'], [role='menuitemcheckbox'], [role='option'])) { min-height: 44px; box-sizing: border-box; }
  :global(.sv-pop__panel--sheet :is(button, select, input:not([type='checkbox']):not([type='radio']))) { min-height: 40px; }
  :global(.sv-pop__panel--sheet [role='menu']) { max-height: none; min-width: 0; width: 100%; }
  /* What a panel lays out for a popover's width (a list of views, a filter) takes the sheet's. */
  :global(.sv-pop__panel--sheet .sv-pop__content > *) { width: auto !important; max-width: none !important; min-width: 0 !important; }
</style>
