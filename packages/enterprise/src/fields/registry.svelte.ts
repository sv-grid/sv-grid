/**
 * Field types: what a column IS (rating, URL, single select, attachment...),
 * as opposed to how it is edited. A type fills in the column (editor, format,
 * alignment) and can draw its own cell. Columns name one with `fieldType` and
 * set its properties with `fieldProps`.
 */
import type { Component } from 'svelte'
import { withSummary } from './summaries'

/** Props every field cell receives. `props` is the type's defaults merged with the column's `fieldProps`. */
export type FieldCellProps<P = Record<string, unknown>> = {
  ctrl: unknown
  row: { id: string; original: unknown }
  column: { id: string; columnDef: Record<string, unknown> }
  value: unknown
  props: P
}

/**
 * What a property's dynamic parts see: the grid, the draft's properties, every
 * other column, and the field's own names (key, id, saved header, draft name),
 * which its formula may not read.
 */
export type FieldEditorContext = { ctrl: any; props: Record<string, any>; columns: ReadonlyArray<Record<string, any>>; self?: ReadonlyArray<unknown> }

type Choices = ReadonlyArray<{ value: string; label: string }>
type Base = {
  key: string
  label: string
  /** Show the property only when this says so (e.g. decimal places for decimals). */
  visible?: (props: Record<string, any>) => boolean
  /** One line of help under the control. */
  hint?: string
  /** Other properties to change along with this one (a number format sets its usual precision). */
  alsoSets?: (value: unknown, props: Record<string, any>) => Record<string, unknown>
}

/** One property the field editor shows for a type. */
export type FieldPropertyDef = Base &
  (
    | { kind: 'number'; min?: number; max?: number }
    | { kind: 'text'; placeholder?: string }
    | { kind: 'checkbox' }
    | { kind: 'choice'; choices: Choices | ((ctx: FieldEditorContext) => Choices) }
    /** The same, drawn as a row of buttons. */
    | { kind: 'segmented'; choices: Choices }
    /** A color from a palette (hex values). */
    | { kind: 'color'; palette: ReadonlyArray<{ value: string; label: string }> }
    /** An icon from a set (SVG path data per icon). */
    | { kind: 'icon'; icons: ReadonlyArray<{ value: string; label: string; path: string }> }
    /** A list of select options with colors. */
    | { kind: 'options' }
    /** The value new rows get; the editor follows the field type. */
    | { kind: 'default' }
    /** A formula over the row's fields. */
    | { kind: 'formula' }
    /** Some of the grid's other columns. */
    | { kind: 'columns' }
  )

/** What a type is told when it fills in a column. */
export type FieldFillContext = { columns: ReadonlyArray<Record<string, any>> }

/** What a type is told when a row is added (row adder) or the field is created. */
export type FieldRowContext = { props: Record<string, any>; field: string; rows: ReadonlyArray<Record<string, unknown>> }

export type FieldTypeDef<P extends Record<string, unknown> = Record<string, unknown>> = {
  /** The name columns use in `fieldType`. */
  id: string
  /** Shown in the type picker. */
  label: string
  /** One line under the picker when the type is chosen. */
  description?: string
  /** An SVG path (24x24 viewBox) for the picker and the header. */
  icon?: string
  /** Group in the type picker. */
  group?: 'basic' | 'number' | 'date' | 'people' | 'computed' | 'relation'
  /** Property values a column gets when its `fieldProps` leave them out. */
  defaults?: P
  /**
   * Fill in the column: editor, format, alignment. Keep what the column set
   * itself (`def.editorType ?? ...`), so a column can still override a type.
   * `ctx.columns` is every column, for types that refer to other fields.
   */
  fill?: (def: Record<string, unknown>, props: P, ctx: FieldFillContext) => Record<string, unknown>
  /** Draws the cell. Without one, the grid draws the filled-in column as usual. */
  cell?: Component<FieldCellProps<P>>
  /** When `cell` draws (default: always). A percent field draws its own cell only as a bar. */
  hasCell?: (props: P) => boolean
  /** What the field editor lets a user set for this type. */
  properties?: ReadonlyArray<FieldPropertyDef>
  /** Column width a new field of this type starts with. */
  width?: number
  /** The value a new row gets (a default, the next number, the current time). */
  newRowValue?: (ctx: FieldRowContext) => unknown
  /** Values for every existing row when the field is created (autonumber, created time). */
  onCreate?: (ctx: FieldRowContext) => unknown[] | null
  /**
   * `false`: a duplicated record gets a new value from `newRowValue` instead
   * of a copy (the field's `default` when the type has no `newRowValue`).
   * For an id, a number or a stamp no two records should share.
   */
  copy?: false
  /**
   * A type kept for columns that already name it, and edited as another: the
   * field editor opens it as `type` with `props` on top of its own, and
   * leaves it out of the type picker.
   */
  editAs?: { type: string; props: Record<string, unknown> }
}

