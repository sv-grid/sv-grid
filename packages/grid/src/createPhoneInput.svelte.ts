/**
 * createPhoneInput - the HEADLESS core behind <SvPhoneInput>: a runes-based
 * state machine that owns the country dial-code + national-number state, parsing
 * an E.164-ish string (`+<dial><digits>`) and re-emitting it. Reuses the pure
 * `./countries` reference and `./datetime/mask` engine. Exposed as **prop-getters**
 * you spread onto YOUR OWN markup. No styles, no DOM.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createPhoneInput } from '@svgrid/grid'
 *   let value = $state('')
 *   const ph = createPhoneInput({ value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <select {...ph.selectProps()}>...</select>
 * <input {...ph.inputProps()} />
 * ```
 *
 * The styled <SvPhoneInput> is just one renderer over this core.
 */
import { COUNTRIES, COUNTRY_BY_CODE, flagEmoji, phoneDigitsValid } from './countries'
import { applyMask } from './datetime/mask'
import { editorAria, type EditorAriaState } from './editor-contract'

/** Emitted alongside the phone value: parsed parts + per-country validity. */
export type PhoneParts = { country: string; dial: string; national: string; valid: boolean; complete: boolean }

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type PhoneInputConfig = {
  value: () => string
  onChange?: (value: string, parts: PhoneParts) => void
  /** Default country ISO code. */
  country?: () => string
  disabled?: () => boolean
  readonly?: () => boolean
  placeholder?: () => string | undefined
  /** Accessible name for the country `<select>` (localizable). */
  countryLabel?: () => string | undefined
  // Editor contract (ARIA + validation) - folded into inputProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

/** Best-effort parse: strip to the longest matching dial code. */
function matchCountry(v: string) {
  return [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => v.startsWith(c.dial))
}

export function createPhoneInput(config: PhoneInputConfig) {
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false

  let iso = $state('US')
  let national = $state('')
  let seeded = false
  let lastVal = ''

  // US/Canada get a friendly national mask; others are plain grouped digits.
  const mask = $derived(COUNTRY_BY_CODE.get(iso)?.dial === '+1' ? '(###) ###-####' : '')
  const dial = $derived(COUNTRY_BY_CODE.get(iso)?.dial ?? '+1')
  const displayNational = $derived(mask ? applyMask(national, mask).formatted : national)

  $effect(() => {
    const v = config.value()
    if (!seeded) {
      seeded = true
      iso = config.country?.() ?? 'US'
      const match = matchCountry(v)
      if (match) { iso = match.code; national = v.slice(match.dial.length) }
      else if (v) national = v.replace(/^\+/, '')
      lastVal = v
      return
    }
    if (v !== lastVal) {
      lastVal = v
      const match = matchCountry(v)
      if (match) { iso = match.code; national = v.slice(match.dial.length) }
    }
  })

  // Per-country length validity: empty is valid (required handles emptiness);
  // a non-empty number must match the country's expected national length.
  const complete = $derived(national.length > 0 && phoneDigitsValid(iso, national))
  const valid = $derived(national.length === 0 || phoneDigitsValid(iso, national))

  function emit() {
    config.onChange?.(`${dial}${national}`, { country: iso, dial, national, valid, complete })
  }
  function onNumberInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '')
    national = raw
    lastVal = `${dial}${raw}`
    emit()
  }
  function onCountryChange(e: Event) {
    iso = (e.currentTarget as HTMLSelectElement).value
    lastVal = `${dial}${national}`
    emit()
  }

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    /** Selected country ISO code. */
    get iso() { return iso },
    /** Dial code for the selected country (e.g. `+1`). */
    get dial() { return dial },
    /** Flag emoji for the selected country. */
    get flag() { return flagEmoji(iso) },
    /** National number formatted for display. */
    get displayNational() { return displayNational },
    /** The full emitted value (`+<dial><digits>`). */
    get value() { return `${dial}${national}` },
    /** Whether the national number is a plausible length for the country. */
    get valid() { return valid },
    /** Whether a non-empty number matches the country's expected length. */
    get complete() { return complete },
    /** Spread onto the country `<select>` element. */
    selectProps: () => ({
      value: iso,
      disabled: disabled(),
      'aria-label': config.countryLabel?.() ?? 'Country',
      onchange: onCountryChange,
    }),
    /** Spread onto the national number input element. */
    inputProps: () => ({
      id: config.id?.(),
      value: displayNational,
      type: 'tel' as const,
      inputmode: 'tel' as const,
      placeholder: config.placeholder?.() ?? 'Phone number',
      disabled: disabled(),
      readonly: readonly(),
      // aria-invalid/required/describedby come from the editor contract; the
      // aria-label default stays 'Phone number' so the field is always named.
      ...editorAria(ariaState()),
      'aria-label': config.ariaLabel?.() ?? 'Phone number',
      oninput: onNumberInput,
    }),
  }
}

export type PhoneInputCore = ReturnType<typeof createPhoneInput>
