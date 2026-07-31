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
  /** Span full width in the grid. */
  full?: boolean
}
