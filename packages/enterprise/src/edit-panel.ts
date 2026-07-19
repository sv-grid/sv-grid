/**
 * Edit-panel logic. The testable core behind `SvGridEditPanel.svelte`: build a
 * form's initial values from a schema + row, resolve which control renders each
 * field, validate the whole form, and produce the payload to submit through a
 * `ServerController`'s `createRow` / `updateRow`. Keeping this pure (no Svelte,
 * no DOM) mirrors the pivot designer split and lets it be unit-tested.
 */
import type { RowData } from '@svgrid/grid'
import {
  resolveIdField,
  schemaToFormFields,
  validateEntity,
  validateField,
  type EntitySchema,
  type FormFieldDescriptor,
} from './schema'

export type EditMode = 'create' | 'edit'

/** The native control a field renders as. */
export type ControlKind =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'time'
  | 'checkbox'
  | 'select'
  | 'textarea'

/** Create mode when there's no row to edit, edit mode otherwise. */
export function editMode<TData extends RowData>(row: TData | null | undefined): EditMode {
  return row == null ? 'create' : 'edit'
}

/** Map a field's editor type to the control the panel renders. */
export function controlKind(field: Pick<FormFieldDescriptor, 'editorType'>): ControlKind {
  switch (field.editorType) {
    case 'checkbox':
      return 'checkbox'
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'time':
      return 'time'
    case 'textarea':
      return 'textarea'
    case 'select':
    case 'rich-select':
    case 'list':
    case 'chips':
      return 'select'
    default:
      return 'text'
  }
}

function emptyFor(field: FormFieldDescriptor): unknown {
  return field.type === 'boolean' ? false : ''
}

// --- Editor value coercion --------------------------------------------------
// Pure conversions between the form's stored value and the shape each rich
// editor's `value` / `onChange` expects. Kept here (not inline in the .svelte)
// so the tricky bits - local date formatting, number <-> '' , tag arrays - are
// unit-testable without a DOM.

const _p2 = (n: number) => String(n).padStart(2, '0')

/** A `Date` -> a **local** `yyyy-MM-dd` string (matches the native date input; no UTC shift). */
export function toDateString(d: Date | null | undefined): string {
  return d ? `${d.getFullYear()}-${_p2(d.getMonth() + 1)}-${_p2(d.getDate())}` : ''
}

/** A `Date` -> a **local** `yyyy-MM-ddTHH:mm` string (matches `datetime-local`; no UTC shift). */
export function toDateTimeString(d: Date | null | undefined): string {
  return d ? `${toDateString(d)}T${_p2(d.getHours())}:${_p2(d.getMinutes())}` : ''
}

/** Stored value -> `SvNumberInput.value` (number | null); non-numbers become null. */
export function toNumberValue(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

/** `SvNumberInput.onChange` payload -> stored value; null becomes '' (the empty convention). */
export function fromNumberValue(v: number | null): number | '' {
  return v == null ? '' : v
}

/** Stored value -> `SvSlider.value`; falls back to `min` when unset. */
export function toSliderValue(raw: unknown, min: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : min
}

/** Stored value -> `SvTagsInput.value` (string[]); splits a comma string, else wraps. */
export function toTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t))
  if (raw == null || raw === '') return []
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean)
}

function isEmpty(value: unknown): boolean {
  return value == null || value === ''
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^https?:\/\/.+/

/**
 * Built-in validation from the field's own constraints - number validity,
 * min/max, length, email/url format, regex - so forms validate out of the box
 * without any external library. Returns the first violation, or null.
 */
export function builtInError(field: FormFieldDescriptor, value: unknown): string | null {
  if (isEmpty(value)) return null
  if (field.type === 'number') {
    const n = Number(value)
    if (!Number.isFinite(n)) return `${field.label} must be a number`
    if (field.min != null && n < field.min) return `${field.label} must be at least ${field.min}`
    if (field.max != null && n > field.max) return `${field.label} must be at most ${field.max}`
    return null
  }
  const s = String(value)
  if (field.minLength != null && s.length < field.minLength) {
    return `${field.label} must be at least ${field.minLength} characters`
  }
  if (field.maxLength != null && s.length > field.maxLength) {
    return `${field.label} must be at most ${field.maxLength} characters`
  }
  if (field.format === 'email' && !EMAIL_RE.test(s)) return `${field.label} must be a valid email`
  if (field.format === 'url' && !URL_RE.test(s)) return `${field.label} must be a valid URL`
  if (field.pattern && !new RegExp(field.pattern).test(s)) return `${field.label} is not in the right format`
  return null
}

/**
 * Seed the form's editable state. Uses the row's value when editing, else the
 * field's `defaultValue`, else a type-appropriate empty. Covers every field the
 * form shows (`schemaToFormFields`), including the read-only primary key so it
 * can be displayed.
 */
export function buildInitialValues<TData extends RowData>(
  schema: EntitySchema<TData>,
  row: TData | null | undefined,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const source = (row ?? null) as RowData | null
  for (const f of schemaToFormFields(schema)) {
    if (source && f.field in source) values[f.field] = source[f.field]
    else if (f.defaultValue !== undefined) values[f.field] = f.defaultValue
    else values[f.field] = emptyFor(f)
  }
  return values
}

/**
 * Validate every editable field: required-but-empty first, then the field's
 * Standard Schema validator (if any), then the schema-level cross-field
 * `hooks.validate` (e.g. "end date must be after start date"). Returns a
 * `{ field: message }` map with only the failing fields, so an empty object
 * means the form is valid. Per-field errors take precedence over cross-field.
 */
export async function validateAll<TData extends RowData>(
  schema: EntitySchema<TData>,
  values: Record<string, unknown>,
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}
  for (const f of schemaToFormFields(schema)) {
    if (f.readonly) continue
    const value = values[f.field]
    if (f.required && f.type !== 'boolean' && isEmpty(value)) {
      errors[f.field] = `${f.label} is required`
      continue
    }
    const builtIn = builtInError(f, value)
    if (builtIn) {
      errors[f.field] = builtIn
      continue
    }
    if (!isEmpty(value)) {
      const msg = await validateField(f, value)
      if (msg) errors[f.field] = msg
    }
  }
  // Cross-field rules run last, and never overwrite a per-field error.
  const crossField = await validateEntity(schema, values as Partial<TData>)
  for (const [field, message] of Object.entries(crossField)) {
    if (!errors[field]) errors[field] = message
  }
  return errors
}

function coerceOut(field: FormFieldDescriptor, value: unknown): unknown {
  if (field.type === 'number') {
    if (isEmpty(value)) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (field.type === 'boolean') return value === true || value === 'true'
  return value
}

/**
 * Build the payload to send to `createRow` / `updateRow`. Read-only fields
 * (including the primary key) are never submitted; the id for an update is
 * resolved separately via `rowId`. Values are coerced back to their runtime
 * type (number strings to numbers, checkbox state to booleans).
 */
export function toSubmitValues<TData extends RowData>(
  schema: EntitySchema<TData>,
  values: Record<string, unknown>,
): Partial<TData> {
  const out: Record<string, unknown> = {}
  for (const f of schemaToFormFields(schema)) {
    if (f.readonly) continue
    out[f.field] = coerceOut(f, values[f.field])
  }
  return out as Partial<TData>
}

/** The stable id of the row being edited, as a string (for `updateRow`). */
export function rowId<TData extends RowData>(schema: EntitySchema<TData>, row: TData): string {
  const idField = resolveIdField(schema)
  return String((row as RowData)[idField])
}
