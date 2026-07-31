<script lang="ts">
  /**
   * SvMaskedInput - a pattern-masked text input (#=digit, A=letter, *=alnum;
   * other chars are literals). Parity: Smart `smart-masked-text-box`. Emits both
   * the masked display value and the raw (unmasked) value.
   *
   * The styled renderer over the headless `createMaskedInput` core; the mask
   * formatting + state live in the core, spread here via prop-getters.
   */
  import type { Snippet } from 'svelte'
  import { unmask } from './datetime/mask'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'
  import { createMaskedInput } from './createMaskedInput.svelte'

  type Props = SvEditorProps & {
    value?: string
    /** Called with (masked, raw, complete). */
    onChange?: (masked: string, raw: string, complete: boolean) => void
    mask?: string
    placeholder?: string
    /** Show a clear (x) button when there is a value. */
    clearable?: boolean
    /** Leading / trailing icon adornments. */
    prefixIcon?: Snippet
    suffixIcon?: Snippet
  }

  let {
    value = $bindable(''),
    onChange,
    mask = '',
    placeholder,
    disabled = false,
    readonly = false,
    name,
    size = 'md',
    ariaLabel,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
    clearable = false,
    prefixIcon,
    suffixIcon,
  }: Props = $props()

  const autoId = nextEditorId('sv-mask')
  const uid = $derived(id ?? autoId)

  const mi = createMaskedInput({
    value: () => value,
    // Write the masked `value` (so `bind:value` works) AND fire `onChange`.
    onChange: (m, r, c) => { value = m; onChange?.(m, r, c) },
    mask: () => mask,
    placeholder: () => placeholder,
    disabled: () => disabled,
    readonly: () => readonly,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel,
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-masked sv-masked--{size}" class:is-invalid={invalid} class:is-disabled={disabled}>
    {#if prefixIcon}<span class="sv-masked__adorn">{@render prefixIcon()}</span>{/if}
    <input class="sv-masked__input" {...mi.inputProps()} />
    {#if clearable && mi.masked && !disabled && !readonly}
      <button type="button" class="sv-masked__clear" aria-label="Clear" tabindex="-1" onclick={() => { value = ''; onChange?.('', '', false) }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    {/if}
    {#if suffixIcon}<span class="sv-masked__adorn">{@render suffixIcon()}</span>{/if}
    {#if name}<input type="hidden" {name} value={mask ? unmask(mi.masked, mask) : mi.masked} />{/if}
  </div>
</SvField>

<style>
  .sv-masked {
    --_accent: var(--sg-accent, #2563eb);
    box-sizing: border-box; width: 200px; display: inline-flex; align-items: center; gap: 6px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; padding: 0 8px 0 10px;
  }
  .sv-masked--sm { height: 28px; font-size: 12px; }
  .sv-masked--md { height: 34px; font-size: 13px; }
  .sv-masked--lg { height: 40px; font-size: 15px; }
  .sv-masked:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-masked.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-masked.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-masked.is-disabled { opacity: 0.6; }
  .sv-masked__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit;
    font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
  }
  .sv-masked__adorn { display: inline-flex; flex: none; color: var(--sg-muted, #64748b); }
  .sv-masked__clear { display: grid; place-items: center; width: 20px; flex: none; background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 4px; }
  .sv-masked__clear:hover { color: var(--sg-danger, #dc2626); }
</style>
