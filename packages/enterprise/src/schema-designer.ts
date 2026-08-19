/**
 * Schema-designer logic. The testable core behind `SvSchemaDesigner.svelte`:
 * immutable operations that edit an `EntitySchema` (add / remove / reorder /
 * retype fields, set the primary key), validation of the schema being designed,
 * and sample-row generation for the live grid preview.
 *
 * Pure (no Svelte, no DOM), mirroring the pivot-designer / edit-panel split.
 * Every mutation returns a NEW schema so Svelte reactivity and undo stay simple.
 */
import type { EntityField, EntityFieldType, EntitySchema } from './schema'
import { resolveIdField } from './schema'
import { generateRows } from './studio/sample-data'

/** All field types the designer offers, in menu order. */
export const FIELD_TYPES: ReadonlyArray<EntityFieldType> = [
  'text',
  'number',
  'boolean',
  'date',
  'dateString',
  'datetime',
  'enum',
  'relation',
  'json',
]

/** A fresh field with a name unique within the schema. */
export function blankField(schema: EntitySchema): EntityField {
  const taken = new Set(schema.fields.map((f) => f.field))
  let n = schema.fields.length + 1
  let name = `field${n}`
  while (taken.has(name)) name = `field${++n}`
  return { field: name, type: 'text' }
}

/** Append a field (a blank one when none is given). */
export function addField(schema: EntitySchema, field?: EntityField): EntitySchema {
  return { ...schema, fields: [...schema.fields, field ?? blankField(schema)] }
}

/** Remove a field by name. Clears `idField` if it pointed at the removed field. */
export function removeField(schema: EntitySchema, fieldName: string): EntitySchema {
  const fields = schema.fields.filter((f) => f.field !== fieldName)
  const idField = schema.idField === fieldName ? undefined : schema.idField
  return { ...schema, fields, idField }
}

/**
 * Patch a field by name. Setting `primaryKey: true` clears it on every other
 * field (a schema has at most one). Switching `type` drops now-irrelevant
 * `options` (leaving enum) / `relation` (leaving relation).
 */
export function updateField(
  schema: EntitySchema,
  fieldName: string,
  patch: Partial<EntityField>,
): EntitySchema {
  const makesPrimary = patch.primaryKey === true
  const fields = schema.fields.map((f) => {
    if (f.field !== fieldName) {
      return makesPrimary && f.primaryKey ? { ...f, primaryKey: false } : f
    }
    const next: EntityField = { ...f, ...patch }
    if (patch.type && patch.type !== f.type) {
      if (patch.type !== 'enum') delete next.options
      if (patch.type !== 'relation') delete next.relation
    }
    return next
  })
  return { ...schema, fields }
}

/** Move a field one slot up (`-1`) or down (`+1`). No-op at the ends. */
export function moveField(schema: EntitySchema, fieldName: string, dir: -1 | 1): EntitySchema {
  const i = schema.fields.findIndex((f) => f.field === fieldName)
  const j = i + dir
  if (i < 0 || j < 0 || j >= schema.fields.length) return schema
  const fields = [...schema.fields]
  const a = fields[i]!
  const b = fields[j]!
  fields[i] = b
  fields[j] = a
  return { ...schema, fields }
}

export type SchemaIssueLevel = 'error' | 'warning'
export type SchemaIssue = { level: SchemaIssueLevel; message: string; field?: string }

/**
 * Validate the schema under construction. Errors block code generation;
 * warnings are advisory. Covers: at least one field, unique field names, a
 * resolvable primary key, enums with options, and complete relations.
 */
export function validateSchema(schema: EntitySchema): SchemaIssue[] {
  const issues: SchemaIssue[] = []

  if (schema.fields.length === 0) {
    issues.push({ level: 'error', message: 'Add at least one field.' })
  }

  const seen = new Set<string>()
  for (const f of schema.fields) {
    if (!f.field.trim()) {
      issues.push({ level: 'error', message: 'A field has an empty name.' })
    } else if (seen.has(f.field)) {
      issues.push({ level: 'error', message: `Duplicate field name "${f.field}".`, field: f.field })
    }
    seen.add(f.field)

    if (f.type === 'enum' && (!f.options || f.options.length === 0)) {
      issues.push({ level: 'warning', message: `Enum "${f.field}" has no options.`, field: f.field })
    }
    if (f.type === 'relation' && (!f.relation?.entity || !f.relation?.labelField)) {
      issues.push({
        level: 'warning',
        message: `Relation "${f.field}" needs a related entity and label field.`,
        field: f.field,
      })
    }
  }

  try {
    resolveIdField(schema)
  } catch {
    issues.push({
      level: 'error',
      message: 'No primary key: flag a field as primary key, set idField, or name a field "id".',
    })
  }

  return issues
}

/** True when the schema has no error-level issues (warnings are allowed). */
export function isSchemaValid(schema: EntitySchema): boolean {
  return !validateSchema(schema).some((i) => i.level === 'error')
}

/** Deterministic, realistic sample rows for the designer's grid preview. */
export function sampleRows(schema: EntitySchema, count = 3): Array<Record<string, unknown>> {
  return generateRows(schema.fields, count)
}
