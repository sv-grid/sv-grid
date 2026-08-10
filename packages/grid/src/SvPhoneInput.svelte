<script lang="ts">
  /**
   * SvPhoneInput - a country dial-code selector + national number field. Parity:
   * Smart `smart-phone-input` (simplified). Emits an E.164-ish string
   * (`+<dial><digits>`). The country list is `countries.ts` (extend for full set).
   *
   * The styled renderer over the headless `createPhoneInput` core; country/number
   * state + parsing live in the core, spread here via prop-getters.
   */
  import { COUNTRIES, flagEmoji } from './countries'
  import SvField from './SvField.svelte'
  import { nextEditorId, resolveMessages, type SvEditorProps } from './editor-contract'
  import { createPhoneInput, type PhoneParts } from './createPhoneInput.svelte'

  /** User-facing strings for the phone input (localizable via `messages`). */
  type PhoneMessages = { country: string }
  const DEFAULT_MESSAGES: PhoneMessages = { country: 'Country' }

  type Props = SvEditorProps & {
    value?: string
    onChange?: (value: string, parts: PhoneParts) => void
    /** Default country ISO code. */
    country?: string
    placeholder?: string
    /** Override the built-in strings (e.g. the country selector aria-label). */
    messages?: Partial<PhoneMessages>
    /** Stretch to the container width. */
    block?: boolean
    /** Control width in px (ignored when `block`). Default 250. */
    width?: number
  }

  let {
    value = $bindable(''),
    onChange,
    country = 'US',
    disabled = false,
    readonly = false,
    placeholder = 'Phone number',
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
    messages,
    block = false,
    width = 250,
  }: Props = $props()

  const autoId = nextEditorId('sv-phone')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const ph = createPhoneInput({
    value: () => value,
    // Write `value` (so `bind:value` works) AND fire `onChange` (callback users).
    onChange: (v, parts) => { value = v; onChange?.(v, parts) },
    country: () => country,
    disabled: () => disabled,
    readonly: () => readonly,
    placeholder: () => placeholder,
    countryLabel: () => M.country,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
    ariaLabel: () => ariaLabel,
  })
</script>

{#snippet countryChip()}
  <span class="sv-phone__country">
    <span class="sv-phone__flag" aria-hidden="true">{ph.flag}</span>
    <span class="sv-phone__dial">{ph.dial}</span>
    <svg class="sv-phone__chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    <select class="sv-phone__select" {...ph.selectProps()}>
      {#each COUNTRIES as c (c.code)}
        <option value={c.code}>{flagEmoji(c.code)} {c.name} ({c.dial})</option>
      {/each}
    </select>
  </span>
{/snippet}

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
  leading={countryChip}
>
  <input class="sv-phone__number" {...ph.inputProps()} />
  {#if name}<input type="hidden" {name} value={ph.value} />{/if}
</SvField>

<style>
  /* A compact country chip in the leading slot: flag + dial + chevron, with the
     native <select> as an invisible overlay covering it. */
  .sv-phone__country {
    position: relative; display: inline-flex; align-items: center; gap: 4px;
    padding-inline-end: 8px; border-inline-end: 1px solid var(--sg-border, #e2e8f0); cursor: pointer;
  }
  .sv-phone__flag { font-size: 15px; }
  .sv-phone__dial { font-size: 13px; font-weight: 600; }
  .sv-phone__chev { color: var(--sg-muted, #64748b); }
  /* The native <select> is an invisible overlay, but its option popup is drawn by
     the OS using the control's own color/background - so theme them explicitly (a
     2-class selector, so it beats SvField frame's generic `select` reset) or dark
     themes get light text on the default white popup. */
  .sv-phone__country .sv-phone__select {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; font-size: 13px; padding: 0;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
  }
  .sv-phone__country .sv-phone__select option { color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); }
</style>
