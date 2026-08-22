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
  type ValidationRuleSpec,
} from './schema.js'
import { evaluatePredicate } from './expressions/evaluate.js'
import type { PredicateExpr } from './expressions/expression-types.js'

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
 * Evaluate one of a field's `when` conditions against the values currently in
 * the form. A malformed condition falls back rather than throwing: a bad rule
 * should not make the form unusable, and the safe answer differs per flag
 * (a field stays visible, stays enabled, keeps its static required flag).
 */
function test(expr: PredicateExpr | undefined, values: Record<string, unknown>, fallback: boolean): boolean {
  if (!expr) return fallback
  try {
    const result = evaluatePredicate(expr, { row: values })
    // An unrecognised node evaluates to undefined rather than throwing, so a
    // non-boolean answer counts as "no opinion" and takes the fallback too.
    return typeof result === 'boolean' ? result : fallback
  } catch {
    return fallback
  }
}

/** Whether a field is shown, editable, and demanded, for the current values. */
export type FieldState = { visible: boolean; disabled: boolean; required: boolean }

/**
 * Resolve a field's live state from its `when` conditions. Read-only always
 * wins over a `disabled` condition, and `when.required` replaces the static
 * `required` flag rather than adding to it, so a rule can make a normally
 * required field optional as well as the other way round.
 */
export function fieldState(field: FormFieldDescriptor, values: Record<string, unknown>): FieldState {
  return {
    visible: test(field.when?.visible, values, true),
    disabled: field.readonly || test(field.when?.disabled, values, false),
    required: field.when?.required ? test(field.when.required, values, false) : field.required,
  }
}

/** Whether a form section's `visibleWhen` holds for the current values. */
export function sectionVisible(expr: PredicateExpr, values: Record<string, unknown>): boolean {
  return test(expr, values, true)
}

/** The fields the form currently shows, in order. */
export function visibleFormFields<TData extends RowData>(
  schema: EntitySchema<TData>,
  values: Record<string, unknown>,
): FormFieldDescriptor[] {
  return schemaToFormFields(schema).filter((f) => fieldState(f, values).visible)
}

/** True when any field's behaviour depends on the values (i.e. has a `when`). */
export function hasFieldConditions<TData extends RowData>(schema: EntitySchema<TData>): boolean {
  return schema.fields.some((f) => !!f.when && (!!f.when.visible || !!f.when.disabled || !!f.when.required))
}

/**
 * Drop the values of fields hidden by a `when.visible` condition.
 *
 * The edit panel already leaves them out via `toSubmitValues`; a server that
 * builds its own payload (the generated SSR route reads a `FormData`) runs it
 * through this so both paths write exactly the same fields. Without it, a field
 * the user could not see would still be saved from a posted form.
 */
export function stripHiddenValues<TData extends RowData>(
  schema: EntitySchema<TData>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (!hasFieldConditions(schema)) return values
  const out: Record<string, unknown> = {}
  const shown = new Set(visibleFormFields(schema, values).map((f) => f.field))
  for (const [field, value] of Object.entries(values)) {
    if (!schema.fields.some((f) => f.field === field) || shown.has(field)) out[field] = value
  }
  return out
}

/**
 * Run the schema's no-code validation rules (`EntitySchema.validations`).
 *
 * These already compile into the generated app's server-side `hooks.validate`;
 * this is the matching interpreter, so the same rule also fires live in the edit
 * panel and the designer preview instead of only after a round-trip to a
 * generated server. The comparisons mirror `compileValidation` in
 * `studio/emit-schema.ts` exactly - string equality for eq/ne, numeric ordering
 * for lt/lte/gt/gte, length for minLen/maxLen - so a rule cannot mean one thing
 * in the form and another on the server.
 */
export function evalValidationRules(rules: ReadonlyArray<ValidationRuleSpec>, values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const rule of rules) {
    if (errors[rule.field]) continue // first failing rule per field wins
    const left = values[rule.field]
    const num = () => (rule.compareTo ? Number(values[rule.compareTo]) : Number(rule.value))
    const str = () => (rule.compareTo ? String(values[rule.compareTo]) : String(rule.value ?? ''))
    const len = String(left ?? '').length
    let holds: boolean
    switch (rule.op) {
      case 'eq': holds = String(left) === str(); break
      case 'ne': holds = String(left) !== str(); break
      case 'lt': holds = Number(left) < num(); break
      case 'lte': holds = Number(left) <= num(); break
      case 'gt': holds = Number(left) > num(); break
      case 'gte': holds = Number(left) >= num(); break
      case 'required': holds = left != null && left !== ''; break
      case 'maxLen': holds = len <= Number(rule.value); break
      case 'minLen': holds = len >= Number(rule.value); break
      default: holds = true
    }
    if (!holds) errors[rule.field] = rule.message
  }
  return errors
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
 * The error for one field, or null. Required-but-empty first, then the field's
 * own constraints, then its Standard Schema validator. Read-only and
 * condition-hidden fields never produce one: the user cannot act on them, so an
 * error there would be a dead end.
 *
 * Shared by whole-form validation and by the panel's on-blur check, so a field
 * cannot pass one and fail the other.
 */
async function fieldError(f: FormFieldDescriptor, values: Record<string, unknown>): Promise<string | null> {
  if (f.readonly) return null
  const state = fieldState(f, values)
  if (!state.visible) return null
  const value = values[f.field]
  if (state.required && f.type !== 'boolean' && isEmpty(value)) return `${f.label} is required`
  const builtIn = builtInError(f, value)
  if (builtIn) return builtIn
  if (!isEmpty(value)) return (await validateField(f, value)) ?? null
  return null
}

/**
 * Validate a single field, for checking as the user leaves it rather than making
 * them submit to find out. Includes the schema-level rules that name this field,
 * so a cross-field rule surfaces on the field it blames.
 */
export async function validateOne<TData extends RowData>(
  schema: EntitySchema<TData>,
  field: string,
  values: Record<string, unknown>,
): Promise<string | null> {
  const descriptor = schemaToFormFields(schema).find((f) => f.field === field)
  if (!descriptor) return null
  const own = await fieldError(descriptor, values)
  if (own) return own
  if (schema.validations?.length) {
    const byRule = evalValidationRules(schema.validations, values)[field]
    if (byRule) return byRule
  }
  return (await validateEntity(schema, values as Partial<TData>))[field] ?? null
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
    const msg = await fieldError(f, values)
    if (msg) errors[f.field] = msg
  }
  // No-code rules, then the cross-field hook. Neither overwrites a per-field error.
  if (schema.validations?.length) {
    for (const [field, message] of Object.entries(evalValidationRules(schema.validations, values))) {
      if (!errors[field]) errors[field] = message
    }
  }
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
    // A field hidden by its `when.visible` condition is left out entirely, so a
    // value the user can no longer see is never written back.
    if (!fieldState(f, values).visible) continue
    out[f.field] = coerceOut(f, values[f.field])
  }
  return out as Partial<TData>
}

/** The stable id of the row being edited, as a string (for `updateRow`). */
export function rowId<TData extends RowData>(schema: EntitySchema<TData>, row: TData): string {
  const idField = resolveIdField(schema)
  return String((row as RowData)[idField])
}
