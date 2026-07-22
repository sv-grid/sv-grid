/**
 * createPasswordInput - the HEADLESS core behind <SvPasswordInput>: a runes-based
 * state machine that owns the reveal toggle + a 4-level strength heuristic,
 * exposed as **prop-getters** you spread onto YOUR OWN markup. No styles, no DOM.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createPasswordInput } from '@svgrid/grid'
 *   let value = $state('')
 *   const pw = createPasswordInput({ value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <input {...pw.inputProps()} />
 * <button {...pw.toggleProps()}>{pw.revealed ? 'Hide' : 'Show'}</button>
 * ```
 *
 * The styled <SvPasswordInput> is just one renderer over this core.
 */
import { editorAria, type EditorAriaState } from './editor-contract'

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

/** Score a password 0-4 by length + character-class variety (pure). */
export function passwordStrength(v: string): number {
  if (!v) return 0
  let score = 0
  if (v.length >= 8) score++
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++
  if (/\d/.test(v)) score++
  if (/[^a-zA-Z0-9]/.test(v)) score++
  return score
}

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type PasswordInputConfig = {
  value: () => string
  onChange?: (value: string) => void
  placeholder?: () => string | undefined
  disabled?: () => boolean
  readonly?: () => boolean
  autocomplete?: () => string | undefined
  // Localizable strings (fall back to the built-in English defaults).
  /** Accessible label for the reveal toggle when the value is hidden. */
  showLabel?: () => string | undefined
  /** Accessible label for the reveal toggle when the value is shown. */
  hideLabel?: () => string | undefined
  /** Strength labels indexed 0-4 (index 0 unused; 1..4 = weak..strong). */
  strengthLabels?: () => readonly string[]
  // Editor contract (ARIA + validation) - folded into inputProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

export function createPasswordInput(config: PasswordInputConfig) {
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false

  let revealed = $state(false)

  const strength = $derived(passwordStrength(config.value()))

  function onInput(e: Event) {
    config.onChange?.((e.currentTarget as HTMLInputElement).value)
  }
  const toggle = () => (revealed = !revealed)

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    /** Whether the value is currently shown as plain text. */
    get revealed() { return revealed },
    /** Strength score, 0-4. */
    get strength() { return strength },
    /** Human label for the strength score (localizable via `strengthLabels`). */
    get strengthLabel() { return (config.strengthLabels?.() ?? STRENGTH_LABELS)[strength] },
    toggle,
    /** Spread onto the text/password input element. */
    inputProps: () => ({
      id: config.id?.(),
      value: config.value(),
      type: (revealed ? 'text' : 'password') as 'text' | 'password',
      placeholder: config.placeholder?.(),
      disabled: disabled(),
      readonly: readonly(),
      autocomplete: (config.autocomplete?.() ?? 'current-password') as AutoFill,
      ...editorAria(ariaState()),
      oninput: onInput,
    }),
    /** Spread onto the reveal (show/hide) toggle button. */
    toggleProps: () => ({
      type: 'button' as const,
      'aria-label': revealed
        ? (config.hideLabel?.() ?? 'Hide password')
        : (config.showLabel?.() ?? 'Show password'),
      'aria-pressed': revealed,
      disabled: disabled(),
      tabindex: -1,
      onclick: toggle,
    }),
  }
}

export type PasswordInputCore = ReturnType<typeof createPasswordInput>
