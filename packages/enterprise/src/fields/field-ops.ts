/**
 * What the field editor and the column menu do to a grid: add, edit, insert,
 * duplicate and delete a field. They work on the grid's own columns and rows
 * and report each change (onColumnAdd / onColumnChange / onColumnRemove) so
 * the app can store its schema; the grid keeps none.
 *
 * A column the app hands over keeps its plain shape here: `id`, `field`,
 * `header`, `width`, `fieldType`, `fieldProps`, `description`. What a type fills
 * in (editor, format, alignment...) is recomputed from that on every change.
 */
import { convertValue, countCleared, keepsStoredValues, optionsFromValues } from './convert'
import { renameFormulaRefs } from './formula'
import { fieldPropsOf, fillFieldColumn, getFieldType, originalColumn } from './registry.svelte'
import { getLinkedTable, linkedRows } from './sources.svelte'

type Def = Record<string, unknown> & { id?: string; field?: string; header?: unknown; fieldType?: string; fieldProps?: Record<string, unknown> }
type Ctrl = {
  props: Record<string, any>
  internalColumns: Def[]
  internalData: Record<string, unknown>[]
  buildApi?: () => { setColumnVisible?: (id: string, visible: boolean) => void }
  scrollContainer?: HTMLElement | null
}

/** Keys a field type fills in. A type change drops them from the declared column too, so the new type's take. */
const FILLED = ['editorType', 'cellDataType', 'format', 'align', 'editorOptions', 'editorMultiple', 'formatter', 'valueParser'] as const

export type FieldDraft = { name: string; fieldType: string; fieldProps: Record<string, unknown>; description?: string }

export const defId = (d: Def) => String(d.id ?? d.field ?? '')

/** The column as the app declared it, without what its type filled in. */
export function plainDef(d: Def): Def {
  return { ...originalColumn(d) }
}

/** The declared columns after a change: what every field event hands the app. */
export const plainColumns = (ctrl: Ctrl): Def[] => ctrl.internalColumns.map((d) => plainDef(d))

/** A new column id from a name: lower-case words, unique among the grid's columns. */
export function uniqueId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field'
  let id = base
  for (let i = 2; used.has(id); i++) id = `${base}_${i}`
  return id
}

/** Whether `name` is free: no other column has that header (case-insensitive). */
export function nameTaken(ctrl: Ctrl, name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase()
  return ctrl.internalColumns.some((d) => defId(d) !== exceptId && String(d.header ?? '').trim().toLowerCase() === n)
}

function cleanProps(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0 && k !== 'options')) out[k] = v
  return out
}

/**
 * Fill every field column again against `cols`: a formula, lookup or button
 * that names another field must see a renamed, added or removed one.
 */
function refill(cols: Def[]): Def[] {
  return cols.map((c) => (originalColumn(c).fieldType ? fillFieldColumn(originalColumn(c), cols) : c))
}

/**
 * Scroll the grid sideways, and only the grid, until a column just added is
 * in view: one added past the right edge would otherwise go unseen.
 */
function revealColumn(ctrl: Ctrl, id: string): void {
  if (typeof requestAnimationFrame !== 'function') return
  requestAnimationFrame(() => {
    const sc = ctrl.scrollContainer
    // `id` comes from uniqueId: [a-z0-9_] only, safe in a selector as is.
    const th = sc?.querySelector<HTMLElement>(`[data-svgrid-header-col="${id}"]`)
    if (!sc || !th) return
    const box = sc.getBoundingClientRect()
    const r = th.getBoundingClientRect()
    const right = box.left + sc.clientWidth
    if (r.right > right) sc.scrollLeft += Math.min(r.right - right, r.left - box.left)
    else if (r.left < box.left) sc.scrollLeft -= box.left - r.left
  })
}

function insertAt(cols: Def[], def: Def, index: number | 'end'): Def[] {
  const next = cols.slice()
  next.splice(index === 'end' ? next.length : Math.max(0, Math.min(index, next.length)), 0, def)
  return next
}