let types = $state.raw<Record<string, FieldTypeDef<any>>>({})

/** Add or replace a field type. */
export function registerFieldType<P extends Record<string, unknown>>(def: FieldTypeDef<P>): void {
  types = { ...types, [def.id]: def as FieldTypeDef<any> }
}

/** The type named `id`, or undefined. */
export function getFieldType(id: unknown): FieldTypeDef<any> | undefined {
  return typeof id === 'string' ? types[id] : undefined
}

/** Every registered type, in registration order. */
export function listFieldTypes(): FieldTypeDef<any>[] {
  return Object.values(types)
}

/** A column's effective properties: the type's defaults, then its own `fieldProps`. */
export function fieldPropsOf(def: { fieldType?: unknown; fieldProps?: Record<string, unknown> }): Record<string, unknown> {
  return { ...(getFieldType(def.fieldType)?.defaults ?? {}), ...(def.fieldProps ?? {}) }
}

// Each filled-in column -> the column it was filled from, so the field editor
// can hand the app back exactly what it declared. Kept twice: in a WeakMap,
// and on the filled column under a symbol, because the grid copies columns
// (`{ ...col }` when it resolves a data type) and a copy is not in the map;
// a spread carries symbol keys along, and JSON and Object.keys leave them out.
const ORIGINAL = new WeakMap<object, Record<string, unknown>>()
const SOURCE = Symbol('svgrid.fieldSource')

/** The column as the grid should see it, filled in by its type. Unknown types pass through. */
export function fillFieldColumn<T extends Record<string, unknown>>(def: T, columns: ReadonlyArray<Record<string, any>> = []): T & Record<string, unknown> {
  const type = getFieldType(def.fieldType)
  if (!type) return def
  const source = originalColumn(def) as Record<string, unknown>
  const props = fieldPropsOf(source)
  // A type without `fill` takes the column as declared, and still gets the rest.
  const filled = type.fill ? type.fill(source, props, { columns: columns.map((c) => originalColumn(c)) }) : { ...source }
  // The footer summary the field keeps in `fieldProps.summary` (none until picked).
  const out = withSummary(filled as T, props)
  ORIGINAL.set(out, source)
  ;(out as Record<symbol, unknown>)[SOURCE] = source
  return out
}

/** The column as it was declared, before its type filled it in. */
export function originalColumn<T extends object>(def: T): T {
  return ((def as Record<symbol, unknown>)[SOURCE] as T | undefined) ?? (ORIGINAL.get(def) as T | undefined) ?? def
}

/** Whether this column's type draws the cell itself (else the grid draws the filled-in column). */
export function typeDrawsCell(def: { fieldType?: unknown; fieldProps?: Record<string, unknown> }): boolean {
  const type = getFieldType(def.fieldType)
  if (!type?.cell) return false
  return type.hasCell ? type.hasCell(fieldPropsOf(def) as never) : true
}
