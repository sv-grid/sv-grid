<script lang="ts">
  /**
   * SvMaskedInput - a pattern-masked text input (#=digit, A=letter, *=alnum;
   * other chars are literals). Parity: Smart `smart-masked-text-box`. Emits both
   * the masked display value and the raw (unmasked) value.
   *
   * The styled renderer over the headless `createMaskedInput` core; the mask
   * formatting + state live in the core, spread here via prop-getters. The box,
   * size, invalid state, clear button and adornments are owned by SvField's
   * `frame` chrome.
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
    /** Leading adornment (icon/button) inside the field. */
    leading?: Snippet
    /** Trailing adornment (icon/button) inside the field. */
    trailing?: Snippet
    /** Plain-text affix at the start. */
    prefix?: string
    /** Plain-text affix at the end. */
    suffix?: string
    /** @deprecated Use `leading`. */
    prefixIcon?: Snippet
    /** @deprecated Use `trailing`. */
    suffixIcon?: Snippet
    /** Stretch to the container width. */
    block?: boolean
    /** Control width in px (ignored when `block`). Default 200. */
    width?: number
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
    loading = false,
    clearable = false,
    leading,
    trailing,
    prefix,
    suffix,
    prefixIcon,
    suffixIcon,
    block = false,
    width = 200,
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

<SvField
  frame
  id={uid}
  {label}
  {hint}
  {error}
  {required}
  {dir}
  {size}
  {invalid}
  {disabled}
  {readonly}
  {loading}
  {block}
  {width}
  leading={leading ?? prefixIcon}
  trailing={trailing ?? suffixIcon}
  {prefix}
  {suffix}
  clearable={clearable}
  showClear={!!mi.masked}
  onclear={() => { value = ''; onChange?.('', '', false) }}
>
  <input class="sv-masked__input" {...mi.inputProps()} />
  {#if name}<input type="hidden" {name} value={mask ? unmask(mi.masked, mask) : mi.masked} />{/if}
</SvField>

<style>
  .sv-masked__input { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
</style>