/** Add a field from the editor. Returns the plain column. */
export function addField(ctrl: Ctrl, draft: FieldDraft, index: number | 'end' = 'end'): Def {
  const id = uniqueId(draft.name, ctrl.internalColumns.map(defId))
  const type = getFieldType(draft.fieldType)
  const def: Def = {
    id,
    field: id,
    header: draft.name.trim(),
    width: type?.width ?? 150,
    fieldType: draft.fieldType,
    fieldProps: cleanProps(draft.fieldProps),
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
  }
  // Autonumber and created time give every existing row its value now.
  let data: Record<string, unknown>[] | undefined
  const values = type?.onCreate?.({ props: fieldPropsOf(def), field: id, rows: ctrl.internalData })
  if (values) {
    data = ctrl.internalData.map((r, i) => (r == null ? r : { ...r, [id]: values[i] }))
    ctrl.internalData = data
  }
  ctrl.internalColumns = refill(insertAt(ctrl.internalColumns, def, index))
  ctrl.props.onColumnAdd?.({ column: def, columns: plainColumns(ctrl), ...(data ? { data } : {}) })
  revealColumn(ctrl, id)
  return def
}

let seq = 0
/** A new record id: "rec" and nine letters and digits, unique in this page. */
export function newRecordId(): string {
  seq = (seq + 1) % 1296
  return `rec${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}${seq.toString(36).padStart(2, '0')}`
}

/**
 * The values a new row gets from its field columns: each type's newRowValue
 * (the next autonumber, the created time, today), else the field's default.
 * `base` (the row adder's own defaults) wins over both.
 */
export function newRowValues(ctrl: Ctrl, base: Record<string, unknown> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const c of ctrl.internalColumns) {
    const plain = originalColumn(c)
    if (!plain.fieldType || !c.field) continue
    const field = String(c.field)
    const props = fieldPropsOf(plain)
    const fromType = getFieldType(plain.fieldType)?.newRowValue?.({ props, field, rows: ctrl.internalData })
    const value = fromType !== undefined ? fromType : props.default
    if (value !== undefined) row[field] = Array.isArray(value) ? value.slice() : value
  }
  // A table whose records carry an id (a base, or rows keyed with getRowId on
  // `id`) needs one on the new record too, or two new records share a key.
  if (!('id' in base) && (ctrl.internalData ?? []).some((r) => r && typeof r === 'object' && 'id' in r)) row.id = newRecordId()
  return { ...row, ...base }
}

/** Built-in fields a copy of a record gets fresh, never copied: its number, when and by whom it was made. */
const STAMPED = new Set(['autoNumber', 'createdTime', 'createdBy', 'lastModifiedTime', 'lastModifiedBy'])

/** Whether a duplicate gets this field fresh: a built-in stamp, or a type registered with `copy: false`. */
const freshOnCopy = (fieldType: unknown) => STAMPED.has(String(fieldType)) || getFieldType(fieldType)?.copy === false

/**
 * The values a duplicate of `row` starts with: its stored fields, lists
 * copied, without its id or what is stamped on a new record (a type with
 * `copy: false`). Give them to `newRowValues` for the rest.
 */
export function recordCopyValues(ctrl: Ctrl, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of ctrl.internalColumns) {
    const plain = originalColumn(c)
    if (!c.field || (c as Def).fieldFn || plain.fieldFn || freshOnCopy(plain.fieldType)) continue
    const v = row[String(c.field)]
    if (v !== undefined) out[String(c.field)] = Array.isArray(v) ? v.slice() : v
  }
  return out
}

/**
 * A field's values as a type change converts them: what a formula, lookup,
 * rollup or count works out (its records store nothing), a link's records by
 * their primary field (names, not record ids), else what the records store.
 */
