<script lang="ts">
  /**
   * SvTooltip - a small hover/focus tooltip anchored to its child, portalled to
   * <body> so it is never clipped. Shows after a short delay, hides on leave /
   * blur / Escape, and is wired via `aria-describedby` (role="tooltip") onto the
   * focusable child itself, so AT users get it announced on focus, not just
   * sighted users on hover.
   *
   * ```svelte
   * <SvTooltip text="Delete row"><button aria-label="Delete">🗑</button></SvTooltip>
   * ```
   */
  import type { Snippet } from 'svelte'
  import { portalToBody, popIn } from './popover'
  import { getFocusable } from './a11y/focus-trap'
  import { createTooltip } from './createTooltip.svelte'

  type Props = {
    text: string
    placement?: 'top' | 'bottom'
    /** Show delay in ms. Default 300. */
    delay?: number
    disabled?: boolean
    children?: Snippet
  }

  let { text, placement = 'top', delay = 300, disabled = false, children }: Props = $props()

  let anchorEl = $state<HTMLSpanElement | null>(null)
  let tipEl = $state<HTMLDivElement | null>(null)
  let pos = $state({ top: 0, left: 0, arrowX: 12 })

  // Open state, show-delay and Escape-to-hide live in the shared headless core;
  // this component owns only the DOM concerns (positioning + describedby merge).
  const tip = createTooltip({ text: () => text, disabled: () => disabled, delay: () => delay })
  const tid = tip.tipId

  function place() {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const tipH = tipEl?.offsetHeight ?? 30
    const tipW = tipEl?.offsetWidth ?? 0
    const top = placement === 'top' ? r.top - tipH - 8 : r.bottom + 8
    let left = r.left + r.width / 2 - tipW / 2
    left = Math.max(4, Math.min(left, window.innerWidth - tipW - 4))
    // Keep the arrow under the anchor's center even when the tip is clamped.
    const arrowX = Math.max(10, Math.min(tipW - 10, r.left + r.width / 2 - left))
    pos = { top, left, arrowX }
  }

  // Reposition while open (and on scroll/resize). Escape-to-hide is the core's.
  $effect(() => {
    if (!tip.open) return
    queueMicrotask(place)
    const rp = () => place()
    window.addEventListener('scroll', rp, true)
    window.addEventListener('resize', rp)
    return () => {
      window.removeEventListener('scroll', rp, true)
      window.removeEventListener('resize', rp)
    }
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
    class="sv-tip"
    role="tooltip"
    use:portalToBody
    use:popIn={{ up: placement === 'top', duration: 110, scale: 0.9 }}
    class:sv-tip--bottom={placement === 'bottom'}
    style:position="fixed"
    style:top={`${pos.top}px`}
    style:left={`${pos.left}px`}
    style:--tip-arrow-x={`${pos.arrowX}px`}
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
  :global(.sv-tip__arrow) {
    position: absolute; inset-inline-start: var(--tip-arrow-x, 12px); width: 8px; height: 8px;
    background: var(--sg-fg, #0f172a); transform: translateX(-50%) rotate(45deg);
  }
  :global(.sv-tip:not(.sv-tip--bottom) .sv-tip__arrow) { bottom: -3px; }
  :global(.sv-tip--bottom .sv-tip__arrow) { top: -3px; }
</style>
