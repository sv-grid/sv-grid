import type { Validator } from './validators'

/**
 * Field descriptor for <SvForm> and the headless `createForm` core. Kept in a
 * plain `.ts` module so the core can import the type without pulling in the
 * `.svelte` component (which would create a `.svelte.ts` -> `.svelte` import
 * cycle Vite's dev import-analysis fails to resolve).
 */
export type FormFieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'password'
  | 'select' | 'checkbox' | 'switch' | 'date' | 'color' | 'rating'
  | 'array'

export type FormField = {
  name: string
  label: string
  type?: FormFieldType
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string | number; label: string; color?: string }>
  /** Declarative validation rules (see `rules` - email/pattern/min/compare...). */
  rules?: ReadonlyArray<Validator>
  /** Return an error message, or null/undefined when valid. */
  validate?: (value: any, values: Record<string, any>) => string | null | undefined
  /**
   * Async validator (e.g. "is this username taken?"). Runs after the sync checks
   * pass, debounced (`asyncDebounce`, default 300ms) and stale-guarded so only the
   * latest result wins. While it runs, `form.isValidating(name)` is true and the
   * field shows a checking indicator. Submit waits for all async validators.
   */
  asyncValidate?: (value: any, values: Record<string, any>) => Promise<string | null | undefined>
  /** Debounce (ms) before `asyncValidate` runs on edit. Default 300. */
  asyncDebounce?: number
  /** Span full width in the grid. */
  full?: boolean
  /**
   * Show the field only when this is `true` / returns `true` (default: always).
   * A field derived from other values, e.g. `visible: (v) => v.hasAddress`.
   * Hidden fields are skipped in validation and excluded from the submitted values.
   */
  visible?: boolean | ((values: Record<string, any>) => boolean)
  /** Disable the field, statically or derived from other values. */
  disabled?: boolean | ((values: Record<string, any>) => boolean)
  /**
   * For `type: 'array'` - the fields of each repeatable item. The value is an
   * array of item objects; each item's fields validate against that item (so
   * cross-field rules within a row work). `required`/`minItems`/`maxItems` gate
   * the array length.
   */
  itemFields?: ReadonlyArray<FormField>
  /** Label for the "add item" button of an array field. Default "+ Add". */
  addLabel?: string
  /** Min / max item count for an array field. */
  minItems?: number
  maxItems?: number
}

/**
 * A group of fields rendered as a titled fieldset - and, when `<SvForm stepper>`
 * is set, as one step of a wizard. Use in place of a plain `FormField` inside the
 * `fields` array; the schema may freely mix flat fields and sections.
 */
export type FormSection = {
  section: string
  description?: string
  fields: ReadonlyArray<FormField>
  /** Column count for this section's grid (defaults to the form's `columns`). */
  columns?: number
}

/** An entry in a form schema: either a single field or a titled section/step. */
export type FormEntry = FormField | FormSection

/** Narrow a schema entry to a section (has a `fields` array). */
export function isFormSection(e: FormEntry): e is FormSection {
  return Array.isArray((e as FormSection).fields)
}

/** Flatten a mixed schema (fields + sections) to the flat list of fields. */
export function flattenFields(entries: ReadonlyArray<FormEntry>): FormField[] {
  const out: FormField[] = []
  for (const e of entries) {
    if (isFormSection(e)) out.push(...e.fields)
    else out.push(e)
  }
  return out
}