function valuesToConvert(ctrl: Ctrl, filled: Def, to: string): unknown[] {
  const field = String(filled.field)
  const stored = ctrl.internalData.map((r) => r?.[field])
  if (keepsStoredValues(to)) return stored
  const plain = originalColumn(filled)
  // Filled again against today's fields, so the values are the ones shown now.
  const fn = (plain.fieldType ? fillFieldColumn(plain, ctrl.internalColumns) : filled).fieldFn
  if (typeof fn === 'function') {
    // A formula that does not compile has nothing to keep.
    return ctrl.internalData.map((r) => {
      if (r == null) return undefined
      const v = (fn as (row: Record<string, unknown>) => unknown)(r)
      return v === '#ERROR' ? null : v
    })
  }
  if (plain.fieldType === 'link' && to !== 'link') {
    const table = getLinkedTable(fieldPropsOf(plain).table)
    if (table) return stored.map((v) => linkedRows(table, v).map((r) => r[table.primaryField]).filter((x) => x != null && x !== ''))
  }
  return stored
}

/** What changing `columnId` to `draft` would clear: cells not empty now, empty after. */
export function previewChange(ctrl: Ctrl, columnId: string, draft: FieldDraft): number {
  const prev = ctrl.internalColumns.find((d) => defId(d) === columnId)
  if (!prev || prev.fieldType === draft.fieldType || !prev.field) return 0
  return countCleared(valuesToConvert(ctrl, prev, draft.fieldType), prev.fieldType, draft.fieldType, cleanProps(draft.fieldProps))
}

/**
 * Other formulas of the table after a field's header changes from `from` to
 * `to`: each `{from}` that named the field now reads `{to}`. A `{field key}`
 * reference needs nothing, a rename leaves the key as it was.
 */
function renameInFormulas(cols: Def[], field: string, from: string, to: string): Def[] {
  const old = from.trim().toLowerCase()
  if (!old || old === to.trim().toLowerCase()) return cols
  return cols.map((c) => {
    const plain = originalColumn(c)
    if (plain.fieldType !== 'formula' || String(plain.field ?? plain.id) === field) return c
    const src = String(plain.fieldProps?.formula ?? '')
    const next = renameFormulaRefs(src, (name) => (name.trim().toLowerCase() === old ? to : null))
    return next === src ? c : { ...plain, fieldProps: { ...plain.fieldProps, formula: next } }
  })
}

/** Apply the editor's draft to an existing field; converts values when the type changes. */
export function updateField(ctrl: Ctrl, columnId: string, draft: FieldDraft): Def | null {
  const index = ctrl.internalColumns.findIndex((d) => defId(d) === columnId)
  if (index < 0) return null
  const previous = plainDef(ctrl.internalColumns[index]!)
  const typeChanged = previous.fieldType !== draft.fieldType
  const fieldProps = cleanProps(draft.fieldProps)
  let data: Record<string, unknown>[] | undefined
  if (typeChanged && previous.field) {
    const field = String(previous.field)
    const before = valuesToConvert(ctrl, ctrl.internalColumns[index]!, draft.fieldType)
    data = ctrl.internalData.map((r, i) =>
      r == null ? r : { ...r, [field]: convertValue(before[i], previous.fieldType, draft.fieldType, fieldProps) },
    )
    // A select made from other values starts with those values as its options.
    if ((draft.fieldType === 'singleSelect' || draft.fieldType === 'multiSelect') && !(fieldProps.options as unknown[] | undefined)?.length) {
      fieldProps.options = optionsFromValues(data.map((r) => r?.[field]))
    }
  }
  const base: Def = { ...previous }
  if (typeChanged) for (const k of FILLED) delete base[k]
  const next: Def = { ...base, header: draft.name.trim(), fieldType: draft.fieldType, fieldProps }
  if (draft.description?.trim()) next.description = draft.description.trim()
  else delete next.description
  let cols = ctrl.internalColumns.slice()
  cols[index] = next
  // A rename carries over to the formulas that name the field by its header.
  if (typeof previous.header === 'string' && previous.field) cols = renameInFormulas(cols, String(previous.field), previous.header, String(next.header))
  ctrl.internalColumns = refill(cols)
  if (data) ctrl.internalData = data
  ctrl.props.onColumnChange?.({ column: next, previous, columns: plainColumns(ctrl), ...(data ? { data } : {}) })
  return next
}

/**
 * Add choices to a select field, as typing a new value into its cell does.
 * Options already there (same value) are skipped; fires onColumnChange.
 */
