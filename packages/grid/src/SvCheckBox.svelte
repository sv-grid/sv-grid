<script lang="ts">
  /**
   * SvCheckBox - a themed checkbox with an indeterminate state and optional
   * label. Parity: Smart `smart-check-box`. Controlled via `checked` + `onChange`.
   */
  import type { Snippet } from 'svelte'
  import { createCheckbox } from './createCheckbox.svelte'

  type Props = {
    checked?: boolean
    indeterminate?: boolean
    onChange?: (checked: boolean) => void
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    name?: string
    value?: string
    ariaLabel?: string
    children?: Snippet
  }

  let {
    checked = false,
    indeterminate = false,
    onChange,
    disabled = false,
    size = 'md',
    name,
    value,
    ariaLabel,
    children,
  }: Props = $props()

  // The styled checkbox is just a renderer over the headless core. The label
  // fallback depends on `children` (a render concern), so it is computed here.
  const cb = createCheckbox({
    checked: () => checked,
    indeterminate: () => indeterminate,
    onChange: (v) => onChange?.(v),
    disabled: () => disabled,
    ariaLabel: () => ariaLabel ?? (children ? undefined : 'checkbox'),
  })
</script>

<label class="sv-check sv-check--{size}" class:is-disabled={disabled}>
  <button
    class="sv-check__box"
    class:is-checked={checked && !indeterminate}
    class:is-indeterminate={indeterminate}
    {...cb.boxProps()}
  >
    {#if indeterminate}
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>
    {:else if checked}
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    {/if}
  </button>
  {#if children}<span class="sv-check__label">{@render children()}</span>{/if}
  {#if name}<input type="hidden" {name} value={checked ? (value ?? 'true') : ''} />{/if}
</label>

<style>
  .sv-check {
    --_accent: var(--sg-accent, #2563eb);
    --_sz: 18px;
    display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
    font: inherit; font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .sv-check--sm { --_sz: 15px; font-size: 12px; }
  .sv-check--lg { --_sz: 22px; font-size: 15px; }
  .sv-check.is-disabled { opacity: 0.55; cursor: not-allowed; }
  .sv-check__box {
    width: var(--_sz); height: var(--_sz); flex: none; padding: 0; cursor: inherit;
    display: grid; place-items: center;
    background: var(--sg-input-bg, #fff); color: var(--sg-on-accent, #fff);
    border: 1.5px solid var(--sg-border, #cbd5e1); border-radius: 5px; transition: background 0.12s, border-color 0.12s;
  }
  .sv-check__box svg { width: 100%; height: 100%; }
  .sv-check__box.is-checked, .sv-check__box.is-indeterminate {
    background: var(--_accent); border-color: var(--_accent);
  }
  .sv-check__box:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
</style>
