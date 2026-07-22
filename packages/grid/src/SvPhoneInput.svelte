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
  }

  let {
    value = '',
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
    messages,
  }: Props = $props()

  const autoId = nextEditorId('sv-phone')
  const uid = $derived(id ?? autoId)
  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))

  const ph = createPhoneInput({
    value: () => value,
    onChange: (v, parts) => onChange?.(v, parts),
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

<SvField id={uid} {label} {hint} {error} {required} {dir}>
<div class="sv-phone sv-phone--{size}" class:is-disabled={disabled} class:is-invalid={invalid}>
  <div class="sv-phone__country">
    <span class="sv-phone__flag" aria-hidden="true">{ph.flag}</span>
    <span class="sv-phone__dial">{ph.dial}</span>
    <select class="sv-phone__select" {...ph.selectProps()}>
      {#each COUNTRIES as c (c.code)}
        <option value={c.code}>{flagEmoji(c.code)} {c.name} ({c.dial})</option>
      {/each}
    </select>
    <svg class="sv-phone__chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
  </div>
  <input class="sv-phone__number" {...ph.inputProps()} />
  {#if name}<input type="hidden" {name} value={ph.value} />{/if}
</div>
</SvField>

<style>
  .sv-phone {
    --_accent: var(--sg-accent, #2563eb);
    display: inline-flex; align-items: stretch; width: 250px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    overflow: hidden;
  }
  .sv-phone:focus-within { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-phone.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-phone.is-invalid:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  .sv-phone.is-disabled { opacity: 0.6; }
  .sv-phone__country {
    position: relative; display: inline-flex; align-items: center; gap: 4px;
    padding-block: 0; padding-inline: 10px 6px; border-inline-end: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc); cursor: pointer;
  }
  .sv-phone__flag { font-size: 15px; }
  .sv-phone__dial { font-size: 13px; font-weight: 600; }
  .sv-phone__chev { color: var(--sg-muted, #64748b); }
  /* The native <select> is an invisible overlay, but its option popup is drawn by
     the OS using the control's own color/background - so theme them explicitly or
     dark themes get light text on the default white popup. */
  .sv-phone__select {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; font-size: 13px;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
  }
  .sv-phone__select option { color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); }
  .sv-phone__number { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: inherit; font: inherit; padding: 0 10px; }
  .sv-phone--sm { height: 28px; font-size: 12px; }
  .sv-phone--md { height: 34px; font-size: 13px; }
  .sv-phone--lg { height: 40px; font-size: 15px; }
</style>
