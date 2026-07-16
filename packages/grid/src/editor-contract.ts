/**
 * The shared "editor contract" for the SvGrid UI kit.
 *
 * Every value-bearing editor (inputs, selects, pickers) accepts this common set
 * of props so forms, validation and accessibility behave IDENTICALLY across the
 * kit - the same spirit as the grid's headless core, applied to the editors.
 * Components spread their own `value` / options / behavior on top of this base.
 *
 * Framework-free (no Svelte, no DOM) so it can be unit-tested and reused.
 */

export type EditorSize = 'sm' | 'md' | 'lg'

/** Props shared by every value-bearing editor in the kit. */
export type SvEditorProps = {
  /** Disable interaction + form submission. */
  disabled?: boolean
  /** Read-only: the value is shown but not editable. */
  readonly?: boolean
  /** Required for validation (adds `aria-required` + participates in validity). */
  required?: boolean
  /** Marks the control invalid (`aria-invalid` + error styling). */
  invalid?: boolean
  /** Error message; when set it is announced via `aria-describedby` and shown. */
  error?: string
  /** Control size / density. */
  size?: EditorSize
  /** Form field name; the editor emits a hidden input carrying its value. */
  name?: string
  /** Root/control element id (the error-text id derives from it). */
  id?: string
  /** Accessible name when there is no visible `<label>`. */
  ariaLabel?: string
}

/** Stable DOM id for an editor's error text, for `aria-describedby` wiring. */
export const editorErrorId = (id?: string): string | undefined => (id ? `${id}__error` : undefined)

/** A subset of {@link SvEditorProps} that drives ARIA on the focusable control. */
export type EditorAriaState = Pick<SvEditorProps, 'id' | 'invalid' | 'required' | 'error' | 'ariaLabel'>

/**
 * ARIA attributes for the focusable control of an editor, derived from its state.
 * Spread onto the input/button/combobox:
 * `<input {...editorAria({ id, invalid, required, error, ariaLabel })} />`
 * Undefined values are omitted by Svelte, so unset props add no attributes.
 */
export function editorAria(state: EditorAriaState): {
  'aria-invalid': 'true' | undefined
  'aria-required': 'true' | undefined
  'aria-describedby': string | undefined
  'aria-label': string | undefined
} {
  return {
    'aria-invalid': state.invalid ? 'true' : undefined,
    'aria-required': state.required ? 'true' : undefined,
    'aria-describedby': state.error ? editorErrorId(state.id) : undefined,
    'aria-label': state.ariaLabel,
  }
}