export function addSelectOptions(ctrl: Ctrl, columnId: string, added: ReadonlyArray<{ value: string; color?: string }>): Def | null {
  const index = ctrl.internalColumns.findIndex((d) => defId(d) === columnId)
  if (index < 0 || !added.length) return null
  const previous = plainDef(ctrl.internalColumns[index]!)
  const options = Array.isArray(previous.fieldProps?.options) ? (previous.fieldProps!.options as Array<{ value: unknown }>).slice() : []
  const have = new Set(options.map((o) => String(o.value)))
  for (const o of added) {
    if (have.has(o.value)) continue
    have.add(o.value)
    options.push({ ...o })
  }
  const next: Def = { ...previous, fieldProps: { ...previous.fieldProps, options } }
  const cols = ctrl.internalColumns.slice()
  cols[index] = next
  ctrl.internalColumns = refill(cols)
  ctrl.props.onColumnChange?.({ column: next, previous, columns: plainColumns(ctrl) })
  return next
}

/**
 * The summary a field shows in the footer row (`fieldProps.summary`, from
 * the footer's picker; 'none' clears it). Fires onColumnChange.
 */
export function setFieldSummary(ctrl: Ctrl, columnId: string, kind: string): Def | null {
  const index = ctrl.internalColumns.findIndex((d) => defId(d) === columnId)
  if (index < 0) return null
  const previous = plainDef(ctrl.internalColumns[index]!)
  const fieldProps: Record<string, unknown> = { ...previous.fieldProps }
  if (kind === 'none') delete fieldProps.summary
  else fieldProps.summary = kind
  const next: Def = { ...previous, fieldProps }
  const cols = ctrl.internalColumns.slice()
  cols[index] = next
  ctrl.internalColumns = refill(cols)
  ctrl.props.onColumnChange?.({ column: next, previous, columns: plainColumns(ctrl) })
  return next
}

/** A copy of a field, values included, right after it. */
export function duplicateField(ctrl: Ctrl, columnId: string): Def | null {
  const index = ctrl.internalColumns.findIndex((d) => defId(d) === columnId)
  if (index < 0) return null
  const source = plainDef(ctrl.internalColumns[index]!)
  const header = `${String(source.header ?? columnId)} copy`
  const id = uniqueId(header, ctrl.internalColumns.map(defId))
  const def: Def = { ...source, id, field: id, header }
  let data: Record<string, unknown>[] | undefined
  if (source.field) {
    const from = String(source.field)
    data = ctrl.internalData.map((r) => (r == null ? r : { ...r, [id]: structuredCloneSafe(r[from]) }))
    ctrl.internalData = data
  }
  ctrl.internalColumns = refill(insertAt(ctrl.internalColumns, def, index + 1))
  ctrl.props.onColumnAdd?.({ column: def, columns: plainColumns(ctrl), ...(data ? { data } : {}) })
  revealColumn(ctrl, id)
  return def
}

/** Remove a field's column (its values stay in the rows). */
export function removeField(ctrl: Ctrl, columnId: string): void {
  ctrl.internalColumns = refill(ctrl.internalColumns.filter((d) => defId(d) !== columnId))
  ctrl.props.onColumnRemove?.({ columnId, columns: plainColumns(ctrl) })
}

export function hideField(ctrl: Ctrl, columnId: string): void {
  ctrl.buildApi?.()?.setColumnVisible?.(columnId, false)
}

/** The index a field inserted next to `columnId` goes to. */
export function indexBeside(ctrl: Ctrl, columnId: string, side: 'left' | 'right'): number {
  const i = ctrl.internalColumns.findIndex((d) => defId(d) === columnId)
  return i < 0 ? ctrl.internalColumns.length : side === 'left' ? i : i + 1
}

function structuredCloneSafe<T>(v: T): T {
  if (v == null || typeof v !== 'object') return v
  try {
    return structuredClone(v)
  } catch {
    return Array.isArray(v) ? (v.slice() as T) : ({ ...(v as object) } as T)
  }
}
