/**
 * createCheckbox - the HEADLESS core behind <SvCheckBox>: a controlled tri-state
 * checkbox (checked / unchecked / indeterminate, ARIA `checkbox` with
 * `aria-checked="mixed"`), exposed as **prop-getters** you spread onto YOUR OWN
 * markup. A native <button> supplies Space/Enter activation.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createCheckbox } from '@svgrid/grid'
 *   let checked = $state(false)
 *   const cb = createCheckbox({ checked: () => checked, onChange: (v) => (checked = v) })
 * </script>
 * <button {...cb.boxProps()}>{cb.checked ? '✓' : ''}</button>
 * ```
 *
 * The styled <SvCheckBox> is just one renderer over this core.
 */
import { editorAria, type EditorAriaState } from './editor-contract'

export type CheckboxConfig = {
  checked: () => boolean
  indeterminate?: () => boolean
  onChange?: (checked: boolean) => void
  disabled?: () => boolean
  // Editor contract (ARIA + validation) - folded into boxProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

export type CheckboxBoxProps = {
  type: 'button'
  role: 'checkbox'
  id: string | undefined
  'aria-checked': boolean | 'mixed'
  'aria-invalid': 'true' | undefined
  'aria-required': 'true' | undefined
  'aria-describedby': string | undefined
  'aria-label': string | undefined
  disabled: boolean
  'data-checked': '' | undefined
  'data-indeterminate': '' | undefined
  onclick: () => void
}

export type Checkbox = {
  /** True only when fully checked (never in the indeterminate state). */
  readonly checked: boolean
  readonly indeterminate: boolean
  readonly disabled: boolean
  /** Indeterminate resolves to checked; otherwise flips checked. */
  toggle: () => void
  /** Spread onto the checkbox element. */
  boxProps: () => CheckboxBoxProps
}

export function createCheckbox(config: CheckboxConfig): Checkbox {
  const checked = () => config.checked()
  const indeterminate = () => config.indeterminate?.() ?? false
  const disabled = () => config.disabled?.() ?? false

  function toggle() {
    if (disabled()) return
    config.onChange?.(indeterminate() ? true : !checked())
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
    get checked() { return checked() },
    get indeterminate() { return indeterminate() },
    get disabled() { return disabled() },
    toggle,
    boxProps: () => ({
      type: 'button',
      role: 'checkbox',
      id: config.id?.(),
      'aria-checked': indeterminate() ? 'mixed' : checked(),
      disabled: disabled(),
      'data-checked': checked() && !indeterminate() ? '' : undefined,
      'data-indeterminate': indeterminate() ? '' : undefined,
      ...editorAria(ariaState()),
      onclick: toggle,
    }),
  }
}
