<script lang="ts">
  /**
   * SvToggleButton - a button with a pressed on/off state (aria-pressed).
   * Parity: Smart `smart-toggle-button`. Controlled via `pressed` + `onChange`.
   */
  import type { Snippet } from 'svelte'

  type Props = {
    pressed?: boolean
    onChange?: (pressed: boolean) => void
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    ariaLabel?: string
    children?: Snippet
  }

  let { pressed = false, onChange, disabled = false, size = 'md', ariaLabel, children }: Props = $props()

  function toggle() {
    if (disabled) return
    onChange?.(!pressed)
  }
</script>

<button
  type="button"
  class="sv-toggle sv-toggle--{size}"
  class:is-pressed={pressed}
  aria-pressed={pressed}
  aria-label={ariaLabel}
  {disabled}
  onclick={toggle}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  .sv-toggle {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-border, #cbd5e1);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font: inherit; font-weight: 600; line-height: 1;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--_border); border-radius: var(--_radius); cursor: pointer; user-select: none;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .sv-toggle--sm { padding: 5px 10px; font-size: 12px; }
  .sv-toggle--md { padding: 8px 13px; font-size: 13px; }
  .sv-toggle--lg { padding: 11px 17px; font-size: 15px; }
  .sv-toggle:hover:not([disabled]):not(.is-pressed) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-toggle.is-pressed {
    background: var(--_accent); color: var(--sg-on-accent, #fff); border-color: var(--_accent);
  }
  .sv-toggle[disabled] { opacity: 0.55; cursor: not-allowed; }
  .sv-toggle:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
