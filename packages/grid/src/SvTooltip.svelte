<script lang="ts">
  /**
   * SvTooltip - a small hover/focus tooltip anchored to its child, portalled to
   * <body> so it is never clipped. Positioned by the shared engine (full placement
   * matrix + flip + shift + arrow), shows after a short delay, hides on leave /
   * blur / Escape, and is wired via `aria-describedby` (role="tooltip") onto the
   * focusable child itself, so AT users get it announced on focus, not just
   * sighted users on hover.
   *
   * Set `group` on several tooltips so scanning between them skips the re-delay,
   * `closeDelay` + `interactive` for a hoverable tip (e.g. one with a link).
   *
   * ```svelte
   * <SvTooltip text="Delete row"><button aria-label="Delete">🗑</button></SvTooltip>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { portalToBody, popIn } from './popover'
  import { computePosition, autoUpdate, type Placement, type ComputePositionResult } from './positioning'
  import { getFocusable } from './a11y/focus-trap'
  import { createTooltip } from './createTooltip.svelte'

  type Props = {
    text: string
    /** Preferred placement; flips when there is no room. Default `top`. */
    placement?: Placement
    /** Show delay in ms. Default 300. */
    delay?: number
    /** Hide delay in ms after leave (give it room for an interactive tip). Default 0. */
    closeDelay?: number
    /** Delay-group id: grouped tooltips open instantly while the group is warm. */
    group?: string
    /** Let the pointer move onto the tip without closing it (e.g. a tip with a link). */
    interactive?: boolean
    disabled?: boolean
    children?: Snippet
  }

  let {
    text,
    placement = 'top',
    delay = 300,
    closeDelay = 0,
    group,
    interactive = false,
    disabled = false,
    children,
  }: Props = $props()

  const ARROW = 8

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let tipEl = $state<HTMLDivElement | null>(null)
  let pos = $state<ComputePositionResult>({
    x: 0, y: 0, placement, side: 'top', align: 'center', maxWidth: 0, maxHeight: 0, arrow: { x: 12 },
  })

  // Open state, show/close delay, delay-group and Escape-to-hide live in the
  // shared headless core; this component owns only the DOM concerns (positioning
  // + describedby merge). Interactive tips get a small closeDelay by default so
  // the pointer can travel from anchor to tip.
  const tip = createTooltip({
    text: () => text,
    disabled: () => disabled,
    delay: () => delay,
    closeDelay: () => (closeDelay || (interactive ? 120 : 0)),
    group: () => group,
  })
  const tid = tip.tipId

  function place() {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const floating = { width: tipEl?.offsetWidth || 0, height: tipEl?.offsetHeight || 30 }
    pos = computePosition(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      floating,
      { placement, offset: 8, padding: 4, arrow: { size: ARROW } },
    )
  }

  // Reposition while open (measure the tip after it mounts, then keep in sync).
  $effect(() => {
    if (!tip.open || !anchorEl || !tipEl) return
    queueMicrotask(place)
    const stop = autoUpdate(anchorEl, tipEl, place)
    return () => stop()
  })

  // The wrapper span above is never itself Tab-focusable, so putting
  // aria-describedby only on it does nothing for keyboard/AT users - they
  // focus the real interactive child (e.g. the <button> in the doc example),
  // and that's the element whose accessible description actually gets
  // announced. Mirror the id onto that child too, merging with (and later
  // restoring) any aria-describedby it already carries.
  $effect(() => {
    if (!tip.open || !anchorEl) return
    const child = getFocusable(anchorEl)[0]
    if (!child) return
    const before = child.getAttribute('aria-describedby')
    const ids = new Set((before ?? '').split(/\s+/).filter(Boolean))
    ids.add(tid)
    child.setAttribute('aria-describedby', [...ids].join(' '))
    return () => {
      const remaining = (child.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((id) => id && id !== tid)
      if (remaining.length) child.setAttribute('aria-describedby', remaining.join(' '))
      else child.removeAttribute('aria-describedby')
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={anchorEl}
  class="sv-tip__anchor"
  {...tip.anchorProps()}
>
  {@render children?.()}
</span>

{#if tip.open}
  <div
    bind:this={tipEl}
    id={tid}
    class="sv-tip sv-tip--{pos.side}"
    class:sv-tip--interactive={interactive}
    role="tooltip"
    use:portalToBody
    use:popIn={{ up: pos.side === 'top', duration: 110, scale: 0.9 }}
    style:position="fixed"
    style:top={`${pos.y}px`}
    style:left={`${pos.x}px`}
    style:--tip-arrow-x={pos.arrow?.x != null ? `${pos.arrow.x}px` : undefined}
    style:--tip-arrow-y={pos.arrow?.y != null ? `${pos.arrow.y}px` : undefined}
    onpointerenter={interactive ? tip.keepOpen : undefined}
    onpointerleave={interactive ? tip.scheduleHide : undefined}
  >{text}<span class="sv-tip__arrow" aria-hidden="true"></span></div>
{/if}

<style>
  .sv-tip__anchor { display: inline-flex; }
  :global(.sv-tip) {
    z-index: 2147483647; pointer-events: none; position: relative;
    max-width: 240px; padding: 5px 9px; font-size: 12px; line-height: 1.4; font-weight: 500;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff);
    border-radius: 6px; box-shadow: 0 6px 20px -6px rgba(15, 23, 42, 0.5); white-space: normal;
  }
  :global(.sv-tip--interactive) { pointer-events: auto; }
  :global(.sv-tip__arrow) {
    position: absolute; width: 8px; height: 8px;
    background: var(--sg-fg, #0f172a); transform: rotate(45deg);
  }
  /* Arrow sits on the edge facing the anchor. top/bottom use --tip-arrow-x,
     left/right use --tip-arrow-y. */
  :global(.sv-tip--top .sv-tip__arrow) { bottom: -3px; inset-inline-start: var(--tip-arrow-x, 12px); }
  :global(.sv-tip--bottom .sv-tip__arrow) { top: -3px; inset-inline-start: var(--tip-arrow-x, 12px); }
  :global(.sv-tip--left .sv-tip__arrow) { right: -3px; top: var(--tip-arrow-y, 12px); }
  :global(.sv-tip--right .sv-tip__arrow) { left: -3px; top: var(--tip-arrow-y, 12px); }
</style>
