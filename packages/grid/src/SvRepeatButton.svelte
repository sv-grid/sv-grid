<script lang="ts">
  /**
   * SvRepeatButton - fires `onclick` repeatedly while held down (after an
   * initial delay, then at a steady interval). Parity: Smart `smart-repeat-button`.
   * Used for spinners / steppers.
   */
  import type { Snippet } from 'svelte'

  type Props = {
    onclick?: () => void
    /** Delay before repeats begin (ms). */
    delay?: number
    /** Interval between repeats (ms). */
    interval?: number
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    ariaLabel?: string
    /** False: the button never takes focus or a Tab stop, so pressing it keeps
     *  focus in the field it steps (a spinner beside an input). Default true. */
    focusable?: boolean
    children?: Snippet
  }

  let {
    onclick,
    delay = 300,
    interval = 60,
    disabled = false,
    size = 'md',
    variant = 'secondary',
    ariaLabel,
    focusable = true,
    children,
  }: Props = $props()

  let delayTimer: ReturnType<typeof setTimeout> | null = null
  let repeatTimer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (delayTimer) { clearTimeout(delayTimer); delayTimer = null }
    if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null }
  }

  function start(e: PointerEvent) {
    if (disabled || e.button !== 0) return
    // Keep focus where it is (the input this button steps), so a click does
    // not blur the field: preventing pointerdown's default suppresses the
    // mousedown that would move focus.
    if (!focusable) e.preventDefault()
    onclick?.() // fire once immediately
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(() => onclick?.(), Math.max(16, interval))
    }, Math.max(0, delay))
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); onclick?.() }
  }
</script>

<svelte:window onpointerup={stop} onpointercancel={stop} />

<button
  type="button"
  class="sv-btn sv-btn--{variant} sv-btn--{size} sv-repeat"
  {disabled}
  aria-label={ariaLabel}
  tabindex={focusable ? undefined : -1}
  onpointerdown={start}
  onpointerleave={stop}
  onkeydown={onKeydown}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  /* Reuses the SvButton visual language (kept local so it works standalone). */
  .sv-btn {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-border, #cbd5e1);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font: inherit; font-weight: 600; line-height: 1; border: 1px solid transparent;
    border-radius: var(--_radius); cursor: pointer; user-select: none; touch-action: none;
  }
  .sv-btn--sm { padding: 5px 9px; font-size: 12px; }
  .sv-btn--md { padding: 8px 12px; font-size: 13px; }
  .sv-btn--lg { padding: 11px 16px; font-size: 15px; }
  .sv-btn[disabled] { opacity: 0.55; cursor: not-allowed; }
  .sv-btn--primary { background: var(--_accent); color: var(--sg-on-accent, #fff); }
  .sv-btn--secondary { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); border-color: var(--_border); }
  .sv-btn--outline { background: transparent; color: var(--_accent); border-color: var(--_accent); }
  .sv-btn--ghost { background: transparent; color: var(--sg-fg, #0f172a); }
  .sv-btn:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
  .sv-btn:active { transform: translateY(0.5px); }
</style>
